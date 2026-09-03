"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HealthResponse = {
  success: boolean;
  message: string;
  data: {
    server: string;
    database: { status: string; name: string | null };
    timestamp: string;
  } | null;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState("JARIS");
  const [tagline, setTagline] = useState("Jasa Raharja Integrated Intelligence System");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((json: HealthResponse) => setHealth(json))
      .finally(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSiteName(json.data.siteName);
          setTagline(json.data.tagline);
          setFooterText(json.data.footerText);
        }
      })
      .catch(() => {});
  }, []);

  const dbConnected = health?.data?.database.status === "connected";
  const serverOk = health?.data?.server === "ok";

  return (
    <div className="login-wrapper" style={{ flexDirection: "column", gap: 16 }}>
      <div className="login-bg-shape login-bg-shape-1" />
      <div className="login-bg-shape login-bg-shape-2" />

      <div className="login-card" style={{ textAlign: "center" }}>
        <span className="login-brand text-decoration-none justify-content-center">
          <i className="bi bi-shield-check" />
          <span>{siteName}</span>
        </span>
        <p className="login-subtitle">{tagline}</p>

        <div className="d-flex gap-2 justify-content-center mb-4">
          <span className={`badge-table ${serverOk ? "success" : "pending"}`}>
            {loading ? "Memeriksa server..." : serverOk ? "Server Online" : "Server Bermasalah"}
          </span>
          <span className={`badge-table ${dbConnected ? "success" : "pending"}`}>
            {loading ? "Memeriksa database..." : dbConnected ? "Database Terhubung" : "Database Bermasalah"}
          </span>
        </div>

        <Link href="/login" className="btn-login" style={{ textDecoration: "none" }}>
          <span>Masuk ke Sistem</span>
          <i className="bi bi-arrow-right" />
        </Link>
      </div>

      {footerText && (
        <p style={{ position: "relative", zIndex: 1, textAlign: "center", fontSize: 12, color: "var(--text-muted-green)" }}>
          {footerText}
        </p>
      )}
    </div>
  );
}
