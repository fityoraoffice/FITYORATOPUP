/**
 * Project Manifest Utility untuk FITYORA STORE (Vercel + Supabase)
 */

export interface WebsiteFileManifestItem {
  path: string;
  desc: string;
}

export const WEBSITE_FILES_MANIFEST: WebsiteFileManifestItem[] = [
  { path: 'package.json', desc: 'Konfigurasi dependensi dan skrip proyek' },
  { path: 'server.ts', desc: 'Backend Express API, database performa tinggi, & proteksi sesi' },
  { path: 'vite.config.ts', desc: 'Konfigurasi Vite build & Tailwind CSS' },
  { path: 'tsconfig.json', desc: 'Konfigurasi compiler TypeScript' },
  { path: 'index.html', desc: 'Entry point HTML & metadata SEO' },
  { path: 'src/main.tsx', desc: 'Inisialisasi React DOM' },
  { path: 'src/App.tsx', desc: 'Komponen utama aplikasi CahyoStore' },
  { path: 'src/index.css', desc: 'Style Tailwind CSS & tema neon' },
  { path: 'src/data/catalog.ts', desc: 'Katalog resmi game, pulsa, e-wallet, voucher, & FAQ' },
  { path: 'src/data/qrisMerchant.ts', desc: 'Payload & generator QRIS resmi GoPay Merchant' },
  { path: 'src/components/AuthModal.tsx', desc: 'Modul autentikasi member & manajemen akun' },
  { path: 'src/components/AdminDashboardModal.tsx', desc: 'Dashboard admin kontrol panel resmi Author' },
  { path: 'src/components/AdminAnalyticsDashboard.tsx', desc: 'Visualisasi grafik analitik & pendapatan' },
  { path: 'src/components/AiSmartConcierge.tsx', desc: 'Asisten cerdas kalkulator budget & rekomendasi AI' },
  { path: 'src/components/CartDrawer.tsx', desc: 'Keranjang belanja multi-item digital' },
  { path: 'src/components/OrderSuccessModal.tsx', desc: 'Struk transaksi, resi digital, & invoice' },
  { path: 'src/components/RecentOrders.tsx', desc: 'Pelacak transaksi & riwayat pesanan pelanggan' },
  { path: 'src/components/VirtualizedProductGrid.tsx', desc: 'Grid katalog teroptimasi virtualisasi performa' },
  { path: 'src/components/FxThemeAndMusic.tsx', desc: 'Pengaturan tema warna, musik, & efek audio' },
  { path: 'src/components/PaymentMethodLogo.tsx', desc: 'Logo resmi QRIS, E-Wallet, & Bank transfer' },
  { path: 'src/components/QrisScannerModal.tsx', desc: 'Modal pemindai QRIS dan upload gambar' },
  { path: 'src/utils/imageResolver.ts', desc: 'Resolusi gambar produk & placeholder SVG dinamis' },
  { path: 'src/utils/fityAi.ts', desc: 'Mesin analisis lokal cerdas & kalkulator winrate' },
  { path: 'src/utils/zipExporter.ts', desc: 'Utilitas ekspor kode dan arsip website' },
  { path: 'supabase/schema.sql', desc: 'Referensi schema dasar lama — jangan dijalankan ulang pada project yang sudah dibuat' },
  { path: 'supabase/migrations/20261107_backend_storage.sql', desc: 'Migrasi tambahan untuk sesi dan kolom penyimpanan backend Supabase' },
  { path: 'src/db/index.ts', desc: 'Koneksi PostgreSQL server-only melalui DATABASE_URL' },
  { path: 'src/db/orders.ts', desc: 'Operasi pesanan PostgreSQL' },
  { path: 'src/db/users.ts', desc: 'Operasi member dan sesi PostgreSQL' },
  { path: 'docs/MIGRATION-NOTES-ID.md', desc: 'Catatan aktivasi migrasi Vercel dan Supabase' },
  { path: 'docs/README-SUPABASE-VERCEL.md', desc: 'Panduan lengkap langkah demi langkah deploy Vercel + Supabase SQL' },
  { path: 'vercel.json', desc: 'Konfigurasi build backend Express Function di Vercel' },
  { path: 'src/db/schema.ts', desc: 'Skema Drizzle ORM relasional PostgreSQL Cloud SQL & Supabase' }
];
