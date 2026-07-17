"use client";

import React, { useState, useEffect } from "react";
import { Shield, Users, CheckCircle2, Lock, AlertTriangle, UserCheck } from "lucide-react";
import { useAuth, User } from "@/components/common/AuthContext";

export default function AdminSecurityPage() {
  const { user, demoAccounts } = useAuth();
  const [userList, setUserList] = useState<User[]>(demoAccounts);
  const [auditLogs] = useState([
    { action: "UPLOAD_DOCUMENT", user: "admin@enterprise.ai", resource: "Supplier ABC Master Agreement 2026", timestamp: "10 mins ago", status: "SUCCESS" },
    { action: "SEARCH_SEMANTIC", user: "hr@enterprise.ai", resource: "Maternity leave policy paid weeks", timestamp: "24 mins ago", status: "SUCCESS" },
    { action: "COMPARE_VERSIONS", user: "finance@enterprise.ai", resource: "Supplier ABC Master Agreement (v1 vs v2)", timestamp: "1 hour ago", status: "SUCCESS" },
    { action: "ACCESS_DENIED", user: "engineer@enterprise.ai", resource: "HR Executive Compensation Strategy (Restricted)", timestamp: "2 hours ago", status: "BLOCKED (RBAC)" },
    { action: "SQL_RAG_QUERY", user: "finance@enterprise.ai", resource: "PaymentHistory Table + Supplier ABC Contract", timestamp: "3 hours ago", status: "SUCCESS" }
  ]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            Enterprise Security & RBAC Administration
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Clearance Oversight
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage user roles (`admin`, `manager`, `viewer`) and monitor real-time security access logs across all departments.
          </p>
        </div>
      </div>

      {/* RBAC Users Table */}
      <div className="glass-panel p-6 rounded-2xl border border-dark-border space-y-4">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-enterprise-400" />
            Registered Enterprise Accounts & Role Assignments
          </h3>
          <span className="text-xs text-gray-400 font-mono">{userList.length} Accounts Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300 border-collapse">
            <thead>
              <tr className="border-b border-dark-border text-gray-400">
                <th className="py-3 pr-4 font-bold">Employee Name</th>
                <th className="py-3 pr-4 font-bold">Email Address</th>
                <th className="py-3 pr-4 font-bold">Department Scope</th>
                <th className="py-3 pr-4 font-bold">Assigned Role</th>
                <th className="py-3 font-bold">Clearance Level</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} className="border-b border-dark-border/40 font-sans">
                  <td className="py-3 pr-4 font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-enterprise-400" />
                    {u.full_name}
                  </td>
                  <td className="py-3 pr-4 font-mono text-gray-400">{u.email}</td>
                  <td className="py-3 pr-4 font-semibold">{u.department}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                      u.role === "admin" 
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                        : "bg-enterprise-500/20 text-enterprise-300 border border-enterprise-500/30"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-gray-300">
                    {u.role === "admin" ? "Restricted + Universal" : "Confidential + Departmental"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Log Stream */}
      <div className="glass-panel p-6 rounded-2xl border border-dark-border space-y-4">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            Live Security Audit & Access History Stream
          </h3>
          <span className="text-xs text-emerald-400 font-bold">● Active Audit</span>
        </div>

        <div className="space-y-2.5 font-mono text-xs">
          {auditLogs.map((log, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-dark-card border border-dark-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                  log.status.includes("BLOCKED") ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-enterprise-500/20 text-enterprise-300"
                }`}>
                  {log.action}
                </span>
                <div className="min-w-0">
                  <span className="text-white font-semibold">{log.user}</span>
                  <span className="text-gray-400 ml-2 truncate">{"->"} {log.resource}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-bold ${log.status.includes("BLOCKED") ? "text-rose-400" : "text-emerald-400"}`}>
                  {log.status}
                </span>
                <span className="text-gray-500">{log.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
