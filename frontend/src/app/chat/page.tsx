"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  UserCircle,
  Database,
  RotateCcw,
  Loader2,
  Bookmark,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";
import { useSettings } from "@/components/common/SettingsContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { API_BASE } from "@/lib/api";
import { Markdown } from "@/components/common/Markdown";
import { Button } from "@/components/ui/Button";
import { CitationCard, Citation } from "@/components/chat/CitationCard";
import { AgentSteps, AgentStep } from "@/components/chat/AgentSteps";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  agent_steps?: AgentStep[];
  unified_data?: any;
  latency_ms?: number;
  isError?: boolean;
}

class ServerError extends Error {}

const WELCOME: MessageItem = {
  id: "welcome-1",
  role: "assistant",
  content:
    "Hi, I'm your knowledge assistant. Ask me about company policies, supplier contracts, or payment history — every answer comes with citations to the source documents so you can verify it yourself.",
};

const QUICK_PROMPTS = [
  "What is the maternity leave policy for full-time employees, and how many weeks are paid?",
  "Which supplier has the highest delayed payments, and what do their contracts say about penalties?",
  "Explain the warehouse receiving process and quality inspection checklist.",
  "Summarize Supplier ABC's master agreement and payment terms.",
];

export default function ChatAssistantPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const compact = settings.density === "compact";
  const [messages, setMessages] = useState<MessageItem[]>([WELCOME]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCitationPreview, setSelectedCitationPreview] = useState<Citation | null>(null);
  useEscapeToClose(!!selectedCitationPreview, () => setSelectedCitationPreview(null));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversationId = `session-${user.id}`;

  // Restore the saved conversation from the server (it survives restarts)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/history?conversation_id=${encodeURIComponent(conversationId)}`);
        if (!res.ok) return;
        const rows: any[] = await res.json();
        if (cancelled || rows.length === 0) return;
        setMessages([
          WELCOME,
          ...rows.map((r, i) => ({
            id: `saved-${i}-${r.created_at}`,
            role: r.role,
            content: r.content,
            citations: r.citations || [],
            agent_steps: r.agent_steps || [],
            unified_data: r.unified_data,
            latency_ms: r.latency_ms ?? undefined,
          })),
        ]);
      } catch {
        // Backend unreachable: start with an empty conversation
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-grow the composer up to ~6 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [inputPrompt]);

  const handleSend = async (textToSend?: string) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim() || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages = [...messages, { id: userMsgId, role: "user" as const, content: prompt }];
    setMessages(newMessages);
    if (!textToSend) setInputPrompt("");
    setLoading(true);

    try {
      // Prior turns only: the current prompt is sent as `message`, and the static
      // welcome text and error bubbles are UI chrome, not conversation.
      const historyPayload = messages
        .filter((m) => m.id !== WELCOME.id && !m.isError)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          conversation_id: conversationId,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ServerError(body?.detail || `The server responded with ${res.status}.`);
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
          isError: true,
          content:
            err instanceof ServerError
              ? `The server couldn't answer: ${err.message}`
              : "Couldn't reach the backend server. Make sure the API is running at http://localhost:8000, then try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setMessages([WELCOME]);
    try {
      await fetch(`${API_BASE}/chat/history?conversation_id=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
    } catch {
      // Backend unreachable: the saved copy will reappear next time it loads
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto gap-3">
      {messages.length > 1 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={handleClear}>
            Clear conversation
          </Button>
        </div>
      )}

      {messages.length === 1 ? (
        /* Starting state — centered as one block instead of pinned to the
           top with a stretched-out empty gap below it. */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2">
          <div className="text-center space-y-3 max-w-md">
            <div className="w-9 h-9 rounded-full bg-accent-600 flex items-center justify-center text-white mx-auto">
              <Bot className="w-4 h-4" />
            </div>
            <p className="text-sm text-ink-secondary leading-relaxed">{WELCOME.content}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="p-3 rounded-xl bg-dark-card border border-dark-border hover:border-accent-500/40 text-left text-xs text-ink-secondary hover:text-ink-primary transition-colors flex items-center justify-between gap-2 group"
              >
                <span className="line-clamp-2">{p}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent-text shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : (
      /* Message stream */
      <div className={`flex-1 overflow-y-auto pr-1 ${compact ? "space-y-3" : "space-y-5"}`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`rounded-full flex items-center justify-center shrink-0 ${compact ? "w-6 h-6" : "w-8 h-8"} ${
                msg.role === "user" ? "bg-overlay/10 text-ink-secondary" : "bg-accent-600 text-white"
              }`}
            >
              {msg.role === "user" ? <UserCircle className="w-5 h-5" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl space-y-3 ${compact ? "px-3 py-2" : "px-4 py-3"} ${
                msg.role === "user"
                  ? "bg-accent-600/15 border border-accent-500/20 text-ink-primary"
                  : msg.isError
                    ? "bg-status-critical/10 border border-status-critical/25 text-status-critical text-sm"
                    : "bg-dark-card border border-dark-border"
              }`}
            >
              {msg.role === "assistant" && !msg.isError ? (
                <Markdown content={msg.content} />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
              )}

              {/* Structured SQL results */}
              {msg.unified_data?.sql_payment_records && (
                <div className="p-3 rounded-xl bg-dark-bg border border-dark-border space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
                    <Database className="w-3.5 h-3.5" />
                    Payment records (from database)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-dark-border text-ink-muted">
                          <th className="py-1.5 pr-4 font-medium">Invoice</th>
                          <th className="py-1.5 pr-4 font-medium">Supplier</th>
                          <th className="py-1.5 pr-4 font-medium">Amount</th>
                          <th className="py-1.5 pr-4 font-medium">Delay</th>
                          <th className="py-1.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {msg.unified_data.sql_payment_records.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-dark-border/60">
                            <td className="py-1.5 pr-4 font-medium text-ink-primary">{row.invoice_number}</td>
                            <td className="py-1.5 pr-4 text-ink-secondary">{row.supplier_name}</td>
                            <td className="py-1.5 pr-4 text-ink-secondary">${row.amount_usd.toLocaleString()}</td>
                            <td className="py-1.5 pr-4 text-status-critical">{row.delay_days}d</td>
                            <td className="py-1.5 text-ink-muted">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2 border-t border-dark-border space-y-2">
                  <p className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5" />
                    {msg.citations.length} source{msg.citations.length > 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.citations.map((c, idx) => (
                      <CitationCard key={c.chunk_id || idx} citation={c} index={idx} onPreview={setSelectedCitationPreview} />
                    ))}
                  </div>
                </div>
              )}

              {msg.agent_steps && msg.agent_steps.length > 0 && (
                <div className="pt-1">
                  <AgentSteps steps={msg.agent_steps} defaultOpen={settings.autoExpandReasoning} />
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center text-white shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-dark-card border border-dark-border rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-ink-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking — this can take up to a minute on a local model
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 p-2 rounded-2xl bg-dark-card border border-dark-border focus-within:border-accent-500/50 transition-colors">
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about policies, contracts, or payment history…"
          disabled={loading}
          className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted max-h-40"
        />
        <Button
          variant="primary"
          onClick={() => handleSend()}
          disabled={!inputPrompt.trim() || loading}
          icon={<Send className="w-3.5 h-3.5" />}
        >
          Send
        </Button>
      </div>

      {/* Citation preview */}
      {selectedCitationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setSelectedCitationPreview(null)}>
          <div
            className="w-full max-w-xl bg-dark-card rounded-2xl p-5 border border-dark-border shadow-card space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div>
                <h3 className="font-semibold text-sm text-ink-primary">{selectedCitationPreview.document_title}</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Page {selectedCitationPreview.page_number} · {selectedCitationPreview.section_title}
                </p>
              </div>
              <span className="text-xs font-medium text-status-good">{selectedCitationPreview.similarity_score}% match</span>
            </div>
            <div className="p-3 rounded-xl bg-dark-bg text-xs text-ink-secondary leading-relaxed max-h-64 overflow-y-auto border border-dark-border">
              {selectedCitationPreview.content_snippet}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="secondary" size="sm" onClick={() => setSelectedCitationPreview(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
