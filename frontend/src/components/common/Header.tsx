"use client";

import React, { useState } from "react";
import { 
  Shield, 
  Building2, 
  UserCircle2, 
  ChevronDown, 
  Check, 
  Sparkles,
  Terminal,
  FileText
} from "lucide-react";
import { useAuth, User } from "./AuthContext";

export const Header: React.FC = () => {
  const { user, demoAccounts, switchUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "manager":
        return "bg-enterprise-500/20 text-enterprise-300 border-enterprise-500/40";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/40";
    }
  };

  return (
    <header className="h-16 glass-panel border-b border-dark-border px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left info area */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg/60 border border-dark-border text-xs text-gray-300 font-medium">
          <Terminal className="w-3.5 h-3.5 text-enterprise-400" />
          <span>Active Clearance:</span>
          <span className="text-white font-bold uppercase">{user.department} Department</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>RBAC & Citation Verification Enabled</span>
        </div>
      </div>

      {/* Right / Demo Account Switcher & Profile */}
      <div className="flex items-center gap-4 relative">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-white leading-tight">{user.full_name}</p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <Building2 className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] text-gray-400">{user.department}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold uppercase ml-1 ${getRoleBadgeColor(user.role)}`}>
              {user.role}
            </span>
          </div>
        </div>

        {/* Profile / Switcher Dropdown Button */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 p-1.5 pl-3 rounded-xl bg-dark-card border border-dark-border hover:border-enterprise-500/50 transition-all shadow-sm group"
          title="Switch Demo Role Account"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-enterprise-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
            {user.full_name.split(" ")[0][0]}
            {user.full_name.split(" ").length > 1 ? user.full_name.split(" ")[1][0] : ""}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setDropdownOpen(false)} 
            />
            <div className="absolute right-0 top-14 w-80 glass-panel rounded-2xl p-4 shadow-2xl border border-dark-border z-50 space-y-3">
              <div className="border-b border-dark-border pb-2.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                  Quick Demo Role Switcher
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Select an account to instantly verify RBAC departmental isolation & permissions:
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
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          {account.full_name}
                          {isSelected && <Check className="w-3.5 h-3.5 text-enterprise-400" />}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400">{account.department} Dept</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold uppercase ${getRoleBadgeColor(account.role)}`}>
                            {account.role}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-dark-border text-center">
                <span className="text-[10px] text-gray-400">
                  ⚡ RBAC security enforcement is active on all API calls
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
