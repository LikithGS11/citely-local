import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/common/AuthContext";
import { SettingsProvider } from "@/components/common/SettingsContext";
import { ToastProvider } from "@/components/common/ToastContext";
import { AppShell } from "@/components/common/AppShell";

export const metadata: Metadata = {
  title: "Citely",
  description: "Ask your documents, get cited answers.",
};

// Applies the saved theme before first paint, so there's no flash of the
// wrong theme while React hydrates.
const THEME_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('enterprise_rag_settings')||'{}');if(s.theme==='light')document.documentElement.classList.add('light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-bg text-ink-primary antialiased selection:bg-accent-500 selection:text-white">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
