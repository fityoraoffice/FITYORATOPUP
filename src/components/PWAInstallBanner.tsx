import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISS_KEY = 'fityora_pwa_banner_dismissed_v1';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    try {
      setIsDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setIsDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* session storage may be blocked */ }
  };

  if (isInstalled || isDismissed || (!isInstallable && !isIOS)) return null;

  return (
    <>
      <section
        role="region"
        aria-label="Pasang FityoraStore"
        className="relative z-40 border-b border-emerald-500/30 bg-gradient-to-r from-emerald-950/90 via-slate-950/95 to-cyan-950/90 px-3 py-2.5 text-white shadow-lg backdrop-blur-md sm:px-4"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2.5 sm:flex-row">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5">
              <img
                src="/pwa-192x192.png"
                alt="FityoraStore"
                className="h-full w-full rounded-[10px] object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
              <Smartphone className="absolute h-4 w-4 text-slate-950" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                  Aplikasi Web
                </span>
                <strong className="truncate text-xs text-white sm:text-sm">Pasang FityoraStore di layar utama</strong>
              </div>
              <p className="truncate text-[11px] text-slate-300">Buka toko lebih cepat langsung dari layar utama perangkat.</p>
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            {isInstallable && (
              <button
                type="button"
                onClick={() => { void install(); }}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 transition-opacity hover:opacity-95 sm:flex-none"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pasang Aplikasi</span>
              </button>
            )}
            {isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 transition-opacity hover:opacity-95 sm:flex-none"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cara Pasang</span>
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Tutup pemberitahuan pemasangan"
              title="Tutup"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {showIOSGuide && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="pwa-ios-title">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-emerald-500/40 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 id="pwa-ios-title" className="flex items-center gap-2 text-sm font-extrabold text-cyan-300">
                <Smartphone className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                Pasang di layar utama
              </h2>
              <button type="button" onClick={() => setShowIOSGuide(false)} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Tutup panduan">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">Pada iPhone atau iPad, gunakan menu Bagikan pada browser, lalu pilih opsi untuk menambahkan situs ke layar utama.</p>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
                <div><strong className="text-white">1. Buka menu Bagikan</strong><p className="mt-0.5 text-[11px] text-slate-400">Lokasinya mengikuti browser yang sedang digunakan.</p></div>
              </div>
              <div className="flex items-start gap-2.5">
                <PlusSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <div><strong className="text-white">2. Tambahkan ke Layar Utama</strong><p className="mt-0.5 text-[11px] text-slate-400">Pilih Add to Home Screen atau opsi sejenis, lalu konfirmasi.</p></div>
              </div>
            </div>
            <button type="button" onClick={() => setShowIOSGuide(false)} className="w-full cursor-pointer rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700">Mengerti</button>
          </div>
        </div>
      )}
    </>
  );
};
