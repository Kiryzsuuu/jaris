"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type KbDoc = {
  id: string;
  title: string;
  category: string;
  sourceType: string;
  chunkCount: number;
  isActive: boolean;
  createdAt: string;
};

const SOURCE_TYPES = [
  { value: "text", label: "Teks polos" },
  { value: "markdown", label: "Markdown" },
  { value: "pdf", label: "Unggah PDF" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [sourceType, setSourceType] = useState("markdown");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kb/documents").then((r) => r.json());
      if (!res.success) {
        setError(res.message ?? "Gagal memuat knowledge base");
      } else {
        setDocs(res.data);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMessage(null);
    try {
      const payload: Record<string, unknown> = { title, category, sourceType };
      if (sourceType === "pdf") {
        if (!file) {
          setFormMessage("Pilih file PDF terlebih dahulu");
          return;
        }
        payload.fileBase64 = await fileToBase64(file);
      } else {
        payload.content = content;
      }

      const res = await fetch("/api/kb/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setFormMessage(json.message ?? "Gagal menambahkan dokumen");
        return;
      }
      setFormMessage(`Dokumen ditambahkan (${json.data.chunkCount} bagian diindeks).`);
      setTitle("");
      setCategory("");
      setContent("");
      setFile(null);
      loadData();
    } catch {
      setFormMessage("Tidak dapat menghubungi server");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/kb/documents/${id}`, { method: "DELETE" });
      loadData();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell
      pageTitle="Knowledge Base"
      pageSubtitle="Dokumen referensi yang menjadi sumber jawaban AI Asisten (RAG) - bukan pengetahuan bebas"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="card self-start">
          <div className="card-body">
            <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Tambah Dokumen</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Judul</label>
                <input
                  required
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. SOP Verifikasi Klaim Meninggal Dunia"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Kategori</label>
                <input
                  required
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="mis. SOP, Tarif Santunan, Regulasi"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Jenis sumber</label>
                <select className="form-select" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                  {SOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {sourceType === "pdf" ? (
                <div className="mb-1">
                  <label className="form-label">File PDF</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    required
                    className="form-control"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              ) : (
                <div className="mb-1">
                  <label className="form-label">Isi dokumen</label>
                  <textarea
                    required
                    rows={10}
                    className="form-control"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tempel isi dokumen di sini..."
                  />
                </div>
              )}

              {formMessage && <p className="text-secondary-400 mt-3 mb-0 text-sm">{formMessage}</p>}

              <button type="submit" disabled={submitting} className="btn btn-primary mt-4">
                {submitting ? "Memproses..." : "Ingest ke Knowledge Base"}
              </button>
            </form>
          </div>
        </div>

        <div className="card self-start">
          <div className="card-body">
            <h2 className="mb-4 text-base font-semibold text-[#1e293b]">Dokumen Tersimpan</h2>

            {loading && <p>Memuat...</p>}
            {error && <p className="text-danger-600">{error}</p>}

            {!loading && !error && (
              <div className="table-responsive">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Judul</th>
                      <th>Kategori</th>
                      <th>Sumber</th>
                      <th>Bagian</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id}>
                        <td>{d.title}</td>
                        <td>{d.category}</td>
                        <td>{d.sourceType}</td>
                        <td>{d.chunkCount}</td>
                        <td>
                          <button
                            onClick={() => handleDelete(d.id)}
                            disabled={deletingId === d.id}
                            className="btn btn-outline-danger btn-sm"
                          >
                            {deletingId === d.id ? "Menghapus..." : "Hapus"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {docs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-secondary-400 py-4 text-center">
                          Belum ada dokumen di knowledge base
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
