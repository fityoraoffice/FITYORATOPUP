import React, { useEffect, useState } from 'react';

interface Props {
  orderId: string;
  defaultName?: string;
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

/** Form ulasan di halaman lacak pesanan; hanya muncul untuk pesanan yang sudah terkirim. */
export const ReviewForm: React.FC<Props> = ({ orderId, defaultName = '', showToast }) => {
  const [state, setState] = useState<'checking' | 'open' | 'done'>('checking');
  const [rating, setRating] = useState<number>(5);
  const [name, setName] = useState<string>(defaultName);
  const [comment, setComment] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setState(j?.reviewed ? 'done' : 'open');
      })
      .catch(() => {
        if (!cancelled) setState('open');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (state === 'checking') return null;
  if (state === 'done') {
    return (
      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
        ✓ Terima kasih, ulasan untuk pesanan ini sudah kami terima.
      </div>
    );
  }

  const submit = async () => {
    if (comment.trim().length < 5) {
      showToast('Tulis ulasan minimal 5 karakter.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, name: name.trim(), comment: comment.trim() })
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        showToast(json?.message || 'Ulasan terkirim. Terima kasih!', 'success');
        setState('done');
      } else {
        showToast(json?.error || 'Ulasan belum terkirim.', res.status === 409 ? 'info' : 'error');
        if (res.status === 409 && /sudah pernah/i.test(json?.error || '')) setState('done');
      }
    } catch {
      showToast('Server tidak dapat dihubungi. Coba lagi.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/25 space-y-2.5">
      <div className="text-[11px] font-extrabold text-white">Pesanan Anda sudah terkirim. Bagaimana pengalamannya?</div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Beri bintang">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} bintang`}
            onClick={() => setRating(n)}
            className={`text-2xl leading-none cursor-pointer transition-transform active:scale-90 ${n <= rating ? 'text-amber-400' : 'text-slate-600'}`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        type="text"
        value={name}
        maxLength={30}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama tampilan (boleh inisial)"
        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
      />
      <textarea
        value={comment}
        maxLength={400}
        rows={3}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Ceritakan kecepatan proses dan pelayanan kami…"
        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
      />
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-extrabold disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Mengirim…' : 'Kirim Ulasan'}
      </button>
      <p className="text-[10px] text-slate-500">Ulasan tampil di toko setelah diperiksa Author.</p>
    </div>
  );
};
