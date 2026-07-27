"use client";

import { useState } from "react";

// Real "Share" action — copies the current page URL to the clipboard.
export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="flex items-center gap-1.5 rounded-[9px] border border-line2 bg-white px-3.5 py-[9px] text-[13.5px] font-semibold transition hover:bg-panel"
    >
      {copied ? "✓ Copied" : "↗ Share"}
    </button>
  );
}
