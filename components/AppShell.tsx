"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";

type Me = { id: string; email: string; roleSlug: string; permissions: string[] };
type Settings = { siteName: string; logoDataUrl: string | null; footerText: string };

type NavItem = {
  href: string;
  label: string;
  icon: string;
  permission?: string;
};

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Menu",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "bi-grid-fill", permission: "dashboard:view" }],
  },
  {
    title: "Operasional",
    items: [
      { href: "/claims", label: "Manajemen Klaim", icon: "bi-file-earmark-text", permission: "claim:view" },
      { href: "/assistant", label: "AI Asisten", icon: "bi-chat-dots", permission: "assistant:use" },
      { href: "/accident-map", label: "Peta Kecelakaan", icon: "bi-geo-alt", permission: "map:view" },
    ],
  },
  {
    title: "Administrasi",
    items: [
      { href: "/users", label: "Manajemen Pengguna", icon: "bi-people", permission: "user:view" },
      { href: "/settings", label: "Pengaturan Situs", icon: "bi-gear", permission: "settings:manage" },
    ],
  },
];

export default function AppShell({
  children,
  pageTitle,
  pageSubtitle,
  headerActions,
}: {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  headerActions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setMe(json.data);
      })
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSettings(json.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sidebar-minimized", minimized);
    return () => document.body.classList.remove("sidebar-minimized");
  }, [minimized]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const siteName = settings?.siteName ?? "JARIS";

  return (
    <>
      <Script
        src="/vendor/spark/libs/bootstrap/js/bootstrap.bundle.min.js"
        strategy="afterInteractive"
      />

      <div className={`sidebar-wrapper ${mobileOpen ? "show" : ""}`} id="sidebar">
        <Link href="/dashboard" className="sidebar-brand">
          {settings?.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
            <img src={settings.logoDataUrl} alt={siteName} style={{ height: 24, width: "auto" }} />
          ) : (
            <i className="bi bi-shield-check" />
          )}
          <span>{siteName}</span>
        </Link>

        <div className="flex-grow-1 overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.permission || me?.permissions.includes(item.permission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div className="sidebar-menu-section" key={section.title}>
                <div className="sidebar-menu-title">{section.title}</div>
                <ul className="sidebar-menu-list">
                  {visibleItems.map((item) => (
                    <li className="sidebar-menu-item" key={item.href}>
                      <Link
                        href={item.href}
                        className={`sidebar-menu-link ${pathname.startsWith(item.href) ? "active" : ""}`}
                        title={item.label}
                      >
                        <i className={`bi ${item.icon}`} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {me && (
          <div className="sidebar-profile">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--brand-lime)",
                color: "var(--theme-foreground, var(--brand-forest-dark))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {me.email.slice(0, 1).toUpperCase()}
            </div>
            <div className="sidebar-profile-info">
              <div className="sidebar-profile-name">{me.roleSlug.replace(/-/g, " ")}</div>
              <div className="sidebar-profile-email">{me.email}</div>
            </div>
          </div>
        )}
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1040 }}
        />
      )}

      <div className="main-wrapper">
        <header className="navbar-custom">
          <div className="navbar-left">
            <button
              className="btn-desktop-toggle d-none d-xl-flex align-items-center justify-content-center me-3"
              aria-label="Minimize Sidebar"
              onClick={() => setMinimized((v) => !v)}
              type="button"
            >
              <i className="bi bi-chevron-bar-left" />
            </button>
            <button
              className="sidebar-toggle-btn me-2"
              aria-label="Toggle Navigation"
              onClick={() => setMobileOpen((v) => !v)}
              type="button"
            >
              <i className="bi bi-list" />
            </button>
          </div>

          <div className="navbar-search-wrapper" />

          <div className="navbar-actions">
            <div className="dropdown ms-2">
              <button
                className="navbar-profile-btn dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--brand-forest-dark)",
                    color: "var(--brand-lime)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {me?.email.slice(0, 1).toUpperCase() ?? "?"}
                </span>
                <span className="navbar-profile-name d-none d-md-inline">{me?.email ?? ""}</span>
                <i className="bi bi-chevron-down navbar-profile-caret" />
              </button>
              <ul className="dropdown-menu dropdown-menu-end dropdown-menu-profile">
                <li className="dropdown-header">{me?.roleSlug.replace(/-/g, " ")}</li>
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <button className="dropdown-item text-danger" type="button" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right" /> Keluar
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </header>

        <div className="page-header">
          <div>
            <h1 className="page-title">{pageTitle}</h1>
            {pageSubtitle && <p className="page-subtitle">{pageSubtitle}</p>}
          </div>
          {headerActions}
        </div>

        {children}

        <footer className="footer-custom mt-4">
          <div className="footer-left">
            <span className="footer-copy">{settings?.footerText}</span>
          </div>
        </footer>
      </div>
    </>
  );
}
