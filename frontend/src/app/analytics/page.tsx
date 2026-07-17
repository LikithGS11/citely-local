"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  Activity,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";
import { API_BASE } from "@/lib/api";

export default function AnalyticsPage() {
  const { user } = useAuth();
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
          const data = await res.json();
          setSummary(data);
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
  }, [user]);

  if (loading) {
    return <div className="p-12 text-center text-gray-400 font-mono text-xs">Loading telemetry and KPIs...</div>;
  }

  if (loadError || !summary) {
    return (
      <div className="p-12 text-center glass-panel rounded-2xl border border-rose-500/40 space-y-3 max-w-xl mx-auto mt-8">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-sm font-bold text-rose-300">{loadError || "No analytics data available."}</p>
      </div>
    );
  }

  const totalDeptDocs = summary.department_usage.reduce(
    (acc: number, item: any) => acc + item.count,
    0
  );

  const formatTimestamp = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            Executive Intelligence Dashboard
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-enterprise-500/20 text-enterprise-300 border border-enterprise-500/30">
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time monitoring across pgvector hybrid retrieval, multi-agent latency, and top queried documents.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Total Documents</span>
            <FileText className="w-5 h-5 text-enterprise-400" />
          </div>
          <p className="text-3xl font-black text-white">{summary.total_documents}</p>
          <span className="text-[11px] text-gray-400">Indexed in pgvector</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Registered Users</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-black text-white">{summary.total_users}</p>
          <span className="text-[11px] text-gray-400">Authentication disabled (open mode)</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Avg Search Latency</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-white">
            {summary.average_latency_ms ? `${summary.average_latency_ms} ms` : "—"}
          </p>
          <span className="text-[11px] text-gray-400">
            Across {summary.total_search_queries} recorded queries
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase">Retrieval Accuracy</span>
            <CheckCircle2 className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-3xl font-black text-gray-400">
            {summary.retrieval_accuracy_rating != null ? `${summary.retrieval_accuracy_rating}%` : "N/A"}
          </p>
          <span className="text-[11px] text-gray-400">Not measured yet</span>
        </div>
      </div>

      {/* Grid Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Queried Documents */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-enterprise-400" />
              Most Searched & Cited Documents
            </h3>
            <span className="text-[11px] text-gray-400 font-mono">From search logs</span>
          </div>

          <div className="space-y-3">
            {summary.top_queried_documents.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                No search activity recorded yet. Run some searches or chat queries first.
              </p>
            ) : (
              summary.top_queried_documents.map((doc: any, idx: number) => (
                <div key={idx} className="p-3.5 rounded-xl bg-dark-card border border-dark-border/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-enterprise-500/20 text-enterprise-400 font-bold text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-white truncate">{doc.title}</p>
                      <span className="text-[10px] text-gray-400">{doc.department} Department</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-enterprise-400">{doc.search_hits} hits</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Usage Distribution */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Departmental Knowledge Activity
            </h3>
            <span className="text-[11px] text-gray-400 font-mono">Archive Distribution</span>
          </div>

          <div className="space-y-3">
            {summary.department_usage.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                No documents uploaded yet.
              </p>
            ) : (
              summary.department_usage.map((item: any, idx: number) => {
                const percentage = totalDeptDocs > 0 ? Math.round((item.count / totalDeptDocs) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-white">{item.department} Department</span>
                      <span className="font-mono text-purple-400">{item.count} documents ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-dark-bg border border-dark-border overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-enterprise-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Queries Feed */}
      <div className="glass-panel p-6 rounded-2xl border border-dark-border space-y-4">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <h3 className="font-extrabold text-sm text-white">Recent Enterprise AI Queries & Latency Tracking</h3>
          <span className="text-xs text-emerald-400 font-bold">● Live Feed</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {summary.recent_queries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 sm:col-span-2">
              No queries recorded yet.
            </p>
          ) : (
            summary.recent_queries.map((q: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-xl bg-dark-card border border-dark-border/60 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-200 truncate font-medium">"{q.query}"</span>
                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                  <span className="text-enterprise-400 font-bold">{q.latency_ms} ms</span>
                  <span className="text-gray-500">{formatTimestamp(q.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
