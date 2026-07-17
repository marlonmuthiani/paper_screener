"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatMessage, Depth, Highlight } from "./types";
import { depthSwitchAsk, initialAsk } from "./prompts";

const MAX_CONTEXT_CHARS = 150_000;
const CONTEXT_WAIT_MS = 15_000;

interface PaperState {
  id: number;
  file: File;
  name: string;
}

interface StoreValue {
  paper: PaperState | null;
  openPaper: (file: File) => void;
  closePaper: () => void;
  setPageTexts: (texts: string[]) => void;

  highlights: Highlight[];
  activeId: string | null;
  panelOpen: boolean;
  panelView: "detail" | "list";
  setPanelOpen: (open: boolean) => void;
  setPanelView: (view: "detail" | "list") => void;
  setActiveId: (id: string) => void;

  explainSelection: (text: string, page: number) => void;
  askFollowUp: (question: string) => void;
  switchDepth: (depth: Depth) => void;
  retryLast: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

async function streamExplanation(
  body: { context: string; messages: ChatMessage[] },
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status}).`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelView, setPanelView] = useState<"detail" | "list">("detail");

  const contextRef = useRef<string | null>(null);
  const contextResolvers = useRef<((ctx: string) => void)[]>([]);
  // Bumped whenever the paper changes; in-flight work from an older
  // generation is abandoned instead of mixing papers.
  const paperGenRef = useRef(0);
  const abortersRef = useRef(new Map<string, AbortController>());

  const resetForPaperChange = useCallback(() => {
    paperGenRef.current += 1;
    for (const aborter of abortersRef.current.values()) aborter.abort();
    abortersRef.current.clear();
    contextRef.current = null;
    contextResolvers.current = [];
    setHighlights([]);
    setActiveId(null);
    setPanelOpen(false);
    setPanelView("detail");
  }, []);

  const openPaper = useCallback(
    (file: File) => {
      resetForPaperChange();
      setPaper({
        id: Date.now(),
        file,
        name: file.name.replace(/\.pdf$/i, ""),
      });
    },
    [resetForPaperChange],
  );

  const closePaper = useCallback(() => {
    resetForPaperChange();
    setPaper(null);
  }, [resetForPaperChange]);

  const setPageTexts = useCallback((texts: string[]) => {
    const joined = texts
      .map((t, i) => `[Page ${i + 1}]\n${t}`)
      .join("\n\n")
      .slice(0, MAX_CONTEXT_CHARS);
    contextRef.current = joined;
    for (const resolve of contextResolvers.current) resolve(joined);
    contextResolvers.current = [];
  }, []);

  const waitForContext = useCallback((): Promise<string> => {
    if (contextRef.current !== null) return Promise.resolve(contextRef.current);
    const gen = paperGenRef.current;
    return new Promise((resolve) => {
      contextResolvers.current.push(resolve);
      setTimeout(() => {
        // Only fall back to the current context if the paper hasn't
        // changed in the meantime.
        resolve(gen === paperGenRef.current ? (contextRef.current ?? "") : "");
      }, CONTEXT_WAIT_MS);
    });
  }, []);

  const patchHighlight = useCallback(
    (id: string, patch: (h: Highlight) => Highlight) => {
      setHighlights((hs) => hs.map((h) => (h.id === id ? patch(h) : h)));
    },
    [],
  );

  const run = useCallback(
    async (id: string, messages: ChatMessage[]) => {
      const gen = paperGenRef.current;
      patchHighlight(id, (h) => ({
        ...h,
        messages,
        status: "streaming",
        error: undefined,
      }));
      const aborter = new AbortController();
      abortersRef.current.set(id, aborter);
      try {
        const context = await waitForContext();
        if (gen !== paperGenRef.current) return; // paper changed mid-wait
        let started = false;
        await streamExplanation(
          { context, messages },
          (chunk) => {
            patchHighlight(id, (h) => {
              const msgs = [...h.messages];
              const last = msgs[msgs.length - 1];
              if (started && last?.role === "assistant") {
                msgs[msgs.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
              } else {
                msgs.push({ role: "assistant", content: chunk });
              }
              return { ...h, messages: msgs };
            });
            started = true;
          },
          aborter.signal,
        );
        patchHighlight(id, (h) => ({ ...h, status: "done" }));
      } catch (err) {
        if (aborter.signal.aborted) return; // paper closed — highlight is gone
        patchHighlight(id, (h) => ({
          ...h,
          status: "error",
          error: err instanceof Error ? err.message : "Something went wrong.",
        }));
      } finally {
        abortersRef.current.delete(id);
      }
    },
    [patchHighlight, waitForContext],
  );

  const explainSelection = useCallback(
    (text: string, page: number) => {
      const id = `hl-${Date.now()}-${highlights.length}`;
      const depth: Depth = "plain";
      const messages: ChatMessage[] = [
        { role: "user", content: initialAsk(text, page, depth) },
      ];
      const highlight: Highlight = {
        id,
        text,
        page,
        createdAt: Date.now(),
        depth,
        messages,
        status: "streaming",
      };
      setHighlights((hs) => [...hs, highlight]);
      setActiveId(id);
      setPanelOpen(true);
      setPanelView("detail");
      void run(id, messages);
    },
    [highlights.length, run],
  );

  const askFollowUp = useCallback(
    (question: string) => {
      const h = highlights.find((x) => x.id === activeId);
      if (!h || h.status === "streaming") return;
      const messages: ChatMessage[] = [
        ...h.messages,
        { role: "user", content: question },
      ];
      void run(h.id, messages);
    },
    [activeId, highlights, run],
  );

  const switchDepth = useCallback(
    (depth: Depth) => {
      const h = highlights.find((x) => x.id === activeId);
      if (!h || h.status === "streaming" || h.depth === depth) return;
      patchHighlight(h.id, (x) => ({ ...x, depth }));
      const messages: ChatMessage[] = [
        ...h.messages,
        { role: "user", content: depthSwitchAsk(depth) },
      ];
      void run(h.id, messages);
    },
    [activeId, highlights, patchHighlight, run],
  );

  const retryLast = useCallback(() => {
    const h = highlights.find((x) => x.id === activeId);
    if (!h || h.status !== "error") return;
    // Drop a trailing partial assistant message, keep the user ask, re-run.
    const messages =
      h.messages[h.messages.length - 1]?.role === "assistant"
        ? h.messages.slice(0, -1)
        : h.messages;
    void run(h.id, messages);
  }, [activeId, highlights, run]);

  const value = useMemo<StoreValue>(
    () => ({
      paper,
      openPaper,
      closePaper,
      setPageTexts,
      highlights,
      activeId,
      panelOpen,
      panelView,
      setPanelOpen,
      setPanelView,
      setActiveId,
      explainSelection,
      askFollowUp,
      switchDepth,
      retryLast,
    }),
    [
      paper,
      openPaper,
      closePaper,
      setPageTexts,
      highlights,
      activeId,
      panelOpen,
      panelView,
      explainSelection,
      askFollowUp,
      switchDepth,
      retryLast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
