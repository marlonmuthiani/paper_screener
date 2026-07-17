import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

const MAX_CONTEXT_CHARS = 150_000;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 20_000;

const SYSTEM_PROMPT = `You are the explanation engine inside Marginalia, a reading tool for dense mathematical and quantitative papers. The reader highlights a passage they don't fully understand, and you explain that exact passage in the context of the paper they are reading.

The full text of the paper, extracted from the PDF, is provided between <paper> tags. Use it to resolve notation, recall definitions introduced earlier, and understand where the highlighted passage sits in the overall argument. Extraction mangles equations — reconstruct the intended mathematics from context and never comment on the garbling.

When the reader highlights a passage (marked between <<< and >>>), respond with exactly three sections under these markdown headings:

### Notation
What each symbol, term, or piece of notation in the passage means, resolved against the paper's own definitions.

### Intuition
What is really going on here, in plain language. What role this passage plays in the paper's argument.

### The step
How this line follows from what came before — the actual mechanism of the derivation, identity, or claim.

Rules:
- Write all mathematics in LaTeX: $...$ inline, $$...$$ for display equations.
- Be tight. No preamble, no restating the question, no filler. Aim for under 220 words total in plain mode; rigorous mode may run longer but never pads.
- Mode "plain": minimal jargon, favor analogy and mechanism over formality.
- Mode "rigorous": precise technical language, exact hypotheses, name the theorems and techniques involved.
- For follow-up questions, answer directly and conversationally — no section headings — but keep using LaTeX for math.
- If the passage is prose rather than mathematics, adapt the sections naturally: Notation covers terminology, The step covers how the claim is supported.`;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

type Validation =
  | { ok: true; context: string; messages: IncomingMessage[] }
  | { ok: false; error: string };

function validate(body: unknown): Validation {
  const invalid = { ok: false as const, error: "Invalid request." };
  if (!body || typeof body !== "object") return invalid;
  const { context, messages } = body as {
    context?: unknown;
    messages?: unknown;
  };
  if (typeof context !== "string") return invalid;
  if (!Array.isArray(messages) || messages.length === 0) return invalid;
  if (messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error:
        "This thread has reached its length limit — highlight the passage again to start a fresh one.",
    };
  }
  for (const m of messages) {
    if (!m || typeof m !== "object") return invalid;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return invalid;
    if (typeof content !== "string" || content.length === 0) return invalid;
    if (content.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        error:
          "A message in this thread is too long — highlight a shorter passage or ask a shorter question.",
      };
    }
  }
  return {
    ok: true,
    context: context.slice(0, MAX_CONTEXT_CHARS),
    messages: messages as IncomingMessage[],
  };
}

export async function POST(req: Request) {
  let parsed: Validation;
  try {
    parsed = validate(await req.json());
  } catch {
    parsed = { ok: false, error: "Invalid request." };
  }
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const sse = await client.messages.create(
      {
        model: "claude-opus-4-8",
        max_tokens: 8000,
        stream: true,
        system: [
          { type: "text", text: SYSTEM_PROMPT },
          {
            type: "text",
            text: `<paper>\n${parsed.context}\n</paper>`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: parsed.messages,
      },
      { signal: req.signal },
    );

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let hitMaxTokens = false;
        try {
          for await (const event of sse) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            } else if (
              event.type === "message_delta" &&
              event.delta.stop_reason === "max_tokens"
            ) {
              hitMaxTokens = true;
            }
          }
          if (hitMaxTokens) {
            controller.enqueue(
              encoder.encode(
                "\n\n---\n*The answer hit its length limit and was cut off — ask a follow-up to continue.*",
              ),
            );
          }
          controller.close();
        } catch {
          // Headers are already sent; surface the interruption as text so
          // the reader isn't left with a silently truncated answer.
          try {
            controller.enqueue(
              encoder.encode(
                "\n\n---\n*The stream was interrupted before the answer finished — ask again to continue.*",
              ),
            );
            controller.close();
          } catch {
            // The client already disconnected — nothing left to do.
          }
        }
      },
      cancel() {
        // Client went away — stop the upstream generation too.
        sse.controller.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Could not resolve authentication")
    ) {
      return Response.json(
        {
          error:
            "No Anthropic API key configured. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
        },
        { status: 401 },
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json(
        {
          error:
            "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local and restart the dev server.",
        },
        { status: 401 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "Rate limited — wait a moment and try again." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return Response.json(
        {
          error:
            "Couldn't reach the Claude API — check your internet connection and try again.",
        },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: `Claude API error (${err.status}): ${err.message}` },
        { status: 500 },
      );
    }
    return Response.json(
      { error: "Something went wrong reaching the Claude API." },
      { status: 500 },
    );
  }
}
