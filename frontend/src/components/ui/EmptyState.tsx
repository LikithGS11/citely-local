"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, tone = "neutral" }) => (
  <div
    className={`p-10 text-center rounded-2xl border space-y-3 ${
      tone === "error" ? "border-status-critical/30 bg-status-critical/5" : "border-dark-border bg-dark-card/40"
    }`}
  >
    <Icon className={`w-7 h-7 mx-auto ${tone === "error" ? "text-status-critical" : "text-ink-muted"}`} />
    <p className={`text-sm font-medium ${tone === "error" ? "text-status-critical" : "text-ink-secondary"}`}>{title}</p>
    {description && <p className="text-xs text-ink-muted max-w-sm mx-auto">{description}</p>}
    {action && <div className="pt-1">{action}</div>}
  </div>
);
