import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ShoppingCart,
  X,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Send,
  ShoppingBag,
  Share2,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { Product, PaymentMethod, PAYMENT_METHODS } from '../data/catalog';
import { placeholderImage } from '../utils/imageResolver';
import { PaymentMethodLogo } from './PaymentMethodLogo';

export interface CartItem {
  cartItemId: string;
  productId: string;
  productName: string;
  productImage: string;
  productImageFit?: 'cover' | 'contain';
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  userId: string;
  zoneId?: string;
}

export const CART_STORAGE_KEY = 'cahyostore_cart_v1';

export function encodeCartForUrl(cart: CartItem[]): string {
  try {
    const compact = cart.map((c) => ({
      p: c.productId,
      i: c.itemId,
      q: c.quantity,
      u: c.userId,
      z: c.zoneId || ''
    }));
    return encodeURIComponent(btoa(JSON.stringify(compact)));
  } catch {
    return '';
  }
}

export function decodeCartFromUrl(
  encoded: string
): Array<{ p: string; i: string; q: number; u: string; z?: string }> {
  try {
    const jsonStr = atob(decodeURIComponent(encoded));
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hydrateCartFromCompact(
  compactList: Array<{ p: string; i: string; q: number; u: string; z?: string }>,
  catalog: Product[]
): CartItem[] {
  const result: CartItem[] = [];
  for (const item of compactList) {
    const prod = catalog.find((p) => p.id === item.p);
    if (!prod) continue;
    const prodItem = prod.items.find((it) => it.id === item.i) || prod.items[0];
    if (!prodItem) continue;
    const cleanUser = String(item.u || '').trim();
    const cleanZone = String(item.z || '').trim();
    const key = `${prod.id}-${prodItem.id}-${cleanUser}-${cleanZone}`;
    result.push({
      cartItemId: key,
      productId: prod.id,
      productName: prod.name,
      productImage: prod.image,
      productImageFit: prod.imageFit,
      itemId: prodItem.id,
      itemName: prodItem.name,
      price: prodItem.price,
      quantity: Math.max(1, Number(item.q) || 1),
      userId: cleanUser,
      zoneId: cleanZone || undefined
    });
  }
  return result;
}

export function loadCartItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  selectedPayment: PaymentMethod | null;
  onSelectPayment: (payment: PaymentMethod) => void;
  whatsappNumber: string;
  onChangeWhatsapp: (wa: string) => void;
  buyerEmail?: string;
  onChangeEmail?: (email: string) => void;
  onCheckoutCart: () => void;
  showToast?: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  selectedPayment,
  onSelectPayment,
  whatsappNumber,
  onChangeWhatsapp,
  buyerEmail = '',
  onChangeEmail,
  onCheckoutCart,
  showToast
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const fee = cart.length > 0 && selectedPayment ? selectedPayment.fee : 0;
  const grandTotal = subtotal + fee;
  const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?cart=${encodeCartForUrl(cart)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2400);
        if (showToast) {
          showToast('Link troli berhasil disalin! Bagikan ke teman atau buka kapan saja.', 'success');
        }
      });
    }
  };

  const handleShareWhatsApp = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?cart=${encodeCartForUrl(cart)}`;
    const itemsText = cart
      .map(
        (c, i) =>
          `${i + 1}. *${c.productName}* - ${c.itemName} (${c.quantity}x)\n   Tujuan: \`${c.userId}${c.zoneId ? ` (${c.zoneId})` : ''}\`\n   Harga: Rp ${(c.price * c.quantity).toLocaleString('id-ID')}`
      )
      .join('\n\n');

    const message = `*DRAFT PESANAN FITYORASTORE*\n\nHalo, ini keranjang belanja saya:\n\n${itemsText}\n\n*Estimasi Total:* Rp ${grandTotal.toLocaleString('id-ID')}\n\nBuka & lanjutkan checkout keranjang ini langsung lewat link:\n${shareUrl}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fy-cart-shell relative z-10 w-full max-w-md glass-panel border-l border-white/10 h-full flex flex-col justify-between overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Troli Belanja</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 tabular-nums">
                      {totalCount}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Checkout beberapa voucher sekaligus dalam 1 pesanan
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-white/5 flex items-center justify-center mx-auto text-slate-600">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-300">Troli Masih Kosong</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Pilih layanan game atau produk digital, lalu klik tombol &ldquo;+ Troli&rdquo;
                      untuk menambahkan ke keranjang.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Itemized List */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        Daftar Item ({cart.length})
                      </span>
                      <button
                        onClick={onClearCart}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Kosongkan</span>
                      </button>
                    </div>

                    {cart.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="p-3 rounded-2xl bg-slate-900/90 border border-white/10 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.onerror = null;
                              t.src = placeholderImage(item.productId, item.productName);
                            }}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-950 border border-white/10 shrink-0"
                          />
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-xs font-bold text-white truncate">
                              {item.productName}
                            </h4>
                            <p className="text-xs font-semibold text-cyan-400 truncate">
                              {item.itemName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              ID: <span className="text-slate-200">{item.userId}</span>
                              {item.zoneId ? ` (${item.zoneId})` : ''}
                            </p>
                            <p className="text-xs font-extrabold text-white pt-0.5 tabular-nums">
                              Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                          <button
                            onClick={() => onRemoveItem(item.cartItemId)}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                            title="Hapus item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-1.5 bg-slate-950 border border-white/10 rounded-xl p-1">
                            <button
                              onClick={() => onUpdateQty(item.cartItemId, -1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-white px-1.5 tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQty(item.cartItemId, 1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Selection inside Cart */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Pilih Metode Pembayaran</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((pay) => {
                        const isSelected = selectedPayment?.id === pay.id;
                        const isMaint = Boolean(pay.isMaintenance);
                        return (
                          <button
                            key={pay.id}
                            type="button"
                            disabled={isMaint}
                            onClick={() => {
                              if (isMaint) return;
                              onSelectPayment(pay);
                            }}
                            className={`p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 ${
                              isMaint
                                ? 'opacity-50 grayscale cursor-not-allowed bg-slate-950/60 border border-white/5'
                                : isSelected
                                ? 'gradient-border-active border-cyan-500 bg-slate-900/90 cursor-pointer'
                                : 'border border-white/10 hover:border-cyan-500/40 bg-slate-900/90 cursor-pointer'
                            }`}
                          >
                            <PaymentMethodLogo id={pay.id} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                <span className="truncate">{pay.name}</span>
                                {isMaint && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold shrink-0">
                                    Maint
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex justify-between mt-0.5">
                                <span className="truncate">{pay.group}</span>
                                <span className="text-cyan-400 shrink-0 ml-1">
                                  {isMaint ? 'Maintenance' : pay.badge}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* WhatsApp & Email Input */}
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        Nomor WhatsApp Pembeli
                      </label>
                      <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => onChangeWhatsapp(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    {onChangeEmail && (
                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Email Struk Pembayaran (Opsional)
                        </label>
                        <input
                          type="email"
                          value={buyerEmail}
                          onChange={(e) => onChangeEmail(e.target.value)}
                          placeholder="Contoh: nama@email.com"
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer Summary & Checkout */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/90 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal ({totalCount} item):</span>
                    <span className="text-slate-200 font-semibold tabular-nums">
                      Rp {subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-white pt-1.5 border-t border-white/10">
                    <span>Total Belanja:</span>
                    <span className="text-cyan-400 tabular-nums">
                      Rp {subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Share Cart Draft Bar */}
                <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Salin Link Keranjang Belanja"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Link Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Bagikan Draft Pesanan ke WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Share ke WA</span>
                  </button>
                </div>

                <button
                  onClick={onCheckoutCart}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-emerald-500 text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-neon-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Checkout Semua via WhatsApp</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
