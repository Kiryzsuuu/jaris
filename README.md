# JARIS

AI-Powered Digital Ecosystem for PT Jasa Raharja (Persero) - internal web application.
See [`PRD-SIRAJA (1).md`](./PRD-SIRAJA%20(1).md) for full product context (original PRD filename kept as-is; the product itself was renamed to JARIS after this document was written).

Single Next.js (App Router) monorepo: UI and API routes live in one codebase, one build, one deployment - no separate `/frontend` and `/backend`.

## UI

The whole app uses the **Spark Admin** template (Bootstrap 5, MIT-licensed, free - by Spark Admin Dev / ThemeWagon) for its visual design: dark forest-green sidebar, lime accent, card-based layout. The vendored template assets (`main.css`, Bootstrap CSS/JS, Bootstrap Icons) live at `public/vendor/spark/` and are loaded via plain `<link>`/`<script>` tags in [`app/layout.tsx`](./app/layout.tsx)/[`components/AppShell.tsx`](./components/AppShell.tsx) - not npm packages, so there's no bundler/version coupling. The template also ships ApexCharts and Flatpickr, but this app uses Recharts for charts and native `<input type="date">` instead, so those two libraries (and the template's stock avatar/demo images) were deliberately left out - don't re-add them unless a page actually starts using them.

Every authenticated page is wrapped in [`components/AppShell.tsx`](./components/AppShell.tsx), which renders the sidebar (nav items filtered by the current user's permissions), topbar (profile dropdown + logout), and the `page-header` title/subtitle block:

```tsx
<AppShell pageTitle="..." pageSubtitle="..." headerActions={<button>...</button>}>
  <div className="card">...</div>
</AppShell>
```

To add a new page to the sidebar, add an entry to `NAV_SECTIONS` in `AppShell.tsx` (with the permission key that should gate it). `/login` and `/` (public, pre-login) use the template's own `login-card`/`login-wrapper` classes instead, with no sidebar.

If you have more Spark Admin template pages/sections to match a look against (you mentioned having a dashboard template), drop the additional HTML/assets in and the same adaptation approach applies: reuse the template's CSS classes (`card`, `table-custom`, `badge-table`, `btn-dark`, `form-control`, etc.) rather than re-implementing styles inline.

## Folder structure

```
/app           UI pages and routes
/app/api       API route handlers (backend)
/lib           Database connection, shared helpers, standard API response shape
/components    Reusable UI components
/models        MongoDB schemas/models
/scripts       One-off scripts (role/tariff/Super Admin seeding, KB bulk ingest, accident-point mock data)
proxy.ts       Route protection for pages (Next.js 16 middleware convention)
```

## Getting started locally

1. Copy the env template and fill in MongoDB Atlas connection string + JWT secrets:
   ```
   cp .env.example .env.local
   ```
   Generate secrets with `openssl rand -hex 32` for `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.
2. Install dependencies:
   ```
   npm install
   ```
3. Seed roles, tariff rules, and the first Super Admin account - set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env.local`, then:
   ```
   npm run seed
   ```
   Optionally seed mock accident-map data too:
   ```
   npm run seed:accidents
   ```
4. Run the dev server:
   ```
   npm run dev
   ```
5. Open http://localhost:3000, or go straight to http://localhost:3000/login and sign in with the seeded Super Admin.

> If your database was seeded before Phase 4/5, re-run `npm run seed` - it upserts by role `slug`, so it safely adds the `dashboard:view` (Petugas Lapangan, limited scope) and `map:view` (all roles) permissions without touching existing users.

## Auth & RBAC (Phase 1)

- Roles (`super-admin`, `verifikator-kepala-cabang`, `direksi-manajemen`, `petugas-lapangan`) and their permissions are stored in the `roles` collection, not hardcoded in logic - see [`lib/permissions.ts`](./lib/permissions.ts).
- Session uses two JWTs in httpOnly cookies: a short-lived access token (15m) and a refresh token (7d). `POST /api/auth/refresh` issues a new access token.
- There is no public self-registration. New accounts are created only by a user with the `user:manage` permission, via `POST /api/auth/register` or `POST /api/users`.
- `lib/authGuard.ts` exposes `requirePermission(request, permission)` for use inside any API route handler.
- `proxy.ts` protects every gated UI route (`/users`, `/claims`, `/assistant`, `/dashboard`, `/accident-map`, `/settings`) - unauthenticated requests are redirected to `/login`, unauthorized ones back to `/`.
- Every login, user creation/update/deactivation, and role change is written to the `audit_logs` collection with actor, action, target, and before/after state.

## Claims & compensation (Phase 2)

- Status flow is a strict state machine - `draft → submitted → verified → approved → paid`, with `rejected` reachable from `submitted` or `verified`. Invalid transitions are rejected by the API (`isValidStatusTransition` in [`lib/claimTypes.ts`](./lib/claimTypes.ts)).
- Compensation amounts are computed by a **pure, deterministic function** - [`lib/tariffEngine.ts`](./lib/tariffEngine.ts) - driven by the `tariff_rules` collection, never by an LLM (PRD §3.2). It has no dependency on the database or request objects, so it can be unit-tested in isolation.
- Case classification (`meninggal_dunia` / `cacat_tetap` / `perawatan` / `penguburan`) is chosen manually by the reporting officer via a dropdown - AI-assisted classification is Phase 3, not built here.
- RBAC scope: Petugas Lapangan only see/act on claims they created (`lib/claimAccess.ts`); Verifikator/Kepala Cabang can verify and approve; Direksi/Manajemen has `claim:view` only and is effectively read-only since it holds neither `claim:verify` nor `claim:approve`.
- Supporting documents are stored as base64 embedded in the claim document (no object storage configured yet) - capped at ~3.7MB per file. Verification checks a required-document list per case category before allowing a claim to move to `verified`.
- Payment recording (`POST /api/claims/[id]/payment`) only records a disbursement against an `approved` claim - no real banking integration (out of scope per PRD §9).
- Every status change (submit, verify, approve, reject, paid) is written to `audit_logs` with actor, action, and before/after status.

## AI Asisten Internal - RAG (Phase 3)

Set `GROQ_API_KEY` in `.env.local` (get one from console.groq.com). Never hardcode it.

### How it works

1. **Ingest** (`kb_documents` + `kb_embeddings`): an admin (`kb:manage`, currently Super Admin only) submits a document via `POST /api/kb/documents` (`sourceType`: `text`, `markdown`, or `pdf` as base64) or via `npm run ingest:kb -- ./kb-source` to bulk-load local `.md`/`.txt` files. A `pdf` upload is text-extracted with `pdf-parse` and then run through [`lib/textToMarkdown.ts`](./lib/textToMarkdown.ts), a heuristic cleanup pass that strips page-break/whitespace noise and normalizes headings/bullets into Markdown - the document is stored as `sourceType: "markdown"` from that point on. [`lib/kbIngest.ts`](./lib/kbIngest.ts) then chunks the text ([`lib/chunking.ts`](./lib/chunking.ts), ~500 chars with overlap - kept small so each retrieved chunk costs fewer tokens), embeds each chunk ([`lib/embeddings.ts`](./lib/embeddings.ts)), and stores one `kb_embeddings` document per chunk.
2. **Retrieve**: `POST /api/assistant/chat` embeds the employee's question and calls [`lib/kbRetrieval.ts`](./lib/kbRetrieval.ts), which tries an Atlas `$vectorSearch` aggregation first and falls back to brute-force cosine similarity in application code if the vector index isn't configured yet (so the assistant still works before the manual Atlas step below - just without the index's speed/scale benefit).
3. **Guardrail**: chunks below `RAG_MIN_SCORE` (default `0.15`) are discarded. If nothing clears the bar, the API returns a fixed "not found in knowledge base" answer and **does not call Groq at all** - this is what prevents hallucinated answers (PRD §3.3). Only when relevant chunks exist does it build a context-only prompt and call Groq, and the response always carries the source documents used.
4. **History**: every user/assistant turn is saved to `chat_history` with `conversationId`, `userId`, and (for assistant turns) `sources` + `isGrounded`. `GET /api/assistant/chat` lists a user's conversations; `GET /api/assistant/chat/[conversationId]` returns one conversation's messages - both scoped to the logged-in user only.
5. **Case classification suggestion**: `POST /api/assistant/classify-case` asks Groq to suggest one of the 4 claim categories from a free-text description. This is a plain classification call (no RAG) and is wired into the "Sarankan kategori (AI)" button on `/claims/new` - the suggestion never auto-fills the form; the officer must click "Gunakan" to apply it, and can always pick a different category manually (PRD §3.1: AI membantu, manusia memutuskan).
6. **Token footprint**: retrieval is capped at `TOP_K = 3` chunks per question (down from an earlier 5), each chunk capped at ~500 characters - keeping the context block sent to Groq per chat answer small on purpose.

### Embeddings: no Groq embeddings endpoint exists

Groq only serves chat completions, not embeddings. By default `lib/embeddings.ts` uses a **dependency-free local feature-hashing embedding** (384 dimensions, deterministic, no extra API key) - good enough for keyword-driven retrieval over an internal document set out of the box. For real semantic embeddings, set `EMBEDDING_API_URL` + `EMBEDDING_API_KEY` (+ optionally `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS`) to any OpenAI-compatible `/embeddings` endpoint (e.g. OpenAI `text-embedding-3-small`). **Switching providers/dimensions requires re-ingesting every document** - vectors from different models aren't comparable - so decide before ingesting real SOP/tariff documents at scale.

### Manual step: configure the Atlas Vector Search index

This cannot be done from code - MongoDB Atlas Vector Search indexes are created via the Atlas UI (or `mongosh`/Admin API), not through a Mongoose schema. Without it, retrieval still works via the brute-force fallback above, but won't scale.

1. In the Atlas dashboard, open your cluster → **Atlas Search** tab → **Create Search Index**.
2. Choose **Vector Search** (not the regular text-search "Search" type) → **JSON Editor**.
3. Database/collection: your DB → `kb_embeddings`. Index name: `kb_vector_index` (must match `KB_VECTOR_INDEX_NAME` in [`lib/kbRetrieval.ts`](./lib/kbRetrieval.ts)).
4. Definition:
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 384,
         "similarity": "cosine"
       },
       { "type": "filter", "path": "documentId" }
     ]
   }
   ```
   Set `numDimensions` to `384` for the default local embedding, or to whatever `EMBEDDING_DIMENSIONS` you configured for a real provider (e.g. `1536` for `text-embedding-3-small`).
5. Save and wait for the index status to become **Active** (usually under a minute for a small collection).
6. No further code changes are needed - `retrieveRelevantChunks()` in `lib/kbRetrieval.ts` will start using `$vectorSearch` automatically once the index exists.

## Dashboard Analitik & Pelaporan (Phase 4)

- All four metrics are computed with **MongoDB aggregation pipelines** - [`lib/dashboardStats.ts`](./lib/dashboardStats.ts) - never by summing/looping over records in the frontend:
  - `getClaimsByStatus` - `$group` by `status`.
  - `getPaymentsByBranch` - `$lookup` payments → claims, `$group` by `claim.branch`, summing `amount`.
  - `getMonthlyAccidentTrend` - `$group` by `{ $year, $month }` of `accidentDate`.
  - `getAvgResolutionDays` - `$lookup` payments → claims, `$subtract` of `payment.recordedAt - claim.submittedAt` per paid claim, then `$avg`.
- `GET /api/dashboard/summary` returns all four in one call, scoped by RBAC via [`lib/dashboardFilters.ts`](./lib/dashboardFilters.ts): Petugas Lapangan (no `claim:verify`/`claim:approve`) are always forced to `reporterId = self` regardless of the `branch` query param - Verifikator/Kepala Cabang, Direksi, and Super Admin see the full dataset. Filters: `dateFrom`/`dateTo` (on `accidentDate`) and `branch`.
- **Branch/wilayah**: each `User` has a `branch` field (set at creation, editable in `/users`); each `Claim` denormalizes the reporter's `branch` at creation time so the aggregation above needs no extra join.
- `/app/dashboard` renders the four metrics with **Recharts** (bar/line charts + stat cards), with period and branch filters (branch filter is hidden entirely for Petugas Lapangan, matching their forced-own-scope access).
- **Export**: `GET /api/dashboard/export?format=excel|pdf` (same filters/RBAC as summary) generates the file server-side - `exceljs` for a multi-sheet workbook, `pdfkit` for a text-report PDF - and streams it back with `Content-Disposition: attachment`. Chosen over client-side generation because the export must reflect the same aggregation-computed numbers the API already trusts, not a re-derivation from data shipped to the browser.
- **Executive summary (AI)**: `POST /api/dashboard/narrative` - [`app/api/dashboard/narrative/route.ts`](./app/api/dashboard/narrative/route.ts) - runs the *same* aggregation as the summary endpoint, formats the real numbers into an explicit "=== DATA AGREGAT ===" block, and only then asks Groq to narrate 3-5 sentences from that block. The system prompt explicitly forbids inventing numbers or giving disbursement recommendations (PRD §3.1/§3.2 - AI narrates real figures, it does not decide or compute them).

## Peta Data Kecelakaan (Phase 5)

**Data pada modul ini seluruhnya mock/dummy** - struktur sudah siap-integrasi untuk API Korlantas Polri, tapi pengisian data real menunggu kerja sama data resmi antar-instansi (PRD §9). Setiap titik ditandai `source: "mock"`; `"korlantas_polri"` sudah dicadangkan di enum untuk saat integrasi nyata berjalan. `/accident-map` menampilkan banner peringatan ini secara eksplisit ke pengguna.

- **Model** ([`models/AccidentPoint.ts`](./models/AccidentPoint.ts)): `location` sebagai GeoJSON `Point` (`{ type: "Point", coordinates: [lng, lat] }`, urutan sesuai spesifikasi GeoJSON), plus `branch`/`province`/`city`, `severity`, `vehicleType`, `casualtyCount`, dan `relatedClaimId` opsional untuk keterkaitan masa depan dengan modul klaim.
- **Index geospasial**: `AccidentPointSchema.index({ location: "2dsphere" })` dibuat otomatis oleh Mongoose saat model didaftarkan (tidak seperti Atlas Vector Search di Fase 3, index `2dsphere` adalah fitur MongoDB standar, bisa dibuat lewat kode) - `npm run seed:accidents` juga memanggil `AccidentPoint.syncIndexes()` secara eksplisit agar index pasti ada sebelum data masuk.
- **Data mock**: `npm run seed:accidents` (tambahkan `-- --force` untuk menambah batch baru meski sudah ada data) menghasilkan ratusan titik tersebar di 10 wilayah Indonesia (Jakarta, Bandung, Surabaya, Semarang, Yogyakarta, Medan, Palembang, Makassar, Denpasar, Balikpapan) via [`lib/accidentPointSeeds.ts`](./lib/accidentPointSeeds.ts) - termasuk beberapa klaster "titik rawan" yang sengaja dibuat rapat (radius ~200m) supaya deteksi pola punya data nyata untuk ditemukan, di samping titik yang tersebar acak di area kota yang lebih luas.
- **Query geospasial**: `GET /api/accident-points` menerima filter `branch`, `province`, `dateFrom`/`dateTo`, dan `lat`+`lng`+`radiusMeters` - saat parameter lokasi diberikan, route memakai aggregation `$geoNear` (harus jadi stage pertama, memanfaatkan index `2dsphere`) untuk mencari titik terdekat dalam radius tertentu, lengkap dengan `distanceMeters` per titik.
- **Deteksi klaster / titik rawan**: [`lib/accidentClustering.ts`](./lib/accidentClustering.ts) - fungsi murni (tanpa akses DB) yang mengelompokkan titik-titik yang saling terhubung dalam radius tertentu (union-find atas graf ketetanggaan, jarak dihitung dengan haversine), lalu menyaring grup dengan jumlah titik ≥ `minPoints`. Sudah diverifikasi lewat smoke test: dari 316 titik mock, terdeteksi 14 klaster titik rawan (6-13 titik per klaster) yang cocok dengan klaster yang sengaja disisipkan seed. Dipakai oleh `GET /api/accident-points/clusters` (default radius 500m, minimal 5 titik, bisa dioverride lewat query param).
- **Sinyal peringatan di dashboard (terhubung ke Fase 4)**: `/app/dashboard` memanggil endpoint klaster yang sama dengan filter periode/cabang yang sedang aktif, dan menampilkan kartu peringatan merah "Sinyal Peringatan - Titik Rawan Kecelakaan" berisi lokasi + jumlah kejadian, dengan tautan ke `/accident-map`.
- **Peta** (`/app/accident-map`): [`components/LeafletMap.tsx`](./components/LeafletMap.tsx) pakai **Leaflet** + **react-leaflet** dengan tile OpenStreetMap gratis (tanpa API key berbayar) - dimuat lewat `next/dynamic(..., { ssr: false })` karena Leaflet butuh `window`/DOM dan tidak boleh di-render di server. Titik kecelakaan digambar sebagai `CircleMarker` berwarna sesuai `severity`; klaster digambar sebagai lingkaran radius merah transparan. Halaman ini punya filter wilayah/periode dan banner peringatan data mock yang sama seperti di atas.
- **RBAC**: permission baru `map:view`, diberikan ke keempat role (Petugas Lapangan, Verifikator/Kepala Cabang, Direksi/Manajemen, Super Admin) - data titik kecelakaan bukan data milik-pengguna seperti klaim, jadi tidak di-scope per pelapor.

## Site Settings

Admins (`settings:manage`, currently Super Admin only) can change site name, tagline, logo, favicon, accent color, and footer text at `/settings` without touching code or redeploying - every field actually takes effect app-wide, not just in the settings form:

- **Site name / logo**: used in `<title>` (`generateMetadata` in [`app/layout.tsx`](./app/layout.tsx)), the sidebar brand and public login/home cards ([`components/AppShell.tsx`](./components/AppShell.tsx)).
- **Favicon**: passed to Next's `metadata.icons`.
- **Accent color**: [`lib/colorUtils.ts`](./lib/colorUtils.ts) derives a hover shade, a translucent shade, and a contrast-safe foreground color from the single hex the admin picks, and `app/layout.tsx` injects them as a `:root` `<style>` override (`--brand-lime`, `--brand-lime-hover`, `--brand-lime-translucent`, `--theme-foreground`) computed server-side - no flash of the default color, no client JS required. This re-tints every use of the template's lime accent (active nav indicator, avatars, links, focus rings). Out of scope by design: the sidebar's dark background and the dashboard's chart colors stay fixed - only the one accent color is themeable, matching what the settings form actually exposes.
- **Footer text**: rendered by `AppShell` (`.footer-custom`, bottom of every authenticated page) and on the public `/` and `/login` pages.
- `GET /api/settings` is intentionally public (no auth) - the login page and every layout need the site name/logo before a session exists, and nothing sensitive is stored in this document.
- `PATCH /api/settings` (admin-only) accepts the text fields plus `logoDataUrl`/`faviconDataUrl` as base64 data URLs - see "Images are always base64" below.
- Settings live in a single-document `site_settings` collection ([`models/SiteSettings.ts`](./models/SiteSettings.ts)). Server components (`app/layout.tsx`) read it fresh per request; client components (`AppShell`, `/login`, `/`) fetch it once on mount via `GET /api/settings` - so a change is visible on next page load/navigation, no rebuild required.

## Images are always base64

Every place in the app that accepts an image (claim supporting documents, site logo, site favicon) converts it to a base64 string client-side (`FileReader.readAsDataURL`) before it ever reaches an API route, and stores it that way in MongoDB - there is no separate object-storage/CDN dependency to provision. Trade-off: this is fine for the current document sizes (capped at ~1.5-3.7MB per file); if usage grows well beyond that, moving to real object storage (e.g. an S3-compatible bucket on Biznet Gio) is the natural next step, but is not required to run the app today.

## Email (Google App Password)

Uses Gmail SMTP via `nodemailer` - see [`lib/mailer.ts`](./lib/mailer.ts). Set `GMAIL_USER` (a full Gmail/Workspace address) and `GMAIL_APP_PASSWORD` (an [App Password](https://myaccount.google.com/apppasswords), not the normal account password - requires 2-Step Verification enabled) in `.env.local`. `MAIL_FROM_NAME` controls the display name on outgoing mail.

Wired into two flows so far, both fire-and-forget via `sendMailSafe` (logs and swallows failures instead of breaking the request that triggered them):

- **New account welcome email** ([`lib/emailTemplates.ts`](./lib/emailTemplates.ts) `welcomeEmail`): sent from `POST /api/users` and `POST /api/auth/register` with the new user's email + temporary password + role.
- **Claim status change notification** (`claimStatusEmail`, via [`lib/claimNotify.ts`](./lib/claimNotify.ts)): sent to the reporting officer when their claim is verified, approved, rejected, or paid.

If `GMAIL_USER`/`GMAIL_APP_PASSWORD` are left empty, `sendMailSafe` fails silently (logged to the server console) - the app keeps working, it just doesn't send mail.

## Deploying to a VPS (Biznet Gio Cloud, no Docker)

This project intentionally has no Dockerfile. Deploy it as a plain Node.js process on the VPS:

1. Provision a Biznet Gio Cloud VPS (Ubuntu 22.04 or newer recommended) with Node.js 20+ installed.
2. Clone/copy the repo to the server, then on the server:
   ```
   npm install
   cp .env.example .env.local   # fill in real values, see below
   npm run build
   ```
3. Run it as a long-lived process with PM2 (recommended) instead of `npm run dev`:
   ```
   npm install -g pm2
   pm2 start npm --name jaris -- start
   pm2 save
   pm2 startup   # follow the printed instructions to survive reboots
   ```
4. Put Nginx in front as a reverse proxy (TLS termination + port 80/443 to Next.js on port 3000), and point your domain's DNS to the VPS.
5. MongoDB stays on Atlas (cloud-hosted) regardless of where the app itself runs, so no database process is needed on the VPS.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server (after build)
- `npm run lint` - run ESLint

## API response convention

All API routes return:

```json
{ "success": true, "data": {}, "message": "..." }
```

Use `successResponse` / `errorResponse` / `handleApiError` from [`lib/apiResponse.ts`](./lib/apiResponse.ts).
