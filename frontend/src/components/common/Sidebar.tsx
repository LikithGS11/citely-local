"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Bot, 
  FileText, 
  Search, 
  BarChart3, 
  ShieldAlert, 
  Layers, 
  Sparkles,
  Database
} from "lucide-react";
import { useAuth } from "./AuthContext";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { name: "AI Assistant", href: "/chat", icon: Bot, badge: "Hybrid RAG + SQL" },
    { name: "Knowledge Library", href: "/documents", icon: FileText, badge: "Versioning" },
    { name: "Semantic Search", href: "/search", icon: Search, badge: "BM25+Dense" },
    { name: "Executive Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Security & RBAC", href: "/admin", icon: ShieldAlert, badge: user.role.toUpperCase() },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-dark-border flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-6 border-b border-dark-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-enterprise-500 to-purple-500 flex items-center justify-center shadow-glow-blue text-white font-bold text-xl">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Enterprise <span className="gradient-text font-black">AI</span>
            </h1>
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <Database className="w-3 h-3 text-enterprise-400" />
              Production RAG v1.0
            </p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Platform Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-gradient-to-r from-enterprise-600/30 to-purple-600/20 border border-enterprise-500/40 text-white font-semibold shadow-glow-blue"
                    : "text-gray-300 hover:bg-dark-accent/40 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? "text-enterprise-400" : "text-gray-400 group-hover:text-enterprise-400 transition-colors"}`} />
                  <span className="text-sm">{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isActive 
                      ? "bg-enterprise-500/30 text-enterprise-200 border border-enterprise-400/30" 
                      : "bg-dark-bg text-gray-400 group-hover:text-gray-200"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-dark-border bg-dark-bg/40">
        <div className="p-3 rounded-xl bg-dark-card/80 border border-dark-border/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Engine Status
            </span>
            <span className="text-emerald-400 font-bold">ONLINE</span>
          </div>
          <div className="text-[11px] text-gray-400 flex justify-between">
            <span>Vector Index:</span>
            <span className="text-gray-200 font-mono">pgvector-16</span>
          </div>
          <div className="text-[11px] text-gray-400 flex justify-between">
            <span>Worker Queue:</span>
            <span className="text-enterprise-400 font-mono">Celery Async</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
