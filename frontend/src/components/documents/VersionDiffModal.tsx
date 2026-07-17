"use client";

import React from "react";
import { X, GitCompare, PlusCircle, MinusCircle, FileText, ArrowRight } from "lucide-react";

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl glass-panel rounded-2xl p-6 border border-dark-border shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-dark-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-enterprise-500/20 flex items-center justify-center text-enterprise-400 font-bold">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                Version Changelog & Semantic Diff
              </h3>
              <p className="text-xs text-gray-400">
                Comparing **{data.document_title}** (v{data.version_1} vs v{data.version_2})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-dark-card hover:bg-dark-accent text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto pr-2 flex-1 font-sans">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-dark-card border border-dark-border/80 space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Semantic Extraction Summary</p>
            <p className="text-xs text-gray-200 leading-relaxed font-mono">{data.diff_summary}</p>
          </div>

          {/* Side by side sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Added Sections */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4" />
                  Added / Modified Section Headers
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20">{data.added_sections.length}</span>
              </div>
              <ul className="space-y-2 text-xs font-mono text-gray-300">
                {data.added_sections.map((sec, idx) => (
                  <li key={idx} className="p-2 rounded bg-dark-bg/60 border border-emerald-500/20 flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">+</span>
                    <span>{sec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Removed Sections */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                <span className="flex items-center gap-1.5">
                  <MinusCircle className="w-4 h-4" />
                  Removed / Replaced Section Headers
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20">{data.removed_sections.length}</span>
              </div>
              <ul className="space-y-2 text-xs font-mono text-gray-300">
                {data.removed_sections.map((sec, idx) => (
                  <li key={idx} className="p-2 rounded bg-dark-bg/60 border border-rose-500/20 flex items-center gap-2">
                    <span className="text-rose-400 font-bold">-</span>
                    <span>{sec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-dark-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-enterprise-600 hover:bg-enterprise-500 text-white font-bold text-xs transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
