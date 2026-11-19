"use client";

import React, { useState } from "react";
import { ChevronRight, Database, FileText, Cpu } from "lucide-react";

export interface AgentStep {
  agent_name: string;
  action: string;
  details: string;
  timestamp: number;
}

const stepIcon = (name: string) => {
  if (name.includes("SQL")) return <Database className="w-3.5 h-3.5 text-status-warning" />;
  if (name.includes("Retrieval")) return <FileText className="w-3.5 h-3.5 text-accent-text" />;
  return <Cpu className="w-3.5 h-3.5 text-ink-secondary" />;
};

/**
 * Inline, collapsed-by-default disclosure of how the answer was produced —
 * replaces a modal dialog so reading the reasoning doesn't interrupt the chat.
 */
export const AgentSteps: React.FC<{ steps: AgentStep[]; defaultOpen?: boolean }> = ({ steps, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-ink-muted hover:text-ink-secondary transition-colors font-medium"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? "Hide reasoning steps" : `Show reasoning (${steps.length} steps)`}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5 pl-2 border-l border-dark-border animate-fade-in">
          {steps.map((step, idx) => (
            <div key={idx} className="pl-3 space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-ink-secondary">
                {stepIcon(step.agent_name)}
                <span>{step.agent_name}</span>
                <span className="text-ink-muted font-normal">· {step.action}</span>
              </div>
              <p className="text-ink-muted leading-relaxed">{step.details}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
