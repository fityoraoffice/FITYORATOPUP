# Catatan Migrasi FITYORA STORE

Gunakan Node.js `24.x` (sesuai `package.json` dan `.nvmrc`). Proyek ini khusus Vercel + Supabase.

## Urutan migrasi database

| Berkas | Isi |
|---|---|
| `supabase/schema.sql` | Instalasi baru: seluruh skema final, aman |
| `migrations/20261107_backend_storage.sql` | Kolom member/order, `auth_sessions` |
| `migrations/20261108_performance_indexes.sql` | Indeks performa |
| `migrations/20261110_tahap6_secure_and_tables.sql` | Hapus policy publik lama; tabel `site_settings`, `reviews`, `push_subscriptions`; cabut akses `anon` |

Database lama: jalankan yang belum pernah dijalankan, berurutan. Semuanya aditif dan aman diulang. Server juga membuat tabel Tahap 6 otomatis bila belum ada.

## Perubahan penting

- Katalog & harga kini di server (`custom_products`), dipakai untuk tampilan dan validasi order.
- Tema/animasi/wallpaper/musik disimpan di server (`site_settings`) dan berlaku untuk semua pengunjung.
- Password admin cadangan dihapus; admin memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD`.
- Google login dan pembayaran otomatis nonaktif sampai validasi server tersedia.

Lihat [README-VERCEL-DEPLOY.md](./README-VERCEL-DEPLOY.md) untuk langkah deploy dan variabel lingkungan.
