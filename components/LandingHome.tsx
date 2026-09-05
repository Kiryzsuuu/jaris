"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CLAIM_FLOW,
  CAPABILITIES,
  ABOUT_SECTION,
  SHOWCASE_SECTIONS,
  LEARN_MORE_CARDS,
  STATS_BACKGROUND_SLUG,
  type LandingCard,
} from "@/lib/landingContent";

export type SettingsResponse = {
  siteName: string;
  logoDataUrl: string | null;
  heroImageDataUrls: string[];
  sectionImageDataUrl: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  footerText: string;
  cardImages: Record<string, string>;
};

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

// Pure-image hero slideshow - no overlaid copy. Any text belongs baked
// into the images themselves. A single image just renders statically;
// dots/arrows only appear once there's more than one slide.
function HeroSlideshow({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || images.length < 2) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [paused, images.length]);

  if (images.length === 0) return null;

  return (
    <div
      className="landing-hero-slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
        <img
          key={i}
          src={src}
          alt={alt}
          className={`landing-hero-slide-img ${i === active ? "is-active" : ""}`}
        />
      ))}

      {images.length > 1 && (
        <div className="landing-hero-carousel-controls">
          <button
            type="button"
            aria-label="Sebelumnya"
            className="landing-hero-arrow"
            onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
          >
            <i className="ti ti-chevron-left" />
          </button>
          <div className="landing-hero-dots-nav">
            {images.map((_, i) => (
              <button
                key={i}
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
            onClick={() => setActive((i) => (i + 1) % images.length)}
          >
            <i className="ti ti-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}

const MAP_REGIONS = [
  { name: "Jakarta", query: "Jasa Raharja Jakarta Pusat, Indonesia" },
  { name: "Surabaya", query: "Jasa Raharja Surabaya, Indonesia" },
  { name: "Medan", query: "Jasa Raharja Medan, Indonesia" },
  { name: "Bandung", query: "Jasa Raharja Bandung, Indonesia" },
  { name: "Makassar", query: "Jasa Raharja Makassar, Indonesia" },
];

type NewsItem = { title: string; link: string; pubDate: string; image: string | null };

/** Aggregate-only figures from /api/public-stats - no PII, safe pre-login. */
type PublicStats = {
  totalClaims: number;
  totalPaidAmount: number;
  totalAccidentPoints: number;
  totalActiveUsers: number;
};

function CardModal({ card, image, onClose }: { card: LandingCard; image: string | null; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="landing-modal-overlay" onClick={onClose}>
      <div className="landing-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="landing-modal-close" aria-label="Tutup" onClick={onClose}>
          <i className="ti ti-x" />
        </button>

        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
          <img src={image} alt={card.title} className="landing-modal-image" />
        )}

        <div className="landing-modal-body">
          <div className="landing-modal-icon">
            <i className={`ti ${card.icon}`} />
          </div>
          <h3>{card.title}</h3>
          <p>{card.detail}</p>
          {card.linkHref && (
            <Link href={card.linkHref} className="landing-primary-btn">
              {card.linkLabel ?? "Pelajari lebih lanjut"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgo(pubDate: string) {
  const then = new Date(pubDate).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export default function LandingHome({ initialSettings }: { initialSettings: SettingsResponse }) {
  const [settings] = useState<SettingsResponse>(initialSettings);
  const [activeRegion, setActiveRegion] = useState(MAP_REGIONS[0]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [activeCard, setActiveCard] = useState<LandingCard | null>(null);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setNews(json.data);
      })
      .catch(() => {});
    // Drives the hero preview card with real aggregates rather than
    // hardcoded sample figures. Card stays hidden if this fails.
    fetch("/api/public-stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPublicStats(json.data);
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

      <header className="landing-hero landing-hero-fullbleed">
        <div className="landing-hero-bg">
          {settings.heroImageDataUrls.length > 0 ? (
            <HeroSlideshow images={settings.heroImageDataUrls} alt={settings.heroHeadline} />
          ) : (
            <div className="landing-hero-bg-fallback" />
          )}
          <div className="landing-hero-bg-overlay" />
        </div>

        <div className="landing-hero-overlay-content">
          <span className="landing-eyebrow landing-eyebrow-onimage">
            <span className="landing-eyebrow-dot" />
            Dibangun untuk Operasional Jasa Raharja
          </span>
          <h1 className="landing-headline landing-headline-onimage">{settings.heroHeadline}</h1>
          <div className="landing-hero-actions">
            <Link href="/login" className="landing-btn-gold">
              Masuk ke sistem
            </Link>
            <a href="#tentang" className="landing-btn-ghost landing-btn-ghost-onimage">
              Pelajari lebih lanjut
            </a>
          </div>
        </div>
      </header>

      <nav className="landing-subnav">
        <a href="#tentang" className="landing-subnav-link is-active">Tentang Kami</a>
        <a href="#showcase" className="landing-subnav-link">Kapabilitas Inti</a>
        <a href="#peta" className="landing-subnav-link">Wilayah Kerja</a>
      </nav>

      <section id="tentang" className="landing-about">
        <div className="landing-about-inner">
          <div className="landing-about-image">
            {settings.cardImages[ABOUT_SECTION.slug] ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
              <img src={settings.cardImages[ABOUT_SECTION.slug]} alt="" />
            ) : (
              <div className="landing-about-image-fallback">
                <i className="ti ti-building-skyscraper" />
              </div>
            )}
          </div>
          <div className="landing-about-panel">
            <h2>{ABOUT_SECTION.title}</h2>
            <p>{ABOUT_SECTION.detail}</p>
            <Link href={ABOUT_SECTION.linkHref ?? "/login"} className="landing-btn-gold">
              {ABOUT_SECTION.linkLabel ?? "Masuk ke Sistem"} <i className="ti ti-arrow-right" />
            </Link>
          </div>
        </div>
      </section>

      <section id="showcase" className="landing-showcase">
        {SHOWCASE_SECTIONS.map((s, i) => (
          <Reveal key={s.slug} className={`landing-showcase-row ${i % 2 === 1 ? "is-reversed" : ""}`}>
            <div className="landing-showcase-image">
              {settings.cardImages[s.slug] ? (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
                <img src={settings.cardImages[s.slug]} alt="" />
              ) : (
                <div className="landing-showcase-image-fallback">
                  <i className={`ti ${s.icon}`} />
                </div>
              )}
            </div>
            <div className="landing-showcase-copy">
              <span className="landing-features-eyebrow">Kapabilitas Inti</span>
              <h3>{s.title}</h3>
              <p>{s.detail}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section
        className="landing-stats-section"
        style={
          settings.cardImages[STATS_BACKGROUND_SLUG]
            ? { backgroundImage: `url(${settings.cardImages[STATS_BACKGROUND_SLUG]})` }
            : undefined
        }
      >
        <div className="landing-stats-section-overlay" />
        <div className="landing-stats-section-inner">
          <div className="landing-stats-section-copy">
            <h2>Fondasi yang Kuat, Operasional yang Aman</h2>
            <p>
              JARIS dibangun di atas rules engine yang deterministik dan audit trail penuh - setiap angka
              santunan dapat ditelusuri asal-usulnya.
            </p>
          </div>
          {publicStats && (
            <div className="landing-stats-section-card">
              <div className="landing-stats-section-row">
                <span>Total Klaim Tercatat</span>
                <strong>{publicStats.totalClaims.toLocaleString("id-ID")}</strong>
              </div>
              <div className="landing-stats-section-row">
                <span>Total Realisasi Santunan</span>
                <strong>Rp{publicStats.totalPaidAmount.toLocaleString("id-ID")}</strong>
              </div>
              <div className="landing-stats-section-row">
                <span>Titik Kecelakaan Terpetakan</span>
                <strong>{publicStats.totalAccidentPoints.toLocaleString("id-ID")}</strong>
              </div>
              <div className="landing-stats-section-row">
                <span>Pengguna Aktif</span>
                <strong>{publicStats.totalActiveUsers.toLocaleString("id-ID")}</strong>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="landing-learn-more">
        <div className="landing-learn-more-inner">
          <Reveal className="landing-features-header landing-features-header-center">
            <h2 className="landing-features-title">Pelajari lebih lanjut tentang JARIS</h2>
            <p className="landing-features-desc">
              Ketahui lebih jauh tentang sistem, pendekatan keamanan, dan siapa yang menggunakannya.
            </p>
          </Reveal>
          <div className="landing-learn-more-grid">
            {LEARN_MORE_CARDS.map((c) => (
              <Reveal key={c.slug} className="landing-learn-more-card">
                <div className="landing-learn-more-image">
                  {settings.cardImages[c.slug] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
                    <img src={settings.cardImages[c.slug]} alt="" />
                  ) : (
                    <div className="landing-learn-more-image-fallback">
                      <i className={`ti ${c.icon}`} />
                    </div>
                  )}
                </div>
                <div className="landing-learn-more-body">
                  <h3>{c.title}</h3>
                  <button type="button" className="landing-learn-more-link" onClick={() => setActiveCard(c)}>
                    Baca selengkapnya <i className="ti ti-arrow-right" />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

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
              <Reveal key={f.slug} style={{ transitionDelay: `${i * 80}ms` }}>
                <button type="button" className="landing-flow-card landing-clickable-card" onClick={() => setActiveCard(f)}>
                  <span className="landing-flow-step">{String(i + 1).padStart(2, "0")}</span>
                  <div className="landing-flow-icon">
                    <i className={`ti ${f.icon}`} />
                  </div>
                  <h3 className="landing-feature-title">{f.title}</h3>
                  <p className="landing-feature-desc">{f.desc}</p>
                </button>
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
              <Reveal key={c.slug} style={{ transitionDelay: `${(i % 4) * 80}ms` }}>
                <button
                  type="button"
                  className={`landing-feature-card landing-clickable-card ${c.highlighted ? "is-highlighted" : ""}`}
                  onClick={() => setActiveCard(c)}
                >
                  <div className="landing-feature-icon">
                    <i className={`ti ${c.icon}`} />
                  </div>
                  <h3 className="landing-feature-title">{c.title}</h3>
                  <p className="landing-feature-desc">{c.desc}</p>
                  {c.badge && <span className="landing-feature-badge">{c.badge}</span>}
                </button>
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

      <section className="landing-cta-banner">
        <h2>Siap mempercepat proses klaim Anda?</h2>
        <p>
          Masuk ke sistem untuk mengelola klaim, memantau dashboard analitik, dan menggunakan
          asisten AI - semua dalam satu ekosistem terpadu.
        </p>
        <Link href="/login" className="landing-btn-gold">
          Masuk ke sistem
        </Link>
      </section>

      <footer className="landing-footer">
        <p className="m-0">{settings.footerText}</p>
        <p className="landing-footer-copyright">© 2026 - Nusa Inspira Teknologi (RFS), All Rights Reserved.</p>
      </footer>

      {activeCard && (
        <CardModal card={activeCard} image={settings.cardImages[activeCard.slug] ?? null} onClose={() => setActiveCard(null)} />
      )}
    </div>
  );
}
