# Panduan Deploy FITYORA STORE: Vercel + Supabase

Proyek ini khusus **Vercel** (Express sebagai Function dari `server.ts`, aset Vite dari `public/`) dan **Supabase PostgreSQL**. Tidak ada penyimpanan file lokal; semua data (pesanan, member, sesi, katalog, ulasan, pengaturan tema/musik, langganan push) ada di database.

## 1. Supabase (sekali)

1. Buat project Supabase. Pilih region terdekat dengan pembeli (untuk Indonesia umumnya **Singapore / ap-southeast-1**).
2. SQL Editor:
   - **Instalasi baru:** jalankan `supabase/schema.sql` satu kali.
   - **Database lama yang sudah berjalan:** jalankan berurutan yang belum pernah dijalankan: `20261107_backend_storage.sql`, `20261108_performance_indexes.sql`, lalu `20261110_tahap6_secure_and_tables.sql`. Semuanya aditif dan aman diulang.
3. Tombol **Connect** > **Transaction pooler** > salin URI (port `6543`) sebagai `DATABASE_URL`.

> **Keamanan:** kunci `anon` Supabase bersifat publik. Skema ini mengaktifkan RLS **tanpa policy** dan mencabut akses `anon`/`authenticated`, jadi browser tidak bisa membaca atau menulis tabel langsung. Semua akses lewat server. Versi lama `schema.sql` memiliki policy publik pada `orders` (siapa pun bisa membaca data pembeli); migrasi `20261110` menghapusnya. Jika project lama Anda dibuat dari schema versi awal, **wajib** jalankan migrasi tersebut.

## 2. Vercel

1. Import repository ke Vercel. Settings > General: **Node.js Version 24.x**, Build Command `npm run build`, **Output Directory kosong** (jangan `dist`). Jika preset terkunci sebagai Vite, ubah ke Other/Express.
2. `vercel.json` menetapkan region fungsi `sin1` (Singapore). **Samakan dengan region Supabase Anda**; bila berbeda, ubah `regions` agar latensi database rendah.
3. Settings > Environment Variables (server-only, **jangan pakai prefix `VITE_`**):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | Ya | Transaction Pooler Supabase (port 6543), tipe Secret |
| `ADMIN_EMAIL` | Ya | Email Author |
| `ADMIN_PASSWORD` | Ya | Sandi Author yang panjang dan unik, Secret |
| `ADMIN_EMAILS` | Tidak | Email admin tambahan, dipisah koma |
| `GEMINI_API_KEY` | Tidak | Fitur AI Concierge |
| `APP_URL` | Tidak | URL publik situs |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Tidak | Notifikasi realtime di dashboard (nilai publik; **bukan** service_role) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Tidak | Push ke HP Author. Buat dengan `node scripts/generate-vapid-keys.mjs` |
| `DATABASE_SSL_CA` | Tidak | PEM sertifikat Supabase agar koneksi diverifikasi penuh |

4. Setelah menambah/mengubah variabel, **Redeploy** agar Function menerima nilainya.

## 3. Setelah deploy: daftar periksa

- `/api/ping` menjawab `database: connected`.
- Login Author, lalu Dashboard: status konfigurasi tersedia di `/api/admin/health` (hanya Author; menampilkan variabel mana yang terisi, tanpa nilainya).
- Ubah satu harga di Dashboard, buka dari HP lain, coba buat pesanan.
- Tandai pesanan terkirim, tulis ulasan dari halaman Lacak Pesanan, setujui di Dashboard > Pesanan.
- Aktifkan notifikasi push dan kirim tes (HTTPS wajib; iPhone: tambahkan ke Layar Utama).

## 4. Pengembangan lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev            # http://localhost:3000
npm test               # tes otomatis
npm run lint && npm run build
```

## 5. Batasan di Vercel

- Sistem berkas Function bersifat baca-saja dan sementara; jangan menyimpan data di file.
- Pembatas laju disimpan di tabel `rate_limits` (terpusat lintas instance); bila database gagal, dipakai cadangan di memori per-instance.
- Verifikasi pembayaran otomatis belum aktif; Author memeriksa pembayaran secara manual. Login Google nonaktif sampai validasi token server tersedia.

## 6. Rollback

Kembalikan deployment ke versi sebelumnya di Vercel. Jangan menghapus tabel Supabase; semua migrasi bersifat aditif.
