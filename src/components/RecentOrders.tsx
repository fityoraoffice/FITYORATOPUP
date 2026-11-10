import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock,
  Trash2,
  ArrowUpRight,
  CreditCard,
  Cpu,
  ShieldCheck,
  PackageCheck,
  Flame,
  Sparkles,
  Search,
  Zap
} from 'lucide-react';
import { Product } from '../data/catalog';
import { placeholderImage } from '../utils/imageResolver';

export interface RecentActivityItem {
  productId: string;
  actionType: 'viewed' | 'searched' | 'ordered';
  detail?: string;
  timestamp: number;
}

export interface TrackedOrderRecord {
  id: string;
  product: string;
  item: string;
  target: string;
  status: string;
  total: string;
  payment?: string;
  whatsapp?: string;
  createdAt?: string;
}

export type OrderStageKey = 'pending' | 'processing' | 'verification' | 'complete' | 'cancelled';

export interface OrderStageStep {
  key: 'pending' | 'processing' | 'verification' | 'complete';
  label: string;
  idLabel: string;
  desc: string;
  statusValue: string;
  icon: React.FC<{ className?: string }>;
}

export const ORDER_STAGES: OrderStageStep[] = [
  {
    key: 'pending',
    label: 'Menunggu Pembayaran',
    idLabel: 'Payment Pending',
    desc: 'Menunggu pelanggan menyelesaikan pembayaran dan admin memeriksa transaksi',
    statusValue: 'Menunggu Pembayaran (Payment Pending)',
    icon: CreditCard
  },
  {
    key: 'processing',
    label: 'Pembayaran Terverifikasi',
    idLabel: 'Dikonfirmasi Admin',
    desc: 'Admin mencocokkan nominal dan transaksi di aplikasi merchant',
    statusValue: 'Pembayaran Terverifikasi • Menunggu Pengiriman',
    icon: Cpu
  },
  {
    key: 'verification',
    label: 'Verifikasi Pengiriman',
    idLabel: 'Injeksi Produk Digital',
    desc: 'Pembayaran telah diperiksa; pesanan menunggu pengiriman manual oleh admin',
    statusValue: 'Pembayaran Terverifikasi • Menunggu Pengiriman',
    icon: ShieldCheck
  },
  {
    key: 'complete',
    label: 'Complete • Terkirim',
    idLabel: 'Pembayaran Terverifikasi',
    desc: 'Produk hanya ditandai selesai setelah admin benar-benar mengirimnya',
    statusValue: 'Selesai • Diamond/Produk Sudah Dikirim',
    icon: PackageCheck
  }
];

export const RECENT_ACTIVITY_STORAGE_KEY = 'cahyostore_recent_items_v1';

export function mapStatusToStageIndex(statusText: string): {
  stageIndex: number;
  stageKey: OrderStageKey;
  badgeLabel: string;
  liveStatusText: string;
  isPaymentVerified: boolean;
  progressPercent: number;
} {
  const s = (statusText || '').toLowerCase();
  if (s.includes('batal') || s.includes('cancel') || s.includes('gagal')) {
    return {
      stageIndex: -1,
      stageKey: 'cancelled',
      badgeLabel: 'Cancelled • Dibatalkan',
      liveStatusText: 'Transaksi Dibatalkan',
      isPaymentVerified: false,
      progressPercent: 100
    };
  }
  if (
    s.includes('complete') ||
    s.includes('delivered') ||
    s.includes('selesai') ||
    s.includes('sukses') ||
    s.includes('terkirim') ||
    s.includes('berhasil')
  ) {
    return {
      stageIndex: 3,
      stageKey: 'complete',
      badgeLabel: 'Pembayaran Terverifikasi • Selesai',
      liveStatusText: 'Produk telah dikirim dan ditandai selesai oleh admin',
      isPaymentVerified: true,
      progressPercent: 100
    };
  }
  if (
    s.includes('menunggu pengiriman') ||
    s.includes('antrean pengiriman') ||
    s.includes('verifikasi pengiriman') ||
    s.includes('verifikasi akun') ||
    s.includes('verification') ||
    s.includes('validasi')
  ) {
    return {
      stageIndex: 2,
      stageKey: 'verification',
      badgeLabel: 'Pembayaran Terverifikasi • Mengirim',
      liveStatusText: 'Pembayaran terverifikasi; pengiriman sedang diproses admin',
      isPaymentVerified: true,
      progressPercent: 75
    };
  }
  if (
    s.includes('pembayaran terverifikasi') ||
    s.includes('terverifikasi') ||
    s.includes('payment verified') ||
    s.includes('processing') ||
    s.includes('sedang diproses') ||
    s.includes('diproses admin') ||
    s.includes('diproses server')
  ) {
    return {
      stageIndex: 1,
      stageKey: 'processing',
      badgeLabel: 'Pembayaran Terverifikasi • Diproses',
      liveStatusText: 'Pembayaran terverifikasi oleh admin',
      isPaymentVerified: true,
      progressPercent: 50
    };
  }
  return {
    stageIndex: 0,
    stageKey: 'pending',
    badgeLabel: 'Menunggu Pembayaran',
    liveStatusText: 'Menunggu pembayaran dan pemeriksaan admin',
    isPaymentVerified: false,
    progressPercent: 25
  };
}

export function loadRecentActivities(): RecentActivityItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 3);
    return [];
  } catch {
    return [];
  }
}

export function saveRecentActivities(items: RecentActivityItem[]) {
  try {
    localStorage.setItem(RECENT_ACTIVITY_STORAGE_KEY, JSON.stringify(items.slice(0, 3)));
  } catch {
    // ignore storage errors
  }
}

interface RecentOrdersProps {
  recentItems: RecentActivityItem[];
  products: Product[];
  onSelectProduct: (productId: string) => void;
  onClearRecent: () => void;
}

export const RecentOrders: React.FC<RecentOrdersProps> = ({
  recentItems,
  products,
  onSelectProduct,
  onClearRecent
}) => {
  const resolvedItems = recentItems
    .map((entry) => {
      const product = products.find((p) => p.id === entry.productId);
      return product ? { ...entry, product } : null;
    })
    .filter((x): x is RecentActivityItem & { product: Product } => x !== null)
    .slice(0, 3);

  const getActionLabel = (item: RecentActivityItem) => {
    if (item.actionType === 'ordered') return item.detail || 'Terakhir diorder';
    if (item.actionType === 'searched') return 'Hasil pencarian terakhir';
    return item.detail || 'Baru saja dilihat';
  };

  if (resolvedItems.length === 0) {
    const popularTrends = products
      .filter((p) => ['mlbb', 'ff', 'pubg', 'roblox', 'genshin', 'pln'].includes(p.id))
      .slice(0, 6);

    return (
      <section className="space-y-3" id="recent-orders-section">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>🔥 Tren Layanan Populer &amp; Paling Dicari</span>
          </h3>
          <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Top Up Instan 24/7</span>
          </span>
        </div>

        {/* Popular Trending Game Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {popularTrends.map((product) => {
            const minPrice = product.items.length
              ? Math.min(...product.items.map((i) => i.price))
              : 0;

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product.id)}
                className="glass-card rounded-2xl p-2.5 cursor-pointer group flex flex-col justify-between hover:border-cyan-500/50 transition-all hover:scale-[1.02]"
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/10 bg-slate-900 shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = placeholderImage(product.id, product.name);
                      }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-extrabold text-white group-hover:text-cyan-400 transition-colors truncate">
                      {product.name}
                    </h4>
                    <p className="text-[9px] text-slate-400 truncate">{product.publisher}</p>
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-cyan-400 font-bold tabular-nums">
                    Mulai Rp {minPrice.toLocaleString('id-ID')}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3" id="recent-orders-section">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Terakhir Dilihat &amp; Dicari</span>
        </h3>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-semibold text-cyan-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Aktivitas Terkini (Real-Time)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {resolvedItems.map(({ product, actionType, detail, timestamp }, index) => {
            const minPrice = product.items.length
              ? Math.min(...product.items.map((i) => i.price))
              : 0;

            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.25,
                  delay: index * 0.05,
                  ease: [0.16, 1, 0.3, 1]
                }}
                onClick={() => onSelectProduct(product.id)}
                className="glass-card rounded-2xl p-3 cursor-pointer group flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-slate-900 shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = placeholderImage(product.id, product.name);
                      }}
                      style={{
                        objectFit: product.imageFit === 'contain' ? 'contain' : 'cover',
                        padding: product.imageFit === 'contain' ? '4px' : '0'
                      }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                      {product.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {getActionLabel({ productId: product.id, actionType, detail, timestamp })}
                    </p>
                    <p className="text-[10px] font-semibold text-cyan-400 mt-0.5">
                      Mulai Rp {minPrice.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/40 transition-all shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
};
