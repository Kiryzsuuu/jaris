// Shared between the landing page (app/page.tsx, renders these as clickable
// cards with a detail modal) and the settings page (app/settings/page.tsx,
// lets an admin attach an optional image to each card by slug). Keeping one
// source of truth means the two can never drift out of sync on which slugs
// exist.

export type LandingCard = {
  slug: string;
  icon: string;
  title: string;
  desc: string;
  detail: string;
  badge?: string;
  highlighted?: boolean;
  linkHref?: string;
  linkLabel?: string;
};

export const CLAIM_FLOW: LandingCard[] = [
  {
    slug: "flow-01-laporan",
    icon: "ti-file-plus",
    title: "Laporan Diajukan",
    desc: "Petugas mengisi data kecelakaan, korban, dan dokumen pendukung langsung dari lapangan.",
    detail:
      "Petugas lapangan membuat laporan langsung dari lokasi kejadian: data kecelakaan (tanggal, lokasi, moda transportasi), data korban/penerima santunan, dan dokumen pendukung (KTP, surat keterangan kepolisian, dsb). Laporan disimpan sebagai draft dan bisa dilengkapi bertahap sebelum diajukan resmi.",
  },
  {
    slug: "flow-02-verifikasi",
    icon: "ti-list-check",
    title: "Verifikasi Kelengkapan",
    desc: "Petugas verifikasi memeriksa kelengkapan berkas sebelum klaim berlanjut ke tahap persetujuan.",
    detail:
      "Setelah diajukan, klaim masuk antrean verifikasi. Petugas verifikasi/kepala cabang memeriksa kelengkapan dan kesesuaian dokumen. Klaim yang tidak lengkap dapat ditolak dengan alasan tertulis, dan pelapor diberi tahu lewat notifikasi email otomatis.",
  },
  {
    slug: "flow-03-kalkulasi",
    icon: "ti-calculator",
    title: "Kalkulasi & Persetujuan",
    desc: "Rules engine menghitung besaran santunan secara deterministik, lalu pejabat berwenang menyetujui.",
    detail:
      "Besaran santunan dihitung otomatis oleh rules engine berdasarkan tabel tarif resmi (kategori kasus, moda transportasi, persentase cacat, atau biaya perawatan yang diklaim) - bukan estimasi AI. Pejabat berwenang meninjau angka ini dan memberikan persetujuan akhir.",
  },
  {
    slug: "flow-04-pencairan",
    icon: "ti-wallet",
    title: "Pencairan Santunan",
    desc: "Setelah disetujui, pencairan dana ke penerima santunan tercatat dan dapat dilacak riwayatnya.",
    detail:
      "Setelah disetujui, pencairan dana ke rekening penerima santunan dicatat lengkap dengan metode pembayaran, referensi transfer, dan waktu pencairan. Seluruh riwayat klaim - dari laporan hingga pencairan - tetap tersimpan dan bisa ditelusuri kapan saja.",
  },
];

export const CAPABILITIES: LandingCard[] = [
  {
    slug: "cap-memahami-data",
    icon: "ti-file-text",
    title: "Memahami Data",
    desc: "AI membaca dan merangkum data operasional secara otomatis, dari laporan klaim hingga dokumen internal.",
    detail:
      "AI Asisten internal menjawab pertanyaan berbasis dokumen resmi yang diunggah ke Knowledge Base (RAG - Retrieval Augmented Generation), lengkap dengan rujukan sumbernya. Jawaban selalu berbasis dokumen yang benar-benar ada, bukan mengarang informasi.",
    badge: "AI",
    linkHref: "/login",
    linkLabel: "Coba AI Asisten",
  },
  {
    slug: "cap-menganalisis-pola",
    icon: "ti-chart-line",
    title: "Menganalisis Pola",
    desc: "Mendeteksi pola dan tren dari ribuan data kecelakaan dan klaim secara berkelanjutan.",
    detail:
      "Dashboard analitik mengagregasi data klaim dan kecelakaan secara real-time langsung dari database - jumlah klaim per status, realisasi santunan per cabang, dan tren kecelakaan bulanan - membantu manajemen melihat pola operasional tanpa menunggu laporan manual.",
    linkHref: "/login",
    linkLabel: "Lihat Dashboard",
  },
  {
    slug: "cap-mempercepat-proses",
    icon: "ti-bolt",
    title: "Mempercepat Proses",
    desc: "Alur klaim dari verifikasi hingga pencairan berjalan lebih cepat dengan rules engine yang deterministik.",
    detail:
      "Kalkulasi santunan dilakukan otomatis oleh rules engine berbasis tabel tarif resmi, menghilangkan proses hitung manual yang rawan salah dan lambat. Petugas cukup meninjau dan menyetujui, bukan menghitung dari nol setiap kali.",
  },
  {
    slug: "cap-mendeteksi-risiko",
    icon: "ti-map-pin",
    title: "Mendeteksi Potensi Risiko",
    desc: "Klaster titik rawan kecelakaan terdeteksi otomatis sebagai sinyal peringatan dini bagi manajemen.",
    detail:
      "Titik-titik kecelakaan yang berulang dalam radius berdekatan dikelompokkan otomatis menjadi klaster/titik rawan pada peta interaktif, memberi sinyal peringatan dini bagi manajemen untuk tindakan pencegahan di wilayah tersebut.",
    linkHref: "/login",
    linkLabel: "Lihat Peta Kecelakaan",
  },
  {
    slug: "cap-rekomendasi",
    icon: "ti-message-chatbot",
    title: "Memberikan Rekomendasi",
    desc: "AI memberi saran klasifikasi kasus dan ringkasan eksekutif - keputusan akhir tetap di tangan Anda.",
    detail:
      "Saat membuat laporan klaim, petugas bisa meminta AI menyarankan klasifikasi kasus berdasarkan deskripsi kejadian, lengkap dengan tingkat keyakinan dan alasannya. Ini hanya SARAN - petugas tetap wajib mengonfirmasi kategori final secara manual.",
    badge: "AI",
  },
  {
    slug: "cap-insight-realtime",
    icon: "ti-gauge",
    title: "Insight Real-Time",
    desc: "Dashboard analitik yang selalu mencerminkan kondisi operasional terkini, kapan saja dibutuhkan.",
    detail:
      "Setiap angka di dashboard dihitung langsung dari database saat halaman dibuka - bukan laporan statis yang diperbarui berkala. Filter berdasarkan tanggal dan cabang, lalu ekspor ke Excel atau PDF untuk laporan resmi.",
  },
  {
    slug: "cap-analisis-gambar",
    icon: "ti-camera",
    title: "Analisis Gambar Kerusakan",
    desc: "Foto kerusakan yang diunggah petugas dianalisis AI untuk saran tingkat keparahan - langsung di form klaim.",
    detail:
      "Foto kerusakan/lokasi kecelakaan yang diunggah sebagai dokumen pendukung bisa dianalisis oleh AI vision untuk mendapatkan saran tingkat keparahan dan deskripsi singkat. Hasil ini murni saran (isSuggestionOnly) - keputusan akhir tetap di tangan petugas yang meninjau klaim.",
    badge: "AI",
    highlighted: true,
  },
];

// "About" panel (image left, colored text panel right) - one slot, image
// swappable from Pengaturan Situs like every other card here.
export const ABOUT_SECTION: LandingCard = {
  slug: "about-jaris",
  icon: "ti-building-skyscraper",
  title: "Satu platform, seluruh operasional Jasa Raharja",
  desc: "JARIS menyatukan manajemen klaim, asisten AI internal, analitik, dan pemetaan risiko kecelakaan dalam satu ekosistem - dibangun untuk kecepatan, akurasi, dan akuntabilitas penuh.",
  detail:
    "JARIS (Jasa Raharja Integrated Intelligence System) adalah sistem informasi internal yang mengintegrasikan seluruh siklus operasional Jasa Raharja - dari laporan kecelakaan di lapangan hingga pencairan santunan - dengan kecerdasan buatan sebagai alat bantu, bukan pengambil keputusan.",
  linkHref: "/login",
  linkLabel: "Masuk ke Sistem",
};

// Alternating image/text showcase blocks - real JARIS capabilities, framed
// like a "featured project" section.
export const SHOWCASE_SECTIONS: LandingCard[] = [
  {
    slug: "showcase-klaim",
    icon: "ti-file-text",
    title: "Manajemen Klaim & Santunan",
    desc: "Siklus klaim end-to-end - dari laporan lapangan, verifikasi berkas, kalkulasi tarif resmi, hingga pencairan - tercatat dan dapat dilacak di setiap tahap.",
    detail:
      "Setiap klaim melewati alur yang sama dan dapat diaudit: laporan diajukan petugas lapangan, diverifikasi kelengkapan dokumennya, dihitung besaran santunannya oleh rules engine berbasis tarif resmi (bukan estimasi AI), disetujui pejabat berwenang, lalu dicairkan dengan pencatatan penuh.",
  },
  {
    slug: "showcase-ai-asisten",
    icon: "ti-message-chatbot",
    title: "AI Asisten Berbasis Knowledge Base",
    desc: "Jawaban atas pertanyaan SOP, tarif, dan ketentuan internal - selalu bersumber dari dokumen resmi yang diunggah, lengkap dengan rujukannya.",
    detail:
      "AI Asisten internal menjawab menggunakan RAG (Retrieval Augmented Generation): setiap jawaban ditelusuri dari dokumen resmi di Knowledge Base, bukan dari pengetahuan umum model. Jika dokumen relevan tidak ditemukan, AI menyatakan tidak tahu alih-alih mengarang jawaban.",
  },
  {
    slug: "showcase-peta-fraud",
    icon: "ti-map-pin",
    title: "Peta Risiko & Deteksi Anomali",
    desc: "Titik kecelakaan berulang terdeteksi otomatis sebagai sinyal peringatan dini, sementara pemindaian statistik menandai pola klaim yang perlu ditinjau lebih lanjut.",
    detail:
      "Peta interaktif mengelompokkan titik kecelakaan yang berdekatan menjadi klaster/titik rawan. Terpisah dari itu, pemindaian anomali statistik (z-score biaya, NIK ganda, dokumen minim) menandai klaim berisiko untuk investigasi manual - keduanya bersifat saran, bukan keputusan otomatis.",
  },
];

// "Learn more" 3-card grid - informational, grounded in what the system
// actually does (no fabricated company-profile pages like Careers).
export const LEARN_MORE_CARDS: LandingCard[] = [
  {
    slug: "learn-tentang",
    icon: "ti-info-circle",
    title: "Tentang JARIS",
    desc: "Sistem informasi internal PT Jasa Raharja (Persero) untuk operasional klaim dan santunan.",
    detail:
      "JARIS dibangun untuk pegawai internal Jasa Raharja - petugas lapangan, verifikator, kepala cabang, dan direksi/manajemen - dengan akses berbasis peran (RBAC) yang jelas untuk setiap fungsi.",
  },
  {
    slug: "learn-keamanan",
    icon: "ti-shield-lock",
    title: "Keamanan & Akuntabilitas",
    desc: "Setiap perubahan data klaim, santunan, dan pengguna tercatat di audit log - siapa, kapan, dan apa yang berubah.",
    detail:
      "Akses dikontrol lewat kontrol akses berbasis peran (role-based access control) yang granular, dan setiap create/update/approve pada data penting tercatat penuh di audit log internal untuk keperluan akuntabilitas.",
  },
  {
    slug: "learn-pengguna",
    icon: "ti-users",
    title: "Untuk Pegawai Jasa Raharja",
    desc: "Dirancang untuk mempercepat kerja petugas lapangan, verifikator, dan manajemen - bukan menggantikan keputusan mereka.",
    detail:
      "Setiap output AI di JARIS (klasifikasi kasus, analisis foto, deteksi anomali) berstatus saran yang wajib ditinjau pegawai berwenang - prinsip \"AI membantu, manusia memutuskan\" berlaku di seluruh sistem.",
  },
];

// Not a clickable card - just a named image slot for the full-bleed stats
// section background. Reuses the same cardImages mechanism/admin UI as
// everything else so no separate settings field is needed.
export const STATS_BACKGROUND_SLUG = "section-stats-background";

export const ALL_LANDING_CARDS: LandingCard[] = [
  ...CLAIM_FLOW,
  ...CAPABILITIES,
  ABOUT_SECTION,
  ...SHOWCASE_SECTIONS,
  ...LEARN_MORE_CARDS,
  {
    slug: STATS_BACKGROUND_SLUG,
    icon: "ti-photo",
    title: "Gambar Latar Bagian Statistik",
    desc: "Latar belakang untuk bagian statistik operasional di halaman depan.",
    detail: "",
  },
];
