"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type FontSize = "sm" | "md" | "lg";
export type Density = "comfortable" | "compact";
export type Theme = "dark" | "light";

export interface AppSettings {
  theme: Theme;
  fontSize: FontSize;
  density: Density;
  autoExpandReasoning: boolean;
  searchResultCount: number;
  sidebarCollapsed: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  fontSize: "md",
  density: "comfortable",
  autoExpandReasoning: false,
  searchResultCount: 6,
  sidebarCollapsed: false,
};

// Root font-size per option — since Tailwind's rem-based utilities scale off
// the root, this one line genuinely resizes text and spacing app-wide.
const FONT_SIZE_PX: Record<FontSize, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
};

const STORAGE_KEY = "enterprise_rag_settings";

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Could not parse stored settings:", e);
      }
    }
  }, []);

  // Apply the effects that touch the DOM directly whenever they change
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_PX[settings.fontSize];
    document.documentElement.setAttribute("data-density", settings.density);
    document.documentElement.classList.toggle("light", settings.theme === "light");
  }, [settings.fontSize, settings.density, settings.theme]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
