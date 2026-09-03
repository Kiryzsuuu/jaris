"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type Settings = {
  siteName: string;
  tagline: string;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  primaryColor: string;
  footerText: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    siteName: "",
    tagline: "",
    footerText: "",
    primaryColor: "#111827",
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings").then((r) => r.json());
      if (!res.success) {
        setError(res.message ?? "Gagal memuat pengaturan");
        return;
      }
      const data: Settings = res.data;
      setSettings(data);
      setForm({
        siteName: data.siteName,
        tagline: data.tagline,
        footerText: data.footerText,
        primaryColor: data.primaryColor,
      });
      setLogoDataUrl(data.logoDataUrl);
      setFaviconDataUrl(data.faviconDataUrl);
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

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setLogoDataUrl(dataUrl);
  }

  async function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setFaviconDataUrl(dataUrl);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          logoDataUrl: logoDataUrl ?? "",
          faviconDataUrl: faviconDataUrl ?? "",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage(json.message ?? "Gagal menyimpan pengaturan");
        return;
      }
      setMessage("Pengaturan berhasil disimpan. Muat ulang halaman lain untuk melihat perubahan.");
    } catch {
      setMessage("Tidak dapat menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell pageTitle="Pengaturan Situs">
        <p>Memuat...</p>
      </AppShell>
    );
  }
  if (error || !settings) {
    return (
      <AppShell pageTitle="Pengaturan Situs">
        <p className="text-danger">{error ?? "Gagal memuat pengaturan"}</p>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Pengaturan Situs" pageSubtitle="Nama, logo, warna tema, dan footer di seluruh aplikasi">
      <form onSubmit={handleSave} className="card" style={{ maxWidth: 560 }}>
        <div className="mb-3">
          <label className="form-label">Nama Situs</label>
          <input
            required
            className="form-control"
            value={form.siteName}
            onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Tagline</label>
          <input
            className="form-control"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Teks Footer</label>
          <input
            className="form-control"
            value={form.footerText}
            onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Warna Utama</label>
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            style={{ display: "block", width: 60, height: 36, padding: 0, border: "1px solid var(--border-light)", borderRadius: 8 }}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Logo (disimpan sebagai base64 di database)</label>
          <input type="file" accept="image/*" className="form-control" onChange={handleLogoChange} />
          {logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
            <img src={logoDataUrl} alt="Logo preview" className="mt-2" style={{ maxHeight: 64 }} />
          )}
        </div>

        <div className="mb-3">
          <label className="form-label">Favicon (disimpan sebagai base64 di database)</label>
          <input type="file" accept="image/*" className="form-control" onChange={handleFaviconChange} />
          {faviconDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
            <img src={faviconDataUrl} alt="Favicon preview" className="mt-2" style={{ maxHeight: 32 }} />
          )}
        </div>

        {message && <p style={{ fontSize: 13 }} className="mb-3">{message}</p>}

        <button type="submit" disabled={saving} className="btn btn-dark" style={{ width: "fit-content" }}>
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </form>
    </AppShell>
  );
}
