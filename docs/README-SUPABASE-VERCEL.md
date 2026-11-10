# FITYORA STORE: Vercel + Supabase PostgreSQL

Panduan lengkap, terbaru, dan satu-satunya sumber acuan deploy ada di **[README-VERCEL-DEPLOY.md](./README-VERCEL-DEPLOY.md)**.

Ringkasan arsitektur:

- **Frontend:** React + Vite, hasil build disalin ke `public/` dan disajikan CDN Vercel.
- **Backend:** Express (`server.ts`) berjalan sebagai Vercel Function.
- **Database:** Supabase PostgreSQL lewat `DATABASE_URL` (Transaction Pooler, 1 koneksi per instance).
- **Akses browser ke tabel:** ditutup (RLS tanpa policy). Semua lewat server.
- **Sumber kebenaran data:** katalog & harga (`custom_products`), pesanan, member, sesi, ulasan, pengaturan tema/musik, langganan push, semuanya di database.
