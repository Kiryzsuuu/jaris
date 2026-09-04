# Product Requirements Document (PRD)
## JARIS — AI-Powered Digital Ecosystem for PT Jasa Raharja (Persero)

**Versi:** 2.0 (update dari draft awal — mencerminkan kondisi aplikasi saat ini)
**Tanggal:** 4 September 2026
**Status:** Sudah dibangun dan live di produksi (`https://jaris.inspiratekno.com`) — dokumen ini sekarang berfungsi sebagai *system snapshot* untuk brainstorming perombakan UI, bukan lagi rencana eksekusi dari nol.
**Nama produk:** JARIS (Jasa Raharja Integrated Intelligence System) — sebelumnya bernama SIRAJA di draft awal.
**Copyright/pengembang:** Nusa Inspira Teknologi (RFS)

---

## 1. Ringkasan Eksekutif

JARIS adalah aplikasi web internal untuk PT Jasa Raharja (Persero) yang mengintegrasikan manajemen klaim & santunan, asisten AI internal, analitik, pemetaan data kecelakaan, deteksi anomali klaim, broadcast pengumuman, dan manajemen pegawai dalam satu ekosistem. Seluruh modul di roadmap awal (Fase 0–5) **sudah dibangun dan berjalan di produksi**, ditambah beberapa modul baru yang tidak ada di draft awal (deteksi fraud, broadcast, prediksi risiko kecelakaan, agen audit klaim berbasis AI, data contoh yang bisa dihapus admin).

Target pengguna tetap sama: pegawai internal Jasa Raharja (petugas lapangan, verifikator klaim, kepala cabang, direksi/manajemen), plus Super Admin untuk konfigurasi sistem.

**Tujuan dokumen versi ini:** memberi konteks lengkap dan akurat tentang kondisi aplikasi *saat ini* — fitur, struktur data, dan terutama sistem desain/UI — supaya bisa dipakai sebagai titik awal diskusi perombakan UI di sesi Claude yang baru, tanpa perlu menjelaskan ulang dari nol.

---

## 2. Tujuan Produk (tidak berubah dari draft awal)

| Tujuan | Metrik Keberhasilan (indikatif) |
|---|---|
| Mempercepat proses klaim santunan | Waktu proses klaim turun dari hitungan hari menjadi hitungan jam |
| Mengurangi kesalahan kalkulasi santunan | Kalkulasi berbasis rules engine, bukan input manual |
| Mempercepat akses informasi internal (tarif, SOP, ketentuan) | Pegawai dapat jawaban dalam hitungan detik via AI Asisten |
| Meningkatkan visibilitas manajemen atas kondisi operasional | Dashboard real-time menggantikan laporan manual berkala |
| Deteksi dini titik rawan kecelakaan | Sinyal peringatan otomatis dari pola data geospasial |
| Menjaga keamanan & akuntabilitas data | RBAC granular + audit log penuh |
| *(baru)* Deteksi potensi kecurangan klaim | Sinyal statistik over-claim/over-charge untuk investigasi manual |

---

## 3. Prinsip Desain & Batasan Penting (tetap berlaku, sudah diimplementasikan)

1. **AI membantu, manusia memutuskan.** Setiap output AI (estimasi santunan, klasifikasi kasus, rekomendasi, hasil audit, deteksi fraud) berstatus saran/draft — tidak pernah otomatis mengubah data resmi. Diterapkan konsisten di semua fitur AI: `isSuggestionOnly: true` pada respons API klasifikasi kasus, analisis foto kerusakan, agen audit klaim, dan deteksi fraud.
2. **Kalkulasi tarif santunan deterministik, bukan generatif.** Dihitung oleh rules engine (`lib/tariffEngine.ts`) dari tabel tarif resmi di database — LLM (Groq) tidak pernah menghitung nominal santunan.
3. **AI Asisten menjawab dari knowledge base internal (RAG), bukan pengetahuan umum model**, lengkap rujukan sumber; jika dokumen relevan tidak ditemukan, AI menyatakan tidak tahu.
4. **RBAC granular** — sekarang 16 permission berbeda (lihat §7), termasuk permission baru untuk fraud detection dan broadcast.
5. **Data eksternal (Korlantas Polri) masih mock/dummy** — peta kecelakaan diberi label eksplisit "data mock/dummy" di UI; struktur data siap-integrasi untuk kerja sama data resmi nanti.
6. **Audit trail wajib** — `models/AuditLog.ts` mencatat semua perubahan data penting, termasuk aksi baru (jalankan audit AI, hapus data contoh, kirim broadcast).

---

## 4. Tech Stack Aktual (berbeda dari sebagian rencana awal)

| Layer | Teknologi | Catatan |
|---|---|---|
| Aplikasi | **Next.js 16 (App Router)**, TypeScript | Satu codebase, UI + API routes menyatu, sesuai rencana awal |
| Database | **MongoDB Atlas** | Sesuai rencana |
| AI Engine | **Groq API** — model teks (`llama-3.3-70b-versatile`) + model vision (`meta-llama/llama-4-scout-17b-16e-instruct`) | Dipakai untuk RAG, klasifikasi kasus, analisis foto kerusakan, agen audit klaim, narasi deteksi fraud, ringkasan eksekutif dashboard |
| Vector Store (RAG) | MongoDB koleksi `kb_embeddings` (bukan Atlas Vector Search asli — retrieval disederhanakan) | |
| Cuaca (fitur prediksi risiko) | Open-Meteo API | Data cuaca real untuk faktor prediksi risiko kecelakaan |
| Email | Nodemailer + Gmail App Password | Notifikasi status klaim & broadcast pengumuman |
| **Deployment** | **Bukan Docker** — PM2 process manager + Nginx reverse proxy di VPS Biznet Gio Cloud, deploy manual via `redeploy-jaris` (git pull + build + restart) | Berbeda dari rencana awal (Docker single container) |
| Auth | JWT (access + refresh token) di httpOnly cookie + bcrypt | Sesuai rencana, tanpa NextAuth |
| Styling | Tailwind CSS v4, berbasis template admin **Datta Able** yang di-vendor & dikustom flat/minimalis | Tidak ada di rencana awal — keputusan desain di tengah jalan |

---

## 5. Modul Produk — Status Saat Ini

| # | Modul | Status | Halaman |
|---|---|---|---|
| 1 | Manajemen Klaim & Santunan | ✅ Selesai, sesuai rencana | `/claims`, `/claims/new`, `/claims/[id]` |
| 2 | AI Asisten Internal (Groq + RAG) | ✅ Selesai | `/assistant` |
| 3 | Dashboard Analitik & Pelaporan | ✅ Selesai + diperluas (SLA, tren proyeksi, breakdown korban, rekomendasi AI gabungan) | `/dashboard` |
| 4 | Peta Data Kecelakaan | ✅ Selesai + tab Prediksi Risiko baru | `/accident-map` |
| 5 | Manajemen Pegawai & RBAC | ✅ Selesai | `/users` |
| 6 | *(baru)* Deteksi Anomali/Fraud Klaim | ✅ Baru — scan statistik (z-score biaya, NIK ganda, rekening bersama, dokumen minim, persetujuan tercepat) + narasi AI | `/fraud-detection` |
| 7 | *(baru)* Broadcast Pengumuman | ✅ Baru — banner in-app + email ke semua/peran tertentu | `/broadcast` |
| 8 | *(baru)* Knowledge Base Admin | ✅ Baru — UI untuk ingest dokumen teks/markdown/PDF (dengan OCR via AI vision untuk PDF hasil scan) yang menjadi sumber RAG | `/knowledge-base` |
| 9 | *(baru)* Agen Audit Klaim (AI) | ✅ Baru — multi-step: cek kelengkapan dokumen → analisis foto AI → sintesis rekomendasi, dipicu manual di halaman detail klaim | Bagian dari `/claims/[id]` |
| 10 | *(baru)* Pengaturan Situs | ✅ Baru — admin bisa ubah nama situs, logo, favicon, warna tema (7 warna terpisah), gambar hero/section/login, gambar per-kartu landing page, dan hapus data contoh | `/settings` |
| 11 | *(baru)* Landing Page Publik | ✅ Baru — halaman depan sebelum login: hero, alur kerja, kapabilitas (kartu bisa diklik untuk detail), berita nasional live (RSS), peta wilayah kerja interaktif | `/` |

---

## 6. Struktur Data (Collection MongoDB) — kondisi saat ini

Tambahan dari daftar awal (§7 draft v1):

- **broadcasts** — pengumuman terkirim (judul, pesan, audiens, jumlah penerima/email terkirim)
- **site_settings** — dokumen singleton: identitas situs, 7 field warna tema, gambar (logo/favicon/hero — bisa banyak gambar hero sebagai slideshow/section/login/per-kartu landing), footer
- Field `isDemo` ditambahkan ke `claims`, `claimants`, `payments` — menandai data contoh yang bisa dihapus admin dalam satu klik tanpa menyentuh data asli
- `accident_points` memakai field `source: "mock" | "korlantas_polri"` untuk tujuan yang sama (data dummy vs. data resmi nanti)

---

## 7. RBAC — Permission Saat Ini (16 total)

`user:manage`, `user:view`, `role:manage`, `role:view`, `claim:create`, `claim:verify`, `claim:approve`, `claim:view`, `dashboard:view`, `audit:view`, `assistant:use`, `kb:manage`, `map:view`, `settings:manage`, `fraud:view` *(baru)*, `broadcast:manage` *(baru)*.

Peran (roles) tidak berubah dari draft awal: **Petugas Lapangan**, **Verifikator/Kepala Cabang**, **Direksi/Manajemen**, **Super Admin**.

---

## 8. Sistem Desain Saat Ini — konteks utama untuk brainstorming UI

Ini bagian paling relevan untuk sesi brainstorming perombakan UI berikutnya.

### 8.1 Basis desain
Dibangun di atas template admin **Datta Able** (Tailwind CSS v4) yang di-vendor ke dalam project (`public/assets/scss`), lalu dikustomisasi berkali-kali menjadi lebih flat/minimalis (border tipis, radius kecil, nyaris tanpa shadow/pill shape berlebih). Landing page & login page memakai layout kustom terpisah dari shell admin.

### 8.2 Palet warna (admin-configurable, disimpan di `SiteSettings`, di-inject sebagai CSS variable server-side)
| Token | Default (hex) | Kegunaan |
|---|---|---|
| `primaryColor` | `#0B2D6B` (Navy) | Tombol utama, tautan, header, hero, sidebar |
| `secondaryColor` | `#1B4FA0` (Biru) | Elemen sekunder |
| `aiColor` | `#1B4FA0` (Biru) | Status aktif, aksen gradient |
| `highlightColor` / `accentColor` | `#F2A900` (Gold) | **Fixed di kode**, bukan lagi field Site Settings — dipakai untuk badge & aksen kecil, sengaja dikunci supaya kontras teks navy-di-atas-gold tetap terjaga |
| `backgroundColor` | `#F8FAFC` (Slate-50) | Latar halaman |
| `sidebarColor` | `#0B2D6B` | Latar sidebar navigasi |

Skala penuh 50–950 untuk tiap warna di-derive otomatis dari satu hex (`lib/colorUtils.ts`) dan diterapkan lewat CSS var yang di-override di `app/layout.tsx` — root layout memakai `export const dynamic = "force-dynamic"` supaya perubahan warna di Pengaturan Situs langsung berlaku tanpa perlu redeploy.

Latar kartu & input **sengaja dikunci putih**, tidak admin-configurable — supaya admin tidak bisa memilih warna yang membuat isi kartu tidak terbaca.

### 8.3 Tipografi
- Aplikasi admin (setelah login): font **Nunito**
- Landing page & login (publik): font **Inter**
(Kedua font dimuat via `next/font/google`.)

### 8.4 Layout & komponen
- `components/AppShell.tsx` — shell bersama semua halaman admin: sidebar navigasi (dikelompokkan per section: Menu, Operasional, Administrasi), header dengan avatar/dropdown profil, banner broadcast yang bisa ditutup, auto-logout 5 menit idle, footer copyright.
- Pola `.card > .card-header/.card-body` dipakai konsisten di semua halaman untuk blok konten.
- Landing page (`app/page.tsx`) punya hero full-bleed (gambar/carousel AI sebagai background, headline putih di atasnya dengan gradient overlay untuk kontras), section alur kerja & kapabilitas dengan kartu yang bisa diklik (membuka modal detail + gambar opsional per-kartu), section berita nasional live, dan peta wilayah kerja interaktif (embed Google Maps tanpa API key).
- Login page: layout dua kolom — panel kiri gelap (gambar/gradient + highlight fitur), form di kanan.

### 8.5 Data contoh (demo data)
Karena database sempat kosong dan membuat Dashboard/Peta/Fraud Detection terlihat "rusak" (semua nol), ada `scripts/seedDemoData.ts` yang mengisi klaim, penerima santunan, pencairan, dan titik kecelakaan contoh yang realistis (ditandai `isDemo`/`source:"mock"`), bisa dihapus kapan saja lewat tombol di Pengaturan Situs.

### 8.6 Hal yang perlu diperhatikan saat brainstorming UI baru
- Sistem palet warna admin-configurable (7 token, skala 50–950 auto-derive) sudah cukup matang — perombakan UI sebaiknya tetap kompatibel dengan mekanisme ini, bukan hardcode warna baru.
- Root layout `force-dynamic` penting untuk Pengaturan Situs — jangan sampai perombakan UI membuat halaman jadi statically-rendered lagi (bug yang pernah terjadi: perubahan warna/logo/favicon tidak berlaku sampai redeploy).
- Landing page sudah ada sistem "kartu bisa diklik + modal detail + gambar per-kartu dari Site Settings" — kalau desain baru mengubah struktur kartu, sistem gambar-per-slug ini (`lib/landingContent.ts`, `SiteSettings.cardImages`) perlu diikutkan.

---

## 9. Hal yang Sudah Tidak Perlu Diklarifikasi (sudah diputuskan selama pembangunan)

- ~~Daftar peran & permission matrix~~ — final, 4 peran + 16 permission (§7)
- ~~Tabel tarif santunan~~ — sudah di-seed (`lib/tariffRuleSeeds.ts`)
- ~~Alur approval berjenjang~~ — satu level approval per status transition (submitted→verified→approved→paid), tidak berjenjang berdasarkan nominal

## 10. Masih Terbuka / Belum Bisa Dibangun

- **Integrasi resmi data Korlantas Polri** — masih mock, menunggu kerja sama data resmi antar-instansi
- **CCTV lalu lintas real-time (Jasa Marga Travoy)** — tidak ada akses API resmi; landing page hanya menaut ke situs Travoy, tidak menampilkan feed langsung
- **"AI-based predictive collection"** (salah satu topik riset yang diminta) — butuh model data premi/billing yang belum ada di skema JARIS saat ini

---

## 11. Cara Pakai Dokumen Ini

Dokumen versi 2.0 ini dipakai sebagai *briefing* saat membuka sesi Claude baru untuk brainstorming perombakan UI — terutama §8 (Sistem Desain Saat Ini). Sertakan juga tangkapan layar halaman yang ingin dirombak, karena dokumen ini mendeskripsikan struktur & mekanisme, bukan tampilan piksel-demi-piksel.
