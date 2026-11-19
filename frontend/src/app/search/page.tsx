"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, FileText, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { useSettings } from "@/components/common/SettingsContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CitationCard, Citation } from "@/components/chat/CitationCard";

const DEPARTMENTS = ["HR", "Finance", "Operations", "Engineering", "Legal", "General"];

export default function SemanticSearchPage() {
  const { settings } = useSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [confidentialityFilter, setConfidentialityFilter] = useState("");
  const [results, setResults] = useState<Citation[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCitationPreview, setSelectedCitationPreview] = useState<Citation | null>(null);
  useEscapeToClose(!!selectedCitationPreview, () => setSelectedCitationPreview(null));

  // Focus the search box after the "/" global shortcut navigates here (see AppShell)
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    if (sessionStorage.getItem("focusSearchOnLoad")) {
      sessionStorage.removeItem("focusSearchOnLoad");
      focusInput();
    }
    window.addEventListener("focus-search", focusInput);
    return () => window.removeEventListener("focus-search", focusInput);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/search/semantic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          department_filter: departmentFilter || null,
          confidentiality_filter: confidentialityFilter || null,
          top_k: settings.searchResultCount,
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
      setSearchError("Search failed: could not reach the backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-2xl font-semibold text-ink-primary">Search your documents</h1>
        <p className="text-sm text-ink-muted max-w-lg mx-auto">
          Combines meaning-based and keyword search, ranked together — no chat, just results.
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="p-2 rounded-2xl bg-dark-card border border-dark-border focus-within:border-accent-500/50 transition-colors flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex items-center gap-2 min-w-0 px-1 sm:px-0">
            <Search className="w-4 h-4 text-ink-muted ml-1 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. cold storage requirements…"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-ink-primary placeholder:text-ink-muted"
            />
          </div>
          <Button variant="primary" type="submit" disabled={!query.trim() || loading} className="w-full sm:w-auto">
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-1">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs text-ink-secondary outline-none"
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={confidentialityFilter}
            onChange={(e) => setConfidentialityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs text-ink-secondary outline-none"
          >
            <option value="">All clearance levels</option>
            <option value="Public">Public</option>
            <option value="Internal">Internal</option>
            <option value="Confidential">Confidential</option>
          </select>
        </div>
      </form>

      {searchError && (
        <div className="p-3.5 rounded-xl bg-status-critical/10 border border-status-critical/25 text-status-critical text-sm text-center">
          {searchError}
        </div>
      )}

      {loading && (
        <div className="p-10 text-center text-ink-muted text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching…
        </div>
      )}

      {!loading && searched && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink-secondary">{results.length} result{results.length !== 1 ? "s" : ""}</h3>
          </div>

          {results.length === 0 ? (
            <EmptyState icon={FileText} title="No matching documents" description="Try a different query or filter." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {results.map((cit, idx) => (
                <CitationCard key={cit.chunk_id || idx} citation={cit} index={idx} onPreview={setSelectedCitationPreview} />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedCitationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setSelectedCitationPreview(null)}>
          <div
            className="w-full max-w-xl bg-dark-card rounded-2xl p-5 border border-dark-border shadow-card space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div>
                <h3 className="font-semibold text-sm text-ink-primary">{selectedCitationPreview.document_title}</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Page {selectedCitationPreview.page_number} · {selectedCitationPreview.section_title}
                </p>
              </div>
              <span className="text-xs font-medium text-status-good">{selectedCitationPreview.similarity_score}% match</span>
            </div>
            <div className="p-3 rounded-xl bg-dark-bg text-xs text-ink-secondary leading-relaxed max-h-64 overflow-y-auto border border-dark-border">
              {selectedCitationPreview.content_snippet}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="secondary" size="sm" onClick={() => setSelectedCitationPreview(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
