"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const BASE_PAGE_WIDTH = 760;
const MIN_SELECTION_LENGTH = 3;
const MAX_SELECTION_LENGTH = 6000;

interface FloatingButton {
  x: number;
  y: number;
  text: string;
  page: number;
}

interface Props {
  file: File;
  zoom: number;
  onExplain: (text: string, page: number) => void;
  onPageTexts: (texts: string[]) => void;
}

async function extractPageTexts(pdf: PDFDocumentProxy): Promise<string[]> {
  const texts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texts.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return texts;
}

function findPageNumber(node: Node | null): number | null {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  while (el) {
    const attr = el.getAttribute?.("data-page-number");
    if (attr) return parseInt(attr, 10);
    el = el.parentElement;
  }
  return null;
}

export default function PdfViewer({
  file,
  zoom,
  onExplain,
  onPageTexts,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const docSeqRef = useRef(0);
  const [numPages, setNumPages] = useState(0);
  const [button, setButton] = useState<FloatingButton | null>(null);

  const onLoadSuccess = useCallback(
    (pdf: PDFDocumentProxy) => {
      const seq = ++docSeqRef.current;
      setNumPages(pdf.numPages);
      extractPageTexts(pdf)
        .then((texts) => {
          if (seq === docSeqRef.current) onPageTexts(texts);
        })
        .catch(() => {
          // Extraction failed (e.g. document destroyed) — don't clobber
          // whatever context the current document produced.
        });
    },
    [onPageTexts],
  );

  // Invalidate pending extractions when this viewer unmounts.
  useEffect(
    () => () => {
      docSeqRef.current += 1;
    },
    [],
  );

  // Selection handling lives on the document so a drag that ends over the
  // panel, the toolbar, or past the window edge still produces the button.
  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      // A mouseup on the Explain button itself must not re-run the
      // recompute — that would resurrect the button after it is clicked.
      if (
        event.target instanceof Element &&
        event.target.closest("[data-explain-button]")
      ) {
        return;
      }
      // Let the browser finalize the selection first.
      window.setTimeout(() => {
        const content = contentRef.current;
        const selection = window.getSelection();
        const raw = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
        if (
          !content ||
          !selection ||
          selection.isCollapsed ||
          raw.length < MIN_SELECTION_LENGTH
        ) {
          setButton(null);
          return;
        }
        const range = selection.getRangeAt(0);
        if (!content.contains(range.commonAncestorContainer)) {
          setButton(null);
          return;
        }
        const page = findPageNumber(range.startContainer) ?? 1;
        const rect = range.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const x = Math.min(
          Math.max(rect.left + rect.width / 2 - contentRect.left, 70),
          contentRect.width - 70,
        );
        const y = rect.top - contentRect.top;
        const text =
          raw.length > MAX_SELECTION_LENGTH
            ? `${raw.slice(0, MAX_SELECTION_LENGTH)} …`
            : raw;
        setButton({ x, y, text, page });
      }, 0);
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Dismiss the button when the selection collapses (click elsewhere, Esc).
  useEffect(() => {
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setButton(null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const width = Math.round(BASE_PAGE_WIDTH * zoom);

  return (
    <div
      ref={scrollRef}
      className="styled-scroll h-full overflow-y-auto bg-paper-deep"
    >
      <div ref={contentRef} className="relative mx-auto w-fit px-8 py-10">
        <Document
          file={file}
          onLoadSuccess={onLoadSuccess}
          loading={
            <div className="flex h-[70vh] w-[760px] max-w-full items-center justify-center">
              <span className="overline-label text-ink-faint">
                Opening the paper…
              </span>
            </div>
          }
          error={
            <div className="flex h-[70vh] w-[760px] max-w-full items-center justify-center">
              <span className="overline-label text-accent">
                Couldn&rsquo;t read this PDF
              </span>
            </div>
          }
        >
          <div className="flex flex-col gap-8">
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i + 1}
                data-marginalia-page={i + 1}
                className="border border-hairline shadow-[0_20px_50px_-30px_rgba(34,27,18,0.55)]"
              >
                <Page
                  pageNumber={i + 1}
                  width={width}
                  renderTextLayer
                  renderAnnotationLayer={false}
                  loading={
                    <div
                      style={{ width, height: Math.round(width * 1.294) }}
                      className="bg-page"
                    />
                  }
                />
              </div>
            ))}
          </div>
        </Document>

        {button && (
          <button
            type="button"
            data-explain-button
            className="explain-pop absolute z-20 flex items-center gap-2 bg-accent px-4 py-2 text-on-accent shadow-[0_10px_30px_-10px_rgba(111,31,25,0.8)] transition-colors hover:bg-accent-deep"
            style={{ left: button.x, top: button.y - 46 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onExplain(button.text, button.page);
              setButton(null);
            }}
          >
            <span className="font-serif text-sm italic leading-none">§</span>
            <span className="overline-label !text-[0.62rem] text-on-accent">
              Explain
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
