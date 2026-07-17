"use client";

import React from "react";
import { useAuth, User } from "@/components/common/AuthContext";
import { Shield, CheckCircle2, UserCheck, Sparkles, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { user, demoAccounts, switchUser } = useAuth();
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-enterprise-500/20 border border-enterprise-400/30 text-enterprise-300 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5" />
          <span>Enterprise Authentication & RBAC Access Portal</span>
        </div>
        <h1 className="text-3xl font-black text-white">
          Verify Security Clearance & Department Isolation
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          Our platform enforces strict Role-Based Access Control (`Admin`, `Manager`, `Viewer`) and Departmental boundaries (`HR`, `Finance`, `Engineering`, `Operations`).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {demoAccounts.map((account) => {
          const isCurrent = account.id === user.id;
          return (
            <div
              key={account.id}
              onClick={() => {
                switchUser(account);
                router.push("/chat");
              }}
              className={`glass-panel p-6 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                isCurrent
                  ? "border-enterprise-500 bg-enterprise-950/40 shadow-glow-blue"
                  : "border-dark-border hover:border-enterprise-500/40 hover:bg-dark-card/90"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-enterprise-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
                  {account.full_name.split(" ")[0][0]}
                  {account.full_name.split(" ").length > 1 ? account.full_name.split(" ")[1][0] : ""}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                    account.role === "admin" 
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40" 
                      : "bg-enterprise-500/20 text-enterprise-300 border-enterprise-500/40"
                  }`}>
                    {account.role}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">{account.department} Dept</span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  {account.full_name}
                  {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </h3>
                <p className="text-xs font-mono text-gray-400">{account.email}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-dark-border/80 flex items-center justify-between text-xs text-gray-400">
                <span>Access Clearance:</span>
                <span className="text-gray-200 font-semibold">
                  {account.role === "admin" ? "Universal (All Docs & SQL)" : `${account.department} + General Docs`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
