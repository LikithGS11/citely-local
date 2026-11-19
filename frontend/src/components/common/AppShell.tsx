"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { SettingsModal } from "./SettingsModal";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global shortcuts: Cmd/Ctrl+K opens the command palette, "/" jumps to
  // Search and focuses its input — both ignored while typing in a field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !paletteOpen) {
        const el = document.activeElement as HTMLElement | null;
        const isTyping = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
        if (isTyping) return;
        e.preventDefault();
        sessionStorage.setItem("focusSearchOnLoad", "1");
        window.dispatchEvent(new Event("focus-search"));
        router.push("/search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, router]);

  return (
    // h-screen + overflow-hidden on the shell so the WINDOW never scrolls —
    // only <main> does. Without this, once page content runs taller than the
    // viewport the whole document scrolls as one block, dragging fixed-height
    // per-page layouts (like the chat composer) along with it.
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};
