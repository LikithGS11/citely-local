"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, FileText, Search, BarChart3, Home, Settings, Sun, Moon, User, Search as SearchIcon } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useSettings } from "./SettingsContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ElementType;
  action: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
  onOpenSettings: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onClose, onOpenSettings }) => {
  const router = useRouter();
  const { user, profiles, switchUser } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEscapeToClose(true, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands: Command[] = useMemo(() => {
    const nav = (path: string) => () => {
      router.push(path);
      onClose();
    };
    const list: Command[] = [
      { id: "nav-home", label: "Go to Home", group: "Navigate", icon: Home, action: nav("/") },
      { id: "nav-chat", label: "Go to Assistant", group: "Navigate", icon: Bot, action: nav("/chat") },
      { id: "nav-documents", label: "Go to Documents", group: "Navigate", icon: FileText, action: nav("/documents") },
      { id: "nav-search", label: "Go to Search", group: "Navigate", icon: Search, action: nav("/search") },
      { id: "nav-analytics", label: "Go to Analytics", group: "Navigate", icon: BarChart3, action: nav("/analytics") },
      {
        id: "toggle-theme",
        label: settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: settings.theme === "dark" ? Sun : Moon,
        action: () => {
          updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" });
          onClose();
        },
      },
      {
        id: "open-settings",
        label: "Open Settings",
        group: "Actions",
        icon: Settings,
        action: () => {
          onOpenSettings();
          onClose();
        },
      },
      ...profiles
        .filter((p) => p.id !== user.id)
        .map((p) => ({
          id: `profile-${p.id}`,
          label: `Switch to ${p.full_name}`,
          group: "Profiles",
          icon: User,
          action: () => {
            switchUser(p);
            onClose();
          },
        })),
    ];
    return list;
  }, [router, onClose, onOpenSettings, settings.theme, updateSettings, profiles, user.id, switchUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.action();
    }
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-dark-card rounded-2xl border border-dark-border shadow-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-dark-border">
          <SearchIcon className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-ink-primary placeholder:text-ink-muted"
          />
          <kbd className="text-[10px] text-ink-muted border border-dark-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-ink-muted text-center py-6">No matching commands</p>
          ) : (
            filtered.map((cmd, idx) => {
              const showGroup = cmd.group !== lastGroup;
              lastGroup = cmd.group;
              const Icon = cmd.icon;
              return (
                <React.Fragment key={cmd.id}>
                  {showGroup && (
                    <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      {cmd.group}
                    </p>
                  )}
                  <button
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={cmd.action}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      idx === activeIndex ? "bg-accent-500/10 text-ink-primary" : "text-ink-secondary"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cmd.label}</span>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
