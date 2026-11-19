"use client";

import React from "react";
import { Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export interface Citation {
  chunk_id: number;
  document_id: number;
  document_title: string;
  page_number: number;
  section_title: string;
  content_snippet: string;
  similarity_score: number;
  confidentiality_level: string;
}

interface CitationCardProps {
  citation: Citation;
  index: number;
  onPreview: (citation: Citation) => void;
}

const confTone = (conf: string) => {
  switch (conf) {
    case "Restricted":
      return "critical" as const;
    case "Confidential":
      return "warning" as const;
    case "Public":
      return "good" as const;
    default:
      return "neutral" as const;
  }
};

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index, onPreview }) => {
  return (
    <button
      onClick={() => onPreview(citation)}
      className="w-full text-left p-3 rounded-xl bg-dark-bg border border-dark-border hover:border-accent-500/40 transition-colors space-y-2 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded bg-overlay/5 flex items-center justify-center text-ink-muted font-medium text-[10px] shrink-0">
            {index + 1}
          </span>
          <span className="font-medium text-xs text-ink-primary truncate group-hover:text-accent-text transition-colors">
            {citation.document_title}
          </span>
        </div>
        <Badge tone={confTone(citation.confidentiality_level)} className="shrink-0">
          {citation.confidentiality_level}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <Bookmark className="w-3 h-3" />
          Page {citation.page_number}
        </span>
        <span className="truncate">{citation.section_title}</span>
        <span className="ml-auto text-status-good font-medium shrink-0">{citation.similarity_score}%</span>
      </div>

      <p className="text-[11px] text-ink-secondary line-clamp-2 leading-relaxed">
        {citation.content_snippet}
      </p>
    </button>
  );
};
