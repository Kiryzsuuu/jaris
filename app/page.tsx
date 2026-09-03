"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type SettingsResponse = {
  siteName: string;
  logoDataUrl: string | null;
  heroImageDataUrl: string | null;
  sectionImageDataUrl: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  footerText: string;
};

const HERO_SLIDES = [
  {
    icon: "ti-gauge",
    title: "Dashboard Analitik Real-Time",
    desc: "Jumlah klaim, realisasi santunan, dan tren kecelakaan langsung dari agregasi database - bukan laporan statis.",
  },
  {
    icon: "ti-map-pin",
    title: "Peta Titik Rawan Kecelakaan",
    desc: "Klaster kecelakaan terdeteksi otomatis di peta geospasial sebagai sinyal peringatan dini bagi manajemen.",
  },
  {
    icon: "ti-message-chatbot",
    title: "AI Asisten Berbasis Knowledge Base",
    desc: "Jawaban internal yang selalu bersumber dari dokumen resmi (RAG) - lengkap dengan rujukan sumbernya.",
  },
  {
    icon: "ti-camera",
    title: "Analisis Foto Kerusakan (AI)",
    desc: "Foto kerusakan yang diunggah petugas dianalisis AI untuk saran tingkat keparahan, langsung di form klaim.",
  },
];

function Reveal({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}

function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % HERO_SLIDES.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="landing-hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {HERO_SLIDES.map((slide, i) => (
        <div key={slide.title} className={`landing-hero-slide ${i === active ? "is-active" : ""}`}>
          <div className="landing-hero-slide-icon">
            <i className={`ti ${slide.icon}`} />
          </div>
          <h3>{slide.title}</h3>
          <p>{slide.desc}</p>
        </div>
      ))}

      <div className="landing-hero-carousel-controls">
        <button
          type="button"
          aria-label="Sebelumnya"
          className="landing-hero-arrow"
          onClick={() => setActive((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
        >
          <i className="ti ti-chevron-left" />
        </button>
        <div className="landing-hero-dots">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Slide ${i + 1}`}
              className={`landing-hero-dot ${i === active ? "is-active" : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Berikutnya"
          className="landing-hero-arrow"
          onClick={() => setActive((i) => (i + 1) % HERO_SLIDES.length)}
        >
          <i className="ti ti-chevron-right" />
        </button>
      </div>
    </div>
  );
}

const CLAIM_FLOW = [
  {
    step: "01",
    title: "Laporan Diajukan",
    desc: "Petugas mengisi data kecelakaan, korban, dan dokumen pendukung langsung dari lapangan.",
    icon: "ti-file-plus",
  },
  {
    step: "02",
    title: "Verifikasi Kelengkapan",
    desc: "Petugas verifikasi memeriksa kelengkapan berkas sebelum klaim berlanjut ke tahap persetujuan.",
    icon: "ti-list-check",
  },
  {
    step: "03",
    title: "Kalkulasi & Persetujuan",
    desc: "Rules engine menghitung besaran santunan secara deterministik, lalu pejabat berwenang menyetujui.",
    icon: "ti-calculator",
  },
  {
    step: "04",
    title: "Pencairan Santunan",
    desc: "Setelah disetujui, pencairan dana ke penerima santunan tercatat dan dapat dilacak riwayatnya.",
    icon: "ti-wallet",
  },
];

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

const MAP_REGIONS = [
  { name: "Jakarta", query: "Jasa Raharja Jakarta Pusat, Indonesia" },
  { name: "Surabaya", query: "Jasa Raharja Surabaya, Indonesia" },
  { name: "Medan", query: "Jasa Raharja Medan, Indonesia" },
  { name: "Bandung", query: "Jasa Raharja Bandung, Indonesia" },
  { name: "Makassar", query: "Jasa Raharja Makassar, Indonesia" },
];

const DEFAULTS: SettingsResponse = {
  siteName: "JARIS",
  logoDataUrl: null,
  heroImageDataUrl: null,
  sectionImageDataUrl: null,
  heroHeadline: "Satu sistem, seluruh kecerdasan operasional Jasa Raharja",
  heroSubheadline:
    "JARIS menyatukan klaim, santunan, asisten AI, analitik, dan peta risiko kecelakaan dalam satu ekosistem cerdas.",
  footerText: "PT Nusa Inspira Teknologi",
};

type NewsItem = { title: string; link: string; pubDate: string; image: string | null };

function timeAgo(pubDate: string) {
  const then = new Date(pubDate).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export default function Home() {
  const [settings, setSettings] = useState<SettingsResponse>(DEFAULTS);
  const [activeRegion, setActiveRegion] = useState(MAP_REGIONS[0]);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSettings(json.data);
      })
      .catch(() => {});
    fetch("/api/news")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setNews(json.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <span className="landing-nav-brand">
          <span className={`landing-nav-mark ${settings.logoDataUrl ? "has-image" : ""}`}>
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
          <a href="#alur-klaim" className="landing-nav-link">Alur Klaim</a>
          <a href="#kapabilitas" className="landing-nav-link">Kapabilitas</a>
          <a href="#berita" className="landing-nav-link">Berita</a>
          <a href="#peta" className="landing-nav-link">Peta</a>
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
              <HeroCarousel />
            )}
          </div>
        </div>
      </header>

      <section id="alur-klaim" className="landing-flow">
        <div className="landing-flow-inner">
          <Reveal className="landing-features-header">
            <span className="landing-features-eyebrow">Cara Kerja</span>
            <h2 className="landing-features-title">Empat tahap, satu sistem terpadu</h2>
            <p className="landing-features-desc">
              Dari laporan kecelakaan hingga pencairan santunan, seluruh siklus klaim tercatat dan
              dapat dilacak dalam satu alur kerja yang sama.
            </p>
          </Reveal>

          {settings.sectionImageDataUrl && (
            <Reveal className="landing-flow-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings */}
              <img src={settings.sectionImageDataUrl} alt="" />
            </Reveal>
          )}

          <div className="landing-flow-grid">
            {CLAIM_FLOW.map((f, i) => (
              <Reveal key={f.step} className="landing-flow-card" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="landing-flow-step">{f.step}</span>
                <div className="landing-flow-icon">
                  <i className={`ti ${f.icon}`} />
                </div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="kapabilitas" className="landing-features">
        <div className="landing-features-inner">
          <Reveal className="landing-features-header">
            <span className="landing-features-eyebrow">Kecerdasan Terintegrasi</span>
            <h2 className="landing-features-title">Tujuh kemampuan inti JARIS</h2>
            <p className="landing-features-desc">
              Dirancang untuk membantu setiap unit kerja Jasa Raharja bekerja lebih cepat dan lebih
              tepat, dengan kecerdasan buatan yang selalu berbasis data resmi internal.
            </p>
          </Reveal>

          <div className="landing-feature-grid">
            {CAPABILITIES.map((c, i) => (
              <Reveal
                key={c.title}
                className={`landing-feature-card ${c.highlighted ? "is-highlighted" : ""}`}
                style={{ transitionDelay: `${(i % 4) * 80}ms` }}
              >
                <div className="landing-feature-icon">
                  <i className={`ti ${c.icon}`} />
                </div>
                <h3 className="landing-feature-title">{c.title}</h3>
                <p className="landing-feature-desc">{c.desc}</p>
                {c.badge && <span className="landing-feature-badge">{c.badge}</span>}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {news.length > 0 && (
        <section id="berita" className="landing-news">
          <div className="landing-news-inner">
            <Reveal className="landing-news-header">
              <div>
                <span className="landing-features-eyebrow">
                  <span className="landing-live-dot" /> Live
                </span>
                <h2 className="landing-features-title">Berita nasional terkini</h2>
              </div>
              <span className="landing-news-source">Sumber: CNN Indonesia</span>
            </Reveal>

            <div className="landing-news-grid">
              {news.map((n, i) => (
                <Reveal key={n.link} style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="landing-news-card">
                    {n.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external news thumbnail, not a static asset
                      <img src={n.image} alt="" className="landing-news-image" />
                    ) : (
                      <div className="landing-news-image landing-news-image-placeholder">
                        <i className="ti ti-news" />
                      </div>
                    )}
                    <div className="landing-news-body">
                      <span className="landing-news-time">{timeAgo(n.pubDate)}</span>
                      <h3>{n.title}</h3>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="peta" className="landing-map">
        <div className="landing-map-inner">
          <Reveal className="landing-features-header">
            <span className="landing-features-eyebrow">Wilayah Kerja</span>
            <h2 className="landing-features-title">Peta interaktif cabang Jasa Raharja</h2>
            <p className="landing-features-desc">
              Pilih kota untuk menelusuri peta - data titik rawan kecelakaan yang terintegrasi
              tersedia setelah masuk ke sistem, di halaman Peta Data Kecelakaan.
            </p>
          </Reveal>

          <Reveal className="landing-map-panel">
            <div className="landing-map-region-list">
              {MAP_REGIONS.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  className={`landing-map-region ${r.name === activeRegion.name ? "is-active" : ""}`}
                  onClick={() => setActiveRegion(r)}
                >
                  {r.name}
                </button>
              ))}
            </div>

            <div className="landing-map-frame">
              <iframe
                key={activeRegion.name}
                title={`Peta ${activeRegion.name}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(activeRegion.query)}&z=12&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="landing-map-note">
              <i className="ti ti-video" />
              <span>
                Pantauan CCTV lalu lintas tersedia lewat portal resmi Jasa Marga Travoy - JARIS
                belum memiliki akses API resmi untuk menampilkannya langsung di sini.
              </span>
              <a href="https://travoy.jasamarga.com/" target="_blank" rel="noopener noreferrer">
                Buka Travoy <i className="ti ti-external-link" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="landing-footer">
        <p className="m-0">{settings.footerText}</p>
        <p className="landing-footer-copyright">© 2026 - Nusa Inspira Teknologi (RFS), All Rights Reserved.</p>
      </footer>
    </div>
  );
}
