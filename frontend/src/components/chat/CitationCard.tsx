"use client";

import React from "react";
import { X, FileText, Bookmark, ShieldAlert, Layers } from "lucide-react";

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

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index, onPreview }) => {
  const getConfBadge = (conf: string) => {
    switch (conf) {
      case "Restricted":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "Confidential":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    }
  };

  return (
    <div 
      onClick={() => onPreview(citation)}
      className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border hover:border-enterprise-500/60 transition-all cursor-pointer space-y-2 group shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-enterprise-500/20 flex items-center justify-center text-enterprise-400 font-bold text-xs shrink-0">
            #{index + 1}
          </div>
          <span className="font-bold text-xs text-white truncate group-hover:text-enterprise-400 transition-colors">
            {citation.document_title}
          </span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border shrink-0 ${getConfBadge(citation.confidentiality_level)}`}>
          {citation.confidentiality_level}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <Bookmark className="w-3 h-3 text-enterprise-400" />
          Page {citation.page_number}
        </span>
        <span className="truncate">§ {citation.section_title}</span>
        <span className="ml-auto text-emerald-400 font-semibold">{citation.similarity_score}% Match</span>
      </div>

      <p className="text-[11px] text-gray-300 line-clamp-2 italic bg-dark-card/60 p-2 rounded-lg border border-dark-border/40">
        "{citation.content_snippet}"
      </p>
    </div>
  );
};
