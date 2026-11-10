# Panduan Setup CahyoStore — QRIS GoPay Merchant

## Kondisi integrasi

- Merchant: CahyoStore
- Metode saat ini: QRIS statis GoPay Merchant
- NMID: `ID1026469444966`
- API/webhook pembayaran: belum tersedia/terkonfigurasi untuk akun yang dipakai
- API supplier: belum tersedia/terkonfigurasi; pengiriman produk masih manual

**Jangan membuat pembayaran tampak otomatis bila server tidak menerima konfirmasi resmi.** NMID dan gambar QR saja tidak memberitahu website bahwa uang sudah masuk. Endpoint auto-verify memang dinonaktifkan sampai ada integrasi nyata.

## Alur kerja sekarang

1. Pelanggan memilih produk, memasukkan Player ID/server, dan membuat invoice. Tunggu sampai website memastikan pesanan berhasil disimpan di server sebelum pelanggan membayar.
2. Tampilkan QRIS GoPay Merchant. Periksa nama merchant dan NMID `ID1026469444966` di aplikasi pembayaran. Karena ini QRIS statis, pelanggan mungkin perlu memasukkan jumlah sesuai invoice.
3. Pelanggan menyelesaikan pembayaran.
4. Admin memeriksa transaksi masuk pada aplikasi GoPay Merchant secara langsung. Cocokkan nominal dan waktu transaksi dengan invoice/ID order. Bukti screenshot bukan bukti final.
5. Admin login ke dashboard CahyoStore, buka antrean pesanan, lalu klik konfirmasi pembayaran hanya untuk order yang benar-benar terbayar.
6. Kirim produk/diamond manual sesuai ID tujuan dan SKU. Setelah benar-benar terkirim, tandai terkirim/selesai di dashboard.
7. Bila pembayaran tidak ditemukan, jangan mengonfirmasi order. Jika ada kelebihan/kekurangan pembayaran, tangani manual terlebih dahulu dan catat di luar status otomatis; jangan mengirim produk sampai rekonsiliasi selesai.

## Konfigurasi server

Website ini memakai frontend Vite/React dan backend Express sebagai Vercel Function. **Deploy ke Vercel dengan Supabase PostgreSQL**; jangan deploy sebagai situs statis/EdgeOne saja karena login/order memerlukan backend. Gunakan Node.js **24.x** di Vercel.

### 1. Isi environment variables

Salin `.env.example` menjadi `.env` untuk pengembangan lokal (jangan commit `.env`). Di hosting, masukkan variabel melalui halaman Environment Variables/Secrets:

- `DATABASE_URL`: connection string Supabase Transaction Pooler (port 6543), wajib dan hanya sebagai Secret server-side.
- `ADMIN_EMAIL`: gunakan `fityorastoreoffice@gmail.com` (sesuai allowlist pada tampilan login).
- `ADMIN_PASSWORD`: kata sandi baru yang kuat dan unik. Wajib diisi; jika kosong, login admin sengaja tidak aktif.
- `APP_URL`: alamat publik website.
- `GEMINI_API_KEY`: opsional jika fitur AI dipakai; simpan hanya di server, jangan beri prefix `VITE_`.
- `PORT`: biasanya disediakan oleh hosting; backend menggunakannya otomatis.

Jangan kirim password, OTP, token, atau API secret ke chat, GitHub, atau kode frontend. Gunakan password admin yang berbeda dari password lain.

### 2. Build dan jalankan

Di folder root proyek, menggunakan Node.js 24.x:

```bash
npm install
npm run build
npm start
```

Pada Vercel, `server.ts` diekspor sebagai Express Function. Vercel menyajikan aset dari `public/`, sedangkan semua order, member, dan sesi disimpan di Supabase PostgreSQL. File JSON lokal tidak digunakan sebagai sumber data production. Jalankan migrasi tambahan `supabase/migrations/20261107_backend_storage.sql` satu kali sebelum deployment.

### 3. Login admin dan antrean

Login admin memakai kredensial dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD`. Sesi admin disimpan di tabel `auth_sessions` dan berlaku maksimal 30 hari. Bila login memberi pesan bahwa admin belum diaktifkan, periksa konfigurasi `ADMIN_PASSWORD` lalu restart layanan.

Aksi penting membutuhkan sesi admin: melihat antrean, mengelola member, mengonfirmasi pembayaran, menandai pesanan terkirim, dan mengekspor website. Data dashboard diambil dari server, bukan localStorage.

## Otomatisasi penuh di masa depan

Untuk menghapus kebutuhan pemeriksaan manual, hubungi dukungan GoPay Merchant dan tanyakan akses integrasi e-commerce yang secara eksplisit mendukung:

1. Pembuatan QRIS dinamis per invoice;
2. webhook/notifikasi server-to-server untuk status pembayaran;
3. verifikasi signature/otentisitas notifikasi dan pemeriksaan nominal/currency/order ID;
4. endpoint status transaksi untuk rekonsiliasi jika webhook gagal.

Setelah itu, pilih supplier produk digital yang menyediakan API resmi dan dokumen status order (pending/success/failed), referensi order unik, callback/status query, serta mekanisme pencegah order ganda. Simpan kredensial supplier di environment server.

Implementasi final harus memverifikasi signature webhook, memeriksa invoice/nominal dan status final dengan penyedia, idempotency untuk notifikasi ganda, retry aman, penanganan refund, dan audit log. Jangan mengirim diamond saat status hanya `pending` atau hanya berdasarkan redirect browser.

## Batas pengujian paket ini

Pemeriksaan sintaks 31 file TS/TSX menghasilkan nol error sintaks. Namun instalasi dependency mengalami timeout pada lingkungan audit, sehingga `npm run build`, lint/type-check penuh, tes pada akun merchant, dan uji transaksi ujung-ke-ujung **belum terverifikasi**. Jalankan build pada Node.js 24.x dan tes semua alur pada Preview Deployment sebelum menggantikan website live.
