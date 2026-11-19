"use client";

import React from "react";
import Link from "next/link";
import { Bot, FileText, Search, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PipelineFlow } from "@/components/home/PipelineFlow";

const features = [
  {
    title: "Ask the assistant",
    desc: "Ask questions in plain language across your documents and structured records. Every answer links back to its source.",
    href: "/chat",
    icon: Bot,
  },
  {
    title: "Manage documents",
    desc: "Upload PDFs, Word docs, spreadsheets, and images. New versions are tracked automatically, with side-by-side comparison.",
    href: "/documents",
    icon: FileText,
  },
  {
    title: "Search directly",
    desc: "Skip the chat and search your knowledge base directly — combines meaning-based and keyword matching.",
    href: "/search",
    icon: Search,
  },
  {
    title: "Track usage",
    desc: "See what's being searched, which documents get cited most, and how fast the system responds.",
    href: "/analytics",
    icon: BarChart3,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10 py-2 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="space-y-5 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-primary leading-tight">
          Your documents, <span className="gradient-text">searchable in plain language.</span>
        </h1>
        <p className="text-ink-secondary text-base leading-relaxed max-w-2xl">
          Ask a question, get an answer grounded in your own files — with citations you can check yourself.
          Runs on hybrid retrieval and a local language model.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link href="/chat">
            <Button variant="primary" icon={<Bot className="w-4 h-4" />}>
              Ask a question
            </Button>
          </Link>
          <Link href="/documents">
            <Button variant="secondary" icon={<FileText className="w-4 h-4" />}>
              Manage documents
            </Button>
          </Link>
        </div>
      </div>

      {/* How it works — an animated look at the actual pipeline, not a marketing diagram */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-ink-primary">How a question becomes an answer</h2>
        <PipelineFlow />
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-dark-card border border-dark-border hover:border-overlay/20 rounded-2xl p-5 space-y-3 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-overlay/5 flex items-center justify-center text-ink-secondary group-hover:text-accent-text transition-colors">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-ink-primary flex items-center gap-1.5">
                  {item.title}
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
