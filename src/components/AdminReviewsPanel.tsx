import React, { useCallback, useEffect, useState } from 'react';
import { adminHeaders } from '../utils/adminAuth';

interface AdminReview {
  id: number;
  orderId: string;
  product: string;
  rating: number;
  comment: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface Props {
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

const STATUS_STYLE: Record<AdminReview['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
};

/** Moderasi ulasan: ulasan baru berstatus "menunggu" sampai Author menyetujuinya. */
export const AdminReviewsPanel: React.FC<Props> = ({ showToast }) => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reviews', { headers: adminHeaders(), credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const json = await res.json();
      setReviews(Array.isArray(json.reviews) ? json.reviews : []);
    } catch {
      showToast('Ulasan tidak dapat dimuat.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, action: 'approve' | 'reject' | 'delete') => {
    if (action === 'delete' && !window.confirm('Hapus ulasan ini secara permanen?')) return;
    try {
      const res = await fetch(`/api/admin/reviews/${id}/${action}`, {
        method: 'POST',
        headers: adminHeaders(),
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('bad status');
      showToast(action === 'approve' ? 'Ulasan ditampilkan di toko.' : action === 'reject' ? 'Ulasan disembunyikan.' : 'Ulasan dihapus.', 'success');
      await load();
    } catch {
      showToast('Aksi ulasan gagal. Pastikan sesi Author masih aktif.', 'error');
    }
  };

  const pending = reviews.filter((r) => r.status === 'pending').length;

  return (
    <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <h4 className="text-sm font-extrabold text-white">Ulasan Pelanggan</h4>
          <p className="text-[11px] text-slate-400">
            Hanya dari pesanan yang sudah terkirim. Ulasan tampil di toko setelah Anda setujui.
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
          {pending} menunggu
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Memuat ulasan…</p>
      ) : reviews.length === 0 ? (
        <p className="text-xs text-slate-400">Belum ada ulasan masuk.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-amber-400 tracking-wider">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  <span className="font-bold text-white truncate">{r.displayName}</span>
                  <span className="text-slate-400 truncate">• {r.product}</span>
                  <span className="font-mono text-slate-500">#{r.orderId}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md border font-bold ${STATUS_STYLE[r.status]}`}>
                  {r.status === 'pending' ? 'Menunggu' : r.status === 'approved' ? 'Tampil' : 'Disembunyikan'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed break-words">&ldquo;{r.comment}&rdquo;</p>
              <div className="flex flex-wrap gap-2">
                {r.status !== 'approved' && (
                  <button type="button" onClick={() => act(r.id, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-extrabold cursor-pointer">
                    Tampilkan
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button type="button" onClick={() => act(r.id, 'reject')} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 text-[11px] font-bold cursor-pointer">
                    Sembunyikan
                  </button>
                )}
                <button type="button" onClick={() => act(r.id, 'delete')} className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold cursor-pointer">
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
