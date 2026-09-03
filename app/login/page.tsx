"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siteName, setSiteName] = useState("JARIS");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSiteName(json.data.siteName);
          setFooterText(json.data.footerText);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? "Login gagal");
        return;
      }

      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper" style={{ flexDirection: "column", gap: 16 }}>
      <div className="login-bg-shape login-bg-shape-1" />
      <div className="login-bg-shape login-bg-shape-2" />

      <div className="login-card">
        <span className="login-brand text-decoration-none">
          <i className="bi bi-shield-check" />
          <span>{siteName}</span>
        </span>

        <p className="login-subtitle">Masuk untuk mengakses sistem informasi Jasa Raharja</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="login-form-group">
            <label htmlFor="email" className="login-form-label">
              Email
            </label>
            <div className="login-input-group">
              <i className="bi bi-envelope input-icon" />
              <input
                type="email"
                id="email"
                className="login-input"
                placeholder="nama@jasaraharja.co.id"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="login-form-group">
            <label htmlFor="password" className="login-form-label">
              Password
            </label>
            <div className="login-input-group">
              <i className="bi bi-shield-lock input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="login-input login-input-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                aria-label="Show password"
                onClick={() => setShowPassword((v) => !v)}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button type="submit" className="btn-login" disabled={loading}>
            <span>{loading ? "Memproses..." : "Masuk"}</span>
            {!loading && <i className="bi bi-arrow-right" />}
          </button>
        </form>
      </div>

      {footerText && (
        <p style={{ position: "relative", zIndex: 1, textAlign: "center", fontSize: 12, color: "var(--text-muted-green)" }}>
          {footerText}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
