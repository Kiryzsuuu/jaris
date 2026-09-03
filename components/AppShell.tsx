"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
    items: [{ href: "/dashboard", label: "Dashboard", icon: "ti-layout-dashboard", permission: "dashboard:view" }],
  },
  {
    title: "Operasional",
    items: [
      { href: "/claims", label: "Manajemen Klaim", icon: "ti-file-text", permission: "claim:view" },
      { href: "/assistant", label: "AI Asisten", icon: "ti-message-chatbot", permission: "assistant:use" },
      { href: "/accident-map", label: "Peta Kecelakaan", icon: "ti-map-pin", permission: "map:view" },
    ],
  },
  {
    title: "Administrasi",
    items: [
      { href: "/users", label: "Manajemen Pengguna", icon: "ti-users", permission: "user:view" },
      { href: "/settings", label: "Pengaturan Situs", icon: "ti-settings", permission: "settings:manage" },
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
  const [profileOpen, setProfileOpen] = useState(false);

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const siteName = settings?.siteName ?? "JARIS";

  return (
    <>
      {mobileOpen && (
        <div className="pc-menu-overlay lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <nav className={`pc-sidebar ${mobileOpen ? "mob-sidebar-active" : ""}`}>
        <div className="navbar-wrapper">
          <div className="m-header flex h-header-height items-center px-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 text-white">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                {settings?.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
                  <img src={settings.logoDataUrl} alt={siteName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-primary-400 text-sm font-bold">{siteName.slice(0, 1)}</span>
                )}
              </span>
              <span className="text-base font-semibold tracking-tight">{siteName}</span>
            </Link>
          </div>

          <div className="navbar-content overflow-y-auto">
            <ul className="pc-navbar">
              {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter(
                  (item) => !item.permission || me?.permissions.includes(item.permission)
                );
                if (visibleItems.length === 0) return null;

                return (
                  <li key={section.title}>
                    <span className="pc-caption">
                      <label>{section.title}</label>
                    </span>
                    <ul className="pc-navbar">
                      {visibleItems.map((item) => (
                        <li key={item.href} className={`pc-item ${pathname.startsWith(item.href) ? "active" : ""}`}>
                          <Link href={item.href} className="pc-link">
                            <span className="pc-micon">
                              <i className={`ti ${item.icon}`} />
                            </span>
                            <span className="pc-mtext">{item.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>

      <header className="pc-header">
        <div className="flex w-full items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <button
              className="pc-head-link lg:hidden"
              aria-label="Toggle Navigation"
              onClick={() => setMobileOpen((v) => !v)}
              type="button"
            >
              <i className="ti ti-menu-2" />
            </button>
          </div>

          <div className={`dropdown ${profileOpen ? "drp-show" : ""}`}>
            <button
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[.03]"
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
            >
              <span className="bg-dark-500 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
                {me?.email.slice(0, 1).toUpperCase() ?? "?"}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-sm leading-tight font-medium">{me?.email ?? ""}</span>
                <span className="text-secondary-400 block text-xs leading-tight capitalize">
                  {me?.roleSlug.replace(/-/g, " ")}
                </span>
              </span>
              <i className="ti ti-chevron-down text-base" />
            </button>

            <div className="dropdown-menu dropdown-menu-end">
              <button
                className="dropdown-item text-danger-500 w-full text-left"
                type="button"
                onClick={handleLogout}
              >
                <i className="ti ti-logout" /> Keluar
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="pc-container">
        <div className="pc-content">
          <div className="page-header flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#1d2630]">{pageTitle}</h1>
              {pageSubtitle && <p className="text-secondary-400 mt-1 text-sm">{pageSubtitle}</p>}
            </div>
            {headerActions}
          </div>

          {children}
        </div>
      </div>
    </>
  );
}
