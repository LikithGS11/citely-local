"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  FileText,
  Search,
  BarChart3,
  Sparkles,
  X,
  Settings,
  ChevronsUpDown,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { API_BASE } from "@/lib/api";
import { useAuth, User } from "./AuthContext";
import { useSettings } from "./SettingsContext";

const HEALTH_URL = API_BASE.replace(/\/api\/v1\/?$/, "") + "/health";

const navItems = [
  { name: "Assistant", href: "/chat", icon: Bot },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Search", href: "/search", icon: Search },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose, onOpenSettings }) => {
  const pathname = usePathname();
  const { user, profiles, switchUser } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = settings.sidebarCollapsed;

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

  // Close the drawer whenever the route changes (mobile)
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const renderNav = (iconOnly: boolean) => (
    <nav className="p-3 space-y-0.5 flex-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            title={iconOnly ? item.name : undefined}
            className={`relative flex items-center rounded-lg transition-colors duration-150 group ${
              iconOnly ? "justify-center py-2.5" : "gap-3 px-3 py-2.5"
            } ${
              isActive
                ? "bg-accent-500/10 text-ink-primary font-medium"
                : "text-ink-secondary hover:bg-overlay/5 hover:text-ink-primary"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent-500" />
            )}
            <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-accent-text" : "text-ink-muted group-hover:text-ink-secondary"}`} />
            {!iconOnly && <span className="text-sm">{item.name}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const renderProfileMenu = (profile: User, isSelected: boolean, onSelect: () => void) => (
    <button
      key={profile.id}
      onClick={onSelect}
      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors ${
        isSelected ? "bg-accent-500/10 text-ink-primary" : "hover:bg-overlay/5 text-ink-secondary"
      }`}
    >
      <span className="text-xs font-medium truncate">{profile.full_name}</span>
      {isSelected && <Check className="w-3.5 h-3.5 text-accent-text shrink-0" />}
    </button>
  );

  const renderProfileRow = (iconOnly: boolean) => (
    <div className="relative p-2 border-t border-dark-border">
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className={`absolute bg-dark-card border border-dark-border rounded-xl shadow-card p-1.5 z-50 animate-fade-in ${
              iconOnly ? "left-full ml-2 bottom-0 w-64" : "bottom-full left-2 right-2 mb-1"
            }`}
          >
            <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Switch profile</p>
            {profiles.map((profile) =>
              renderProfileMenu(profile, profile.id === user.id, () => {
                switchUser(profile);
                setMenuOpen(false);
              })
            )}
            <div className="my-1 border-t border-dark-border" />
            <button
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings();
              }}
              className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 text-ink-secondary hover:bg-overlay/5 hover:text-ink-primary transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Settings</span>
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setMenuOpen(!menuOpen)}
        title={iconOnly ? user.full_name : undefined}
        className={`w-full flex items-center rounded-lg hover:bg-overlay/5 transition-colors ${
          iconOnly ? "justify-center p-1.5" : "gap-2.5 p-2"
        }`}
      >
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full bg-accent-600 flex items-center justify-center text-white font-medium text-[11px]">
            {user.full_name.split(" ")[0][0]}
            {user.full_name.split(" ").length > 1 ? user.full_name.split(" ")[1][0] : ""}
          </div>
          {iconOnly && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-dark-card ${
                backendUp === null ? "bg-ink-muted" : backendUp ? "bg-status-good" : "bg-status-critical"
              }`}
            />
          )}
        </div>
        {!iconOnly && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-medium text-ink-primary truncate">{user.full_name}</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    backendUp === null ? "bg-ink-muted" : backendUp ? "bg-status-good" : "bg-status-critical"
                  }`}
                />
                <span className="text-[11px] text-ink-muted truncate">
                  {backendUp === null ? "Checking…" : backendUp ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
          </>
        )}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — collapsible, ChatGPT-style */}
      <aside
        className={`hidden md:flex bg-dark-card/60 border-r border-dark-border flex-col h-screen sticky top-0 z-30 transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className={`border-b border-dark-border ${collapsed ? "flex flex-col items-center gap-2 py-4" : "p-5 flex items-center justify-between"}`}>
          <Link href="/" title="Home" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-semibold text-sm tracking-tight text-ink-primary leading-none group-hover:text-accent-text transition-colors">
                  Enterprise AI
                </h1>
                <p className="text-[11px] text-ink-muted mt-0.5">Knowledge workspace</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => updateSettings({ sidebarCollapsed: !collapsed })}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-overlay/5 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {renderNav(collapsed)}
        {renderProfileRow(collapsed)}
      </aside>

      {/* Mobile drawer — always full width, unaffected by desktop collapse state */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <aside className="relative w-64 bg-dark-card border-r border-dark-border flex flex-col h-full animate-fade-in">
            <div className="p-5 border-b border-dark-border flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center text-white shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="font-semibold text-sm tracking-tight text-ink-primary leading-none group-hover:text-accent-text transition-colors">
                    Enterprise AI
                  </h1>
                  <p className="text-[11px] text-ink-muted mt-0.5">Knowledge workspace</p>
                </div>
              </Link>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-overlay/5"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderNav(false)}
            {renderProfileRow(false)}
          </aside>
        </div>
      )}
    </>
  );
};
