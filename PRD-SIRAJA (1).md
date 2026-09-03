# Product Requirements Document (PRD)
## SIRAJA — AI-Powered Digital Ecosystem for PT Jasa Raharja (Persero)

**Versi:** 1.0
**Tanggal:** 3 September 2026
**Status:** Draft untuk eksekusi bertahap
**Tagline:** *Where Intelligence Drives Every Decision*

---

## 1. Ringkasan Eksekutif

SIRAJA adalah aplikasi web internal untuk PT Jasa Raharja (Persero) yang mengintegrasikan seluruh proses operasional — manajemen klaim & santunan, asisten AI internal, analitik, pemetaan data kecelakaan, dan manajemen pegawai — dalam satu ekosistem yang didukung kecerdasan buatan (AI) sebagai *intelligence engine*, bukan sekadar alat bantu tambahan.

Target pengguna: **pegawai internal Jasa Raharja** (petugas lapangan, verifikator klaim, kepala cabang, direksi/manajemen).

Proyek dibangun secara **bertahap (phased)** agar setiap modul matang sebelum lanjut ke modul berikutnya, dan agar setiap fase bisa langsung dieksekusi sebagai satu unit kerja di Claude Code.

---

## 2. Tujuan Produk

| Tujuan | Metrik Keberhasilan (indikatif) |
|---|---|
| Mempercepat proses klaim santunan | Waktu proses klaim turun dari hitungan hari menjadi hitungan jam |
| Mengurangi kesalahan kalkulasi santunan | Kalkulasi berbasis rules engine, bukan input manual |
| Mempercepat akses informasi internal (tarif, SOP, ketentuan) | Pegawai dapat jawaban dalam hitungan detik via AI Asisten |
| Meningkatkan visibilitas manajemen atas kondisi operasional | Dashboard real-time menggantikan laporan manual berkala |
| Deteksi dini titik rawan kecelakaan | Sinyal peringatan otomatis dari pola data geospasial |
| Menjaga keamanan & akuntabilitas data | RBAC granular + audit log penuh |

---

## 3. Prinsip Desain & Batasan Penting

Beberapa keputusan arsitektur mendasar yang mengikat seluruh fase pembangunan:

1. **AI membantu, manusia memutuskan.** AI tidak pernah menjadi otoritas final atas pencairan dana. Setiap output AI (estimasi santunan, klasifikasi kasus, rekomendasi) berstatus *draft/rekomendasi* yang wajib direview dan disetujui pegawai berwenang sebelum berdampak pada data resmi.
2. **Kalkulasi tarif santunan bersifat deterministik, bukan generatif.** Nilai santunan dihitung oleh *rules engine* berbasis tabel tarif resmi Jasa Raharja yang tersimpan di database — bukan dihasilkan oleh LLM. Model AI (Groq) hanya digunakan untuk: (a) klasifikasi jenis kasus dari deskripsi/dokumen, (b) menjawab pertanyaan dari knowledge base (RAG), (c) menyusun ringkasan/narasi laporan.
3. **AI Asisten menjawab berdasarkan knowledge base internal (RAG), bukan pengetahuan umum model.** Ini mencegah halusinasi terhadap angka tarif atau ketentuan resmi. Jawaban wajib menyertakan rujukan sumber dokumen internal.
4. **RBAC granular sejak awal.** Struktur peran & permission didefinisikan di Fase 1 dan menjadi fondasi seluruh modul berikutnya — bukan ditambahkan belakangan.
5. **Data eksternal (Korlantas Polri) menggunakan data mock/dummy terlebih dahulu.** Struktur skema dirancang siap-integrasi, tapi pengisian data real menunggu kerja sama data resmi antar-instansi.
6. **Audit trail wajib di semua modul yang mengubah data.** Setiap create/update/delete/approve pada data klaim, santunan, dan pengguna harus tercatat: siapa, kapan, apa yang berubah.

---

## 4. Tech Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Aplikasi | **Next.js (React)** — monorepo, full-stack dalam satu codebase | Frontend (pages/components) dan backend (API routes/route handlers) menyatu dalam satu project, TIDAK dipisah menjadi dua repo/project berbeda |
| Database | **MongoDB Atlas** | Cloud-hosted, connection string disediakan terpisah oleh user |
| AI Engine | Groq API | LLM inference cepat (700+ token/detik), dipanggil dari API routes Next.js |
| Vector Store (RAG) | MongoDB Atlas Vector Search | Memakai cluster yang sama — tidak perlu vector DB terpisah |
| Deployment | Docker | Single container untuk seluruh aplikasi (bukan container terpisah frontend/backend) |
| Auth | JWT + bcrypt (atau setara), atau NextAuth | Dikombinasikan dengan RBAC middleware di API routes |

> **Perubahan dari draft sebelumnya:** semula direncanakan React+Vite (frontend) terpisah dari Node.js+Express (backend). Berdasarkan keputusan untuk monorepo tanpa pemisahan frontend/backend, arsitektur diubah menjadi **satu aplikasi Next.js** yang menangani UI dan API dalam satu codebase, satu proses build, dan satu deployment.

> **Catatan teknis MongoDB Atlas:** Karena database bersifat dokumen (bukan relasional), skema di dokumen ini disusun sebagai *collection design*, bukan ERD relasional kaku. Atlas Vector Search dipakai untuk RAG di Modul AI Asisten, sehingga tidak perlu infrastruktur vector DB tambahan (Qdrant/Chroma/Pinecone).

---

## 5. Modul Produk (Ringkasan)

| # | Modul | Fungsi Inti |
|---|---|---|
| 1 | Manajemen Klaim & Santunan | Siklus hidup klaim: laporan → verifikasi → kalkulasi → approval → pencairan |
| 2 | AI Asisten Internal (Groq + RAG) | Tanya-jawab knowledge base internal berbahasa Indonesia |
| 3 | Dashboard Analitik & Pelaporan | Metrik real-time + ekspor laporan PDF/Excel + ringkasan AI |
| 4 | Peta Data Kecelakaan | Visualisasi geospasial + deteksi pola titik rawan |
| 5 | Manajemen Pegawai & RBAC | User management, roles, permission, audit log |

---

## 6. Roadmap Bertahap (Fase Eksekusi untuk Claude Code)

Proyek dipecah menjadi 5 fase. **Setiap fase adalah satu sesi kerja mandiri** — tidak lanjut ke fase berikutnya sebelum fase sebelumnya stabil.

### **FASE 0 — Fondasi Proyek**
- Setup struktur project **monorepo Next.js tunggal** (UI + API routes dalam satu codebase, tanpa folder /frontend dan /backend terpisah)
- Koneksi ke MongoDB Atlas (connection string via environment variable, user akan berikan terpisah)
- Setup Docker (satu Dockerfile untuk seluruh aplikasi)
- Struktur folder & konvensi kode (linting, env config, error handling standar)
- Health-check endpoint (API route)

### **FASE 1 — Autentikasi & RBAC (Manajemen Pegawai)**
- Collection `users`, `roles`, `permissions`, `audit_logs`
- Definisi peran: Petugas Lapangan, Verifikator/Kepala Cabang, Direksi/Manajemen, Super Admin (dapat disesuaikan)
- Login/logout, JWT session, password hashing
- Middleware otorisasi berbasis peran per-endpoint
- CRUD manajemen pengguna (khusus admin)
- Audit log dasar (login, perubahan data user)

### **FASE 2 — Manajemen Klaim & Santunan (Modul Inti)**
- Collection `claims`, `claimants`, `tariff_rules`, `payments`
- Alur: input laporan kecelakaan → upload dokumen → verifikasi kelengkapan → klasifikasi kasus (AI-assisted) → kalkulasi santunan (rules engine deterministik) → approval berjenjang → pencatatan pencairan
- Rules engine tarif santunan sebagai modul terpisah & dapat diaudit
- Status tracking klaim (draft, submitted, verified, approved, paid, rejected)
- Audit log penuh di setiap perubahan status klaim

### **FASE 3 — AI Asisten Internal (Groq + RAG)**
- Ingest dokumen internal (tarif resmi, SOP, ketentuan) → chunking → embedding → simpan di MongoDB Atlas Vector Search
- Endpoint chat: query pegawai → retrieve dokumen relevan → kirim ke Groq sebagai context → jawaban + sitasi sumber
- Riwayat percakapan per pengguna
- Guardrail: jika tidak ada dokumen relevan ditemukan, AI menyatakan tidak tahu (bukan mengarang jawaban)

### **FASE 4 — Dashboard Analitik & Pelaporan**
- Agregasi data dari Modul Klaim (jumlah klaim aktif, realisasi santunan per wilayah, tren bulanan, tingkat penyelesaian)
- Visualisasi (chart) di frontend
- Ekspor laporan PDF/Excel
- Ringkasan eksekutif yang digenerate AI (berbasis data agregat riil, bukan asumsi)

### **FASE 5 — Peta Data Kecelakaan**
- Collection `accident_points` dengan struktur siap-integrasi Korlantas Polri (data awal: mock/dummy)
- Visualisasi geospasial (peta interaktif)
- Analisis pola AI: deteksi titik rawan berulang → sinyal peringatan ke dashboard manajemen

---

## 7. Struktur Data Awal (Gambaran Collection MongoDB)

> Ini adalah gambaran awal tingkat tinggi — detail skema penuh (field, index, validasi) akan disusun per fase saat eksekusi.

- **users** — data pegawai, role_id, status aktif
- **roles** — nama peran, daftar permission
- **audit_logs** — actor, action, target, timestamp, detail perubahan
- **claims** — data laporan kecelakaan, status, klasifikasi AI, riwayat approval
- **claimants** — data korban/penerima santunan
- **tariff_rules** — tabel tarif resmi per kategori/golongan
- **payments** — riwayat pencairan santunan
- **kb_documents** — dokumen knowledge base (untuk RAG)
- **kb_embeddings** — vector embedding dari kb_documents (Atlas Vector Search)
- **chat_history** — riwayat tanya-jawab AI Asisten per user
- **accident_points** — data titik kecelakaan (geospasial, mock awal)

---

## 8. Hal yang Perlu Diklarifikasi Sebelum/Selama Eksekusi

Daftar ini sebaiknya diisi bertahap seiring proyek berjalan, bukan blocker untuk mulai Fase 0–1:

- [ ] Daftar peran (roles) final dan permission matrix per peran
- [ ] Tabel tarif santunan resmi terbaru (sumber dokumen untuk rules engine & RAG)
- [ ] Format dokumen SOP/ketentuan internal yang akan di-ingest ke knowledge base
- [ ] Ketentuan alur approval berjenjang (satu level approval atau berjenjang sesuai nominal?)
- [ ] Kebutuhan integrasi resmi data Korlantas Polri (timeline, format data, API)
- [ ] Kebijakan retensi data & keamanan (khususnya data pribadi/kesehatan korban)

---

## 9. Ruang Lingkup di Luar Fase Awal (Out of Scope untuk saat ini)

- Aplikasi/portal untuk publik/nasabah (di luar scope — ini sistem internal)
- Integrasi pembayaran/perbankan langsung (pencairan dana dicatat, bukan dieksekusi otomatis oleh sistem)
- Integrasi real-time dengan sistem Korlantas Polri (menunggu kerja sama data resmi)

---

## 10. Cara Pakai Dokumen Ini

Dokumen ini menjadi acuan saat membuka sesi Claude Code. Setiap fase dieksekusi sebagai prompt/task terpisah, merujuk ke bagian "Roadmap Bertahap" (§6) dan "Prinsip Desain & Batasan Penting" (§3). Connection string MongoDB Atlas akan diberikan langsung sebagai environment variable saat eksekusi Fase 0, tidak dituliskan di dalam dokumen ini atau di dalam kode.
