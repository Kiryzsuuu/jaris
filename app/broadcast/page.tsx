"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  audienceLabel: string;
  createdByName: string;
  recipientCount: number;
  emailsSent: number;
  createdAt: string;
};

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Semua Pengguna" },
  { value: "petugas-lapangan", label: "Petugas Lapangan" },
  { value: "verifikator-kepala-cabang", label: "Verifikator/Kepala Cabang" },
  { value: "direksi-manajemen", label: "Direksi/Manajemen" },
  { value: "super-admin", label: "Super Admin" },
];

export default function BroadcastPage() {
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts").then((r) => r.json());
      if (!res.success) {
        setError(res.message ?? "Gagal memuat riwayat broadcast");
      } else {
        setHistory(res.data);
      }
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData();
  }, [loadData]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendMessage(null);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, audience }),
      });
      const json = await res.json();
      if (!json.success) {
        setSendMessage(json.message ?? "Gagal mengirim broadcast");
        return;
      }
      setSendMessage(json.message);
      setTitle("");
      setMessage("");
      loadData();
    } catch {
      setSendMessage("Tidak dapat menghubungi server");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      pageTitle="Broadcast Pengumuman"
      pageSubtitle="Kirim pengumuman ke pengguna JARIS - tampil sebagai banner di aplikasi dan lewat email"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="card self-start">
          <div className="card-body">
            <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Buat Broadcast</h2>

            <form onSubmit={handleSend}>
              <div className="mb-3">
                <label className="form-label">Judul</label>
                <input
                  required
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. Pemeliharaan Sistem Terjadwal"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Audiens</label>
                <select className="form-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-1">
                <label className="form-label">Pesan</label>
                <textarea
                  required
                  rows={5}
                  className="form-control"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tulis pengumuman Anda..."
                />
              </div>

              {sendMessage && <p className="text-secondary-400 mt-3 mb-0 text-sm">{sendMessage}</p>}

              <button type="submit" disabled={sending} className="btn btn-primary mt-4">
                <i className="ti ti-send mr-1" />
                {sending ? "Mengirim..." : "Kirim Broadcast"}
              </button>
            </form>
          </div>
        </div>

        <div className="card self-start">
          <div className="card-body">
            <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Riwayat Broadcast</h2>

            {loading && <p>Memuat...</p>}
            {error && <p className="text-danger-600">{error}</p>}

            {!loading && !error && (
              <ul className="space-y-3 text-sm">
                {history.map((b) => (
                  <li key={b.id} className="border-secondary-200 border-b pb-3 last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{b.title}</strong>
                      <span className="badge bg-secondary-100 text-secondary-700">{b.audienceLabel}</span>
                    </div>
                    <p className="mt-1 mb-1">{b.message}</p>
                    <p className="text-secondary-400 text-xs">
                      Oleh {b.createdByName} - {new Date(b.createdAt).toLocaleString("id-ID")} - {b.recipientCount} penerima ({b.emailsSent} email terkirim)
                    </p>
                  </li>
                ))}
                {history.length === 0 && <li className="text-secondary-400">Belum ada broadcast</li>}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
