"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import ExplainPanel from "./ExplainPanel";
import ThemeToggle from "./ThemeToggle";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-1 items-center justify-center bg-paper-deep">
      <span className="overline-label text-ink-faint">Preparing the reader…</span>
    </div>
  ),
});

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

export default function Reader() {
  const {
    paper,
    closePaper,
    setPageTexts,
    explainSelection,
    highlights,
    panelOpen,
    setPanelOpen,
  } = useStore();

  const [zoom, setZoom] = useState(1);

  const jumpToPage = useCallback((page: number) => {
    document
      .querySelector(`[data-marginalia-page="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!paper) return null;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      {/* toolbar */}
      <header className="flex items-center justify-between gap-6 border-b border-hairline bg-paper px-6 py-3">
        <div className="flex min-w-0 items-baseline gap-5">
          <span className="shrink-0 font-serif text-lg italic tracking-tight">
            Marginalia
          </span>
          <span className="hidden truncate font-serif text-[0.95rem] italic text-ink-soft md:block">
            {paper.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <div className="flex items-center gap-1 border border-hairline">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() =>
                setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(1)))
              }
              className="px-2.5 py-1 font-mono text-sm text-ink-soft hover:text-ink"
            >
              −
            </button>
            <span className="overline-label w-12 text-center text-ink-faint">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() =>
                setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(1)))
              }
              className="px-2.5 py-1 font-mono text-sm text-ink-soft hover:text-ink"
            >
              +
            </button>
          </div>

          <ThemeToggle />

          {!panelOpen && highlights.length > 0 && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="overline-label border border-hairline px-3 py-2 text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Margin ({highlights.length})
            </button>
          )}

          <button
            type="button"
            onClick={closePaper}
            className="overline-label text-ink-faint transition-colors hover:text-accent"
          >
            New paper
          </button>
        </div>
      </header>

      {/* reading surface */}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <PdfViewer
            key={paper.id}
            file={paper.file}
            zoom={zoom}
            onExplain={explainSelection}
            onPageTexts={setPageTexts}
          />

          {highlights.length === 0 && (
            <div className="hint-float pointer-events-none absolute bottom-8 left-1/2 z-10 border border-hairline bg-panel px-5 py-2.5 shadow-[0_14px_40px_-20px_rgba(34,27,18,0.5)]">
              <span className="overline-label text-ink-soft">
                Select any passage to have it explained
              </span>
            </div>
          )}
        </div>

        <ExplainPanel onJumpToPage={jumpToPage} />
      </div>
    </main>
  );
}
