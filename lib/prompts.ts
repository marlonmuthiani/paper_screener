import type { Depth } from "./types";

export function initialAsk(selection: string, page: number, depth: Depth) {
  return `Explain this highlighted passage from page ${page} of the paper (mode: ${depth}):\n\n<<<\n${selection}\n>>>`;
}

export function depthSwitchAsk(depth: Depth) {
  return depth === "rigorous"
    ? "Re-explain the same passage in rigorous mode: full technical precision, exact statements, all assumptions made explicit. Keep the three sections."
    : "Re-explain the same passage in plain mode: minimal jargon, maximum intuition, as if to a smart reader from a neighboring field. Keep the three sections.";
}
