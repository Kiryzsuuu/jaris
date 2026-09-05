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

const SUGGESTED_QUESTIONS = [
  "Apa SOP verifikasi klaim kecelakaan di JARIS?",
  "Berapa batas waktu pengajuan klaim santunan Jasa Raharja?",
  "Prosedur klaim untuk korban meninggal dunia di Jasa Raharja",
];

// Minimal typing for the Web Speech API - not in standard lib.dom.d.ts, and
// only available in some browsers (mainly Chromium-based). Voice input is
// entirely client-side; there's no backend speech-to-text service here.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: { transcript: string }[][] } | SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

export default function AssistantPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kbCount, setKbCount] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/assistant/chat").then((r) => r.json());
    if (res.success) setConversations(res.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadConversations();
    fetch("/api/kb/documents/count")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setKbCount(json.data.count);
      })
      .catch(() => {});

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "id-ID";
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const results = (event as SpeechRecognitionEventLike).results;
        const transcript = results[results.length - 1]?.[0]?.transcript;
        if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognitionRef.current = recognition;
    }
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleVoiceInput() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }

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

  async function sendMessage(text: string) {
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(input.trim());
  }

  return (
    <AppShell
      pageTitle="AI Asisten Internal"
      pageSubtitle="Jawaban berbasis knowledge base internal (RAG) - bukan mengarang jawaban"
    >
      <div className="assistant-shell">
        <aside className="assistant-sidebar">
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
              className={`assistant-conv-item ${c.conversationId === conversationId ? "is-active" : ""}`}
            >
              {c.lastMessage}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-secondary-400 text-xs">Belum ada riwayat percakapan</p>
          )}
        </aside>

        <section className="assistant-main">
          <div className="assistant-header">
            <p className="mb-0 text-sm font-semibold text-[#1e293b]">
              <i className="ti ti-sparkles text-accent-500 mr-1.5" /> JARIS AI Asisten Internal
            </p>
            {kbCount !== null && (
              <span className="assistant-rag-badge">
                <span className="assistant-rag-dot" />
                RAG Aktif - {kbCount} Dokumen
              </span>
            )}
          </div>

          <div className="assistant-messages">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <span className="assistant-avatar">
                    <i className="ti ti-robot" />
                  </span>
                )}
                <div className={`assistant-bubble ${m.role === "user" ? "is-user" : "is-assistant"}`}>
                  {m.content}
                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.sources.map((s, j) => (
                        <span key={j} className="assistant-source-pill">
                          <i className="ti ti-file-text" />
                          {s.documentTitle} #{s.chunkIndex}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && m.isGrounded === false && (
                    <div className="text-warning-600 mt-2 text-xs">
                      <i className="ti ti-alert-triangle mr-1" />
                      Tidak ditemukan di knowledge base
                    </div>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div>
                <p className="text-secondary-400 mb-0 text-sm">
                  Tanyakan sesuatu, mis. &quot;Berapa santunan meninggal dunia untuk kendaraan darat?&quot;
                </p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-danger-600 px-4 text-sm">{error}</p>}

          {messages.length === 0 && (
            <div className="assistant-suggestions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="assistant-suggestion-chip"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="assistant-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan Anda..."
              className="form-control"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`btn btn-sm ${listening ? "btn-danger" : "btn-outline-primary"}`}
                title="Input suara"
              >
                <i className={`ti ${listening ? "ti-microphone-off" : "ti-microphone"}`} />
              </button>
            )}
            <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary">
              {sending ? "Mengirim..." : "Kirim"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
