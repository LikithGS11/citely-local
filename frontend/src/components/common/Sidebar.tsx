"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, FileText, Search, BarChart3, Sparkles } from "lucide-react";
import { API_BASE } from "@/lib/api";

const HEALTH_URL = API_BASE.replace(/\/api\/v1\/?$/, "") + "/health";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  // Real health check — no pretend "ONLINE" labels
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(HEALTH_URL, { cache: "no-store" });
        if (!cancelled) setBackendUp(res.ok);
      } catch {
        if (!cancelled) setBackendUp(false);
      }
    };
    check();
    const id = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const navItems = [
    { name: "AI Assistant", href: "/chat", icon: Bot },
    { name: "Documents", href: "/documents", icon: FileText },
    { name: "Search", href: "/search", icon: Search },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-dark-border flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      {/* Brand */}
      <div>
        <div className="p-6 border-b border-dark-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-enterprise-500 to-purple-500 flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white">
              Enterprise <span className="gradient-text">AI</span>
            </h1>
            <p className="text-[11px] text-gray-400">Knowledge workspace</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-enterprise-600/20 border border-enterprise-500/40 text-white font-semibold"
                    : "text-gray-300 hover:bg-dark-accent/40 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-enterprise-400" : "text-gray-400 group-hover:text-enterprise-400 transition-colors"}`} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer: real backend status */}
      <div className="p-4 border-t border-dark-border">
        <div className="flex items-center gap-2 px-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              backendUp === null ? "bg-gray-500" : backendUp ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <span className="text-gray-400">
            {backendUp === null ? "Checking backend…" : backendUp ? "Backend connected" : "Backend offline"}
          </span>
        </div>
      </div>
    </aside>
  );
};
