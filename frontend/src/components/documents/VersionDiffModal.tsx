"use client";

import React from "react";
import { X, GitCompare, PlusCircle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

export interface VersionDiffData {
  document_id: number;
  document_title: string;
  version_1: number;
  version_2: number;
  diff_summary: string;
  added_sections: string[];
  removed_sections: string[];
  changed_metrics: any;
}

interface VersionDiffModalProps {
  data: VersionDiffData;
  onClose: () => void;
}

export const VersionDiffModal: React.FC<VersionDiffModalProps> = ({ data, onClose }) => {
  useEscapeToClose(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-dark-card rounded-2xl p-5 border border-dark-border shadow-card space-y-5 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center text-accent-text">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-ink-primary">Version comparison</h3>
              <p className="text-xs text-ink-muted">
                {data.document_title} · v{data.version_1} vs v{data.version_2}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div className="p-3.5 rounded-xl bg-dark-bg border border-dark-border">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted mb-1">Summary</p>
            <p className="text-sm text-ink-secondary leading-relaxed">{data.diff_summary}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-status-good/5 border border-status-good/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-status-good">
                <span className="flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" />
                  Added sections
                </span>
                <span>{data.added_sections.length}</span>
              </div>
              <ul className="space-y-1.5 text-xs text-ink-secondary">
                {data.added_sections.map((sec, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-dark-bg border border-status-good/10">{sec}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-status-critical/5 border border-status-critical/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-status-critical">
                <span className="flex items-center gap-1.5">
                  <MinusCircle className="w-3.5 h-3.5" />
                  Removed sections
                </span>
                <span>{data.removed_sections.length}</span>
              </div>
              <ul className="space-y-1.5 text-xs text-ink-secondary">
                {data.removed_sections.map((sec, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-dark-bg border border-status-critical/10">{sec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-dark-border flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};
