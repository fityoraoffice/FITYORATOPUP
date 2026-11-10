# PEMBARUAN FITYORA STORE

Semua catatan fitur baru, perbaikan bug, dan perubahan proyek disimpan di sini.

---

## 10 November 2026 (Tahap 10: Domain Sementara & Penutupan Celah)

- **Domain tidak lagi tertanam di kode.** `index.html`, `robots.txt`, dan `sitemap.xml` sebelumnya menulis `fityoratopup.vercel.app` secara permanen (tebakan, bisa salah). Kini `vite.config.ts` mengisinya saat build dari `APP_URL`, atau domain Vercel otomatis (`VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`). Bila tidak ada, tag canonical/og:url/og:image dihilangkan, bukan diisi alamat salah. Pindah ke domain sendiri nanti: isi `APP_URL`, deploy ulang.
- **Celah checkout keranjang ditutup.** Item hanya bisa masuk troli bila ID tidak invalid dan, untuk status kuning, pembeli sudah mencentang konfirmasi. Checkout satu produk sudah begini sejak Tahap 9.
- Ekspor ZIP di server dicek: penulisan file memang ditangkap `try/catch` sehingga tidak merusak Vercel (read-only), hanya mencatat peringatan.

---

## 10 November 2026 (Tahap 9: Verifikasi ID Jujur, Cegah Salah Transfer)

Temuan: sebagian besar "verifikasi real-time" sebelumnya palsu. Nama akun game dikarang dari hash ID dan dilabeli "Official Gateway / TERVERIFIKASI"; nomor HP/e-wallet dilabeli "HLR / KYC Premium / jaringan aktif" padahal hanya cek format; golongan tarif PLN dikarang dari digit terakhir; username Roblox yang tidak ada dinyatakan valid; dan bila jaringan error, browser menampilkan hijau "Target Terverifikasi". Pembeli tidak bisa menangkap salah ketik karena nama yang tampil bukan nama sebenarnya.

Perbaikan (`src/utils/targetVerification.ts`, dipakai `/api/verify-target`):
- Tiga tingkat hasil: **confirmed** (hijau, nama benar-benar dari penyedia: Roblox resmi / lookup nickname game), **format_only** (kuning, format benar tetapi pemilik akun tidak bisa dikonfirmasi), **invalid** (merah).
- Tidak ada lagi nama, operator aktif, tarif, atau klaim "resmi" yang dikarang. Yang ditampilkan untuk format_only adalah ID/nomor persis seperti diketik pembeli agar mudah diperiksa ulang.
- Roblox: username tidak ditemukan sekarang ditolak.
- Bila status kuning, pembeli **wajib mencentang** "Saya sudah memeriksa ID/nomor sudah benar" sebelum bisa lanjut (centang reset saat ID berubah). Jaringan error di browser = kuning, bukan hijau.
- 10 tes baru (total 30), termasuk tes bahwa hasil tidak pernah memuat kata/klaim karangan.

Batasan yang perlu diketahui:
- Lookup nickname game memakai API pihak ketiga tidak resmi (`api.isan.eu.org`); ketersediaannya tidak dijamin. Untuk konfirmasi andal di semua game, gunakan penyedia berlangganan resmi lalu ganti isi `verifyTarget`.
- Pulsa, e-wallet, dan PLN memang tidak bisa dikonfirmasi pemiliknya tanpa penyedia berbayar; kini jujur ditampilkan sebagai "belum terkonfirmasi".
- Checkout keranjang (banyak voucher) belum memakai centang konfirmasi per baris.

---

## 10 November 2026 (Tahap 8: Ketahanan Serverless)

- **Login Author:** batas percobaan kini dicek SEBELUM sandi dicocokkan (sebelumnya sesudah, sehingga tebakan sandi tidak benar-benar terhenti). Batas 10 percobaan / 10 menit per IP.
- **Pembatas laju terpusat di Postgres** (`rate_limits`): berlaku lintas semua instance Vercel (sebelumnya per-instance di memori, mudah dilewati). Cadangan memori bila database gagal. Dipakai untuk login, order, registrasi, ulasan, verifikasi target, dan AI.
- `robots.txt` (blokir `/api/`) dan `sitemap.xml`. Ubah domain di kedua berkas bila memakai domain khusus.
- 3 tes baru (total 20). Jalankan migrasi `20261110` lagi (sudah mencakup `rate_limits`; aman diulang).

---

## 09 November 2026 (Tahap 7: Khusus Vercel + Supabase)

- **Keamanan Supabase:** `schema.sql` versi awal punya policy RLS publik pada `orders` (data pembeli bisa dibaca siapa pun yang memegang anon key). Skema final kini RLS tanpa policy + akses `anon/authenticated` dicabut. Database lama wajib menjalankan `migrations/20261110_tahap6_secure_and_tables.sql`.
- `schema.sql` kini skema final lengkap (kolom member/order, `auth_sessions`, `site_settings`, `reviews`, `push_subscriptions`, indeks). Migrasi `20261109_site_settings.sql` digantikan oleh `20261110`.
- `vercel.json`: region fungsi `sin1` (samakan dengan region Supabase), skema JSON, header SW. `.vercelignore` mengecualikan tes & dokumen dari bundel.
- `GET /api/admin/health`: status variabel lingkungan (tanpa nilai) dan koneksi database, hanya untuk Author.
- Sisa AI Studio dihapus (`metadata.json`, komentar/opsi HMR di `vite.config.ts`, User-Agent). Metadata versi & instruksi paket ZIP diperbarui.
- Dokumentasi deploy disatukan di `docs/README-VERCEL-DEPLOY.md` (tabel env, urutan migrasi, daftar periksa).

---

## 09 November 2026 (Tahap 6: Katalog di Server, Kecepatan, Ulasan, Push, Tes)

### 1. Katalog & harga tersimpan di server (perbaikan penting)
- Masalah: harga hasil edit Author hanya ada di browser Author, sedangkan server menagih berdasarkan katalog bawaan. Pembeli tidak melihat harga Author, dan order dengan harga kustom ditolak ("nominal tidak cocok").
- Kini katalog disimpan di tabel `custom_products` (dibuat otomatis) dan dipakai untuk tampilan pembeli DAN validasi order. Endpoint: `GET /api/catalog`, `PUT /api/admin/catalog`.
- Katalog lama di browser Author dikirim ke server otomatis satu kali saat Author membuka situs dalam keadaan login.
- Default katalog tanpa edit = harga bawaan (sebelumnya klien memulai dari Rp 0). Item berharga 0 ditolak server ("harga belum ditetapkan").
- Gagal menyimpan = notifikasi merah untuk Author; perubahan lokal tidak tertimpa diam-diam.

### 2. Kecepatan awal
- AI Concierge, modal struk, dan modal QRIS dimuat lazy (baru diunduh saat browser santai / saat dibutuhkan). Pembuat HTML struk dipindah ke `src/utils/receiptHtml.ts`.
- Font Google tidak lagi memblokir tampilan awal.
- Belum diukur (build tidak bisa dijalankan di lingkungan penyusunan). Ukur dengan Lighthouse sebelum/sesudah. `App.tsx` masih besar; pemecahan lanjutan sebaiknya bertahap dengan build nyata.

### 3. Kepercayaan pembeli
- Timeline pesanan kini menampilkan jam tiap tahap yang sudah dilalui.
- Tombol "Hubungi Author via WhatsApp" dengan ID pesanan terisi otomatis.
- Ulasan asli: hanya dari pesanan berstatus terkirim, satu per pesanan, tampil setelah disetujui Author (Dashboard > Pesanan > Ulasan Pelanggan). Tidak ada ulasan contoh. Endpoint: `GET /api/reviews`, `POST /api/orders/:id/review`, moderasi `/api/admin/reviews/...`.

### 4. Notifikasi push ke HP Author
- Web Push VAPID tanpa dependensi baru. Pesan push tidak berisi data pesanan/pembeli.
- Aktifkan: `node scripts/generate-vapid-keys.mjs` -> isi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` di Vercel -> deploy ulang -> Dashboard > Pesanan > "Aktifkan di Perangkat Ini" (butuh HTTPS; iPhone: tambahkan ke Layar Utama dulu).
- Pemicu: saat pesanan baru tercatat di server (bukan saat pembayaran terverifikasi, karena verifikasi dilakukan manual oleh Author).

### 5. Tes otomatis
- `npm test` (17 tes, `node:test` via tsx): aturan harga & total order, kode unik, validasi katalog (harga negatif/pecahan, id ganda, gambar `javascript:`), tanda tangan VAPID, daftar endpoint push yang diizinkan, perilaku kirim push.
- Logika murni diekstrak ke `src/utils/orderPricing.ts` dan `src/utils/catalogSanitize.ts`; server memakai fungsi yang sama.

### Perlu dicek setelah deploy
`npm install && npm test && npm run lint && npm run build`, lalu: ubah harga di Dashboard > buka situs dari HP lain > cek harga & coba order; tandai pesanan terkirim > tulis ulasan > setujui; aktifkan push > kirim tes.

---

## 09 November 2026 (Tahap 5: Tema Menyatu, Musik untuk Pembeli, Ikon Online)

### Tampilan
- Mode siang & malam: grid garis 48px di latar dihapus (penyebab tampilan "kotak-kotak"). Latar kini gradien lembut + cahaya warna preset, menyatu dari atas ke bawah.
- Mode siang: panel/kartu/header/dock memakai kaca buram lembut (transparan, blur, tepi tipis, bayangan halus), bukan blok putih solid berborder tebal. Panel di dalam panel diberi lapisan sedikit lebih redup agar tetap terbaca.
- Partikel animasi di mode siang digelapkan otomatis agar terlihat; perpindahan siang/malam memakai transisi halus.

### Musik & tema untuk semua pengunjung
- Sebelumnya musik/tema hanya tersimpan di browser Author (localStorage), makanya pembeli tidak mendengar apa pun. Kini tema, animasi, wallpaper, dan musik disimpan di server (tabel `site_settings`, dibuat otomatis) dan dibaca semua pengunjung (sinkron tiap 45 detik / saat tab dibuka kembali).
- Endpoint baru: `GET /api/site-settings` (publik, tanpa data pribadi) dan `PUT /api/admin/site-settings` (hanya sesi Author).
- Browser memblokir suara otomatis, jadi musik pembeli mulai pada sentuhan/klik pertama di halaman.
- Pembeli tidak punya ikon/tombol musik; hanya Author yang mengatur lewat Dashboard > Tema. Mode siang/malam tetap pilihan pribadi tiap pengunjung.
- Bila penyimpanan ke server gagal, Author mendapat notifikasi (perubahan lokal tidak diam-diam tertimpa).

### Ikon & penyimpanan
- Folder `public/icons`, `public/images/{pln,ewallet,pulsa}-official.png`, dan `src/assets` dihapus (±1,4 MB; `pointblank.jpg` saja 868 KB). Ikon produk dimuat dari platform online; bila gagal, dibuat ilustrasi SVG dari kode.
- Pointblank, Valorant, dan PSN memakai ilustrasi SVG tertanam (tanpa file). Untuk logo resmi Pointblank, tempel URL gambar online di editor katalog Author.
- `public/images/qris-official.png` sengaja dipertahankan sebagai cadangan QRIS bila gambar online gagal dimuat.

### Catatan
- Belum diuji build di lingkungan ini (dependensi tidak terpasang). Jalankan `npm install && npm run lint && npm run build`, lalu cek tampilan siang/malam dan buka situs dari perangkat lain untuk menguji musik.

---

## 08 November 2026 (Tahap 4: Pengetatan Keamanan)

### Keamanan
- Endpoint `/api/ai/recommend`, `/api/ai/chat`, dan `/api/verify-target` kini dibatasi per IP (20/40/60 permintaan per 10 menit) agar kuota Gemini tidak bisa dihabiskan orang lain; pesan chat dibatasi 2000 karakter.
- Sesi kedaluwarsa di tabel `auth_sessions` dibersihkan otomatis saat login member.
- Opsional `DATABASE_SSL_CA`: bila diisi dengan sertifikat SSL Supabase, server memverifikasi sertifikat database (tanpa itu perilaku lama dipertahankan agar koneksi tidak putus).

### Catatan
- Belum diuji build/typecheck; jalankan `npm install && npm run lint && npm run build` sebelum deploy.

---

## 08 November 2026 (Tahap 3: Tampilan dan Animasi)

### Tampilan
- Kartu produk muncul bertahap (stagger, 12 kartu pertama) saat daftar dimuat atau difilter; gambar produk zoom halus saat kartu di-hover (hanya perangkat dengan kursor).
- Judul utama beranda memakai efek teks gradien dengan kilau bergerak.
- Tombol kategori memberi umpan balik sentuhan saat ditekan; warna seleksi teks bernuansa merek.
- Dashboard admin: baris order baru masuk dengan animasi pop lalu berdenyut hijau beberapa kali.

### Perbaikan
- Kelas `.fy-fade-in` memakai `animation-fill-mode: backwards` agar efek hover/tekan kartu tidak tertimpa transform akhir animasi.

### Catatan
- Semua animasi hanya memakai transform dan opacity serta tetap menghormati pengaturan "kurangi gerakan". Belum dilihat langsung di browser dan belum diuji build; jalankan `npm install && npm run lint && npm run build`, lalu cek tampilan di ponsel dan desktop sebelum deploy.

---

## 08 November 2026 (Tahap 2: Notifikasi Order Realtime)

### Fitur
- Dashboard admin kini memantau pesanan lewat endpoint ringan `/api/admin/orders/pulse` (jumlah + waktu update terakhir). Daftar lengkap hanya diunduh ketika ada perubahan, bukan setiap 6 detik.
- Polling berhenti saat tab tersembunyi dan langsung menyegarkan ketika tab dibuka kembali.
- Opsional: Supabase Realtime Broadcast. Saat `SUPABASE_URL` dan `SUPABASE_ANON_KEY` diatur di Vercel, order baru atau perubahan status memicu ping instan ke dashboard admin; polling turun menjadi 30 detik sebagai cadangan. Tanpa variabel itu, dashboard tetap bekerja dengan polling.

### Keamanan
- Ping realtime tidak berisi data pesanan atau member, hanya penanda waktu. Tabel tetap tertutup untuk role anon (RLS tidak diubah); anon key hanya dipakai untuk kanal broadcast.
- Endpoint `/api/admin/realtime-config` hanya untuk sesi admin dan hanya mengembalikan nilai publik. `DATABASE_URL` tidak pernah dikirim ke browser.

### Catatan
- Belum diuji build/typecheck. Jalankan `npm install && npm run lint && npm run build` sebelum deploy, dan jalankan ulang file migrasi indeks (`20261108_performance_indexes.sql`) bila belum.

---

## 08 November 2026 (Tahap 1: Performa Backend)

### Performa
- Setiap request ke `/api/admin`, `/api/orders`, `/api/users`, `/api/export` tidak lagi memuat seluruh tabel `users` dan `orders`; middleware hanya memvalidasi sesi (kueri berindeks) dan memuat satu baris member bila login.
- Pelacakan pesanan publik, pembuatan invoice, dan aksi admin (konfirmasi bayar, tandai terkirim, ubah status, hapus) kini membaca satu pesanan berdasarkan ID, bukan seluruh daftar.
- Perubahan status hanya menyimpan satu pesanan yang berubah (sebelumnya semua pesanan di-upsert ulang setiap kali). Perubahan data member admin juga hanya memperbarui satu baris.
- Daftar pesanan admin dibatasi 2.000 terbaru; riwayat pesanan member diambil lewat kueri terfilter (maks. 200).
- Statistik database admin memakai `count(*)`, bukan memuat semua data.
- Migrasi indeks baru: `supabase/migrations/20261108_performance_indexes.sql` (jalankan satu kali di Supabase SQL Editor).

### Catatan
- Perubahan ini belum diuji build/typecheck karena `npm install` tidak bisa dijalankan di lingkungan penyusunan. Jalankan `npm install && npm run lint && npm run build` sebelum deploy.
- Berikutnya: notifikasi pesanan realtime di dashboard admin, lalu penyempurnaan UI dan animasi.

---

## 08 November 2026 (Full Upgrade)

### Keamanan
- Token admin tidak lagi diterima lewat URL (`?token=`); hanya cookie HttpOnly atau header Authorization. Unduhan ZIP admin disesuaikan.
- Header keamanan juga dipasang di `vercel.json` sehingga aset statis di CDN ikut terlindungi.

### Performa
- Dashboard admin (komponen terbesar) dimuat secara lazy, jadi tidak memperlambat render halaman utama.
- Aset hasil build Vite (`/_app/assets`) diberi cache immutable 1 tahun; ikon 30 hari.
- Polling pesanan baru admin dilonggarkan dari 3,2 detik menjadi 6 detik untuk mengurangi beban database.

### Tampilan
- Efek premium: hover angkat + glow neon pada kartu produk, tombol kategori halus, fokus keyboard jelas, kelas utilitas `.gradient-text-shine` dan `.fy-fade-in`.
- Dukungan `prefers-reduced-motion` untuk pengguna yang mengurangi animasi.
- Branding disatukan menjadi FITYORA STORE (judul, meta, manifest PWA).

### Khusus Vercel + Supabase
- Seluruh jejak Netlify dihapus: endpoint `/api/netlify/deploy`, pembuat ZIP Netlify, state dan handler deploy di dashboard admin, serta `netlify.toml` dan `_redirects`.
- Firebase dihapus total: paket `firebase` dan `firebase-admin`, `firebase-applet-config.json`, `src/lib/firebase.ts`, dan tombol/endpoint login Google (Firebase). Penyimpanan dan sesi tetap sepenuhnya di Supabase PostgreSQL.
- Skema ganda dirapikan: `supabase-schema.sql` (duplikat) dihapus; satu-satunya referensi skema dasar adalah `supabase/schema.sql` ditambah migrasi di `supabase/migrations/`.
- Setelah mengganti `package.json`, jalankan `npm install` sekali agar `package-lock.json` bersih dari sisa paket Firebase.

### Kerapihan
- Memperbaiki canonical/OG URL (sebelumnya masih Netlify) menjadi domain Vercel; menambah OG image dan Twitter card.
- Menghapus skrip penambal WebSocket/console di `index.html` yang menyembunyikan error asli di produksi.
- Menghapus file tidak terpakai: `netlify.toml`, `public/_redirects`, `LiveOrderTicker.tsx`, `src/lib/supabase.ts`, `src/lib/firebase-admin.ts`, `src/middleware/auth.ts`, `README-CAHYOSTORE-RESMI.txt`.
- Memperbaiki README (sisa teks `E0F`), manifest ZIP exporter, dan `.gitignore` (database lokal, ZIP hasil export).

---

## 08 November 2026 (Branding)

### Branding dan tampilan
- Memperbarui logo utama FITYORA STORE.
- Memperbarui favicon dan ikon aplikasi PWA.
- Memperbarui nama serta warna tema aplikasi.

### Dokumentasi
- Merapikan README utama GitHub.
- Memindahkan dokumentasi teknis ke folder docs/.
- Menyiapkan PEMBARUAN.md sebagai catatan perubahan terpusat.

### Dependensi dan pemeriksaan
- Menambahkan Sharp untuk konversi aset gambar.
- Build produksi berhasil dijalankan setelah perubahan branding.

---

## Pembaruan berikutnya

Catat perubahan terbaru di bagian paling atas file ini.
