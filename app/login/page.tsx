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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f4f7fa] px-6 py-10">
      <span className="bg-primary-100 animate-[floating_7s_infinite] absolute -top-24 -right-24 block h-72 w-72 rounded-full opacity-70" />
      <span className="bg-primary-500 animate-[floating_9s_infinite] absolute top-32 -right-6 block h-4 w-4 rounded-full" />
      <span className="bg-primary-200 animate-[floating_9s_infinite] absolute -bottom-20 -left-20 block h-72 w-72 rounded-full opacity-70" />

      <div className="relative w-full max-w-[380px]">
        <div className="card w-full">
          <div className="card-body p-10">
            <div className="mb-8 flex flex-col items-center text-center">
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from site settings
                <img src={logoDataUrl} alt={siteName} className="mb-3 h-10 w-auto object-contain" />
              ) : (
                <div className="bg-primary-500 mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white">
                  {siteName.slice(0, 1)}
                </div>
              )}
              <h4 className="text-lg font-semibold text-[#1d2630]">{siteName}</h4>
              <p className="text-secondary-400 mt-1 text-sm">
                Masuk untuk mengakses sistem informasi Jasa Raharja
              </p>
            </div>

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
