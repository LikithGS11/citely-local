"use client";

import React from "react";
import { X, Bot, CheckCircle2, Clock, Cpu, Database, FileText } from "lucide-react";

export interface AgentStep {
  agent_name: string;
  action: string;
  details: string;
  timestamp: number;
}

interface AgentStepsModalProps {
  steps: AgentStep[];
  onClose: () => void;
}

export const AgentStepsModal: React.FC<AgentStepsModalProps> = ({ steps, onClose }) => {
  const getAgentIcon = (name: string) => {
    if (name.includes("SQL")) return <Database className="w-4 h-4 text-amber-400" />;
    if (name.includes("Retrieval")) return <FileText className="w-4 h-4 text-enterprise-400" />;
    return <Cpu className="w-4 h-4 text-purple-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 border border-dark-border shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-dark-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">
                Multi-Agent Execution Transparency
              </h3>
              <p className="text-xs text-gray-400">
                Real-time thought trajectory and tool routing executed by the Coordinator Engine
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-dark-card hover:bg-dark-accent text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-2 flex-1">
          {steps.map((step, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-2 relative pl-10"
            >
              <div className="absolute left-3 top-4 w-6 h-6 rounded-full bg-dark-bg border border-dark-border flex items-center justify-center">
                {getAgentIcon(step.agent_name)}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-white flex items-center gap-2">
                  {step.agent_name}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-enterprise-500/20 text-enterprise-300 border border-enterprise-500/30">
                    {step.action}
                  </span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Completed
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-mono bg-dark-bg/60 p-3 rounded-lg border border-dark-border/60">
                {step.details}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-dark-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-enterprise-600 hover:bg-enterprise-500 text-white font-bold text-xs transition-colors"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};
