"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SettingsResponse = {
  siteName: string;
  logoDataUrl: string | null;
  heroImageDataUrl: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  footerText: string;
};

type PublicStats = {
  totalClaims: number;
  totalPaidAmount: number;
  totalAccidentPoints: number;
  totalActiveUsers: number;
};

const CAPABILITIES = [
  {
    title: "Memahami Data",
    desc: "AI membaca dan merangkum data operasional secara otomatis, dari laporan klaim hingga dokumen internal.",
    icon: "ti-file-text",
  },
  {
    title: "Menganalisis Pola",
    desc: "Mendeteksi pola dan tren dari ribuan data kecelakaan dan klaim secara berkelanjutan.",
    icon: "ti-chart-line",
  },
  {
    title: "Mempercepat Proses",
    desc: "Alur klaim dari verifikasi hingga pencairan berjalan lebih cepat dengan rules engine yang deterministik.",
    icon: "ti-bolt",
  },
  {
    title: "Mendeteksi Potensi Risiko",
    desc: "Klaster titik rawan kecelakaan terdeteksi otomatis sebagai sinyal peringatan dini bagi manajemen.",
    icon: "ti-map-pin",
  },
  {
    title: "Memberikan Rekomendasi",
    desc: "AI memberi saran klasifikasi kasus dan ringkasan eksekutif - keputusan akhir tetap di tangan Anda.",
    icon: "ti-message-chatbot",
  },
  {
    title: "Insight Real-Time",
    desc: "Dashboard analitik yang selalu mencerminkan kondisi operasional terkini, kapan saja dibutuhkan.",
    icon: "ti-gauge",
  },
  {
    title: "Analisis Gambar Kerusakan",
    desc: "Foto kerusakan yang diunggah petugas dianalisis AI untuk saran tingkat keparahan - langsung di form klaim.",
    icon: "ti-camera",
    badge: "Baru",
    highlighted: true,
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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCompactCurrency(value: number) {
  return `Rp${formatCompactNumber(value)}`;
}

export default function Home() {
  const [settings, setSettings] = useState<SettingsResponse>(DEFAULTS);
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSettings(json.data);
      })
      .catch(() => {});
    fetch("/api/public-stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data);
      })
      .catch(() => {});
  }, []);

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

        <div className="landing-nav-links">
          <a href="#kapabilitas" className="landing-nav-link">Kapabilitas</a>
          <a href="#statistik" className="landing-nav-link">Statistik</a>
        </div>

        <Link href="/login" className="landing-nav-cta">
          Masuk
        </Link>
      </nav>

      <header className="landing-hero">
        <div className="landing-hero-grid">
          <div>
            <span className="landing-eyebrow">
              <span className="landing-eyebrow-dot" />
              PT Jasa Raharja (Persero)
            </span>
            <h1 className="landing-headline">{settings.heroHeadline}</h1>
            <p className="landing-subheadline">{settings.heroSubheadline}</p>

            <div className="landing-hero-actions">
              <Link href="/login" className="landing-primary-btn">
                Masuk ke Sistem
              </Link>
              <a href="#kapabilitas" className="landing-secondary-link">
                Lihat kapabilitas
              </a>
            </div>
          </div>

          <div className="landing-hero-visual">
            {settings.heroImageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
              <img src={settings.heroImageDataUrl} alt={settings.heroHeadline} />
            ) : (
              <div className="landing-hero-visual-placeholder">
                <div className="landing-hero-visual-placeholder-mark">
                  {settings.siteName.slice(0, 1)}
                </div>
                <p>Gambar hero dapat diatur admin lewat Pengaturan Situs, tanpa perlu ubah kode.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <section id="statistik" className="landing-stats">
        <div className="landing-stats-inner">
          <div className="landing-stat">
            <div className="landing-stat-value">{stats ? formatCompactNumber(stats.totalClaims) : "-"}</div>
            <div className="landing-stat-label">Klaim Diproses</div>
          </div>
          <div className="landing-stat">
            <div className="landing-stat-value">{stats ? formatCompactCurrency(stats.totalPaidAmount) : "-"}</div>
            <div className="landing-stat-label">Santunan Tersalurkan</div>
          </div>
          <div className="landing-stat">
            <div className="landing-stat-value">{stats ? formatCompactNumber(stats.totalAccidentPoints) : "-"}</div>
            <div className="landing-stat-label">Titik Kecelakaan Terpetakan</div>
          </div>
          <div className="landing-stat">
            <div className="landing-stat-value">{stats ? formatCompactNumber(stats.totalActiveUsers) : "-"}</div>
            <div className="landing-stat-label">Pengguna Aktif</div>
          </div>
        </div>
      </section>

      <section id="kapabilitas" className="landing-features">
        <div className="landing-features-inner">
          <div className="landing-features-header">
            <span className="landing-features-eyebrow">Kecerdasan Terintegrasi</span>
            <h2 className="landing-features-title">Tujuh kemampuan inti JARIS</h2>
            <p className="landing-features-desc">
              Dirancang untuk membantu setiap unit kerja Jasa Raharja bekerja lebih cepat dan lebih
              tepat, dengan kecerdasan buatan yang selalu berbasis data resmi internal.
            </p>
          </div>

          <div className="landing-feature-grid">
            {CAPABILITIES.map((c) => (
              <div className={`landing-feature-card ${c.highlighted ? "is-highlighted" : ""}`} key={c.title}>
                <div className="landing-feature-icon">
                  <i className={`ti ${c.icon}`} />
                </div>
                <h3 className="landing-feature-title">{c.title}</h3>
                <p className="landing-feature-desc">{c.desc}</p>
                {c.badge && <span className="landing-feature-badge">{c.badge}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">{settings.footerText}</footer>
    </div>
  );
}
