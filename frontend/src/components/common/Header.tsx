"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Building2, ChevronDown, Check } from "lucide-react";
import { useAuth } from "./AuthContext";

const PAGE_INFO: Record<string, { title: string; description: string }> = {
  "/": { title: "Home", description: "Overview of this workspace" },
  "/chat": { title: "Assistant", description: "Ask questions, get cited answers" },
  "/documents": { title: "Documents", description: "Upload and manage your knowledge base" },
  "/search": { title: "Search", description: "Look up documents directly" },
  "/analytics": { title: "Analytics", description: "Usage and performance at a glance" },
};

export const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const pathname = usePathname();
  const { user, profiles, switchUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const page = PAGE_INFO[pathname] || PAGE_INFO["/"];

  return (
    <header className="h-16 bg-dark-bg/95 backdrop-blur border-b border-dark-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-overlay/5"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-ink-primary truncate">{page.title}</h1>
          <p className="text-xs text-ink-muted truncate hidden sm:block">{page.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 relative shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-ink-primary leading-tight">{user.full_name}</p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <Building2 className="w-3 h-3 text-ink-muted" />
            <span className="text-[11px] text-ink-muted">{user.department}</span>
          </div>
        </div>

        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1 pl-2.5 rounded-xl border border-dark-border hover:border-overlay/20 transition-colors group"
          title="Switch profile"
        >
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center text-white font-semibold text-xs">
            {user.full_name.split(" ")[0][0]}
            {user.full_name.split(" ").length > 1 ? user.full_name.split(" ")[1][0] : ""}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-ink-muted group-hover:text-ink-primary transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-14 w-64 bg-dark-card rounded-2xl p-3 shadow-card border border-dark-border z-50 space-y-1 animate-fade-in">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted px-2 pt-1 pb-2">
                Switch profile
              </p>
              {profiles.map((profile) => {
                const isSelected = profile.id === user.id;
                return (
                  <button
                    key={profile.id}
                    onClick={() => {
                      switchUser(profile);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-colors ${
                      isSelected ? "bg-accent-500/10 text-ink-primary" : "hover:bg-overlay/5 text-ink-secondary"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                        {profile.full_name}
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-text" />}
                      </p>
                      <span className="text-[11px] text-ink-muted">{profile.department}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
