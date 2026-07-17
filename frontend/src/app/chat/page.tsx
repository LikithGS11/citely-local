"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  UserCircle, 
  Sparkles, 
  Cpu, 
  Database, 
  FileText, 
  RotateCcw, 
  CheckCircle2, 
  Loader2,
  Bookmark,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";
import { API_BASE } from "@/lib/api";
import { CitationCard, Citation } from "@/components/chat/CitationCard";
import { AgentStepsModal, AgentStep } from "@/components/chat/AgentStepsModal";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  agent_steps?: AgentStep[];
  unified_data?: any;
  latency_ms?: number;
}

export default function ChatAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: `Hello **${user.full_name.split(" ")[0]}**! I am your **Enterprise AI Knowledge Assistant**. \n\nI am securely connected to **${user.department} Department** archives, our **pgvector Hybrid Index**, and **PostgreSQL Financial tables**. You can ask me natural language questions and verify every response using our interactive **Source Citations** or view live **Multi-Agent Thought Steps**.`,
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStepsModal, setActiveStepsModal] = useState<AgentStep[] | null>(null);
  const [selectedCitationPreview, setSelectedCitationPreview] = useState<Citation | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const quickPrompts = [
    "What is the maternity leave policy for full-time employees, and how many weeks are paid?",
    "Which supplier has the highest delayed payments, and what do their contracts say about penalties?",
    "Explain the warehouse receiving process and quality inspection checklist.",
    "Summarize Supplier ABC's master agreement and payment terms."
  ];

  const handleSend = async (textToSend?: string) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim() || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages = [...messages, { id: userMsgId, role: "user" as const, content: prompt }];
    setMessages(newMessages);
    if (!textToSend) setInputPrompt("");
    setLoading(true);

    try {
      const historyPayload = newMessages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${API_BASE}/chat/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          conversation_id: `session-${user.id}`,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to communicate with AI Assistant server");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          citations: data.citations || [],
          agent_steps: data.agent_steps || [],
          unified_data: data.unified_data,
          latency_ms: data.latency_ms,
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            "⚠️ Could not reach the backend server. Please make sure the API is running at http://localhost:8000 (and that PostgreSQL is up), then try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content: `Conversation memory cleared. Ready for your next inquiry, **${user.full_name.split(" ")[0]}**!`,
      }
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-6xl mx-auto gap-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-6 py-3.5 rounded-2xl glass-panel border border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-enterprise-500 to-purple-500 flex items-center justify-center text-white shadow-glow-blue font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
              Hybrid RAG & Multi-Agent Assistant
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Citations Grounded
              </span>
            </h2>
            <p className="text-[11px] text-gray-400">
              Multi-turn conversation memory active • Department: **{user.department}**
            </p>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card hover:bg-dark-accent border border-dark-border text-xs font-semibold text-gray-300 hover:text-white transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
          Clear Memory
        </button>
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                msg.role === "user"
                  ? "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-sm"
                  : "bg-gradient-to-tr from-enterprise-600 to-blue-600 text-white font-bold"
              }`}
            >
              {msg.role === "user" ? <UserCircle className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
            </div>

            {/* Bubble Content */}
            <div
              className={`max-w-3xl rounded-2xl p-5 space-y-4 shadow-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-enterprise-900/80 to-purple-900/80 border border-enterprise-500/40 text-white"
                  : "glass-panel border border-dark-border text-gray-200"
              }`}
            >
              {/* Header inside assistant bubble */}
              {msg.role === "assistant" && msg.agent_steps && msg.agent_steps.length > 0 && (
                <div className="flex items-center justify-between border-b border-dark-border pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-enterprise-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Multi-Agent Execution Engine</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {msg.latency_ms && (
                      <span className="text-[10px] font-mono text-gray-400">
                        ⚡ {Math.round(msg.latency_ms)}ms
                      </span>
                    )}
                    <button
                      onClick={() => setActiveStepsModal(msg.agent_steps!)}
                      className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-enterprise-500/20 hover:bg-enterprise-500/30 text-enterprise-300 border border-enterprise-500/30 flex items-center gap-1 transition-all"
                    >
                      <Cpu className="w-3 h-3" />
                      View {msg.agent_steps.length} Agent Steps
                    </button>
                  </div>
                </div>
              )}

              {/* Text Body */}
              <div className="text-sm leading-relaxed whitespace-pre-line space-y-2 font-sans">
                {msg.content}
              </div>

              {/* Unified SQL Table Results if present */}
              {msg.unified_data && msg.unified_data.sql_payment_records && (
                <div className="mt-3 p-4 rounded-xl bg-dark-bg border border-dark-border space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      Structured PostgreSQL Query Results (Delayed Invoices)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20">
                      SQL + RAG Unified
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300 border-collapse">
                      <thead>
                        <tr className="border-b border-dark-border text-gray-400">
                          <th className="py-2 pr-4">Invoice #</th>
                          <th className="py-2 pr-4">Supplier</th>
                          <th className="py-2 pr-4">Amount (USD)</th>
                          <th className="py-2 pr-4">Delay Days</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {msg.unified_data.sql_payment_records.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-dark-border/40 font-mono">
                            <td className="py-2 pr-4 font-bold text-white">{row.invoice_number}</td>
                            <td className="py-2 pr-4">{row.supplier_name}</td>
                            <td className="py-2 pr-4 text-emerald-400">${row.amount_usd.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-rose-400 font-bold">{row.delay_days} days</td>
                            <td className="py-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Citations Grid */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-3 border-t border-dark-border space-y-2.5">
                  <p className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-enterprise-400" />
                    Verified Source Citations ({msg.citations.length}):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {msg.citations.map((c, idx) => (
                      <CitationCard
                        key={c.chunk_id || idx}
                        citation={c}
                        index={idx}
                        onPreview={(cit) => setSelectedCitationPreview(cit)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-enterprise-600 to-blue-600 flex items-center justify-center text-white font-bold animate-pulse">
              <Bot className="w-6 h-6" />
            </div>
            <div className="glass-panel px-6 py-4 rounded-2xl border border-dark-border flex items-center gap-3 text-xs text-gray-300 font-medium">
              <Loader2 className="w-4 h-4 text-enterprise-400 animate-spin" />
              <span>Coordinator Agent evaluating query semantics and hybrid pgvector index...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 px-1">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="p-3 rounded-xl glass-panel border border-dark-border hover:border-enterprise-500/50 text-left text-xs font-medium text-gray-300 hover:text-white transition-all flex items-center justify-between group"
            >
              <span className="line-clamp-1">{p}</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-enterprise-400 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="p-2 rounded-2xl glass-panel border border-dark-border focus-within:border-enterprise-500/60 shadow-lg transition-all flex items-center gap-2">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything about policies, supplier contracts, or SQL payment history..."
          disabled={loading}
          className="flex-1 bg-transparent border-none outline-none px-4 py-2.5 text-sm text-white placeholder:text-gray-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputPrompt.trim() || loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-enterprise-600 to-purple-600 hover:from-enterprise-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-glow-blue transition-all"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modals */}
      {activeStepsModal && (
        <AgentStepsModal steps={activeStepsModal} onClose={() => setActiveStepsModal(null)} />
      )}

      {selectedCitationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-panel rounded-2xl p-6 border border-dark-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div>
                <h3 className="font-extrabold text-base text-white">{selectedCitationPreview.document_title}</h3>
                <p className="text-xs text-gray-400">
                  Page {selectedCitationPreview.page_number} • Section: § {selectedCitationPreview.section_title}
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-400">{selectedCitationPreview.similarity_score}% Match</span>
            </div>
            <div className="p-4 rounded-xl bg-dark-bg font-mono text-xs text-gray-300 leading-relaxed max-h-64 overflow-y-auto border border-dark-border">
              {selectedCitationPreview.content_snippet}
            </div>
            <div className="flex justify-end pt-2 border-t border-dark-border">
              <button
                onClick={() => setSelectedCitationPreview(null)}
                className="px-4 py-2 rounded-xl bg-enterprise-600 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
