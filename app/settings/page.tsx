"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ALL_LANDING_CARDS } from "@/lib/landingContent";

type Settings = {
  siteName: string;
  tagline: string;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  heroImageDataUrls: string[];
  sectionImageDataUrl: string | null;
  loginImageDataUrl: string | null;
  cardImages: Record<string, string>;
  heroHeadline: string;
  heroSubheadline: string;
  primaryColor: string;
  secondaryColor: string;
  aiColor: string;
  highlightColor: string;
  accentColor: string;
  backgroundColor: string;
  sidebarColor: string;
  footerText: string;
};

// Gold (accentColor/highlightColor) is intentionally absent: it's a fixed
// brand color in app/globals.css, since every gold surface in the app is
// paired with navy text and an arbitrary color there breaks legibility.
const COLOR_FIELDS = [
  { key: "primaryColor", label: "Navy (Utama)", desc: "Warna utama - tombol, tautan, header, hero" },
  { key: "secondaryColor", label: "Biru (Sekunder)", desc: "Elemen sekunder" },
  { key: "aiColor", label: "Biru (Aktif/Aksen)", desc: "Status aktif, ikon, dan aksen biru" },
  { key: "backgroundColor", label: "Abu Muda (Background)", desc: "Warna latar halaman" },
  { key: "sidebarColor", label: "Warna Sidebar", desc: "Latar sidebar navigasi aplikasi" },
] as const;

const MAX_HERO_IMAGES = 6;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    siteName: "",
    tagline: "",
    footerText: "",
    primaryColor: "#0B2D6B",
    secondaryColor: "#1B4FA0",
    aiColor: "#1B4FA0",
    highlightColor: "#F2A900",
    accentColor: "#F2A900",
    backgroundColor: "#F8FAFC",
    sidebarColor: "#0B2D6B",
    heroHeadline: "",
    heroSubheadline: "",
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [heroImageDataUrls, setHeroImageDataUrls] = useState<string[]>([]);
  const [sectionImageDataUrl, setSectionImageDataUrl] = useState<string | null>(null);
  const [loginImageDataUrl, setLoginImageDataUrl] = useState<string | null>(null);
  const [cardImages, setCardImages] = useState<Record<string, string>>({});

  const [demoCounts, setDemoCounts] = useState<{ claims: number; claimants: number; payments: number; accidentPoints: number } | null>(null);
  const [deletingDemo, setDeletingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const loadDemoCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/demo-data").then((r) => r.json());
      if (res.success) setDemoCounts(res.data);
    } catch {
      /* non-critical - just hide the card if this fails */
    }
  }, []);

  async function handleDeleteDemoData() {
    if (!confirm("Hapus semua data contoh (klaim, penerima santunan, pencairan, titik kecelakaan)? Tindakan ini tidak bisa dibatalkan.")) {
      return;
    }
    setDeletingDemo(true);
    setDemoMessage(null);
    try {
      const res = await fetch("/api/demo-data", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setDemoMessage(json.message ?? "Gagal menghapus data contoh");
        return;
      }
      setDemoMessage("Data contoh berhasil dihapus.");
      loadDemoCounts();
    } catch {
      setDemoMessage("Tidak dapat menghubungi server");
    } finally {
      setDeletingDemo(false);
    }
  }

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
        secondaryColor: data.secondaryColor,
        aiColor: data.aiColor,
        highlightColor: data.highlightColor,
        accentColor: data.accentColor,
        backgroundColor: data.backgroundColor,
        sidebarColor: data.sidebarColor,
        heroHeadline: data.heroHeadline,
        heroSubheadline: data.heroSubheadline,
      });
      setLogoDataUrl(data.logoDataUrl);
      setFaviconDataUrl(data.faviconDataUrl);
      setHeroImageDataUrls(data.heroImageDataUrls);
      setSectionImageDataUrl(data.sectionImageDataUrl);
      setLoginImageDataUrl(data.loginImageDataUrl);
      setCardImages(data.cardImages ?? {});
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData();
    loadDemoCounts();
  }, [loadData, loadDemoCounts]);

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

  async function handleHeroImagesAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newDataUrls = await Promise.all(files.map(fileToDataUrl));
    setHeroImageDataUrls((prev) => [...prev, ...newDataUrls].slice(0, MAX_HERO_IMAGES));
    e.target.value = "";
  }

  function handleHeroImageRemove(index: number) {
    setHeroImageDataUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function handleHeroImageMove(index: number, direction: -1 | 1) {
    setHeroImageDataUrls((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSectionImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSectionImageDataUrl(await fileToDataUrl(file));
  }

  async function handleLoginImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoginImageDataUrl(await fileToDataUrl(file));
  }

  async function handleCardImageChange(slug: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCardImages((prev) => ({ ...prev, [slug]: dataUrl }));
  }

  function handleRemoveCardImage(slug: string) {
    setCardImages((prev) => ({ ...prev, [slug]: "" }));
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
          heroImageDataUrls,
          sectionImageDataUrl: sectionImageDataUrl ?? "",
          loginImageDataUrl: loginImageDataUrl ?? "",
          cardImages,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage(json.message ?? "Gagal menyimpan pengaturan");
        return;
      }
      setMessage("Pengaturan berhasil disimpan dan langsung diterapkan.");
      router.refresh();
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
            <h2 className="mb-3 text-base font-semibold text-[#1e293b]">Identitas Situs</h2>

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

          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-body">
            <h2 className="mb-1 text-base font-semibold text-[#1e293b]">Palet Warna</h2>
            <p className="text-secondary-400 mb-4 text-xs">
              Setiap warna mengendalikan bagian berbeda dari tampilan. Latar kartu/input tetap putih dan tidak
              bisa diubah, supaya isi kartu selalu terbaca jelas apa pun warna yang dipilih.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {COLOR_FIELDS.map((c) => (
                <div key={c.key}>
                  <label className="form-label">{c.label}</label>
                  <input
                    type="color"
                    value={form[c.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                    className="border-secondary-200 block h-9 w-[60px] rounded-lg border p-0"
                  />
                  <p className="text-secondary-400 mt-1 mb-0 text-xs">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="mb-3 text-base font-semibold text-[#1e293b]">Logo &amp; Favicon</h2>

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
            <h2 className="mb-3 text-base font-semibold text-[#1e293b]">Halaman Depan (Landing Page)</h2>

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
              <label className="form-label">
                Gambar Hero - slideshow (base64 di database, disarankan rasio landscape, maks. {MAX_HERO_IMAGES} gambar)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                className="form-control"
                onChange={handleHeroImagesAdd}
                disabled={heroImageDataUrls.length >= MAX_HERO_IMAGES}
              />
              <p className="text-secondary-400 mt-1 text-xs">
                Beberapa gambar akan tampil bergantian (slideshow) di halaman depan. Tanpa teks - teks (kalau perlu)
                sebaiknya sudah ada di dalam gambarnya. Urutan tampil mengikuti urutan di bawah ini.
              </p>

              {heroImageDataUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {heroImageDataUrls.map((dataUrl, i) => (
                    <div key={i} className="relative w-40">
                      {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize */}
                      <img
                        src={dataUrl}
                        alt={`Hero slide ${i + 1}`}
                        className="border-ink-200 block h-24 w-40 rounded-lg border object-cover"
                      />
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="text-secondary-400 text-xs">#{i + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={i === 0}
                            onClick={() => handleHeroImageMove(i, -1)}
                            aria-label="Pindah ke kiri"
                          >
                            <i className="ti ti-chevron-left" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={i === heroImageDataUrls.length - 1}
                            onClick={() => handleHeroImageMove(i, 1)}
                            aria-label="Pindah ke kanan"
                          >
                            <i className="ti ti-chevron-right" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleHeroImageRemove(i)}
                            aria-label="Hapus gambar"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-body">
            <h2 className="mb-1 text-base font-semibold text-[#1e293b]">Gambar Bagian Alur Kerja</h2>
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

        <div className="card md:col-span-2">
          <div className="card-body">
            <h2 className="mb-1 text-base font-semibold text-[#1e293b]">Gambar Halaman Login</h2>
            <p className="text-secondary-400 mb-3 text-xs">
              Latar panel kiri di halaman login (di belakang gradasi gelap, jadi teks di atasnya tetap
              terbaca). Opsional - gradasi polos akan tetap tampil jika gambar ini tidak diisi.
            </p>
            <input type="file" accept="image/*" className="form-control" onChange={handleLoginImageChange} />
            {loginImageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize
              <img
                src={loginImageDataUrl}
                alt="Preview gambar login"
                className="mt-2 block max-h-[180px] rounded-xl"
              />
            )}
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-body">
            <h2 className="mb-1 text-base font-semibold text-[#1e293b]">Gambar Kartu Landing Page</h2>
            <p className="text-secondary-400 mb-4 text-xs">
              Setiap kartu &quot;Cara Kerja&quot; dan &quot;Kapabilitas&quot; di halaman depan bisa diklik untuk membuka
              detail. Unggah gambar opsional untuk kartu tertentu - akan tampil di bagian atas jendela detailnya.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_LANDING_CARDS.map((c) => (
                <div key={c.slug} className="border-secondary-100 rounded-lg border p-3">
                  <p className="mb-2 text-sm font-medium text-[#1e293b]">
                    <i className={`ti ${c.icon} text-primary-600 mr-1.5`} />
                    {c.title}
                  </p>
                  {cardImages[c.slug] ? (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not a static asset Next/Image can optimize */}
                      <img src={cardImages[c.slug]} alt="" className="mb-2 h-24 w-full rounded object-cover" />
                      <button
                        type="button"
                        className="text-danger-600 text-xs font-medium"
                        onClick={() => handleRemoveCardImage(c.slug)}
                      >
                        Hapus gambar
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      className="form-control"
                      onChange={(e) => handleCardImageChange(c.slug, e)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          {message && <p className="text-secondary-400 mb-2 text-sm">{message}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-fit">
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </form>

      {demoCounts && (demoCounts.claims > 0 || demoCounts.accidentPoints > 0) && (
        <div className="card mt-4 max-w-[960px]">
          <div className="card-body">
            <h2 className="mb-1 text-base font-semibold text-[#1e293b]">Data Contoh</h2>
            <p className="text-secondary-400 mb-3 text-xs">
              Sistem ini berisi data contoh ({demoCounts.claims} klaim, {demoCounts.accidentPoints} titik
              kecelakaan) untuk mendemonstrasikan dashboard, peta, dan deteksi anomali. Hapus kapan saja
              sebelum data klaim sungguhan mulai masuk.
            </p>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={deletingDemo}
              onClick={handleDeleteDemoData}
            >
              <i className="ti ti-trash mr-1" />
              {deletingDemo ? "Menghapus..." : "Hapus Data Contoh"}
            </button>
            {demoMessage && <p className="text-secondary-400 mt-2 mb-0 text-sm">{demoMessage}</p>}
          </div>
        </div>
      )}
    </AppShell>
  );
}
