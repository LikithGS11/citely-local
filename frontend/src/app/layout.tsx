import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/common/AuthContext";
import { Sidebar } from "@/components/common/Sidebar";
import { Header } from "@/components/common/Header";

export const metadata: Metadata = {
  title: "Enterprise AI Knowledge Intelligence Platform",
  description: "Production-grade RAG platform with multi-agent orchestration, SQL+RAG, exact source citations, and RBAC security.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-gray-100 antialiased selection:bg-enterprise-500 selection:text-white">
        <AuthProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
