"use client";

import React from "react";
import Link from "next/link";
import { 
  Bot, 
  FileText, 
  Search, 
  BarChart3, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Database,
  Layers,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  const features = [
    {
      title: "Hybrid RAG AI Assistant",
      desc: "Ask natural language questions across HR SOPs, Finance contracts, and Warehouse receiving guides. Receives exact page number & section citations.",
      href: "/chat",
      icon: Bot,
      color: "from-enterprise-500 to-blue-600",
      badge: "Citations + Memory",
    },
    {
      title: "SQL + RAG Unified Engine",
      desc: "Query structured database records (Payment History delays) seamlessly combined with unstructured RAG contracts (Late penalty clauses).",
      href: "/chat",
      icon: Database,
      color: "from-purple-500 to-indigo-600",
      badge: "Multi-Agent Routing",
    },
    {
      title: "Knowledge Library & Versioning",
      desc: "Drag-and-drop file ingestion (PDF, DOCX, XLSX, Images OCR) with department tagging, version changelogs, and side-by-side diff comparison.",
      href: "/documents",
      icon: FileText,
      color: "from-emerald-500 to-teal-600",
      badge: "Celery Async Workers",
    },
    {
      title: "Executive Intelligence Dashboard",
      desc: "Monitor real-time search latency, retrieval accuracy, top queried documents, and active departmental activity across your enterprise.",
      href: "/analytics",
      icon: BarChart3,
      color: "from-amber-500 to-orange-600",
      badge: "KPI Telemetry",
    },
  ];

  return (
    <div className="space-y-10 py-4">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 md:p-12 border border-enterprise-500/30 shadow-glow-blue">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-enterprise-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
        <div className="absolute right-1/4 -bottom-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-enterprise-500/20 border border-enterprise-400/40 text-enterprise-200 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-enterprise-400 animate-spin" />
            <span>Production-Grade Enterprise AI Intelligence Platform</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-white">
            Organizational Knowledge, <br />
            <span className="gradient-text">Instantaneously Grounded.</span>
          </h1>

          <p className="text-gray-300 text-base md:text-lg leading-relaxed">
            Ask questions in plain language and get answers grounded in your own documents — with citations you can check. Powered by hybrid retrieval and a local language model.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/chat"
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-enterprise-600 to-purple-600 hover:from-enterprise-500 hover:to-purple-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-glow-blue transition-all transform hover:scale-[1.02]"
            >
              <Bot className="w-5 h-5" />
              Launch AI Assistant
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/documents"
              className="px-6 py-3.5 rounded-2xl bg-dark-card/90 hover:bg-dark-card border border-dark-border hover:border-enterprise-500/40 text-gray-200 hover:text-white font-semibold text-sm flex items-center gap-2 transition-all"
            >
              <FileText className="w-4 h-4 text-enterprise-400" />
              Manage Documents & Versions
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-dark-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Security Clearance</p>
            <p className="text-sm font-extrabold text-white">{user.department} ({user.role.toUpperCase()})</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-enterprise-500/20 flex items-center justify-center text-enterprise-400 font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Hybrid Search Engine</p>
            <p className="text-sm font-extrabold text-white">pgvector + BM25 RRF</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Exact Citations</p>
            <p className="text-sm font-extrabold text-emerald-400">100% Grounded</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Structured Data</p>
            <p className="text-sm font-extrabold text-white">Postgres SQL+RAG</p>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
          Explore Enterprise Capabilities
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                href={item.href}
                className="group glass-panel glass-panel-hover p-6 rounded-2xl border border-dark-border flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-dark-bg/80 border border-dark-border text-gray-300">
                    {item.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-enterprise-400 transition-colors flex items-center gap-2">
                    {item.title}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
