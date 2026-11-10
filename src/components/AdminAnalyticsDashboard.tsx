import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Activity,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Zap,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { AdminStoredTransaction } from './AdminDashboardModal';
import { Product } from '../data/catalog';

interface AdminAnalyticsDashboardProps {
  transactions: AdminStoredTransaction[];
  products: Product[];
  onSimulateOrder?: () => void;
}

interface TrendPoint {
  label: string;
  revenue: number;
  orders: number;
  verifiedPayments: number;
}

const PIE_COLORS = ['#00F0FF', '#8B5CF6', '#10B981', '#F59E0B', '#F43F5E'];

function parseRupiahValue(raw?: string): number {
  if (!raw) return 0;
  const digits = String(raw).replace(/[^\d]/g, '');
  return Number(digits) || 0;
}

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  transactions,
  products,
  onSimulateOrder
}) => {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  // Only persisted transactions are shown. No synthetic/random data is added to business metrics.
  const trendData: TrendPoint[] = useMemo(() => {
    const now = Date.now();
    const span = timeframe === '24h' ? 24 * 60 * 60 * 1000 : timeframe === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const eligible = transactions.filter((tx) => {
      if (/batal|cancel|simulasi/i.test(String(tx.status || '')) || /^SIM-/i.test(String(tx.id || ''))) return false;
      const stamp = Date.parse(String(tx.createdAt || ''));
      return Number.isFinite(stamp) && stamp >= now - span && stamp <= now + 60_000;
    });
    const bucketCount = timeframe === '24h' ? 6 : timeframe === '7d' ? 7 : 5;
    const bucketMs = span / bucketCount;
    const output: TrendPoint[] = Array.from({ length: bucketCount }, (_, index) => {
      const start = now - span + index * bucketMs;
      const end = start + bucketMs;
      const bucketTx = eligible.filter((tx) => {
        const stamp = Date.parse(String(tx.createdAt || ''));
        return stamp >= start && (index === bucketCount - 1 ? stamp <= end : stamp < end);
      });
      const paidTx = bucketTx.filter((tx) => tx.paymentStatus === 'verified' || /pembayaran terverifikasi|sudah dibayar/i.test(String(tx.status || '')));
      const date = new Date(end);
      const label = timeframe === '24h'
        ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      return {
        label,
        revenue: paidTx.reduce((sum, tx) => sum + parseRupiahValue(tx.total), 0),
        orders: bucketTx.length,
        verifiedPayments: paidTx.length
      };
    });
    return output;
  }, [transactions, timeframe]);

  // Compute Top Categories & Services BarChart data
  const categoryBarData = useMemo(() => {
    const map: Record<string, { name: string; orders: number; revenue: number }> = {
      mlbb: { name: 'Mobile Legends', orders: 0, revenue: 0 },
      ff: { name: 'Free Fire', orders: 0, revenue: 0 },
      pointblank: { name: 'Point Blank', orders: 0, revenue: 0 },
      streaming: { name: 'Netflix & Streaming', orders: 0, revenue: 0 },
      other: { name: 'Layanan lainnya', orders: 0, revenue: 0 },
      pln: { name: 'Pulsa & PLN', orders: 0, revenue: 0 }
    };

    for (const tx of transactions) {
      if (/batal|cancel|simulasi/i.test(tx.status) || /^SIM-/i.test(String(tx.id || ''))) continue;
      const val = tx.paymentStatus === 'verified' || /pembayaran terverifikasi|sudah dibayar/i.test(String(tx.status || '')) ? parseRupiahValue(tx.total) : 0;
      const pLower = (tx.product || '').toLowerCase();
      if (pLower.includes('mobile legends') || pLower.includes('mlbb')) {
        map.mlbb.orders += 1;
        map.mlbb.revenue += val;
      } else if (pLower.includes('free fire')) {
        map.ff.orders += 1;
        map.ff.revenue += val;
      } else if (pLower.includes('point blank')) {
        map.pointblank.orders += 1;
        map.pointblank.revenue += val;
      } else if (
        pLower.includes('netflix') ||
        pLower.includes('spotify') ||
        pLower.includes('youtube') ||
        pLower.includes('vidio')
      ) {
        map.streaming.orders += 1;
        map.streaming.revenue += val;
      } else if (pLower.includes('pln') || pLower.includes('pulsa')) {
        map.pln.orders += 1;
        map.pln.revenue += val;
      } else {
        map.other.orders += 1;
        map.other.revenue += val;
      }
    }

    return Object.values(map);
  }, [transactions]);

  // Payment mix is based only on persisted, non-simulation orders.
  const paymentPieData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of transactions) {
      if (/batal|cancel|simulasi/i.test(String(tx.status || '')) || /^SIM-/i.test(String(tx.id || ''))) continue;
      const key = String(tx.payment || 'QRIS').toUpperCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const totalChartRevenue = useMemo(
    () => trendData.reduce((acc, d) => acc + d.revenue, 0),
    [trendData]
  );
  const totalChartOrders = useMemo(
    () => trendData.reduce((acc, d) => acc + d.orders, 0),
    [trendData]
  );
  const verifiedPaymentCount = trendData.reduce((acc, point) => acc + point.verifiedPayments, 0);
  const avgOrderValue = verifiedPaymentCount > 0 ? Math.round(totalChartRevenue / verifiedPaymentCount) : 0;

  return (
    <div id="admin-recharts-analytics" className="space-y-4 text-xs">
      {/* Header & Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/35 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-neon-cyan">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-extrabold text-white">
                Analitik Pesanan &amp; Pembayaran
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-extrabold text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>DATA TERSIMPAN</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ringkasan pesanan yang tersimpan di server. Pendapatan hanya menghitung pembayaran yang dikonfirmasi admin ({products.length} layanan aktif).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-white/10">
            {(
              [
                { id: '24h', label: '24 Jam' },
                { id: '7d', label: '7 Hari' },
                { id: '30d', label: '30 Hari' }
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all ${
                  timeframe === tf.id
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <span className="px-3 py-1.5 rounded-xl border border-white/10 bg-slate-800 text-[11px] font-semibold text-slate-300">
            Statistik dari order tersimpan
          </span>

          {onSimulateOrder && (
            <button
              type="button"
              onClick={onSimulateOrder}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-cyan-500 text-slate-950 font-extrabold text-[11px] cursor-pointer"
            >
              Tes Bunyi Alarm
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Telemetry KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Total Pendapatan Periode
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-extrabold text-emerald-400 tabular-nums">
            Rp {totalChartRevenue.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-emerald-300 font-semibold">
            Hanya pembayaran yang diverifikasi admin
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Volume Transaksi Top-Up
            </span>
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-base font-extrabold text-cyan-400 tabular-nums">
            {totalChartOrders.toLocaleString('id-ID')} Order
          </div>
          <div className="text-[10px] text-cyan-300 font-semibold">
            {transactions.length} pesanan tercatat di server
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Rata-Rata Pembayaran Terverifikasi
            </span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-base font-extrabold text-purple-300 tabular-nums">
            Rp {avgOrderValue.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400">Data dari pesanan tersimpan</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Status Integrasi
            </span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-base font-extrabold text-amber-300 tabular-nums">
            Verifikasi Admin
          </div>
          <div className="text-[10px] text-slate-400 font-semibold">
            Belum ada API pembayaran/supplier aktif
          </div>
        </div>
      </div>

      {/* Main Chart 1: Real-Time Revenue & Order Volume AreaChart */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h5 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Grafik Pendapatan Terverifikasi &amp; Volume Pesanan</span>
            </h5>
            <p className="text-[10px] text-slate-400">
              Pendapatan menghitung pesanan yang sudah dikonfirmasi admin; jumlah order berasal dari catatan server.
            </p>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">
            Periode: {timeframe === '24h' ? '24 Jam Terakhir' : timeframe === '7d' ? '7 Hari Terakhir' : '30 Hari Terakhir'}
          </span>
        </div>

        <div className="w-full h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorOrdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.14)" />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#00F0FF"
                fontSize={10}
                tickLine={false}
                tickFormatter={(v: any) => `Rp${Math.round(Number(v) / 1000)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#A855F7"
                fontSize={10}
                tickLine={false}
                tickFormatter={(v: any) => `${v} tx`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: 'rgba(0, 240, 255, 0.35)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#f8fafc'
                }}
                formatter={(value: any, name: any) => {
                  if (name === 'Pendapatan (Rp)') {
                    return [`Rp ${Number(value).toLocaleString('id-ID')}`, name];
                  }
                  return [`${value} Pesanan`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Pendapatan (Rp)"
                stroke="#00F0FF"
                strokeWidth={2.4}
                fillOpacity={1}
                fill="url(#colorRevGrad)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="Volume Order"
                stroke="#A855F7"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#colorOrdGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts Grid: BarChart (Top Layanan) & PieChart (Metode Pembayaran) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BarChart: Order Volume per Game/Service Category */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-white/10 space-y-3">
          <div>
            <h5 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Volume Order per Kategori &amp; Game Terpopuler</span>
            </h5>
            <p className="text-[10px] text-slate-400">
              Perbandingan jumlah transaksi masuk pada layanan utama CahyoStore.
            </p>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="orders"
                  name="Jumlah Order"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PieChart: Payment Method Share */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-white/10 space-y-3">
          <div>
            <h5 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-400" />
              <span>Distribusi Metode Pembayaran Pelanggan</span>
            </h5>
            <p className="text-[10px] text-slate-400">
              Distribusi berdasarkan metode yang tersimpan pada pesanan nyata.
            </p>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {paymentPieData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`${value} Transaksi`, 'Volume']}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
