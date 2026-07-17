"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // The no-flash script in layout.tsx set the attribute before paint;
  // sync local state to it after mount.
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem("marginalia-theme", next ? "dark" : "light");
    } catch {
      // Private browsing — the choice just won't persist.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      title={dark ? "Switch to the day edition" : "Switch to the night edition"}
      className="overline-label border border-hairline px-3 py-2 text-ink-soft transition-colors hover:border-accent hover:text-accent"
    >
      {dark ? "☀ Day" : "☾ Night"}
    </button>
  );
}
