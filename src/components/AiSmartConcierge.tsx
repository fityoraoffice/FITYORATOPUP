import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Sparkles,
  Bot,
  Wand2,
  Send,
  Wallet,
  Gamepad2,
  CheckCircle2,
  ArrowRight,
  X,
  Zap,
  ShieldCheck,
  TrendingUp,
  Calculator,
  SearchCheck,
  RotateCcw,
  Copy,
  QrCode,
  MessageCircle,
  Trophy,
  Layers
} from 'lucide-react';
import { Product, ADMIN_WHATSAPP_NUMBER } from '../data/catalog';
import {
  fityBotAnalyzeAndReply,
  BotSuggestedAction,
  recommendItemsForTargetBudget,
  calculateTargetWinrate
} from '../utils/fityAi';

interface AiSmartConciergeProps {
  products: Product[];
  onApplyRecommendation: (productId: string, itemId: string) => void;
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
  onOpenQris?: () => void;
}

interface AiRecommendationItem {
  productId: string;
  productName: string;
  itemId: string;
  itemName: string;
  price: number;
  valueScore: string;
  reason: string;
}

interface AiRecommendationResult {
  headline: string;
  strategySummary: string;
  recommendations: AiRecommendationItem[];
  proTip: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedProductId?: string;
  suggestedItemId?: string;
  suggestedLabel?: string;
  recommendations?: BotSuggestedAction[];
  openQris?: boolean;
  waLink?: string;
}

interface OrderRecord {
  id: string;
  product: string;
  item: string;
  target: string;
  status: string;
  total: string;
  payment?: string;
  createdAt?: string;
}

const BUDGET_PRESETS = [20000, 50000, 100000, 250000, 500000];

const GOAL_PRESETS = [
  'Beli Skin / Gacha Event Paling Worth It',
  'Top Up Rutin Hemat & Cepat',
  'Combo Game + Pulsa / Kuota / Token PLN',
  'Hadiah Gift Voucher untuk Teman'
];

const QUICK_CHAT_PROMPTS = [
  'Rekomendasi Diamond MLBB budget 50rb',
  'Harga Point Blank (PB Cash) berapa?',
  'Paket Free Fire paling laris',
  'Harga Netflix & Spotify Premium',
  'Metode pembayaran gratis biaya admin?',
  'Cara beli Token Listrik PLN 50rb'
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-ai',
  role: 'assistant',
  timestamp: 'Baru saja',
  text:
    'Halo! Saya Fityora Ai asisten ✨\n\n' +
    'Silakan tanyakan harga 28+ layanan di FityoraStore (MLBB, Free Fire, Point Blank, Roblox, Netflix, Pulsa, Token PLN), konsultasi budget, lacak ID pesanan (cth: CS-12345), atau gunakan Kalkulator WR & Diamond di tab atas!'
};

export const AiSmartConcierge: React.FC<AiSmartConciergeProps> = ({
  products,
  onApplyRecommendation,
  showToast,
  onOpenQris
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'chat' | 'optimizer' | 'calculator' | 'tracker'>('chat');

  // Budget Optimizer states
  const [budget, setBudget] = useState<number>(50000);
  const [selectedTarget, setSelectedTarget] = useState<string>('Semua Game & Digital');
  const [selectedGoal, setSelectedGoal] = useState<string>(GOAL_PRESETS[0]);
  const [loadingRecommend, setLoadingRecommend] = useState<boolean>(false);
  const [result, setResult] = useState<AiRecommendationResult | null>(null);

  // Interactive AI Chat states
  const [chatInput, setChatInput] = useState<string>('');
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Gamer Calculator states (Winrate & Diamond Shortfall)
  const [calcTotalMatch, setCalcTotalMatch] = useState<string>('350');
  const [calcCurrentWr, setCalcCurrentWr] = useState<string>('54.5');
  const [calcTargetWr, setCalcTargetWr] = useState<string>('60');
  const [diamondOwned, setDiamondOwned] = useState<string>('120');
  const [diamondTarget, setDiamondTarget] = useState<string>('500');
  const [diamondGameId, setDiamondGameId] = useState<string>('mlbb');

  // Bot Order Tracker states
  const [botOrderIdInput, setBotOrderIdInput] = useState<string>('');
  const [botOrderLoading, setBotOrderLoading] = useState<boolean>(false);
  const [botOrderResult, setBotOrderResult] = useState<OrderRecord | null>(null);
  const [botOrderNotFound, setBotOrderNotFound] = useState<boolean>(false);
  const [recentLocalOrders, setRecentLocalOrders] = useState<OrderRecord[]>([]);

  const catalogSummary = useMemo(() => {
    return products.map((p) => ({
      productId: p.id,
      productName: p.name,
      category: p.category,
      items: p.items.map((i) => ({
        itemId: i.id,
        itemName: i.name,
        price: i.price
      }))
    }));
  }, [products]);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (isOpen && activeMode === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingChat, isOpen, activeMode]);

  // Load recent local orders when opening tracker tab
  useEffect(() => {
    if (!isOpen) return;
    const list: OrderRecord[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('CS-')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.id && parsed.product) {
              list.push(parsed);
            }
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    setRecentLocalOrders(list.reverse().slice(0, 5));
  }, [isOpen, activeMode]);

  // Ensure any productId / itemId returned by AI actually exists in `products`
  const resolveValidCatalogItem = (
    rawProductId?: string,
    rawItemId?: string
  ): { product: Product; item: Product['items'][0] } | null => {
    if (!rawProductId) return null;
    const prod =
      products.find((p) => p.id.toLowerCase() === rawProductId.toLowerCase()) ||
      products.find((p) => p.name.toLowerCase() === rawProductId.toLowerCase());
    if (!prod || prod.items.length === 0) return null;

    const item =
      (rawItemId &&
        (prod.items.find((i) => i.id.toLowerCase() === rawItemId.toLowerCase()) ||
          prod.items.find((i) => i.name.toLowerCase() === rawItemId.toLowerCase()))) ||
      prod.items[0];

    return { product: prod, item };
  };

  // Fallback local smart engine in case API encounters network/key issues
  const buildLocalFallbackRecommendation = (
    budgetVal: number,
    targetName: string
  ): AiRecommendationResult => {
    const candidates: AiRecommendationItem[] = [];
    const pool =
      targetName === 'Semua Game & Digital'
        ? products
        : products.filter((p) => p.name === targetName);

    pool.forEach((p) => {
      const affordable = p.items.filter((i) => i.price <= budgetVal);
      if (affordable.length > 0) {
        const best = affordable[affordable.length - 1];
        candidates.push({
          productId: p.id,
          productName: p.name,
          itemId: best.id,
          itemName: best.name,
          price: best.price,
          valueScore: '99% Best Value',
          reason: `Nominal paling optimal di bawah budget Rp ${budgetVal.toLocaleString('id-ID')} untuk ${p.name}.`
        });
      }
    });

    // If single product selected, also add second and third best items from that product
    if (pool.length === 1 && pool[0].items.length > 1) {
      const p = pool[0];
      const affordable = p.items.filter((i) => i.price <= budgetVal);
      if (affordable.length > 1) {
        for (let idx = affordable.length - 2; idx >= 0 && candidates.length < 3; idx--) {
          const alt = affordable[idx];
          candidates.push({
            productId: p.id,
            productName: p.name,
            itemId: alt.id,
            itemName: alt.name,
            price: alt.price,
            valueScore: 'Alternatif Hemat',
            reason: `Hemat Rp ${(budgetVal - alt.price).toLocaleString('id-ID')} dari budget Anda.`
          });
        }
      }
    }

    if (candidates.length === 0 && products[0]?.items[0]) {
      const firstP = pool[0] || products[0];
      const cheapest = [...firstP.items].sort((a, b) => a.price - b.price)[0];
      candidates.push({
        productId: firstP.id,
        productName: firstP.name,
        itemId: cheapest.id,
        itemName: cheapest.name,
        price: cheapest.price,
        valueScore: 'Paket Ekonomis',
        reason: `Pilihan harga terendah untuk memulai transaksi ${firstP.name}.`
      });
    }

    return {
      headline: `Rekomendasi Cerdas Budget Rp ${budgetVal.toLocaleString('id-ID')}`,
      strategySummary: `Berdasarkan analisis katalog CahyoStore, berikut adalah pilihan nominal dengan rasio nilai terbaik sesuai target "${selectedGoal}".`,
      recommendations: candidates.slice(0, 3),
      proTip:
        'Periksa total dan biaya pada invoice. Pembayaran QRIS diperiksa manual oleh Author.'
    };
  };

  // Smart Combo Package calculation
  const smartCombo = useMemo(() => {
    const targetProd =
      selectedTarget === 'Semua Game & Digital'
        ? null
        : products.find((p) => p.name === selectedTarget) || null;
    return recommendItemsForTargetBudget(budget, targetProd, products);
  }, [budget, selectedTarget, products]);

  const handleRunOptimizer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loadingRecommend) return;

    setLoadingRecommend(true);
    const recommendController = new AbortController();
    const recommendTimeout = window.setTimeout(() => recommendController.abort(), 26_000);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: recommendController.signal,
        body: JSON.stringify({
          budget,
          gameOrCategory: selectedTarget,
          goal: selectedGoal
        })
      });

      if (!res.ok) {
        throw new Error('Fallback to smart local analyzer');
      }

      const data = await res.json();
      if (data && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        // Validate every recommendation item against real catalog
        const validatedRecs: AiRecommendationItem[] = data.recommendations
          .map((r: AiRecommendationItem) => {
            const valid = resolveValidCatalogItem(r.productId || r.productName, r.itemId || r.itemName);
            if (!valid) return null;
            return {
              productId: valid.product.id,
              productName: valid.product.name,
              itemId: valid.item.id,
              itemName: valid.item.name,
              price: valid.item.price,
              valueScore: r.valueScore || '98% Worth It',
              reason: r.reason || `Paket terbaik dari ${valid.product.name}.`
            };
          })
          .filter(Boolean) as AiRecommendationItem[];

        if (validatedRecs.length > 0) {
          setResult({
            headline: data.headline || `Rekomendasi Cerdas Budget Rp ${budget.toLocaleString('id-ID')}`,
            strategySummary:
              data.strategySummary ||
              'Kombinasi terbaik berdasarkan budget dan katalog resmi CahyoStore.',
            recommendations: validatedRecs.slice(0, 3),
            proTip:
              data.proTip ||
              'Periksa total dan biaya pada invoice. Pembayaran QRIS diperiksa manual oleh Author.'
          });
        } else {
          setResult(buildLocalFallbackRecommendation(budget, selectedTarget));
        }
      } else {
        setResult(buildLocalFallbackRecommendation(budget, selectedTarget));
      }
    } catch {
      setResult(buildLocalFallbackRecommendation(budget, selectedTarget));
    } finally {
      window.clearTimeout(recommendTimeout);
      setLoadingRecommend(false);
    }
  };

  const getTimeString = () =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const handleSendChat = async (customPrompt?: string) => {
    const text = (customPrompt ?? chatInput).trim();
    if (!text || loadingChat) return;

    const userMsg: ChatMessage = {
      id: 'u-' + Date.now(),
      role: 'user',
      text,
      timestamp: getTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setChatInput('');
    setLoadingChat(true);

    // Run local smart analysis first so we always have accurate catalog matches & order ID detection
    const localAnalysis = fityBotAnalyzeAndReply(text, products);

    // If user entered an Order ID (e.g. CS-12345), check server API for live status
    if (localAnalysis.detectedOrderId) {
      try {
        const orderRes = await fetch(
          `/api/orders/${encodeURIComponent(localAnalysis.detectedOrderId)}`
        );
        if (orderRes.ok) {
          const orderJson = await orderRes.json();
          if (orderJson?.order) {
            const o = orderJson.order as OrderRecord;
            setMessages((prev) => [
              ...prev,
              {
                id: 'ai-' + Date.now(),
                role: 'assistant',
                timestamp: getTimeString(),
                text:
                  `✅ Status Transaksi Live Ditemukan!\n\n` +
                  `• ID Pesanan: ${o.id}\n` +
                  `• Layanan: ${o.product}\n` +
                  `• Nominal: ${o.item}\n` +
                  `• Tujuan: ${o.target}\n` +
                  `• Total: ${o.total}\n` +
                  `• Status Saat Ini: ${o.status}\n\n` +
                  `Klik tombol di bawah jika ingin menghubungi Admin WA terkait pesanan ini:`,
                waLink: `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  `Halo Admin CahyoStore, saya ingin konfirmasi pesanan *${o.id}* (${o.product} - ${o.item}).`
                )}`
              }
            ]);
            setLoadingChat(false);
            return;
          }
        }
      } catch {
        // Fall through to localAnalysis response
      }
    }

    const chatController = new AbortController();
    const chatTimeout = window.setTimeout(() => chatController.abort(), 26_000);
    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: chatController.signal,
        body: JSON.stringify({
          message: text,
          history: historyPayload
        })
      });

      if (!res.ok) {
        throw new Error('Use smart local bot engine');
      }

      const data = await res.json();
      const validSuggestion = resolveValidCatalogItem(
        data.suggestedProductId,
        data.suggestedItemId
      );

      setMessages((prev) => [
        ...prev,
        {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          timestamp: getTimeString(),
          text: data.reply || localAnalysis.reply,
          suggestedProductId:
            validSuggestion?.product.id || localAnalysis.suggestedProductId || '',
          suggestedItemId: validSuggestion?.item.id || localAnalysis.suggestedItemId || '',
          suggestedLabel:
            validSuggestion
              ? `Pilih ${validSuggestion.item.name} (Rp ${validSuggestion.item.price.toLocaleString('id-ID')})`
              : localAnalysis.suggestedLabel || '',
          recommendations: localAnalysis.recommendations,
          openQris: localAnalysis.openQris,
          waLink: localAnalysis.waLink
        }
      ]);
    } catch {
      // Accurate, context-aware fallback powered by fityAi.ts (never forces wrong product!)
      setMessages((prev) => [
        ...prev,
        {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          timestamp: getTimeString(),
          text: localAnalysis.reply,
          suggestedProductId: localAnalysis.suggestedProductId,
          suggestedItemId: localAnalysis.suggestedItemId,
          suggestedLabel: localAnalysis.suggestedLabel,
          recommendations: localAnalysis.recommendations,
          openQris: localAnalysis.openQris,
          waLink: localAnalysis.waLink
        }
      ]);
    } finally {
      window.clearTimeout(chatTimeout);
      setLoadingChat(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        ...INITIAL_WELCOME_MESSAGE,
        timestamp: getTimeString()
      }
    ]);
    showToast('Riwayat percakapan bot berhasil direset', 'info');
  };

  const handleSelectRecommendedItem = (productId: string, itemId: string, label: string) => {
    const valid = resolveValidCatalogItem(productId, itemId);
    if (!valid) {
      showToast('Produk tidak ditemukan di katalog', 'error');
      return;
    }
    onApplyRecommendation(valid.product.id, valid.item.id);
    setIsOpen(false);
    showToast(`Bot memilihkan: ${label}`, 'success');
  };

  // Winrate calculation result
  const wrResult = useMemo(() => {
    const m = parseFloat(calcTotalMatch) || 0;
    const c = parseFloat(calcCurrentWr) || 0;
    const t = parseFloat(calcTargetWr) || 0;
    return calculateTargetWinrate(m, c, t);
  }, [calcTotalMatch, calcCurrentWr, calcTargetWr]);

  // Diamond Shortfall Calculator
  const diamondShortfallResult = useMemo(() => {
    const owned = Math.max(0, parseInt(diamondOwned, 10) || 0);
    const target = Math.max(0, parseInt(diamondTarget, 10) || 0);
    const needed = Math.max(0, target - owned);
    const gameProd = products.find((p) => p.id === diamondGameId) || products[0];

    if (!gameProd || needed <= 0) {
      return { needed: 0, gameProd, suggestedItem: null };
    }

    // Parse numeric amount from item names (e.g. "86 Diamonds" -> 86)
    const itemsWithAmount = gameProd.items.map((item) => {
      const match = item.name.replace(/\./g, '').match(/(\d+)/);
      const amount = match ? parseInt(match[1], 10) : 0;
      return { item, amount };
    });

    const sufficient = itemsWithAmount
      .filter((x) => x.amount >= needed)
      .sort((a, b) => a.item.price - b.item.price);

    const suggestedItem =
      sufficient.length > 0
        ? sufficient[0].item
        : gameProd.items[gameProd.items.length - 1] || gameProd.items[0];

    return { needed, gameProd, suggestedItem };
  }, [diamondOwned, diamondTarget, diamondGameId, products]);

  // Bot Order Lookup Handler
  const handleBotCheckOrder = async (customId?: string) => {
    const targetId = (customId ?? botOrderIdInput).trim().toUpperCase();
    if (!targetId) {
      showToast('Masukkan ID Transaksi (contoh: CS-12345)', 'error');
      return;
    }
    if (customId) setBotOrderIdInput(customId);
    setBotOrderLoading(true);
    setBotOrderNotFound(false);
    setBotOrderResult(null);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.order) {
          setBotOrderResult(json.order);
          setBotOrderLoading(false);
          return;
        }
      }
    } catch {
      // fallback to localStorage
    }

    try {
      const localRaw = localStorage.getItem(targetId);
      if (localRaw) {
        setBotOrderResult(JSON.parse(localRaw));
      } else {
        setBotOrderNotFound(true);
      }
    } catch {
      setBotOrderNotFound(true);
    } finally {
      setBotOrderLoading(false);
    }
  };

  return (
    <>
      {/* Compact Floating Bottom-Right AI Button (Clean minimal dark design, no cyan/purple gradient) */}
      <motion.button
        type="button"
        title="Buka Fityora AI"
        aria-label="Buka Fityora AI"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(true);
          if (!result) {
            handleRunOptimizer();
          }
        }}
        className="fixed bottom-16 md:bottom-5 right-4 z-40 h-8 px-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-white shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
      >
        <img
          src="/icon.svg"
          alt="FY AI"
          className="w-3.5 h-3.5 object-contain shrink-0"
        />
        <span className="text-[10px] font-bold text-slate-300 tracking-wide">
          AI
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </motion.button>

      {/* Premium AI Concierge Bot Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 glass-panel w-full max-w-3xl max-h-[90vh] rounded-3xl border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,240,255,0.22)] flex flex-col overflow-hidden"
            >
              {/* Top Header */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 bg-slate-950/90 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/15 flex items-center justify-center shrink-0">
                    <img
                      src="/icon.svg"
                      alt="FY AI"
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                        Fityora Ai asisten
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-300">
                        ONLINE 24/7
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      Asisten Pintar FityoraStore • Cek Harga 28+ Produk • Budget &amp; Combo • Kalkulator WR • Lacak Order
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenQris && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenQris();
                      }}
                      title="Buka QRIS Resmi"
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-extrabold hidden sm:flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QRIS</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 4-Feature Mode Switcher Tabs */}
              <div className="px-4 sm:px-5 pt-2.5 bg-slate-950/60 border-b border-white/10 flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveMode('chat')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    activeMode === 'chat'
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chat Bot AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('optimizer');
                    if (!result) handleRunOptimizer();
                  }}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    activeMode === 'optimizer'
                      ? 'border-purple-400 text-purple-300 bg-purple-500/10'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Budget &amp; Combo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('calculator')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    activeMode === 'calculator'
                      ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Kalkulator WR &amp; Diamond</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('tracker')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    activeMode === 'tracker'
                      ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <SearchCheck className="w-3.5 h-3.5" />
                  <span>Cek Pesanan</span>
                </button>
              </div>

              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
                {/* TAB 1: INTERACTIVE CHAT BOT */}
                {activeMode === 'chat' && (
                  <div className="flex flex-col h-[460px]">
                    {/* Top Bar: Quick Prompt Chips + Reset Chat Button */}
                    <div className="flex items-center justify-between gap-2 pb-2.5">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {QUICK_CHAT_PROMPTS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => handleSendChat(q)}
                            className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-white/10 text-[11px] text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      {messages.length > 1 && (
                        <button
                          type="button"
                          onClick={handleResetChat}
                          title="Reset Percakapan"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-white/10 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[10px] font-bold">Reset</span>
                        </button>
                      )}
                    </div>

                    {/* Chat Messages Area */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[88%] p-3.5 rounded-2xl space-y-2.5 ${
                              m.role === 'user'
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold'
                                : 'bg-slate-900/95 border border-white/10 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                              <span className="font-bold">
                                {m.role === 'user' ? 'Anda' : '🤖 Fityora Ai asisten'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span>{m.timestamp}</span>
                                {m.role === 'assistant' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(m.text);
                                      showToast('Balasan bot disalin!', 'success');
                                    }}
                                    title="Salin teks"
                                    className="hover:text-cyan-300 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="leading-relaxed whitespace-pre-line break-words">{m.text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').replace(/^\s*#{1,6}\s*/gm, '')}</p>

                            {/* Multi-Item Interactive Cards inside Chat */}
                            {m.recommendations && m.recommendations.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                {m.recommendations.map((rec, idx) => (
                                  <div
                                    key={`${rec.productId}-${rec.itemId}-${idx}`}
                                    className="p-2.5 rounded-xl bg-slate-950/90 border border-cyan-500/25 flex flex-col justify-between gap-2"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                                          {rec.badge || 'Rekomendasi'}
                                        </span>
                                        <span className="text-[9px] text-slate-400 truncate">
                                          {rec.productName}
                                        </span>
                                      </div>
                                      <div className="font-extrabold text-white text-xs mt-1">
                                        {rec.itemName}
                                      </div>
                                      <div className="text-emerald-400 font-extrabold text-xs tabular-nums">
                                        Rp {rec.price.toLocaleString('id-ID')}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSelectRecommendedItem(
                                          rec.productId,
                                          rec.itemId,
                                          `${rec.productName} - ${rec.itemName}`
                                        )
                                      }
                                      className="w-full py-1.5 px-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Zap className="w-3 h-3" />
                                      <span>Pilih Paket</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Single Suggested Action Button (if no multi-cards or extra CTA) */}
                            {m.suggestedProductId &&
                              m.suggestedItemId &&
                              (!m.recommendations || m.recommendations.length === 0) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSelectRecommendedItem(
                                      m.suggestedProductId!,
                                      m.suggestedItemId!,
                                      m.suggestedLabel || 'Paket Rekomendasi AI'
                                    )
                                  }
                                  className="mt-1 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>{m.suggestedLabel || 'Pilih Paket Ini Sekarang'}</span>
                                </button>
                              )}

                            {/* QRIS or WhatsApp Quick Action Buttons inside Chat */}
                            {(m.openQris || m.waLink) && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {m.openQris && onOpenQris && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsOpen(false);
                                      onOpenQris();
                                    }}
                                    className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Lihat &amp; Scan QRIS Resmi</span>
                                  </button>
                                )}
                                {m.waLink && (
                                  <a
                                    href={m.waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-extrabold text-xs inline-flex items-center gap-1.5"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>Hubungi Admin WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {loadingChat && (
                        <div className="flex justify-start">
                          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 text-cyan-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 animate-spin" />
                            <span>Fityora Ai asisten sedang menganalisis katalog...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendChat();
                      }}
                      className="pt-3 mt-2 border-t border-white/10 flex gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ketik nama game, budget (cth: ML 50rb), atau ID Pesanan (CS-12345)..."
                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={loadingChat}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        <span>Kirim</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 2: AI SMART BUDGET & COMBO OPTIMIZER */}
                {activeMode === 'optimizer' && (
                  <div className="space-y-5">
                    <form
                      onSubmit={handleRunOptimizer}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Budget Input */}
                        <div className="space-y-2">
                          <label className="flex items-center justify-between font-bold text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <Wallet className="w-4 h-4 text-cyan-400" />
                              <span>Budget Anda (Rupiah)</span>
                            </span>
                            <span className="text-cyan-400 font-extrabold tabular-nums">
                              Rp {budget.toLocaleString('id-ID')}
                            </span>
                          </label>
                          <input
                            type="number"
                            min={1000}
                            step={1000}
                            value={budget}
                            onChange={(e) => setBudget(Number(e.target.value) || 0)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-500"
                          />
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {BUDGET_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setBudget(preset)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  budget === preset
                                    ? 'bg-cyan-500 text-slate-950 font-extrabold'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                Rp {(preset / 1000).toLocaleString('id-ID')}rb
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Game / Product Target */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-1.5 font-bold text-slate-300">
                            <Gamepad2 className="w-4 h-4 text-purple-400" />
                            <span>Fokus Layanan / Game</span>
                          </label>
                          <select
                            value={selectedTarget}
                            onChange={(e) => setSelectedTarget(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value="Semua Game & Digital">Semua Game &amp; Produk Digital</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name} ({p.publisher})
                              </option>
                            ))}
                          </select>

                          <label className="block font-bold text-slate-300 pt-1">
                            Target Pembelian
                          </label>
                          <select
                            value={selectedGoal}
                            onChange={(e) => setSelectedGoal(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                          >
                            {GOAL_PRESETS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loadingRecommend}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-600 to-emerald-500 text-white font-extrabold text-xs shadow-neon-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {loadingRecommend ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            <span>AI Sedang Menghitung Kombinasi Terbaik...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            <span>Analisis &amp; Cari Paket Paling Untung</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* AI Result Display */}
                    {result && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-emerald-500/10 border border-cyan-500/30 space-y-1.5">
                          <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-sm">
                            <TrendingUp className="w-4 h-4" />
                            <span>{result.headline}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{result.strategySummary}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {result.recommendations.map((rec, i) => (
                            <motion.div
                              key={`${rec.productId}-${rec.itemId}-${i}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.06 }}
                              className="p-4 rounded-2xl bg-slate-900/95 border border-white/10 hover:border-cyan-400/50 flex flex-col justify-between space-y-3 transition-all"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-extrabold text-[10px]">
                                    {rec.valueScore}
                                  </span>
                                  <span className="text-[10px] text-slate-400 truncate">
                                    {rec.productName}
                                  </span>
                                </div>
                                <h5 className="text-sm font-extrabold text-white">
                                  {rec.itemName}
                                </h5>
                                <div className="text-base font-extrabold text-emerald-400 tabular-nums">
                                  Rp {Number(rec.price).toLocaleString('id-ID')}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  {rec.reason}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectRecommendedItem(
                                    rec.productId,
                                    rec.itemId,
                                    `${rec.productName} - ${rec.itemName}`
                                  )
                                }
                                className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Pilih Paket Ini</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </div>

                        {/* Smart Combo Bundler Feature */}
                        {smartCombo && smartCombo.items.length > 1 && (
                          <div className="p-4 rounded-2xl bg-slate-900/95 border border-purple-500/35 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-purple-400" />
                                <span className="font-extrabold text-white text-xs sm:text-sm">
                                  {smartCombo.comboTitle}
                                </span>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold text-[10px] self-start sm:self-auto">
                                Sisa Budget: Rp {smartCombo.remainingBudget.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {smartCombo.items.map((cItem: any, idx: number) => (
                                <div
                                  key={`${cItem.itemId}-${idx}`}
                                  className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <div className="text-[10px] text-purple-300 font-bold">
                                      {cItem.productName} • {cItem.badge}
                                    </div>
                                    <div className="font-extrabold text-white">{cItem.itemName}</div>
                                    <div className="text-emerald-400 font-bold tabular-nums">
                                      Rp {cItem.price.toLocaleString('id-ID')}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectRecommendedItem(
                                        cItem.productId,
                                        cItem.itemId,
                                        `${cItem.productName} - ${cItem.itemName}`
                                      )
                                    }
                                    className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-[11px] cursor-pointer shrink-0"
                                  >
                                    Ambil
                                  </button>
                                </div>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400">{smartCombo.savingNote}</p>
                          </div>
                        )}

                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/25 flex items-center gap-2.5 text-emerald-300">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>
                            <strong>Tips AI:</strong> {result.proTip}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* TAB 3: GAMER CALCULATOR (WINRATE & DIAMOND GACHA SHORTFALL) */}
                {activeMode === 'calculator' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Winrate Calculator */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-4">
                      <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-white">
                            Kalkulator Winrate (WR)
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Hitung jumlah Win Streak tanpa kalah untuk mencapai target WR impian
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block font-bold text-slate-300 mb-1">
                            Total Pertandingan (Match) Saat Ini
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={calcTotalMatch}
                            onChange={(e) => setCalcTotalMatch(e.target.value)}
                            placeholder="Contoh: 350"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block font-bold text-slate-300 mb-1">
                              WR Saat Ini (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min={1}
                              max={99.9}
                              value={calcCurrentWr}
                              onChange={(e) => setCalcCurrentWr(e.target.value)}
                              placeholder="Contoh: 54.5"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-300 mb-1">
                              Target WR (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min={1}
                              max={99.9}
                              value={calcTargetWr}
                              onChange={(e) => setCalcTargetWr(e.target.value)}
                              placeholder="Contoh: 60"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border ${
                            wrResult.valid
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          } space-y-1.5`}
                        >
                          {wrResult.valid && (
                            <div className="text-base font-extrabold text-emerald-400">
                              🔥 Butuh {wrResult.neededWins} Win Streak!
                            </div>
                          )}
                          <p className="text-[11px] leading-relaxed">{wrResult.message}</p>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Diamond / Currency Target Shortfall Calculator */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-4 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <Calculator className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white">
                              Kalkulator Kekurangan Diamond / Koin
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              Hitung sisa Diamond untuk Skin / Gacha &amp; rekomendasi paket pas
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block font-bold text-slate-300 mb-1">
                              Pilih Game
                            </label>
                            <select
                              value={diamondGameId}
                              onChange={(e) => setDiamondGameId(e.target.value)}
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                            >
                              {products
                                .filter((p) => p.category === 'game' || p.category === 'pcgame')
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block font-bold text-slate-300 mb-1">
                                Diamond Dimiliki
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={diamondOwned}
                                onChange={(e) => setDiamondOwned(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-300 mb-1">
                                Target Harga Skin
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={diamondTarget}
                                onChange={(e) => setDiamondTarget(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {diamondShortfallResult.needed > 0 && diamondShortfallResult.suggestedItem ? (
                        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Kekurangan:</span>
                            <span className="font-extrabold text-cyan-300 text-sm">
                              Kurang {diamondShortfallResult.needed.toLocaleString('id-ID')} Item
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Rekomendasi Paket Paling Pas:{' '}
                            <strong className="text-white">
                              {diamondShortfallResult.suggestedItem.name}
                            </strong>{' '}
                            (
                            <span className="text-emerald-400 font-bold">
                              Rp{' '}
                              {diamondShortfallResult.suggestedItem.price.toLocaleString('id-ID')}
                            </span>
                            )
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectRecommendedItem(
                                diamondShortfallResult.gameProd.id,
                                diamondShortfallResult.suggestedItem!.id,
                                `${diamondShortfallResult.gameProd.name} - ${diamondShortfallResult.suggestedItem!.name}`
                              )
                            }
                            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Zap className="w-4 h-4" />
                            <span>
                              Top Up {diamondShortfallResult.suggestedItem.name} Sekarang
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-center">
                          🎉 Jumlah Diamond Anda sudah cukup untuk membeli skin/item target!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: LIVE ORDER TRACKER INSIDE BOT */}
                {activeMode === 'tracker' && (
                  <div className="space-y-4">
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <SearchCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-white">
                            Lacak Status Transaksi Real-Time via Bot
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Masukkan ID Pesanan (contoh: CS-12345) untuk mengecek status pengiriman
                          </p>
                        </div>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleBotCheckOrder();
                        }}
                        className="flex flex-col sm:flex-row gap-2"
                      >
                        <input
                          type="text"
                          value={botOrderIdInput}
                          onChange={(e) => setBotOrderIdInput(e.target.value)}
                          placeholder="Ketik ID Transaksi (Contoh: CS-89412)..."
                          className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="submit"
                          disabled={botOrderLoading}
                          className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer disabled:opacity-50"
                        >
                          {botOrderLoading ? 'Mencari...' : 'Lacak Sekarang'}
                        </button>
                      </form>

                      {botOrderResult && (
                        <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/35 space-y-2">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="font-extrabold text-emerald-400">
                              ✓ Pesanan Ditemukan ({botOrderResult.id})
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[10px]">
                              {botOrderResult.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                            <div>
                              Layanan: <strong className="text-white">{botOrderResult.product}</strong>
                            </div>
                            <div>
                              Nominal: <strong className="text-cyan-300">{botOrderResult.item}</strong>
                            </div>
                            <div>
                              Tujuan: <strong className="text-white">{botOrderResult.target}</strong>
                            </div>
                            <div>
                              Total Bayar:{' '}
                              <strong className="text-emerald-400">{botOrderResult.total}</strong>
                            </div>
                          </div>
                          <div className="pt-2 flex flex-wrap gap-2">
                            <a
                              href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                                `Halo Admin CahyoStore, saya ingin menanyakan pesanan dengan ID *${botOrderResult.id}* (${botOrderResult.product} - ${botOrderResult.item}) ke tujuan *${botOrderResult.target}*.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Konfirmasi ke WA Admin</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {botOrderNotFound && (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                          ✕ ID Transaksi <strong>{botOrderIdInput.toUpperCase()}</strong> tidak ditemukan. Pastikan format ID sesuai (cth: CS-12345).
                        </div>
                      )}
                    </div>

                    {/* Recent Local Orders Quick Click */}
                    {recentLocalOrders.length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-2.5">
                        <div className="font-extrabold text-slate-300">
                          Riwayat Transaksi Terakhir Anda di Perangkat Ini:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {recentLocalOrders.map((ord) => (
                            <button
                              key={ord.id}
                              type="button"
                              onClick={() => handleBotCheckOrder(ord.id)}
                              className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-white/10 hover:border-amber-400/50 text-left flex items-center justify-between gap-2 cursor-pointer transition-all"
                            >
                              <div className="min-w-0">
                                <div className="font-extrabold text-cyan-400">{ord.id}</div>
                                <div className="text-[11px] text-white truncate">
                                  {ord.product} — {ord.item}
                                </div>
                                <div className="text-[10px] text-amber-300 truncate">
                                  {ord.status}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
