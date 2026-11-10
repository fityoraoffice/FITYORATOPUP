import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Product, ProductItem } from '../data/catalog';
import { placeholderImage } from '../utils/imageResolver';

interface CategoryOption {
  id: string;
  label: string;
}

interface VirtualizedProductGridProps {
  products: Product[];
  selectedProductId?: string | null;
  onSelectProduct: (productId: string) => void;
  getStartingPrice: (product: Product) => number;
  categories?: CategoryOption[];
  currentCategory?: string;
  onCategoryChange?: (categoryId: string) => void;
  searchQuery?: string;
  activeTag?: string;
  getProductTags?: (productId: string) => ('best-seller' | 'new-arrival' | 'promo')[];
  onResetFilters?: () => void;
}

const highlightMatchedText = (text: string, query?: string) => {
  const q = (query || '').trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={idx}
        className="bg-cyan-400/25 text-cyan-200 rounded px-0.5 font-extrabold not-italic"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const CATEGORY_ICONS: Record<string, string> = {
  game: '🎮',
  pcgame: '💻',
  streaming: '🎬',
  sosmed: '🔥',
  digital: '📱',
  voucher: '🎟️',
  ewallet: '💳',
  pln: '⚡',
};

const CATEGORY_NAMES: Record<string, string> = {
  game: 'Game Mobile',
  pcgame: 'PC & Konsol',
  streaming: 'Streaming',
  sosmed: 'Sosmed & TikTok',
  digital: 'Pulsa',
  voucher: 'Voucher Game',
  ewallet: 'Saldo E-Wallet',
  pln: 'Listrik PLN',
};

export const VirtualizedProductGrid: React.FC<VirtualizedProductGridProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  getStartingPrice,
  categories,
  searchQuery,
  activeTag,
  getProductTags,
  onResetFilters
}) => {
  const q = (searchQuery || '').trim().toLowerCase();

  const categoryLabelMap: Record<string, string> = {};
  if (categories) {
    for (const c of categories) {
      categoryLabelMap[c.id] = c.label.replace(/^[^\w\s]+\s*/, '');
    }
  }

  const tagMetaMap: Record<
    'best-seller' | 'new-arrival' | 'promo',
    { label: string; className: string }
  > = {
    'best-seller': {
      label: '🔥 Best Seller',
      className: 'bg-amber-500/90 text-slate-950 border-amber-300'
    },
    'new-arrival': {
      label: '✨ New Arrival',
      className: 'bg-purple-600/90 text-white border-purple-300'
    },
    promo: {
      label: '🏷️ Promo',
      className: 'bg-emerald-500/90 text-slate-950 border-emerald-300'
    }
  };

  return (
    <div
      id="product-grid"
      data-grid-cols="4"
      className="w-full relative select-none"
    >
      {products.length === 0 ? (
        <div className="py-12 px-4 text-center text-slate-400 space-y-3 rounded-2xl bg-slate-900/60 border border-white/10">
          <PackageOpen className="w-10 h-10 mx-auto text-cyan-400/70" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">
              Produk &ldquo;{searchQuery}&rdquo; tidak ditemukan pada kategori ini.
            </p>
            <p className="text-xs text-slate-400">
              Coba kata kunci lain (seperti Diamond, Welkin, Netflix, Token PLN) atau tampilkan semua kategori.
            </p>
          </div>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-extrabold transition-all cursor-pointer"
            >
              Reset Filter &amp; Tampilkan Semua Layanan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
          {products.map((prod: Product, cardIndex: number) => {
            const isCurrentlySelected = selectedProductId === prod.id;
            const startPrice = getStartingPrice(prod);
            const matchedItem = q
              ? prod.items.find((it: ProductItem) => it.name.toLowerCase().includes(q))
              : undefined;
            const catShort = categoryLabelMap[prod.category] || prod.category.toUpperCase();
            const prodTags = getProductTags ? getProductTags(prod.id) : [];
            const displayTag =
              activeTag &&
              activeTag !== 'all' &&
              prodTags.includes(activeTag as 'best-seller' | 'new-arrival' | 'promo')
                ? (activeTag as 'best-seller' | 'new-arrival' | 'promo')
                : prodTags[0];
            const badgeMeta = displayTag ? tagMetaMap[displayTag] : null;

            return (
              <div
                key={prod.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProduct(prod.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProduct(prod.id);
                  }
                }}
                style={{ animationDelay: cardIndex < 12 ? `${cardIndex * 35}ms` : '0ms' }}
                className={`fy-fade-in glass-card product-card-glow rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 cursor-pointer group flex flex-col items-center text-center space-y-1.5 relative overflow-hidden select-none transition-colors duration-150 h-full ${
                  isCurrentlySelected
                    ? 'gradient-border-active border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.4)] ring-2 ring-cyan-400/80 bg-slate-900/95'
                    : 'hover:border-cyan-400/50 hover:bg-slate-800/80 bg-slate-900/80'
                }`}
              >
                <div className="relative w-full aspect-square rounded-lg sm:rounded-xl overflow-hidden border border-white/10 group-hover:border-cyan-400/50 bg-slate-900 z-10 shrink-0">
                  <img
                    src={prod.image}
                    alt={prod.name}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = placeholderImage(prod.id, prod.name);
                    }}
                    style={{
                      objectFit: prod.imageFit === 'contain' ? 'contain' : 'cover',
                      padding: prod.imageFit === 'contain' ? '4px' : '0'
                    }}
                    className="fy-img-zoom w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none" />
                  {isCurrentlySelected ? (
                    <span className="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded-md bg-cyan-400 text-slate-950 font-black text-[8px] sm:text-[9px] shadow-sm flex items-center gap-0.5">
                      ✓ Terpilih
                    </span>
                  ) : q ? (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/85 border border-cyan-400/40 text-[8px] font-bold text-cyan-300 truncate max-w-[85%]">
                      {CATEGORY_ICONS[prod.category] || '🎮'} {catShort}
                    </span>
                  ) : badgeMeta ? (
                    <span
                      className={`absolute top-1 left-1 px-1.5 py-0.5 rounded border text-[7px] sm:text-[9px] font-extrabold shadow-sm truncate max-w-[88%] ${badgeMeta.className}`}
                    >
                      {badgeMeta.label}
                    </span>
                  ) : (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-950/85 border border-white/10 text-[7px] sm:text-[8px] font-extrabold text-slate-300 truncate max-w-[88%] flex items-center gap-1">
                      <span>{CATEGORY_ICONS[prod.category] || '🎮'}</span>
                      <span>{CATEGORY_NAMES[prod.category] || prod.category}</span>
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 border border-slate-950" />
                </div>
                <div className="w-full relative z-10 space-y-0.5 px-0.5 min-w-0">
                  <h4 className="text-[10px] sm:text-xs font-extrabold text-white group-hover:text-cyan-300 transition-colors truncate">
                    {highlightMatchedText(prod.name, searchQuery)}
                  </h4>
                  <p className="text-[8px] sm:text-[10px] text-slate-400 truncate flex items-center justify-center gap-1">
                    {matchedItem ? (
                      <span className="text-emerald-300 font-semibold truncate">
                        ✓ {highlightMatchedText(matchedItem.name, searchQuery)}
                      </span>
                    ) : (
                      <>
                        <span className="opacity-70">{CATEGORY_ICONS[prod.category] || '🎮'}</span>
                        <span className="truncate">{highlightMatchedText(prod.publisher, searchQuery)}</span>
                      </>
                    )}
                  </p>
                  {startPrice > 0 ? (
                    <p className="text-[9px] sm:text-[10px] font-extrabold text-cyan-400 truncate tabular-nums">
                      Rp {(matchedItem ? matchedItem.price : startPrice).toLocaleString('id-ID')}
                    </p>
                  ) : (
                    <p className="text-[9px] sm:text-[10px] font-bold text-amber-300 truncate">
                      Rp 0 (Atur Harga)
                    </p>
                  )}

                  <div className="w-full mt-1 py-0.5 text-[8px] sm:text-[9px] text-cyan-400/80 group-hover:text-cyan-300 font-bold flex items-center justify-center gap-0.5 transition-colors">
                    <span>{isCurrentlySelected ? 'Terpilih' : 'Pilih Layanan'}</span>
                    <span>➔</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
