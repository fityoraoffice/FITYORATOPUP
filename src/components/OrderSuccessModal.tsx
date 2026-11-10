import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Copy,
  Check,
  Send,
  Receipt,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  QrCode,
  Mail,
  Download,
  Eye,
  Code2
} from 'lucide-react';
import { PaymentMethodLogo } from './PaymentMethodLogo';
import { CAHYO_QRIS_DATA_URL, CAHYO_QRIS_INFO } from '../data/qrisMerchant';

import { generateHtmlEmailReceipt, type CompletedOrderReceipt } from '../utils/receiptHtml';
export { generateHtmlEmailReceipt };
export type { CompletedOrderReceipt };

interface OrderSuccessModalProps {
  receipt: CompletedOrderReceipt | null;
  onClose: () => void;
  onOpenQris: () => void;
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  receipt,
  onClose,
  onOpenQris,
  showToast
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [showEmailHtmlPreview, setShowEmailHtmlPreview] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const autoCopiedRef = useRef(false);

  const triggerAutoCopy = useCallback(() => {
    if (!receipt?.orderId || autoCopiedRef.current) return;
    autoCopiedRef.current = true;
    try {
      localStorage.setItem('cahyostore_last_tracked_id', receipt.orderId);
    } catch {}

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(receipt.orderId)
        .then(() => {
          setCopied(true);
          showToast(`ID Pesanan #${receipt.orderId} otomatis disalin ke clipboard! Siap dilacak.`, 'success');
          setTimeout(() => setCopied(false), 3000);
        })
        .catch(() => {});
    }
  }, [receipt?.orderId, showToast]);

  useEffect(() => {
    autoCopiedRef.current = false;
    const timer = setTimeout(() => {
      triggerAutoCopy();
    }, 450);
    return () => clearTimeout(timer);
  }, [receipt?.orderId, triggerAutoCopy]);

  if (!receipt) return null;

  const emailReceiptHtml = generateHtmlEmailReceipt(receipt);

  const handleCopyId = () => {
    triggerAutoCopy();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(receipt.orderId);
    }
    setCopied(true);
    showToast(`ID Pesanan #${receipt.orderId} disalin!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmailHtml = () => {
    navigator.clipboard?.writeText(emailReceiptHtml);
    setCopiedHtml(true);
    showToast('Kode HTML Email Struk berhasil disalin!', 'success');
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handleDownloadEmailHtml = () => {
    const blob = new Blob([emailReceiptHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Struk-Email-${receipt.orderId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Struk Email HTML (${receipt.orderId}) berhasil diunduh!`, 'success');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Animated Receipt Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          onAnimationComplete={() => triggerAutoCopy()}
          className="relative z-10 glass-panel max-w-md w-full p-6 rounded-3xl border border-emerald-500/40 shadow-glass overflow-hidden space-y-5"
        >
          {/* Ambient Top Emerald Glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Animated Success Badge */}
          <div className="flex flex-col items-center text-center space-y-2 pt-2">
            <div className="relative">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.35, 1.15], opacity: [0.6, 0, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="w-20 h-20 rounded-full bg-emerald-500/30 absolute inset-0"
              />
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.08 }}
                className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-neon-cyan relative z-10"
              >
                <CheckCircle2 className="w-11 h-11 stroke-[2.5]" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="space-y-1 pt-1"
            >
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Invoice Tersimpan di Server</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">Invoice Pesanan Dibuat</h3>
              <p className="text-xs text-slate-400">
                Simpan ID pesanan. Pembayaran belum terverifikasi sampai admin memeriksa transaksi GoPay Merchant.
              </p>
            </motion.div>
          </div>

          {/* Transaction ID Copy Box & Important WhatsApp Support Reminder */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">ID Transaksi Unik</span>
                <span className="text-base font-extrabold text-cyan-400 tracking-wide tabular-nums">
                  {receipt.orderId}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-extrabold text-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">ID Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Salin ID Pesanan</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-[11px] text-amber-200 leading-relaxed">
              <strong className="text-amber-300">⚠️ PENTING — Wajib Salin / Screenshot ID Pesanan:</strong>{' '}
              Harap salin ID Pesanan (<strong>{receipt.orderId}</strong>) di atas untuk melacak status pesanan yang tersimpan di server atau menghubungi CS bila terdapat kendala.
            </div>
          </motion.div>

          {/* Receipt Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-cyan-400" /> Produk Layanan
              </span>
              <span className="font-bold text-white">{receipt.productName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Item Nominal</span>
              <span className="font-bold text-cyan-300">{receipt.itemName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Target / User ID</span>
              <span className="font-bold text-white">{receipt.targetId}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Metode Bayar</span>
              <div className="flex items-center gap-2">
                <PaymentMethodLogo id={receipt.paymentId} size="sm" />
                <span className="font-bold text-white">{receipt.paymentName}</span>
              </div>
            </div>

            {receipt.email && (
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Struk
                </span>
                <span className="font-bold text-cyan-300 truncate max-w-[200px]">{receipt.email}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Waktu Order</span>
              <span className="text-slate-300 tabular-nums">{receipt.timestamp}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-300 font-bold">Total Pembayaran</span>
              <span className="text-base font-extrabold text-emerald-400 tabular-nums">
                {receipt.totalFormatted}
              </span>
            </div>
          </motion.div>

          <button
            type="button"
            onClick={onOpenQris}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 font-extrabold text-sm flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" /> Tampilkan QRIS untuk Invoice Ini
          </button>

          {/* HTML Email Receipt Generator Controls */}
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-purple-500/30 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-white block truncate">
                    Invoice HTML (Bukan Bukti Pembayaran)
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {receipt.email ? `Siap dikirim ke ${receipt.email}` : 'Ringkasan pesanan HTML siap diunduh'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmailHtmlPreview((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/35 text-[11px] font-bold text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showEmailHtmlPreview ? 'Tutup' : 'Preview'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEmailHtml}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-[11px] font-bold text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Salin Kode HTML Email"
                >
                  {copiedHtml ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>{copiedHtml ? 'Tersalin' : 'HTML'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEmailHtml}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-[11px] font-bold text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Download File HTML Struk Email"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh</span>
                </button>
              </div>
            </div>

            {showEmailHtmlPreview && (
              <div className="rounded-xl overflow-hidden border border-white/15 bg-slate-950">
                <iframe
                  title={`Email Receipt ${receipt.orderId}`}
                  srcDoc={emailReceiptHtml}
                  className="w-full h-56 bg-slate-950 border-0"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => setShowQrPreview((prev) => !prev)}
              className="w-full py-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>{showQrPreview ? 'Tutup Barcode QRIS' : 'Scan QRIS Resmi (CAHYO STORE)'}</span>
            </button>

            {showQrPreview && (
              <div className="p-3 rounded-2xl bg-white border-2 border-cyan-400 shadow-lg space-y-2">
                <img
                  src={CAHYO_QRIS_DATA_URL}
                  alt="QRIS CAHYO STORE, PULSA & TAGIHAN"
                  className="w-full max-h-80 object-contain mx-auto rounded-xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/qris-official.png';
                  }}
                />
              </div>
            )}

            <a
              href={receipt.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-neon-cyan hover:opacity-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Kirim Bukti &amp; Konfirmasi ke WA Admin</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Selesai &amp; Kembali ke Beranda</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
