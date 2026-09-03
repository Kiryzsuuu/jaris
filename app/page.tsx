"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HealthResponse = {
  success: boolean;
  data: {
    server: string;
    database: { status: string };
  } | null;
};

type SettingsResponse = {
  siteName: string;
  logoDataUrl: string | null;
  heroImageDataUrl: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  footerText: string;
};

const CAPABILITIES = [
  {
    title: "Memahami Data",
    desc: "AI membaca dan merangkum data operasional secara otomatis, dari laporan klaim hingga dokumen internal.",
  },
  {
    title: "Menganalisis Pola",
    desc: "Mendeteksi pola dan tren dari ribuan data kecelakaan dan klaim secara berkelanjutan.",
  },
  {
    title: "Mempercepat Proses",
    desc: "Alur klaim dari verifikasi hingga pencairan berjalan lebih cepat dengan rules engine yang deterministik.",
  },
  {
    title: "Mendeteksi Potensi Risiko",
    desc: "Klaster titik rawan kecelakaan terdeteksi otomatis sebagai sinyal peringatan dini bagi manajemen.",
  },
  {
    title: "Memberikan Rekomendasi",
    desc: "AI memberi saran klasifikasi kasus dan ringkasan eksekutif - keputusan akhir tetap di tangan Anda.",
  },
  {
    title: "Insight Real-Time",
    desc: "Dashboard analitik yang selalu mencerminkan kondisi operasional terkini, kapan saja dibutuhkan.",
  },
];

const DEFAULTS: SettingsResponse = {
  siteName: "JARIS",
  logoDataUrl: null,
  heroImageDataUrl: null,
  heroHeadline: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
  heroSubheadline:
    "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
  footerText: "PT Jasa Raharja (Persero) - Internal Use Only",
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsResponse>(DEFAULTS);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((json: HealthResponse) => setHealth(json))
      .finally(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSettings(json.data);
      })
      .catch(() => {});
  }, []);

  const dbConnected = health?.data?.database.status === "connected";
  const serverOk = health?.data?.server === "ok";

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <span className="landing-nav-brand">
          <span className="landing-nav-mark">
            {settings.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
              <img src={settings.logoDataUrl} alt={settings.siteName} />
            ) : (
              <span className="landing-nav-mark-letter">{settings.siteName.slice(0, 1)}</span>
            )}
          </span>
          <span>{settings.siteName}</span>
        </span>
        <Link href="/login" className="landing-nav-cta">
          Masuk
        </Link>
      </nav>

      <header className="landing-hero">
        <div className="landing-hero-grid">
          <div>
            <span className="landing-eyebrow">PT Jasa Raharja (Persero)</span>
            <h1 className="landing-headline">{settings.heroHeadline}</h1>
            <p className="landing-subheadline">{settings.heroSubheadline}</p>

            <div className="landing-hero-actions">
              <Link href="/login" className="landing-primary-btn">
                Masuk ke Sistem
              </Link>
            </div>

            <div className="landing-status-pills">
              <span className="landing-status-pill">
                <span className={`landing-status-dot ${loading ? "" : serverOk ? "is-ok" : "is-bad"}`} />
                {loading ? "Memeriksa server" : serverOk ? "Server Online" : "Server Bermasalah"}
              </span>
              <span className="landing-status-pill">
                <span className={`landing-status-dot ${loading ? "" : dbConnected ? "is-ok" : "is-bad"}`} />
                {loading ? "Memeriksa database" : dbConnected ? "Database Terhubung" : "Database Bermasalah"}
              </span>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-hero-visual-glow" />
            {settings.heroImageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
              <img src={settings.heroImageDataUrl} alt={settings.heroHeadline} />
            ) : (
              <div className="landing-hero-visual-placeholder">
                <div className="landing-hero-visual-placeholder-mark">
                  {settings.siteName.slice(0, 1)}
                </div>
                <p>
                  Gambar hero dapat diatur admin lewat Pengaturan Situs, tanpa perlu ubah kode.
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="landing-features">
        <div className="landing-features-inner">
          <div className="landing-features-header">
            <span className="landing-features-eyebrow">Kecerdasan Terintegrasi</span>
            <h2 className="landing-features-title">Enam kemampuan inti JARIS</h2>
            <p className="landing-features-desc">
              Dirancang untuk membantu setiap unit kerja Jasa Raharja bekerja lebih cepat dan lebih
              tepat, dengan kecerdasan buatan yang selalu berbasis data resmi internal.
            </p>
          </div>

          <div className="landing-feature-grid">
            {CAPABILITIES.map((c, i) => (
              <div className="landing-feature-card" key={c.title}>
                <div className="landing-feature-index">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="landing-feature-title">{c.title}</h3>
                <p className="landing-feature-desc">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">{settings.footerText}</footer>
    </div>
  );
}
