"use client";

import React, { useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useAuth } from "./AuthContext";

export const Header: React.FC = () => {
  const { user, demoAccounts, switchUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 glass-panel border-b border-dark-border px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: honest, quiet context */}
      <div className="text-xs text-gray-500">
        Local workspace · open access (no authentication)
      </div>

      {/* Right: profile display + switcher */}
      <div className="flex items-center gap-4 relative">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-white leading-tight">{user.full_name}</p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <Building2 className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] text-gray-400">{user.department}</span>
          </div>
        </div>

        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 p-1.5 pl-3 rounded-xl bg-dark-card border border-dark-border hover:border-enterprise-500/50 transition-all shadow-sm group"
          title="Switch profile"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-enterprise-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {user.full_name.split(" ")[0][0]}
            {user.full_name.split(" ").length > 1 ? user.full_name.split(" ")[1][0] : ""}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-14 w-72 glass-panel rounded-2xl p-4 shadow-2xl border border-dark-border z-50 space-y-3">
              <div className="border-b border-dark-border pb-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Switch profile</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Display profiles only — all data is open in this build.
                </p>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {demoAccounts.map((account) => {
                  const isSelected = account.id === user.id;
                  return (
                    <button
                      key={account.id}
                      onClick={() => {
                        switchUser(account);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-enterprise-500/20 border border-enterprise-500/50 text-white"
                          : "hover:bg-dark-accent/40 text-gray-300"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                          {account.full_name}
                          {isSelected && <Check className="w-3.5 h-3.5 text-enterprise-400" />}
                        </p>
                        <span className="text-[10px] text-gray-400">{account.department}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
