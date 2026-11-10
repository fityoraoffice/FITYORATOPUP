# Laporan Audit dan Perbaikan CahyoStore

**Status:** Beta hasil hardening kode; belum tersertifikasi bebas bug dan belum siap menerima pembayaran otomatis penuh.

## Ringkasan

Website disesuaikan dengan keadaan operasional saat ini: GoPay Merchant menggunakan QRIS statis pada NMID `ID1026469444966`, belum ada API/webhook pembayaran yang dikonfigurasi, dan pengiriman produk masih dilakukan manual. Sistem sengaja tidak menganggap bukti gambar, timer browser, polling, atau nominal dari browser sebagai bukti uang masuk.

## Temuan dan tindakan

1. **Status pembayaran palsu dari timer** — jalur yang memajukan pesanan hanya karena waktu/polling sudah berlalu dihapus/dinonaktifkan. Endpoint verifikasi otomatis sekarang mengembalikan status tidak tersedia sampai gateway resmi diintegrasikan.
2. **Status pengiriman terlalu dini** — status pembayaran dipisahkan dari status fulfillment. Pesanan tidak dapat ditandai terkirim sebelum pembayaran diverifikasi admin; perubahan kedua status memiliki prasyarat dan jejak audit.
3. **Endpoint admin terbuka** — daftar pesanan, perubahan status, penghapusan/ekspor, dan pengelolaan member memerlukan sesi admin dari server. Login menggunakan `ADMIN_PASSWORD` dari environment dan membatasi percobaan login. Tidak ada PIN default `1234`.
4. **Data lokal bisa dimanipulasi** — antrean admin dan analitik kini mengambil data dari server, bukan menganggap localStorage sebagai sumber transaksi. Pelacakan publik mengembalikan bidang pesanan yang aman dan statusnya.
5. **Manipulasi harga** — endpoint pembuatan pesanan menghitung ulang produk/nominal dari katalog server, memeriksa total, membatasi baris troli dan kuantitas, memvalidasi metode pembayaran, serta mengabaikan status yang dikirim browser.
6. **Privasi akun** — hash kata sandi tidak dikirim ke browser; kata sandi member disimpan dengan scrypt (dan format lama ditingkatkan saat login); endpoint daftar member dilindungi sesi admin. Pendaftaran tidak lagi membocorkan data kontak member lain.
7. **Data/testimoni dan pemindai simulasi** — angka transaksi/testimoni sintetis dihapus dari tampilan bisnis, statistik menggunakan pesanan tersimpan dan pendapatan hanya menghitung pembayaran yang diverifikasi. Pemindai ID yang tidak dapat membuktikan identitas tidak lagi mengarang nama akun. QRIS statis diberi penjelasan bahwa website tidak bisa mengetahui pembayaran hanya dari QR.
8. **Metode pembayaran** — checkout dibatasi ke QRIS GoPay Merchant, karena metode lain belum dikonfigurasi untuk toko ini.
9. **Database runtime** — file JSON disimpan di disk server, ditulis melalui file sementara lalu rename, dengan izin file terbatas. File database tidak disertakan dalam paket publik/export.
10. **Hosting statis** — deploy statis tidak didukung (Netlify sudah dihapus dari proyek), karena server Express/API dan database JSON membutuhkan proses Node.js serta disk persisten.

## Alur operasional yang benar saat ini

1. Pelanggan membuat invoice; server menyimpan order berstatus `Menunggu Pembayaran`.
2. Pelanggan membayar QRIS. Cocokkan nama merchant, NMID, dan jumlah yang benar pada aplikasi pembayaran; QRIS statis dapat meminta pelanggan memasukkan nominal sendiri.
3. Admin membuka aplikasi GoPay Merchant dan memeriksa transaksi masuk, termasuk nominal yang sesuai invoice. Jangan mengonfirmasi hanya dari tangkapan layar pelanggan.
4. Admin login ke dashboard CahyoStore dan menjalankan aksi **Konfirmasi Pembayaran** untuk invoice yang benar.
5. Admin mengirim diamond/produk secara manual, lalu menandai **Terkirim/Selesai** setelah pengiriman benar-benar berhasil.

Tombol admin adalah tindakan manual yang diaudit server, bukan bukti dari provider. Verifikasi harus dilakukan terlebih dahulu di aplikasi GoPay Merchant.

## Verifikasi yang dilakukan

- Pemeriksaan sintaks dilakukan terhadap **22 file TypeScript/TSX** menggunakan TypeScript transpile parser: **0 diagnostic sintaks** pada saat pengecekan.
- File JSON/package, beberapa rute, konfigurasi dan isi arsip diperiksa secara statis.
- `npm install` tidak dapat diselesaikan di lingkungan audit karena kegagalan/timeout pengambilan dependency dari registry. Karena itu **build Vite penuh, pemeriksaan tipe/lint, dan tes transaksi ujung-ke-ujung belum terverifikasi**.
- Payload QRIS dan NMID yang tertanam diperiksa secara tekstual; ini **bukan** bukti settlement dan bukan jaminan QR berhasil dipindai oleh setiap aplikasi pembayaran.

## Batasan yang harus diketahui sebelum produksi

- Pembayaran GoPay Merchant belum terhubung ke API/webhook; verifikasi oleh admin masih diperlukan.
- Tidak ada API supplier produk digital yang dikonfigurasi; pengiriman masih manual.
- Database saat ini berupa JSON lokal untuk satu proses Node.js. Hosting yang menghapus disk ketika restart, beberapa instance, atau serverless tanpa adapter database persisten tidak didukung. Untuk operasi produksi, pindahkan order/member/audit log ke database terkelola seperti PostgreSQL/Supabase dan tambahkan backup.
- Transaksi nyata belum dapat disimulasikan tanpa akun merchant/provider dan akses lingkungan uji.
- Pastikan supplier dan layanan game digunakan sesuai ketentuan resmi masing-masing. Jangan meminta kata sandi akun game pelanggan.

**Kesimpulan:** versi ini menutup beberapa jalur status sukses palsu dan memperkuat validasi/akses pada kode, tetapi tetap merupakan paket beta. Jangan mengklaim transaksi otomatis, anti-bug, atau siap produksi sebelum build berhasil dan seluruh alur diuji di lingkungan staging.
