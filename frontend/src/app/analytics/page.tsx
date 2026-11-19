"use client";

import React, { useState, useEffect } from "react";
import { FileText, Users, Clock, Gauge, AlertCircle, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { RankedBarChart } from "@/components/analytics/RankedBarChart";

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  dim?: boolean;
}

const StatTile: React.FC<StatTileProps> = ({ icon: Icon, label, value, hint, dim }) => (
  <div className="bg-dark-card border border-dark-border rounded-2xl p-4 space-y-1.5">
    <div className="flex items-center justify-between text-ink-muted">
      <span className="text-xs font-medium">{label}</span>
      <Icon className="w-4 h-4" />
    </div>
    <p className={`text-2xl font-semibold tabular-nums ${dim ? "text-ink-muted" : "text-ink-primary"}`}>{value}</p>
    <p className="text-xs text-ink-muted">{hint}</p>
  </div>
);

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/analytics/summary`);
        if (res.ok) {
          setSummary(await res.json());
        } else {
          throw new Error(`Server responded with ${res.status}`);
        }
      } catch (err) {
        console.error(err);
        setSummary(null);
        setLoadError("Could not reach the backend server. Make sure the API is running at http://localhost:8000.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-16 text-center text-ink-muted text-sm flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics…
      </div>
    );
  }

  if (loadError || !summary) {
    return <EmptyState icon={AlertCircle} title={loadError || "No analytics data available."} tone="error" />;
  }

  const departmentData = summary.department_usage
    .map((item: any) => ({ label: item.department, value: item.count }))
    .sort((a: any, b: any) => b.value - a.value);

  const topDocsData = summary.top_queried_documents.map((doc: any) => ({
    label: doc.title.length > 28 ? doc.title.slice(0, 27) + "…" : doc.title,
    value: doc.search_hits,
    sublabel: doc.department,
  }));

  const formatTimestamp = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Stat tiles — single headline numbers, not charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={FileText} label="Documents" value={String(summary.total_documents)} hint="Indexed in pgvector" />
        <StatTile icon={Users} label="Users" value={String(summary.total_users)} hint="Open access — no login" />
        <StatTile
          icon={Clock}
          label="Avg latency"
          value={summary.average_latency_ms ? `${summary.average_latency_ms} ms` : "—"}
          hint={`Across ${summary.total_search_queries} queries`}
        />
        <StatTile
          icon={Gauge}
          label="Retrieval accuracy"
          value={summary.retrieval_accuracy_rating != null ? `${summary.retrieval_accuracy_rating}%` : "N/A"}
          hint="Not measured yet"
          dim
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-ink-primary">Most searched documents</h3>
          {topDocsData.length === 0 ? (
            <p className="text-xs text-ink-muted py-8 text-center">No search activity recorded yet.</p>
          ) : (
            <RankedBarChart data={topDocsData} />
          )}
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-ink-primary">Documents by department</h3>
          {departmentData.length === 0 ? (
            <p className="text-xs text-ink-muted py-8 text-center">No documents uploaded yet.</p>
          ) : (
            <RankedBarChart data={departmentData} />
          )}
        </div>
      </div>

      {/* Recent queries — a list, not a chart */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-ink-primary">Recent queries</h3>
        {summary.recent_queries.length === 0 ? (
          <p className="text-xs text-ink-muted py-8 text-center">No queries recorded yet.</p>
        ) : (
          <div className="divide-y divide-dark-border">
            {summary.recent_queries.map((q: any, idx: number) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-secondary truncate">{q.query}</span>
                <div className="flex items-center gap-3 shrink-0 text-xs text-ink-muted tabular-nums">
                  <span>{q.latency_ms} ms</span>
                  <span>{formatTimestamp(q.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
