"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Depth, Highlight } from "@/lib/types";
import Markdown from "./Markdown";

// Keep a margin below the server-side message cap so a thread never
// becomes permanently unsendable.
const MAX_THREAD_MESSAGES = 36;
const MAX_QUESTION_CHARS = 4000;

function snippet(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function DepthToggle({
  depth,
  disabled,
  onSwitch,
}: {
  depth: Depth;
  disabled: boolean;
  onSwitch: (d: Depth) => void;
}) {
  return (
    <div className="flex border border-hairline">
      {(["plain", "rigorous"] as const).map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onSwitch(d)}
          className={`overline-label px-3 py-1.5 transition-colors disabled:cursor-not-allowed ${
            depth === d
              ? "bg-ink text-paper"
              : "text-ink-faint hover:text-ink disabled:hover:text-ink-faint"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function Conversation({ highlight }: { highlight: Highlight }) {
  const { retryLast } = useStore();
  const streaming = highlight.status === "streaming";
  const lastIndex = highlight.messages.length - 1;
  const waitingForFirstToken =
    streaming && highlight.messages[lastIndex]?.role === "user";

  return (
    <div className="flex flex-col gap-5">
      {highlight.messages.map((message, i) => {
        if (i === 0) return null; // the initial ask is shown as the quote block
        if (message.role === "user") {
          return (
            <p
              key={i}
              className="ml-6 border-r-2 border-hairline pr-3 text-right font-serif text-[0.95rem] italic leading-relaxed text-ink-soft"
            >
              {message.content}
            </p>
          );
        }
        // The caret belongs only to an answer that is actively being written.
        const isStreamingThis = streaming && i === lastIndex;
        return (
          <div key={i} className={isStreamingThis ? "stream-caret" : undefined}>
            <Markdown>{message.content}</Markdown>
          </div>
        );
      })}

      {waitingForFirstToken && (
        <p className="overline-label stream-caret text-ink-faint">
          {highlight.messages.length <= 1 ? "Reading the paper" : "Writing"}
        </p>
      )}

      {highlight.status === "error" && (
        <div className="border border-accent/40 bg-accent-wash px-4 py-3">
          <p className="text-sm leading-relaxed text-accent-deep">
            {highlight.error}
          </p>
          <button
            type="button"
            onClick={retryLast}
            className="overline-label mt-2 text-accent underline underline-offset-4 hover:text-accent-deep"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export default function ExplainPanel({
  onJumpToPage,
}: {
  onJumpToPage: (page: number) => void;
}) {
  const {
    highlights,
    activeId,
    panelOpen,
    panelView,
    setPanelOpen,
    setPanelView,
    setActiveId,
    askFollowUp,
    switchDepth,
  } = useStore();

  const [question, setQuestion] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = highlights.find((h) => h.id === activeId) ?? null;
  const streaming = active?.status === "streaming";
  const threadFull = (active?.messages.length ?? 0) >= MAX_THREAD_MESSAGES;

  // Follow the stream — but only in the detail view, and only while the
  // reader is already at the bottom (scrolling up opts out).
  const lastLength =
    active?.messages[active.messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    if (!streaming || panelView !== "detail") return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [streaming, lastLength, panelView]);

  const submitFollowUp = () => {
    const q = question.trim();
    if (!q || streaming || threadFull) return;
    askFollowUp(q);
    setQuestion("");
  };

  return (
    <div
      inert={!panelOpen}
      className={`h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        panelOpen ? "w-[min(420px,100vw)]" : "w-0"
      }`}
      aria-hidden={!panelOpen}
    >
      <aside className="flex h-full w-[min(420px,100vw)] flex-col border-l border-hairline bg-panel">
      {/* header */}
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="overline-label text-ink">
            {panelView === "list" ? "Highlights" : "In the margin"}
          </span>
          {highlights.length > 1 && panelView === "detail" && (
            <button
              type="button"
              onClick={() => setPanelView("list")}
              className="overline-label text-accent hover:text-accent-deep"
            >
              ◂ {highlights.length} highlights
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {active && panelView === "detail" && (
            <DepthToggle
              depth={active.depth}
              disabled={!!streaming}
              onSwitch={switchDepth}
            />
          )}
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setPanelOpen(false)}
            className="font-serif text-xl leading-none text-ink-faint hover:text-ink"
          >
            ×
          </button>
        </div>
      </div>

      {panelView === "list" ? (
        <div className="styled-scroll flex-1 overflow-y-auto">
          <ul>
            {[...highlights].reverse().map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(h.id);
                    setPanelView("detail");
                    onJumpToPage(h.page);
                  }}
                  className={`block w-full border-b border-hairline-soft px-5 py-4 text-left transition-colors hover:bg-accent-wash ${
                    h.id === activeId ? "bg-accent-wash" : ""
                  }`}
                >
                  <span className="font-serif text-[0.95rem] italic leading-snug text-ink">
                    “{snippet(h.text)}”
                  </span>
                  <span className="overline-label mt-2 block text-ink-faint">
                    p. {h.page}
                    {h.status === "streaming" && " — writing…"}
                    {h.status === "error" && " — failed"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : active ? (
        <>
          <div
            ref={scrollRef}
            className="styled-scroll flex-1 overflow-y-auto overflow-x-hidden px-5 py-5"
          >
            {/* the highlighted passage */}
            <blockquote className="mb-5 border-l-2 border-accent pl-4">
              <p className="font-serif text-[0.95rem] italic leading-relaxed text-ink">
                “{snippet(active.text, 260)}”
              </p>
              <button
                type="button"
                onClick={() => onJumpToPage(active.page)}
                className="overline-label mt-2 text-ink-faint hover:text-accent"
              >
                p. {active.page} — jump to it
              </button>
            </blockquote>

            <Conversation highlight={active} />
          </div>

          {/* follow-up */}
          <div className="border-t border-hairline px-5 py-4">
            <div className="flex items-end gap-3">
              <textarea
                rows={1}
                value={question}
                disabled={threadFull}
                maxLength={MAX_QUESTION_CHARS}
                placeholder={
                  threadFull
                    ? "Thread limit reached — highlight the passage again to continue"
                    : "Ask a follow-up about this passage"
                }
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitFollowUp();
                  }
                }}
                className="max-h-28 flex-1 resize-none bg-transparent font-serif text-[0.95rem] italic leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={submitFollowUp}
                disabled={streaming || threadFull || !question.trim()}
                className="overline-label border border-hairline px-3 py-2 text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-8 text-center">
          <p className="font-serif italic text-ink-faint">
            Highlight a passage in the paper to see it explained here.
          </p>
        </div>
      )}
      </aside>
    </div>
  );
}
