"use client";

import React from "react";

type Tone = "neutral" | "good" | "warning" | "serious" | "critical" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-overlay/5 text-ink-secondary border-overlay/10",
  good: "bg-status-good/10 text-status-good border-status-good/25",
  warning: "bg-status-warning/10 text-status-warning border-status-warning/25",
  serious: "bg-status-serious/10 text-status-serious border-status-serious/25",
  critical: "bg-status-critical/10 text-status-critical border-status-critical/25",
  accent: "bg-accent-500/10 text-accent-text border-accent-500/25",
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = "neutral",
  children,
  className = "",
}) => (
  <span
    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${toneClasses[tone]} ${className}`}
  >
    {children}
  </span>
);
