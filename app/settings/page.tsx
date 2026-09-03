"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type Settings = {
  siteName: string;
  tagline: string;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  heroImageDataUrl: string | null;
  sectionImageDataUrl: string | null;
  heroHeadline: string;
  heroSubheadline: string;
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
    primaryColor: "#0A3D91",
    heroHeadline: "",
    heroSubheadline: "",
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [heroImageDataUrl, setHeroImageDataUrl] = useState<string | null>(null);
  const [sectionImageDataUrl, setSectionImageDataUrl] = useState<string | null>(null);

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
        heroHeadline: data.heroHeadline,
        heroSubheadline: data.heroSubheadline,
      });
      setLogoDataUrl(data.logoDataUrl);
      setFaviconDataUrl(data.faviconDataUrl);
      setHeroImageDataUrl(data.heroImageDataUrl);
      setSectionImageDataUrl(data.sectionImageDataUrl);
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
    setLogoDataUrl(await fileToDataUrl(file));
  }

  async function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconDataUrl(await fileToDataUrl(file));
  }

  async function handleHeroImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroImageDataUrl(await fileToDataUrl(file));
  }

  async function handleSectionImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSectionImageDataUrl(await fileToDataUrl(file));
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
          heroImageDataUrl: heroImageDataUrl ?? "",
          sectionImageDataUrl: sectionImageDataUrl ?? "",
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
        <p className="text-danger-600">{error ?? "Gagal memuat pengaturan"}</p>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Pengaturan Situs" pageSubtitle="Identitas, halaman depan, warna tema, dan footer di seluruh aplikasi">
      <form onSubmit={handleSave} className="grid max-w-[960px] grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="card-body">
            <h2 className="mb-3 text-base font-semibold text-[#1d2630]">Identitas Situs</h2>

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

            <div className="mb-1">
              <label className="form-label">Warna Utama</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="border-secondary-200 block h-9 w-[60px] rounded-lg border p-0"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="mb-3 text-base font-semibold text-[#1d2630]">Logo &amp; Favicon</h2>

            <div className="mb-3">
              <label className="form-label">Logo (base64 di database)</label>
              <input type="file" accept="image/*" className="form-control" onChange={handleLogoChange} />
              {logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
                <img src={logoDataUrl} alt="Logo preview" className="mt-2 max-h-16" />
              )}
            </div>

            <div className="mb-1">
              <label className="form-label">Favicon (base64 di database)</label>
              <input type="file" accept="image/*" className="form-control" onChange={handleFaviconChange} />
              {faviconDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
                <img src={faviconDataUrl} alt="Favicon preview" className="mt-2 max-h-8" />
              )}
            </div>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-body">
            <h2 className="mb-3 text-base font-semibold text-[#1d2630]">Halaman Depan (Landing Page)</h2>

            <div className="mb-3">
              <label className="form-label">Judul Hero</label>
              <input
                required
                className="form-control"
                value={form.heroHeadline}
                onChange={(e) => setForm((f) => ({ ...f, heroHeadline: e.target.value }))}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Sub-judul Hero</label>
              <textarea
                required
                rows={2}
                className="form-control"
                value={form.heroSubheadline}
                onChange={(e) => setForm((f) => ({ ...f, heroSubheadline: e.target.value }))}
              />
            </div>

            <div className="mb-1">
              <label className="form-label">Gambar Hero (base64 di database, disarankan rasio landscape)</label>
              <input type="file" accept="image/*" className="form-control" onChange={handleHeroImageChange} />
              {heroImageDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
                <img
                  src={heroImageDataUrl}
                  alt="Hero preview"
                  className="mt-2 block max-h-[180px] rounded-xl"
                />
              )}
            </div>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-body">
            <h2 className="mb-1 text-base font-semibold text-[#1d2630]">Gambar Bagian Alur Kerja</h2>
            <p className="text-secondary-400 mb-3 text-xs">
              Ditampilkan pada bagian &quot;Cara Kerja&quot; di halaman depan supaya tidak kosong hanya berisi ikon.
              Opsional - bagian ikon akan tetap tampil jika gambar ini tidak diisi.
            </p>
            <input type="file" accept="image/*" className="form-control" onChange={handleSectionImageChange} />
            {sectionImageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
              <img
                src={sectionImageDataUrl}
                alt="Preview gambar bagian"
                className="mt-2 block max-h-[180px] rounded-xl"
              />
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {message && <p className="text-secondary-400 mb-2 text-sm">{message}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-fit">
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
