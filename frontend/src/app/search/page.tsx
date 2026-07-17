"use client";

import React, { useState } from "react";
import { Search, Filter, Bookmark, FileText, Sparkles, Shield, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";
import { API_BASE } from "@/lib/api";
import { CitationCard, Citation } from "@/components/chat/CitationCard";

export default function SemanticSearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [confidentialityFilter, setConfidentialityFilter] = useState("");
  const [results, setResults] = useState<Citation[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCitationPreview, setSelectedCitationPreview] = useState<Citation | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/search/semantic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          department_filter: departmentFilter || null,
          confidentiality_filter: confidentialityFilter || null,
          top_k: 6,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        throw new Error("Search failed");
      }
    } catch (err) {
      console.error(err);
      setResults([]);
      setSearchError("Search failed: could not reach the backend server at http://localhost:8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {searchError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-semibold text-center">
          {searchError}
        </div>
      )}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Direct Hybrid RAG Engine (Dense Vector + BM25 RRF)</span>
        </div>
        <h1 className="text-3xl font-black text-white">
          Direct Semantic & Keyword Discovery
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          Search across all company archives directly without chatbot synthesis. Results are ranked by **Reciprocal Rank Fusion** and filtered by your active department clearance.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="p-2.5 rounded-2xl glass-panel border border-dark-border focus-within:border-enterprise-500/60 shadow-lg transition-all flex items-center gap-3">
          <Search className="w-5 h-5 text-enterprise-400 ml-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g. 'cold storage requirements', 'supplier agreement penalty', 'invoice approval'..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-enterprise-600 to-purple-600 hover:from-enterprise-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-glow-blue transition-all"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <Filter className="w-4 h-4 text-enterprise-400" />
            <span className="font-semibold text-gray-300">RBAC Filters:</span>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-white outline-none"
            >
              <option value="">All Authorized Departments</option>
              <option value="HR">HR Department</option>
              <option value="Finance">Finance Department</option>
              <option value="Operations">Operations Department</option>
              <option value="Engineering">Engineering Department</option>
            </select>

            <select
              value={confidentialityFilter}
              onChange={(e) => setConfidentialityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-white outline-none"
            >
              <option value="">All Clearance Levels</option>
              <option value="Public">Public</option>
              <option value="Internal">Internal</option>
              <option value="Confidential">Confidential</option>
            </select>
          </div>

          <span className="text-[11px] text-gray-500 font-mono">
            Clearance: **{user.department}** ({user.role.toUpperCase()})
          </span>
        </div>
      </form>

      {/* Results Grid */}
      {searched && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              Retrieved Document Citations ({results.length})
            </h3>
            <span className="text-xs text-gray-400 font-mono">
              Scored via pgvector Cosine {"<=>"} &amp; BM25
            </span>
          </div>

          {results.length === 0 ? (
            <div className="p-12 text-center glass-panel rounded-2xl border border-dark-border">
              <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-300">No matching chunks found matching query and security criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((cit, idx) => (
                <CitationCard
                  key={cit.chunk_id || idx}
                  citation={cit}
                  index={idx}
                  onPreview={(c) => setSelectedCitationPreview(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedCitationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-panel rounded-2xl p-6 border border-dark-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div>
                <h3 className="font-extrabold text-base text-white">{selectedCitationPreview.document_title}</h3>
                <p className="text-xs text-gray-400">
                  Page {selectedCitationPreview.page_number} • Section: § {selectedCitationPreview.section_title}
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-400">{selectedCitationPreview.similarity_score}% Match</span>
            </div>
            <div className="p-4 rounded-xl bg-dark-bg font-mono text-xs text-gray-300 leading-relaxed max-h-64 overflow-y-auto border border-dark-border">
              {selectedCitationPreview.content_snippet}
            </div>
            <div className="flex justify-end pt-2 border-t border-dark-border">
              <button
                onClick={() => setSelectedCitationPreview(null)}
                className="px-4 py-2 rounded-xl bg-enterprise-600 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

