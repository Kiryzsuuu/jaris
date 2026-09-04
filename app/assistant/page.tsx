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
      <div className="card flex overflow-hidden p-0" style={{ height: "calc(100vh - 220px)", minHeight: 420 }}>
        <aside className="border-secondary-200 w-[260px] shrink-0 overflow-y-auto border-r p-4">
          <button onClick={startNewConversation} className="btn btn-primary mb-3 w-full">
            <i className="ti ti-plus mr-1" /> Percakapan Baru
          </button>
          <h2 className="text-secondary-400 mb-2 text-xs font-semibold tracking-wide uppercase">
            Riwayat
          </h2>
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => openConversation(c.conversationId)}
              className={`mb-1 block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                c.conversationId === conversationId ? "bg-primary-50 text-primary-700" : "text-[#1e293b]"
              }`}
            >
              {c.lastMessage}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-secondary-400 text-xs">Belum ada riwayat percakapan</p>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary-600 self-end text-white" : "bg-primary-50 self-start text-[#1e293b]"
                }`}
              >
                {m.content}
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <div className="text-secondary-400 mt-2 text-xs">
                    <strong>Sumber:</strong>
                    <ul className="mt-1 list-disc pl-4">
                      {m.sources.map((s, j) => (
                        <li key={j}>{s.documentTitle} (bagian #{s.chunkIndex}, skor {s.score.toFixed(2)})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.role === "assistant" && m.isGrounded === false && (
                  <div className="text-warning-600 mt-2 text-xs">
                    <i className="ti ti-alert-triangle mr-1" />
                    Tidak ditemukan di knowledge base
                  </div>
                )}
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-secondary-400 text-sm">
                Tanyakan sesuatu, mis. &quot;Berapa santunan meninggal dunia untuk kendaraan darat?&quot;
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-danger-600 px-4 text-sm">{error}</p>}

          <form onSubmit={handleSend} className="border-secondary-200 flex gap-2 border-t p-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan Anda..."
              className="form-control"
            />
            <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary">
              {sending ? "Mengirim..." : "Kirim"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
