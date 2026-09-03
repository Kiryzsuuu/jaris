"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";

type Source = { documentId: string; documentTitle: string; chunkIndex: number; score: number };
type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isGrounded?: boolean;
};
type ConversationSummary = {
  conversationId: string;
  lastMessage: string;
  lastRole: string;
  updatedAt: string;
};

export default function AssistantPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/assistant/chat").then((r) => r.json());
    if (res.success) setConversations(res.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openConversation(id: string) {
    setConversationId(id);
    setError(null);
    const res = await fetch(`/api/assistant/chat/${id}`).then((r) => r.json());
    if (res.success) {
      setMessages(
        res.data.map((m: Message & { isGrounded: boolean }) => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
          isGrounded: m.isGrounded,
        }))
      );
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? "Gagal mendapatkan jawaban");
        return;
      }

      setConversationId(json.data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.data.answer,
          sources: json.data.sources,
          isGrounded: json.data.grounded,
        },
      ]);
      loadConversations();
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      pageTitle="AI Asisten Internal"
      pageSubtitle="Jawaban berbasis knowledge base internal (RAG) - bukan mengarang jawaban"
    >
      <div className="card p-0" style={{ height: "calc(100vh - 220px)", minHeight: 420, display: "flex", overflow: "hidden" }}>
        <aside style={{ width: 260, borderRight: "1px solid var(--border-light)", padding: 16, overflowY: "auto", flexShrink: 0 }}>
          <button onClick={startNewConversation} className="btn btn-dark w-100 mb-3">
            <i className="bi bi-plus-lg me-1" /> Percakapan Baru
          </button>
          <h2 className="text-muted-green" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Riwayat
          </h2>
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => openConversation(c.conversationId)}
              className="btn text-start w-100 mb-1"
              style={{
                fontSize: 13,
                background: c.conversationId === conversationId ? "var(--bs-body-bg)" : "transparent",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {c.lastMessage}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-muted-green" style={{ fontSize: 12 }}>Belum ada riwayat percakapan</p>
          )}
        </aside>

        <section style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "70%",
                  background: m.role === "user" ? "var(--brand-forest-dark)" : "var(--bs-body-bg)",
                  color: m.role === "user" ? "white" : "var(--text-main)",
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 14,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <div className="mt-2 text-muted-green" style={{ fontSize: 12 }}>
                    <strong>Sumber:</strong>
                    <ul style={{ paddingLeft: 16, margin: "4px 0 0" }}>
                      {m.sources.map((s, j) => (
                        <li key={j}>{s.documentTitle} (bagian #{s.chunkIndex}, skor {s.score.toFixed(2)})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.role === "assistant" && m.isGrounded === false && (
                  <div className="mt-2" style={{ fontSize: 12, color: "var(--sys-orange)" }}>
                    <i className="bi bi-exclamation-triangle me-1" />
                    Tidak ditemukan di knowledge base
                  </div>
                )}
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-muted-green" style={{ fontSize: 14 }}>
                Tanyakan sesuatu, mis. &quot;Berapa santunan meninggal dunia untuk kendaraan darat?&quot;
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-danger px-3" style={{ fontSize: 13 }}>{error}</p>}

          <form onSubmit={handleSend} className="d-flex gap-2 p-3" style={{ borderTop: "1px solid var(--border-light)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan Anda..."
              className="form-control"
            />
            <button type="submit" disabled={sending || !input.trim()} className="btn btn-dark">
              {sending ? "Mengirim..." : "Kirim"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
