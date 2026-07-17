"use client";

import { useCallback, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

export default function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);

  const accept = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
        setRejected(true);
        setTimeout(() => setRejected(false), 2400);
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files?.[0]);
      }}
    >
      {/* masthead */}
      <header className="anim-fade-up flex items-center justify-between border-b border-hairline px-8 py-5 sm:px-14">
        <span className="font-serif text-2xl italic tracking-tight">
          Marginalia
        </span>
        <div className="flex items-center gap-6">
          <span className="overline-label hidden text-ink-faint sm:block">
            A companion for dense papers
          </span>
          <ThemeToggle />
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl text-center">
          <p
            className="anim-fade-up overline-label text-accent"
            style={{ animationDelay: "0.08s" }}
          >
            No. 1 — Mathematics &amp; Finance
          </p>

          <h1
            className="anim-fade-up mx-auto mt-6 max-w-2xl font-serif text-5xl leading-[1.08] tracking-tight text-ink sm:text-6xl"
            style={{ animationDelay: "0.16s" }}
          >
            Dense papers,
            <br />
            <em className="text-accent">readable</em> at last.
          </h1>

          <p
            className="anim-fade-up mx-auto mt-6 max-w-md text-lg leading-relaxed text-ink-soft"
            style={{ animationDelay: "0.24s" }}
          >
            Drop in a paper. Highlight whatever loses you. Get the notation,
            the intuition, and the step — right in the margin.
          </p>

          {/* drop plate */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a PDF"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={`anim-fade-up group mx-auto mt-12 flex w-full max-w-xl cursor-pointer flex-col items-center gap-3 border px-10 py-14 transition-all duration-300 ${
              dragging
                ? "scale-[1.015] border-accent bg-accent-wash shadow-[0_18px_50px_-24px_rgba(141,43,35,0.45)]"
                : "border-hairline bg-panel shadow-[0_14px_44px_-30px_rgba(34,27,18,0.5)] hover:border-ink-faint"
            }`}
            style={{ animationDelay: "0.32s" }}
          >
            <span className="font-serif text-3xl italic text-accent">§</span>
            <span className="font-serif text-xl text-ink">
              {dragging ? "Release to open it" : "Drag a paper here"}
            </span>
            <span className="overline-label text-ink-faint">
              PDF — or click to browse
            </span>
            {rejected && (
              <span className="overline-label mt-1 text-accent">
                That wasn&rsquo;t a PDF
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <footer
        className="anim-fade-up flex items-center justify-center gap-3 border-t border-hairline px-8 py-4"
        style={{ animationDelay: "0.4s" }}
      >
        <span className="overline-label text-ink-faint">
          Your paper stays in the browser — only highlighted text is sent for
          explanation
        </span>
      </footer>
    </main>
  );
}
