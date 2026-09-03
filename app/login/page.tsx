"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const LOGIN_HIGHLIGHTS = [
  { icon: "ti-file-text", text: "Manajemen klaim dari laporan hingga pencairan santunan" },
  { icon: "ti-map-pin", text: "Peta titik rawan kecelakaan dengan deteksi klaster otomatis" },
  { icon: "ti-message-chatbot", text: "AI Asisten internal berbasis knowledge base resmi" },
  { icon: "ti-gauge", text: "Dashboard analitik real-time dari data operasional" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siteName, setSiteName] = useState("JARIS");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSiteName(json.data.siteName);
          setLogoDataUrl(json.data.logoDataUrl);
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
    <div className="login-shell">
      <div className="login-visual">
        <div className="login-visual-brand">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
            <img src={logoDataUrl} alt={siteName} />
          ) : (
            <span className="login-visual-mark">{siteName.slice(0, 1)}</span>
          )}
          <span>{siteName}</span>
        </div>

        <div className="login-visual-body">
          <span className="login-visual-eyebrow">PT Jasa Raharja (Persero)</span>
          <h1>Satu sistem, seluruh kecerdasan operasional Jasa Raharja</h1>
          <ul className="login-visual-list">
            {LOGIN_HIGHLIGHTS.map((h) => (
              <li key={h.text}>
                <span className="login-visual-icon">
                  <i className={`ti ${h.icon}`} />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="login-visual-footer">© 2026 - Nusa Inspira Teknologi (RFS), All Rights Reserved.</p>
      </div>

      <div className="login-form-side">
        <div className="login-form-box">
          <h4>Masuk</h4>
          <p>Masuk untuk mengakses sistem informasi Jasa Raharja</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-[#1d2630]">Email</label>
              <input
                type="email"
                required
                className="form-control"
                placeholder="nama@jasaraharja.co.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[#1d2630]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="form-control pr-10"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="text-secondary-400 absolute top-1/2 right-3 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Show password"
                >
                  <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} />
                </button>
              </div>
            </div>

            {error && <p className="text-danger-600 mb-4 text-sm">{error}</p>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
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
