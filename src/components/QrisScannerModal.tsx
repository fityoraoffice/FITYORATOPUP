import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QrCode, X, Download, Copy, CheckCircle2, ShieldCheck } from 'lucide-react';
import { CAHYO_QRIS_DATA_URL, CAHYO_QRIS_INFO } from '../data/qrisMerchant';

interface QrisScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount?: number;
  orderId?: string;
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

export const QrisScannerModal: React.FC<QrisScannerModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  orderId,
  showToast
}) => {
  const handleDownloadQris = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = 3;
      const width = (img.naturalWidth || 600) * scale;
      const height = (img.naturalHeight || 850) * scale;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `QRIS-CAHYO-STORE-${orderId || 'OFFICIAL'}-HD.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              showToast(
                'Gambar QRIS statis berhasil diunduh. Pastikan nama merchant dan nominal di aplikasi pembayaran sebelum menyetujui.',
                'success'
              );
            }
          },
          'image/png',
          1.0
        );
      }
    };
    img.onerror = () => {
      const link = document.createElement('a');
      link.href = CAHYO_QRIS_DATA_URL;
      link.download = `QRIS-CAHYO-STORE-${orderId || 'OFFICIAL'}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Gambar QRIS statis berhasil diunduh. Periksa nama merchant dan nominal sebelum membayar.', 'success');
    };
    img.src = CAHYO_QRIS_DATA_URL;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 25 }}
            className="relative z-10 glass-panel max-w-md w-full p-5 sm:p-6 rounded-3xl border border-cyan-500/40 shadow-[0_0_40px_rgba(0,240,255,0.25)] space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    QRIS Statis CahyoStore
                  </h3>

                </div>
                <p className="text-xs text-slate-400">
                  {CAHYO_QRIS_INFO.merchantName}
                </p>
              </div>
            </div>

            {typeof totalAmount === 'number' && totalAmount > 0 && (
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Nominal yang Harus Dibayar
                  </span>
                  <span className="text-base font-extrabold text-cyan-400 tabular-nums">
                    Rp {totalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(String(totalAmount));
                    showToast(`Nominal Rp ${totalAmount.toLocaleString('id-ID')} disalin!`, 'success');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Nominal</span>
                </button>
              </div>
            )}

            {/* QRIS static payload preview; payment receipt is not observable by this page. */}
            <div className="rounded-2xl overflow-hidden border-2 border-cyan-400/50 bg-white shadow-xl relative group">
              <img
                src={CAHYO_QRIS_DATA_URL}
                alt="QRIS CAHYO STORE, PULSA & TAGIHAN"
                className="w-full h-auto block"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/qris-official.png';
                }}
              />
            </div>

            {/* NMID Info & Copy */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">NMID (cocokkan di aplikasi):</span>
                <span className="font-mono font-bold text-white">{CAHYO_QRIS_INFO.nmid}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(CAHYO_QRIS_INFO.nmid);
                  showToast('NMID berhasil disalin!', 'success');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy NMID</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2 text-[11px] text-emerald-200 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                QRIS ini bersifat statis dan halaman tidak mendeteksi uang masuk. Sebelum membayar, pastikan nama merchant dan nominal yang tampil pada aplikasi pembayaran benar. Admin memverifikasi pembayaran lewat riwayat GoPay Merchant.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadQris}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Simpan Gambar QR</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-neon-cyan hover:opacity-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Tutup</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
