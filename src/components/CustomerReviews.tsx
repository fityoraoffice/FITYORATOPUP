import React, { useEffect, useState } from 'react';

interface PublicReview {
  id: number;
  product: string;
  rating: number;
  comment: string;
  displayName: string;
  createdAt: string;
}

/** Ulasan asli yang sudah disetujui Author. Tidak ada ulasan contoh. */
export const CustomerReviews: React.FC = () => {
  const [data, setData] = useState<{ reviews: PublicReview[]; count: number; average: number } | null>(null);
  const [showAll, setShowAll] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j) setData({ reviews: j.reviews || [], count: j.count || 0, average: j.average || 0 });
      })
      .catch(() => {
        if (!cancelled) setData({ reviews: [], count: 0, average: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.reviews.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-5 text-center text-sm text-slate-400">
        Belum ada ulasan. Setelah pesanan Anda terkirim, Anda bisa menulis ulasan lewat menu Lacak Pesanan.
      </div>
    );
  }

  const visible = showAll ? data.reviews : data.reviews.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-amber-400 text-lg tracking-wider">★</span>
        <span className="font-extrabold text-white">{data.average.toFixed(1)}</span>
        <span className="text-slate-400">dari {data.count} ulasan pelanggan</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {visible.map((r) => (
          <article key={r.id} className="glass-card rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 border border-white/5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-extrabold text-white shrink-0">
                    {(r.displayName[0] || 'P').toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-white truncate">{r.displayName}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shrink-0 max-w-[45%] truncate">
                  {r.product}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed break-words">&ldquo;{r.comment}&rdquo;</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
              <span className="text-amber-400 tracking-wider">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              <span className="text-emerald-400 font-semibold">✓ Pesanan terkirim</span>
            </div>
          </article>
        ))}
      </div>
      {data.reviews.length > 6 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-bold text-xs cursor-pointer"
          >
            {showAll ? 'Sembunyikan sebagian ulasan' : `Lihat semua (${data.reviews.length} ulasan)`}
          </button>
        </div>
      )}
    </div>
  );
};
