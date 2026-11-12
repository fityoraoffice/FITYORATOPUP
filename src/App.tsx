/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Zap,
  Search,
  SearchCheck,
  MessageCircle,
  Sparkles,
  Grid,
  X,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  UserCheck,
  ShieldCheck,
  Wallet,
  Headphones,
  Instagram,
  Phone,
  Send,
  PackageOpen,
  AlertCircle,
  CheckCircle2,
  Info,
  Shield,
  ArrowUpDown,
  Copy,
  Check,
  ChevronDown,
  LayoutGrid,
  Rows3,
  QrCode,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Camera,
  Maximize2,
  Minimize2,
  ScanLine,
  Lock,
  Unlock,
  ClipboardCheck,
  Mail,
  Download,
  Sun,
  Moon,
  Home,
  LogOut,
  Trash2
} from 'lucide-react';
import {
  Product,
  ProductItem,
  PaymentMethod,
  INITIAL_PRODUCTS_DATA,
  PAYMENT_METHODS,
  ADMIN_WHATSAPP_NUMBER,
  DEFAULT_PRODUCT_ARTWORKS,
  TESTIMONIALS,
  FAQ_ITEMS,
  FAQ_TOPICS,
  FaqCategoryTopic
} from './data/catalog';
import { resolveLiveProductImage, placeholderImage } from './utils/imageResolver';
import { fetchCatalog, pushCatalog, catalogSignature, normalizeProducts } from './utils/catalogSync';
import {
  FxThemeAndMusic,
  FxConfig,
  loadFxConfig,
  saveFxConfig,
  applyGlobalColorModeVars,
  THEME_PRESETS,
  fetchPublicFx,
  mergePublicFx,
  pushPublicFx,
  samePublicFx
} from './components/FxThemeAndMusic';
const AdminDashboardModal = lazy(() =>
  import('./components/AdminDashboardModal').then((m) => ({ default: m.AdminDashboardModal }))
);
import { VirtualizedProductGrid } from './components/VirtualizedProductGrid';
import {
  RecentOrders,
  RecentActivityItem,
  loadRecentActivities,
  saveRecentActivities,
  ORDER_STAGES,
  mapStatusToStageIndex
} from './components/RecentOrders';
import {
  CartDrawer,
  CartItem,
  loadCartItems,
  saveCartItems,
  decodeCartFromUrl,
  hydrateCartFromCompact
} from './components/CartDrawer';
import {
  AuthModal,
  MemberUser,
  isAuthorAccount,
  loadSessionUser,
  saveSessionUser,
  syncUsersWithServerDb,
  refreshCurrentMemberProfile
} from './components/AuthModal';
import { PaymentMethodLogo } from './components/PaymentMethodLogo';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { generateOrderId } from './utils/orderId';
import { CustomerReviews } from './components/CustomerReviews';
import { ReviewForm } from './components/ReviewForm';
import { generateHtmlEmailReceipt, type CompletedOrderReceipt } from './utils/receiptHtml';
// Bagian berat dimuat belakangan (lazy) supaya halaman utama tampil lebih cepat di HP murah.
const OrderSuccessModal = lazy(() =>
  import('./components/OrderSuccessModal').then((m) => ({ default: m.OrderSuccessModal }))
);
const AiSmartConcierge = lazy(() =>
  import('./components/AiSmartConcierge').then((m) => ({ default: m.AiSmartConcierge }))
);
const QrisScannerModal = lazy(() =>
  import('./components/QrisScannerModal').then((m) => ({ default: m.QrisScannerModal }))
);
import { CAHYO_QRIS_DATA_URL, CAHYO_QRIS_INFO } from './data/qrisMerchant';
import { line as d3Line, area as d3Area, curveMonotoneX } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import {
  playCheckoutClickDing,
  playTransactionSuccessDing,
  playPaymentVerifiedChime,
} from './utils/soundEffects';

interface DraftData {
  userId: string;
  zoneId: string;
  itemId: string | null;
  payId: string | null;
}

const CHECKOUT_EXPIRY_SECONDS = 2 * 60; // 2 minutes countdown (120 seconds)

interface OrderSnapshot {
  orderId: string;
  product: Product;
  item: ProductItem;
  payment: PaymentMethod;
  userId: string;
  zoneId: string;
  wa: string;
  email?: string;
  uniqueCode: number;
  createdAtMs: number;
  createdAtFormatted: string;
  expiresAtFormatted: string;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface StoredTransaction {
  id: string;
  product: string;
  item: string;
  target: string;
  status: string;
  total: string;
  uniqueCode?: number;
  payment?: string;
  whatsapp?: string;
  email?: string;
  memberName?: string;
  memberId?: string;
  createdAt?: string;
  productId?: string;
  itemId?: string;
  paymentId?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  verifiedAt?: string;
  shippedAt?: string;
  lineItems?: Array<{ productId: string; itemId: string; quantity: number; userId: string; zoneId?: string }>;
}

interface RecentQrScanEntry {
  id: string;
  rawValue: string;
  userId: string;
  zoneId?: string;
  productId: string;
  productName: string;
  scannedAt: string;
}

const CUSTOM_CATALOG_KEY = 'cahyostore_custom_catalog_v13';
const RECENT_QR_SCANS_KEY = 'cahyostore_recent_qr_scans_v1';

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_CATALOG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeProducts(parsed as Product[]);
        }
      }
    } catch {
      // ignore
    }
    // Default: katalog bawaan (sama dengan yang dipakai server untuk menagih). Katalog terbaru
    // dimuat dari server segera setelah halaman terbuka.
    return normalizeProducts(INITIAL_PRODUCTS_DATA);
  });
  const [fx, setFx] = useState<FxConfig>(() => loadFxConfig());
  const fxRef = useRef<FxConfig>(fx);
  fxRef.current = fx;
  const lastFxEditAtRef = useRef<number>(0);
  const fxPushTimerRef = useRef<number | null>(null);

  // Tema, animasi, wallpaper & musik latar diatur Author di server, lalu dibaca SEMUA pengunjung.
  // Mode siang/malam tetap pilihan pribadi (disimpan di browser masing-masing).
  useEffect(() => {
    let cancelled = false;
    const syncFromServer = async () => {
      if (document.hidden) return;
      // Jangan menimpa perubahan yang baru saja dibuat Author di perangkat ini.
      if (Date.now() - lastFxEditAtRef.current < 8000) return;
      const remote = await fetchPublicFx();
      if (cancelled || !remote?.settings) return;
      const merged = mergePublicFx(fxRef.current, remote.settings);
      if (!samePublicFx(fxRef.current, merged)) {
        setFx(merged);
        saveFxConfig(merged);
      }
    };
    void syncFromServer();
    const timer = window.setInterval(syncFromServer, 45000);
    const onVisible = () => {
      if (!document.hidden) void syncFromServer();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Katalog & harga: server adalah sumber kebenaran, dilihat semua pembeli.
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;
  const lastCatalogEditAtRef = useRef<number>(0);
  const catalogPushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const syncCatalog = async () => {
      if (document.hidden) return;
      if (Date.now() - lastCatalogEditAtRef.current < 8000) return;
      const remote = await fetchCatalog();
      if (cancelled || !remote) return;
      if (!remote.custom) {
        // Server belum punya katalog tersimpan. Bila browser ini punya salinan lama hasil edit Author
        // (sebelum katalog pindah ke server), kirim ke server satu kali; hanya berhasil bila sesi Author aktif.
        try {
          const legacy = localStorage.getItem(CUSTOM_CATALOG_KEY);
          if (legacy) {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const local = normalizeProducts(parsed as Product[]);
              if (catalogSignature(local) !== catalogSignature(remote.products)) {
                const ok = await pushCatalog(local);
                if (ok && !cancelled) return;
              }
            }
          }
        } catch {
          // ignore
        }
      }
      if (catalogSignature(productsRef.current) !== catalogSignature(remote.products)) {
        setProducts(remote.products);
        try {
          localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(remote.products));
        } catch {
          // ignore
        }
      }
    };
    void syncCatalog();
    const timer = window.setInterval(syncCatalog, 60000);
    const onVisible = () => {
      if (!document.hidden) void syncCatalog();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleAdminUpdateFx = (newFx: FxConfig) => {
    const publicChanged = !samePublicFx(fxRef.current, newFx);
    setFx(newFx);
    saveFxConfig(newFx);
    if (!publicChanged) return;
    lastFxEditAtRef.current = Date.now();
    if (fxPushTimerRef.current) window.clearTimeout(fxPushTimerRef.current);
    // Ditunda sebentar agar geseran volume tidak mengirim puluhan permintaan.
    fxPushTimerRef.current = window.setTimeout(async () => {
      const ok = await pushPublicFx(fxRef.current);
      if (!ok) {
        // Jaga perubahan lokal tetap tampil, dan beri tahu Author bahwa pengunjung belum menerimanya.
        lastFxEditAtRef.current = Date.now() + 10 * 60 * 1000;
        showToast('Pengaturan belum tersimpan ke server. Login ulang sebagai Author lalu coba lagi.', 'error');
      } else {
        lastFxEditAtRef.current = Date.now();
      }
    }, 400);
  };
  const [adminOpen, setAdminOpen] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'analytics' | 'theme' | 'studio' | 'orders' | 'streaming' | 'catalog' | 'members' | 'zip'
  >('analytics');
  const [currentCategory, setCurrentCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc'>('default');
  const gridColumns = '4' as const;
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [progressWidth, setProgressWidth] = useState<number>(0);
  const progressTimerRef = useRef<number | null>(null);

  const triggerTopProgress = () => {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    setIsFiltering(true);
    setProgressWidth(35);
    window.setTimeout(() => setProgressWidth(82), 80);
    progressTimerRef.current = window.setTimeout(() => {
      setProgressWidth(100);
      window.setTimeout(() => {
        setIsFiltering(false);
        setProgressWidth(0);
      }, 180);
    }, 280);
  };

  // Selected Checkout State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProductItem | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [activeFaqTopic, setActiveFaqTopic] = useState<FaqCategoryTopic>('Semua');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [shakeUserId, setShakeUserId] = useState<boolean>(false);
  const [shakeZoneId, setShakeZoneId] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<'user' | 'zone' | null>(null);
  const [aiParsedNotice, setAiParsedNotice] = useState<string | null>(null);
  const [clearingField, setClearingField] = useState<'user' | 'zone' | null>(null);
  const [showUserIdText, setShowUserIdText] = useState<boolean>(true);
  const [showZoneIdText, setShowZoneIdText] = useState<boolean>(true);
  const [isAiInputLocked, setIsAiInputLocked] = useState<boolean>(false);
  const [autoFillCopiedTooltip, setAutoFillCopiedTooltip] = useState<boolean>(false);
  const autoFillCopiedTimerRef = useRef<number | null>(null);
  const [aiPasteFlashField, setAiPasteFlashField] = useState<'user' | 'zone' | 'both' | null>(null);
  const aiPasteFlashTimerRef = useRef<number | null>(null);
  const [pasteBorderPulseField, setPasteBorderPulseField] = useState<'user' | 'zone' | 'both' | null>(
    null
  );
  const pasteBorderPulseTimerRef = useRef<number | null>(null);
  const [liveTargetAuth, setLiveTargetAuth] = useState<{
    status: 'idle' | 'checking' | 'verified' | 'unconfirmed' | 'invalid';
    accountName?: string;
    regionOrInfo?: string;
    provider?: string;
    verifiedAt?: string;
    message?: string;
  }>({ status: 'idle' });
  const [pasteBubbleInfo, setPasteBubbleInfo] = useState<{
    field: 'user' | 'zone';
    charCount: number;
    wasSplit?: boolean;
    key: number;
  } | null>(null);
  const pasteBubbleTimerRef = useRef<number | null>(null);
  const [qrScanModalOpen, setQrScanModalOpen] = useState<boolean>(false);
  const [qrScannerRetracted, setQrScannerRetracted] = useState<boolean>(false);
  const [qrScanProgress, setQrScanProgress] = useState<number>(0);
  const [qrScanningActive, setQrScanningActive] = useState<boolean>(false);
  const [qrDetectedString, setQrDetectedString] = useState<string | null>(null);
  const [recentScansDrawerOpen, setRecentScansDrawerOpen] = useState<boolean>(false);
  const [recentQrScans, setRecentQrScans] = useState<RecentQrScanEntry[]>(() => {
    // Previous versions seeded this list with sample IDs that looked like real scans.
    // Remove that unverified history; only truly decoded scans may be saved in future.
    try { localStorage.removeItem(RECENT_QR_SCANS_KEY); } catch {}
    return [];
  });
  const qrScanIntervalRef = useRef<number | null>(null);
  const shakeUserTimerRef = useRef<number | null>(null);
  const shakeZoneTimerRef = useRef<number | null>(null);
  const aiParsedTimerRef = useRef<number | null>(null);

  // Lightweight tactile haptic feedback pattern when a valid ID is parsed or auto-filled
  const triggerValidIdHaptic = (pattern: number | number[] = [18, 35, 24]) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore if vibration API is unsupported or blocked by browser permissions
    }
  };

  // Visual feedback flash overlay on the input field when a user pastes a long string & AI parsing initiates
  const triggerAiPasteFlash = (target: 'user' | 'zone' | 'both') => {
    setAiPasteFlashField(target);
    if (aiPasteFlashTimerRef.current) {
      window.clearTimeout(aiPasteFlashTimerRef.current);
    }
    aiPasteFlashTimerRef.current = window.setTimeout(() => {
      setAiPasteFlashField(null);
    }, 950);
  };

  // Distinct gold/purple border pulse animation when text is pasted
  const triggerPasteBorderPulse = (target: 'user' | 'zone' | 'both') => {
    setPasteBorderPulseField(null);
    if (pasteBorderPulseTimerRef.current) {
      window.clearTimeout(pasteBorderPulseTimerRef.current);
    }
    window.requestAnimationFrame(() => {
      setPasteBorderPulseField(target);
      pasteBorderPulseTimerRef.current = window.setTimeout(() => {
        setPasteBorderPulseField(null);
      }, 1200);
    });
  };

  // Visual 'bubble' animation popping up near the input field when text is pasted, showing a summary of characters processed
  const triggerPasteBubble = (field: 'user' | 'zone', pastedText: string, wasSplit?: boolean) => {
    const cleanLen = pastedText.trim().length;
    if (cleanLen === 0) return;
    triggerPasteBorderPulse(wasSplit ? 'both' : field);
    setPasteBubbleInfo({
      field,
      charCount: cleanLen,
      wasSplit,
      key: Date.now()
    });
    if (pasteBubbleTimerRef.current) {
      window.clearTimeout(pasteBubbleTimerRef.current);
    }
    pasteBubbleTimerRef.current = window.setTimeout(() => {
      setPasteBubbleInfo(null);
    }, 2200);
  };

  // Verify and refresh member session with the persistent server database on app boot
  useEffect(() => {
    refreshCurrentMemberProfile().then((fresh) => {
      if (fresh) setCurrentUser(fresh);
    }).catch(() => {});
  }, []);

  const recordRecentQrScan = (
    prod: Product,
    rawValue: string,
    extractedUserId: string,
    extractedZoneId?: string
  ) => {
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const newEntry: RecentQrScanEntry = {
      id: `qr-${Date.now()}`,
      rawValue: rawValue.trim(),
      userId: extractedUserId.trim(),
      zoneId: extractedZoneId?.trim() || undefined,
      productId: prod.id,
      productName: prod.name,
      scannedAt: nowTime
    };
    setRecentQrScans((prev) => {
      const deduplicated = prev.filter(
        (item) =>
          !(
            item.rawValue.toLowerCase() === newEntry.rawValue.toLowerCase() &&
            item.productId === newEntry.productId
          )
      );
      const next = [newEntry, ...deduplicated].slice(0, 5);
      try {
        localStorage.setItem(RECENT_QR_SCANS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const applyRecentScanEntry = (entry: RecentQrScanEntry) => {
    if (!selectedProduct) return;
    if (selectedProduct.hasZoneId && entry.zoneId) {
      setUserId(entry.userId);
      setZoneId(entry.zoneId);
      setShakeUserId(false);
      setShakeZoneId(false);
      triggerValidIdHaptic([18, 35, 24]);
      playCheckoutClickDing();
      const msg = `Recent Scan diterapkan: ${selectedProduct.idLabel} "${entry.userId}" & ${
        selectedProduct.zoneLabel || 'Zone ID'
      } "${entry.zoneId}"`;
      triggerAiParsedBanner(msg);
      showToast(msg, 'success');
    } else if (!handleSmartFormatInput(entry.rawValue, 'button')) {
      setUserId(entry.userId);
      setShakeUserId(false);
      triggerValidIdHaptic([18, 35, 24]);
      playCheckoutClickDing();
      const msg = `Recent Scan diterapkan: ${selectedProduct.idLabel} "${entry.userId}"`;
      triggerAiParsedBanner(msg);
      showToast(msg, 'success');
    }
    setRecentScansDrawerOpen(false);
  };

  const handleAnimatedClearField = (field: 'user' | 'zone') => {
    setIsAiInputLocked(false);
    setClearingField(field);
    window.setTimeout(() => {
      if (field === 'user') {
        setUserId('');
        setShakeUserId(false);
        userIdInputRef.current?.focus();
      } else {
        setZoneId('');
        setShakeZoneId(false);
        zoneIdInputRef.current?.focus();
      }
      setClearingField((prev) => (prev === field ? null : prev));
    }, 220);
  };

  const getProductQrSampleStrings = (prod: Product | null): { label: string; value: string }[] => {
    if (!prod) return [{ label: 'Game ID Standar', value: '123456789' }];
    const id = prod.id.toLowerCase();
    if (id === 'mlbb' || id === 'magicchess') {
      return [
        { label: `Profil ${prod.name} (ID + Server)`, value: '184920384 (2198)' },
        { label: `Squad / Kartu Akun ${prod.name}`, value: '829104756 (9214)' }
      ];
    }
    if (id === 'pubg') {
      return [
        { label: 'Kartu QR Profil PUBG Mobile', value: '5182930475' },
        { label: 'Clan / UID PUBG', value: '5920184736' }
      ];
    }
    if (id === 'ff' || id === 'ffmax') {
      return [
        { label: 'QR Kartu Player Free Fire', value: '591827364' },
        { label: 'Booyah Pass UID QR', value: '8492017364' }
      ];
    }
    if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
      return [
        { label: `QR HoYoLAB (${prod.name} - Asia)`, value: '812345678 (Asia)' },
        { label: `QR HoYoLAB (${prod.name} - America)`, value: '619283745 (America)' }
      ];
    }
    if (id === 'valorant') {
      return [
        { label: 'QR Riot Card ID', value: 'CahyoVLR#IDN' },
        { label: 'QR Premier Tagline', value: 'RadiantAce#SEA' }
      ];
    }
    const uHint = getProductFieldFormatHint(prod, 'user');
    const zHint = getProductFieldFormatHint(prod, 'zone');
    if (prod.hasZoneId) {
      return [
        {
          label: `QR Profil ${prod.name}`,
          value: `${uHint.example} (${zHint.example.split(' ')[0]})`
        }
      ];
    }
    return [{ label: `QR Akun ${prod.name}`, value: uHint.example }];
  };

  const applyScannedQrString = (rawQrValue: string) => {
    if (!selectedProduct) return;
    if (qrScanIntervalRef.current) {
      window.clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }
    setQrScanningActive(false);
    setQrDetectedString(rawQrValue);
    playCheckoutClickDing();
    triggerValidIdHaptic([20, 40, 30]);

    const parsed = parseSmartGameIdString(selectedProduct, rawQrValue);
    const finalUser = parsed.userId || rawQrValue.trim();
    const finalZone = parsed.wasSplit ? parsed.zoneId : undefined;

    recordRecentQrScan(selectedProduct, rawQrValue, finalUser, finalZone);

    if (!handleSmartFormatInput(rawQrValue, 'button')) {
      setUserId(finalUser);
      setShakeUserId(false);
      const msg = `QR Scanner: ${selectedProduct.idLabel} "${finalUser}" berhasil dipindai!`;
      triggerAiParsedBanner(msg);
      showToast(msg, 'success');
    }
    window.setTimeout(() => {
      setQrScanModalOpen(false);
    }, 420);
  };

  const openSimulatedQrScanner = () => {
    // The previous implementation only advanced a timer and inserted a hard-coded example ID.
    // Disable it rather than pretend camera detection works. Customers can paste their real UID.
    setQrScanningActive(false);
    setQrScanProgress(0);
    setQrDetectedString(null);
    setQrScanModalOpen(false);
    showToast('Pemindai kamera belum aktif pada versi ini. Salin UID asli dari profil game dan tempelkan ke kolom ID; contoh ID tidak akan dimasukkan otomatis.', 'info');
  };

  // Returns product-specific primary & secondary glow palette so focused inputs pulse with the selected product's theme
  const getProductThemePalette = (prod: Product | null) => {
    const id = prod?.id.toLowerCase() || '';
    const cat = prod?.category || 'game';
    if (id === 'mlbb' || id === 'magicchess') {
      return {
        name: 'Mythic Azure & Violet',
        primary: 'rgba(56, 189, 248, 0.95)',
        primaryRing: 'rgba(56, 189, 248, 0.25)',
        primaryGlow: 'rgba(56, 189, 248, 0.38)',
        primaryInset: 'rgba(56, 189, 248, 0.22)',
        secondary: 'rgba(168, 85, 247, 0.95)',
        secondaryRing: 'rgba(168, 85, 247, 0.25)',
        secondaryGlow: 'rgba(168, 85, 247, 0.42)',
        secondaryInset: 'rgba(168, 85, 247, 0.22)',
        accentHex: '#38bdf8'
      };
    }
    if (id === 'ff' || id === 'ffmax') {
      return {
        name: 'Booyah Solar Orange & Gold',
        primary: 'rgba(249, 115, 22, 0.95)',
        primaryRing: 'rgba(249, 115, 22, 0.26)',
        primaryGlow: 'rgba(249, 115, 22, 0.4)',
        primaryInset: 'rgba(249, 115, 22, 0.22)',
        secondary: 'rgba(250, 204, 21, 0.95)',
        secondaryRing: 'rgba(250, 204, 21, 0.26)',
        secondaryGlow: 'rgba(250, 204, 21, 0.42)',
        secondaryInset: 'rgba(250, 204, 21, 0.22)',
        accentHex: '#f97316'
      };
    }
    if (id === 'pubg') {
      return {
        name: 'Winner Tactical Gold & Amber',
        primary: 'rgba(250, 204, 21, 0.95)',
        primaryRing: 'rgba(250, 204, 21, 0.26)',
        primaryGlow: 'rgba(250, 204, 21, 0.38)',
        primaryInset: 'rgba(250, 204, 21, 0.2)',
        secondary: 'rgba(245, 158, 11, 0.95)',
        secondaryRing: 'rgba(245, 158, 11, 0.26)',
        secondaryGlow: 'rgba(245, 158, 11, 0.42)',
        secondaryInset: 'rgba(245, 158, 11, 0.22)',
        accentHex: '#facc15'
      };
    }
    if (id === 'valorant') {
      return {
        name: 'Radiant Crimson & Magenta',
        primary: 'rgba(251, 113, 133, 0.95)',
        primaryRing: 'rgba(251, 113, 133, 0.25)',
        primaryGlow: 'rgba(251, 113, 133, 0.38)',
        primaryInset: 'rgba(251, 113, 133, 0.2)',
        secondary: 'rgba(217, 70, 239, 0.95)',
        secondaryRing: 'rgba(217, 70, 239, 0.25)',
        secondaryGlow: 'rgba(217, 70, 239, 0.4)',
        secondaryInset: 'rgba(217, 70, 239, 0.22)',
        accentHex: '#fb7185'
      };
    }
    if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
      return {
        name: 'Celestia Sky & Indigo',
        primary: 'rgba(56, 189, 248, 0.95)',
        primaryRing: 'rgba(56, 189, 248, 0.26)',
        primaryGlow: 'rgba(56, 189, 248, 0.38)',
        primaryInset: 'rgba(56, 189, 248, 0.2)',
        secondary: 'rgba(129, 140, 248, 0.95)',
        secondaryRing: 'rgba(129, 140, 248, 0.26)',
        secondaryGlow: 'rgba(129, 140, 248, 0.42)',
        secondaryInset: 'rgba(129, 140, 248, 0.22)',
        accentHex: '#818cf8'
      };
    }
    if (cat === 'streaming') {
      return {
        name: 'Cinema Ruby & Purple',
        primary: 'rgba(244, 63, 94, 0.92)',
        primaryRing: 'rgba(244, 63, 94, 0.24)',
        primaryGlow: 'rgba(244, 63, 94, 0.36)',
        primaryInset: 'rgba(244, 63, 94, 0.18)',
        secondary: 'rgba(168, 85, 247, 0.95)',
        secondaryRing: 'rgba(168, 85, 247, 0.25)',
        secondaryGlow: 'rgba(168, 85, 247, 0.4)',
        secondaryInset: 'rgba(168, 85, 247, 0.22)',
        accentHex: '#c084fc'
      };
    }
    if (cat === 'pln') {
      return {
        name: 'Electric Volt Gold & Cyan',
        primary: 'rgba(250, 204, 21, 0.95)',
        primaryRing: 'rgba(250, 204, 21, 0.25)',
        primaryGlow: 'rgba(250, 204, 21, 0.38)',
        primaryInset: 'rgba(250, 204, 21, 0.2)',
        secondary: 'rgba(34, 211, 238, 0.95)',
        secondaryRing: 'rgba(34, 211, 238, 0.25)',
        secondaryGlow: 'rgba(34, 211, 238, 0.4)',
        secondaryInset: 'rgba(34, 211, 238, 0.22)',
        accentHex: '#facc15'
      };
    }
    return {
      name: 'Cyber Neon Cyan & Violet',
      primary: 'rgba(34, 211, 238, 0.95)',
      primaryRing: 'rgba(34, 211, 238, 0.24)',
      primaryGlow: 'rgba(0, 240, 255, 0.35)',
      primaryInset: 'rgba(0, 240, 255, 0.2)',
      secondary: 'rgba(168, 85, 247, 0.95)',
      secondaryRing: 'rgba(168, 85, 247, 0.25)',
      secondaryGlow: 'rgba(168, 85, 247, 0.4)',
      secondaryInset: 'rgba(168, 85, 247, 0.22)',
      accentHex: '#22d3ee'
    };
  };

  const triggerAiParsedBanner = (msg: string) => {
    setAiParsedNotice(msg);
    setIsAiInputLocked(true);
    if (aiParsedTimerRef.current) window.clearTimeout(aiParsedTimerRef.current);
    aiParsedTimerRef.current = window.setTimeout(() => {
      setAiParsedNotice(null);
    }, 4500);
  };

  const triggerAutoFillCopiedTooltip = () => {
    setAutoFillCopiedTooltip(false);
    if (autoFillCopiedTimerRef.current) {
      window.clearTimeout(autoFillCopiedTimerRef.current);
    }
    window.requestAnimationFrame(() => {
      setAutoFillCopiedTooltip(true);
      autoFillCopiedTimerRef.current = window.setTimeout(() => {
        setAutoFillCopiedTooltip(false);
      }, 2200);
    });
  };

  const handleAutoFillFromClipboard = async () => {
    if (!selectedProduct) return;
    playCheckoutClickDing();
    triggerAutoFillCopiedTooltip();

    const uHint = getProductFieldFormatHint(selectedProduct, 'user');
    const zHint = getProductFieldFormatHint(selectedProduct, 'zone');
    let clipText = '';
    try {
      clipText = await navigator.clipboard.readText();
    } catch {
      // Fallback sample if clipboard read permission is blocked in preview iframe
    }

    const rawToProcess =
      clipText && clipText.trim()
        ? clipText.trim()
        : selectedProduct.hasZoneId
          ? `${uHint.example} (${zHint.example.split(' ')[0]})`
          : uHint.example;

    const parsed = parseSmartGameIdString(selectedProduct, rawToProcess);
    triggerPasteBubble('user', rawToProcess, parsed.wasSplit);

    if (!handleSmartFormatInput(rawToProcess, 'button')) {
      const targetUser = parsed.userId || rawToProcess;
      setUserId(targetUser);
      setShakeUserId(false);
      triggerValidIdHaptic([18, 35, 24]);
      triggerAiPasteFlash('user');
      triggerAiParsedBanner(
        `AI Auto-Fill Clipboard: ${selectedProduct.idLabel} "${targetUser}" berhasil diterapkan & dikunci!`
      );
      showToast(`Copied! ${selectedProduct.idLabel} diisi otomatis dari Clipboard`, 'success');
    }
  };

  // AI Smart Game ID Parser: extracts User ID and Zone/Server ID from combined strings like "12345678 (1234)"
  const parseSmartGameIdString = (
    prod: Product | null,
    rawInput: string
  ): { userId: string; zoneId?: string; wasSplit: boolean } => {
    const cleaned = rawInput.trim();
    if (!cleaned) return { userId: '', wasSplit: false };

    if (prod?.hasZoneId) {
      // 1. Format with parentheses or brackets: "12345678 (1234)" or "UID: 812345678 [Asia]"
      const parenMatch = cleaned.match(
        /(?:id|uid|user\s*id)?\s*[:=-]?\s*([a-zA-Z0-9._-]{4,20})\s*[\(\[\{]\s*([a-zA-Z0-9_-]{2,15})\s*[\)\]\}]/i
      );
      if (parenMatch) {
        return { userId: parenMatch[1], zoneId: parenMatch[2], wasSplit: true };
      }

      // 2. Explicit labeled format: "ID: 12345678 Server: 1234" or "UID 812345678 Zone Asia"
      const labeledMatch = cleaned.match(
        /(?:id|uid|user)\s*[:=-]?\s*([a-zA-Z0-9._-]{4,20})[\s,|/;-]+(?:zone|server|svr|zona)\s*[:=-]?\s*([a-zA-Z0-9_-]{2,15})/i
      );
      if (labeledMatch) {
        return { userId: labeledMatch[1], zoneId: labeledMatch[2], wasSplit: true };
      }

      // 3. Delimiter separated format: "12345678 1234", "12345678-1234", "12345678/1234", "812345678 Asia"
      const delimMatch = cleaned.match(
        /^([0-9]{5,15})\s*(?:[\s/|,-]+|:)\s*([0-9]{3,6}|asia|america|europe|tw|hk|mo|sar|global|sea)$/i
      );
      if (delimMatch) {
        return { userId: delimMatch[1], zoneId: delimMatch[2], wasSplit: true };
      }
    }

    // Single-field cleanup: strip prefixes like "ID: 5123456789" or "(1234)" if accidentally pasted
    const labeledSingle = cleaned.match(
      /^(?:user\s*id|player\s*id|character\s*id|uid|id)\s*[:=-]\s*([^\s()]+)(?:\s*\(([^)]+)\))?/i
    );
    if (labeledSingle) {
      return {
        userId: labeledSingle[1],
        zoneId: prod?.hasZoneId ? labeledSingle[2] : undefined,
        wasSplit: Boolean(prod?.hasZoneId && labeledSingle[2])
      };
    }

    return { userId: cleaned, wasSplit: false };
  };

  const handleSmartFormatInput = (rawText: string, source: 'paste' | 'button' | 'typing') => {
    if (!selectedProduct) return false;
    const parsed = parseSmartGameIdString(selectedProduct, rawText);
    if (parsed.wasSplit && parsed.userId && parsed.zoneId) {
      setUserId(parsed.userId);
      setZoneId(parsed.zoneId);
      setShakeUserId(false);
      setShakeZoneId(false);
      triggerValidIdHaptic([18, 35, 24]);
      triggerAiPasteFlash('both');
      const msg = `AI Auto-Parse: ${selectedProduct.idLabel} "${parsed.userId}" & ${
        selectedProduct.zoneLabel || 'Zone ID'
      } "${parsed.zoneId}" terpisah otomatis!`;
      triggerAiParsedBanner(msg);
      if (source !== 'typing') {
        showToast(msg, 'success');
      }
      return true;
    }
    return false;
  };

  const getProductFieldFormatHint = (
    prod: Product | null,
    field: 'user' | 'zone'
  ): { title: string; format: string; example: string; tip: string } => {
    if (!prod) {
      return {
        title: 'Panduan Format ID',
        format: 'Angka / Karakter Akun',
        example: '12345678',
        tip: 'Salin ID langsung dari menu profil akun Anda.'
      };
    }

    const id = prod.id.toLowerCase();
    const label = field === 'zone' ? prod.zoneLabel || 'Zone ID' : prod.idLabel;

    if (field === 'zone') {
      if (id === 'mlbb' || id === 'magicchess') {
        return {
          title: `Format ${label} ${prod.name}`,
          format: '4–5 digit angka di dalam tanda kurung',
          example: '2198',
          tip: 'Terletak tepat di sebelah kanan User ID pada profil game Anda.'
        };
      }
      if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
        return {
          title: `Pilihan ${label} (${prod.name})`,
          format: 'Nama Server / kode region',
          example: 'Asia / America / Europe',
          tip: 'Pastikan server sesuai dengan karakter yang dimainkan.'
        };
      }
      return {
        title: `Format ${label}`,
        format: '2–10 digit angka atau kode Server',
        example: '1234 / Asia',
        tip: 'Cek informasi Server/Zone di halaman profil akun game Anda.'
      };
    }

    if (id === 'mlbb' || id === 'magicchess') {
      return {
        title: `Format User ID ${prod.name}`,
        format: '8–10 digit angka (tanpa Zone ID)',
        example: '123456789',
        tip: 'Buka Avatar Profil di pojok kiri atas game untuk melihat User ID.'
      };
    }
    if (id === 'ff' || id === 'ffmax') {
      return {
        title: 'Format Player ID Free Fire',
        format: '8–12 digit angka numerik',
        example: '591827364',
        tip: 'Klik avatar di pojok kiri atas lobi Free Fire lalu salin UID.'
      };
    }
    if (id === 'pubg') {
      return {
        title: 'Format Character ID PUBG Mobile',
        format: '9–12 digit angka dimulai angka 5',
        example: '5182930475',
        tip: 'Buka menu profil PUBG untuk menyalin ID Karakter angka.'
      };
    }
    if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
      return {
        title: `Format UID ${prod.name}`,
        format: '9 digit angka (Asia diawali angka 8)',
        example: '812345678',
        tip: 'UID tertera di pojok kanan bawah layar permainan.'
      };
    }
    if (id === 'valorant') {
      return {
        title: 'Format Riot ID & Tagline',
        format: 'Username#Tagline',
        example: 'CahyoPlayer#IDN',
        tip: 'Sertakan tanda pagar (#) beserta tagline akun Riot Anda.'
      };
    }
    if (id === 'pointblank') {
      return {
        title: 'Format ID Zepetto Point Blank',
        format: 'Username login akun Zepetto (4–16 karakter)',
        example: 'cahyopb99',
        tip: 'Masukkan ID Login Zepetto (bukan nickname karakter di dalam game).'
      };
    }
    if (id === 'roblox') {
      return {
        title: 'Format Username Roblox',
        format: 'Username unik akun (bukan Display Name)',
        example: 'cahyo_gamer99',
        tip: 'Gunakan username berawalan @ pada profil Roblox Anda.'
      };
    }
    if (/nomor|hp|telepon|ewallet|dana|ovo|gopay|shopeepay|pulsa/i.test(label + ' ' + id)) {
      return {
        title: `Format ${label}`,
        format: '10–13 digit nomor aktif (08xx)',
        example: '081234567890',
        tip: 'Pastikan nomor aktif dan terdaftar pada layanan terkait.'
      };
    }
    if (/pln|listrik|meter|pelanggan/i.test(label + ' ' + id)) {
      return {
        title: `Format ${label}`,
        format: '11–12 digit Nomor Meter / ID Pelanggan',
        example: '14234567890',
        tip: 'Periksa nomor pada kartu pelanggan atau meteran listrik PLN.'
      };
    }

    return {
      title: `Format ${label} (${prod.name})`,
      format: prod.hasZoneId ? '6–12 digit angka ID' : 'ID / Username / Nomor akun aktif',
      example: prod.hasZoneId ? '12345678' : 'user_cahyo01 / 0812xxxx',
      tip: 'Pastikan data akun sudah benar agar proses instan berjalan lancar.'
    };
  };

  const triggerUserIdShake = () => {
    setShakeUserId(false);
    triggerValidIdHaptic([28, 35, 22]);
    if (shakeUserTimerRef.current) window.clearTimeout(shakeUserTimerRef.current);
    window.requestAnimationFrame(() => {
      setShakeUserId(true);
      shakeUserTimerRef.current = window.setTimeout(() => setShakeUserId(false), 520);
    });
  };

  const triggerZoneIdShake = () => {
    setShakeZoneId(false);
    triggerValidIdHaptic([28, 35, 22]);
    if (shakeZoneTimerRef.current) window.clearTimeout(shakeZoneTimerRef.current);
    window.requestAnimationFrame(() => {
      setShakeZoneId(true);
      shakeZoneTimerRef.current = window.setTimeout(() => setShakeZoneId(false), 520);
    });
  };

  const checkShouldTriggerInvalidFormatHaptic = (
    prod: Product | null,
    nextVal: string,
    prevVal: string,
    field: 'user' | 'zone'
  ): boolean => {
    const trimmed = nextVal.trim();
    if (!prod || !trimmed || nextVal.length < prevVal.length) return false;
    const rule = getProductValidationRule(prod);
    const id = prod.id.toLowerCase();

    if (field === 'zone') {
      const maxLen = rule.zoneMaxLen || 15;
      const minLen = rule.zoneMinLen || 2;
      const zRegex = rule.zoneRegex || /^[a-zA-Z0-9_-]{2,15}$/;
      if (trimmed.length > maxLen) return true;
      if ((id === 'mlbb' || id === 'magicchess') && /[^\d]/.test(trimmed)) return true;
      if (trimmed.length >= minLen && !zRegex.test(trimmed)) return true;
      return false;
    }

    if (trimmed.length > rule.userMaxLen) return true;
    const numericOnlyIds = ['mlbb', 'magicchess', 'pubg', 'ff', 'ffmax', 'genshin', 'hsr', 'zzz', 'supersus', 'hok', 'codm', 'fcmobile', 'pln'];
    if (numericOnlyIds.includes(id) && /[^\d\s()-]/.test(trimmed)) {
      return true;
    }
    if (id === 'pubg' && trimmed.length >= 1 && !trimmed.startsWith('5')) {
      return true;
    }
    if ((id === 'genshin' || id === 'hsr' || id === 'zzz') && trimmed.startsWith('0')) {
      return true;
    }
    if (trimmed.length >= rule.userMinLen && !rule.userRegex.test(trimmed)) {
      return true;
    }
    return false;
  };

  interface FieldValidationRule {
    userRegex: RegExp;
    userErrorMsg: string;
    userMinLen: number;
    userMaxLen: number;
    zoneRegex?: RegExp;
    zoneErrorMsg?: string;
    zoneMinLen?: number;
    zoneMaxLen?: number;
  }

  const getProductValidationRule = (prod: Product | null): FieldValidationRule => {
    if (!prod) {
      return {
        userRegex: /^[a-zA-Z0-9._+#@-]{4,32}$/,
        userErrorMsg: 'Format tidak valid (minimal 4 karakter).',
        userMinLen: 4,
        userMaxLen: 32
      };
    }

    const id = prod.id.toLowerCase();
    const label = prod.idLabel.toLowerCase();

    if (id === 'mlbb' || id === 'magicchess') {
      return {
        userRegex: /^\d{6,12}$/,
        userErrorMsg: `Format tidak valid: User ID ${prod.name} wajib 6–12 digit angka.`,
        userMinLen: 6,
        userMaxLen: 12,
        zoneRegex: /^\d{3,6}$/,
        zoneErrorMsg: `Format tidak valid: Zone ID ${prod.name} wajib 3–6 digit angka.`,
        zoneMinLen: 3,
        zoneMaxLen: 6
      };
    }
    if (id === 'pubg') {
      return {
        userRegex: /^5\d{8,11}$/,
        userErrorMsg: 'Format tidak valid: ID PUBG wajib diawali angka 5 (9–12 digit angka).',
        userMinLen: 9,
        userMaxLen: 12
      };
    }
    if (id === 'ff' || id === 'ffmax') {
      return {
        userRegex: /^\d{8,12}$/,
        userErrorMsg: 'Format tidak valid: Player ID Free Fire wajib 8–12 digit angka.',
        userMinLen: 8,
        userMaxLen: 12
      };
    }
    if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
      return {
        userRegex: /^[1-9]\d{8,9}$/,
        userErrorMsg: `Format tidak valid: UID ${prod.name} wajib 9–10 digit angka (contoh: 812345678).`,
        userMinLen: 9,
        userMaxLen: 10,
        zoneRegex: /^(asia|america|europe|tw|hk|mo|sar|global|sea|\d{2,6})$/i,
        zoneErrorMsg: 'Format tidak valid: Masukkan Server valid (Asia / America / Europe).',
        zoneMinLen: 2,
        zoneMaxLen: 7
      };
    }
    if (id === 'valorant') {
      return {
        userRegex: /^.{3,16}#[a-zA-Z0-9]{2,6}$/,
        userErrorMsg: 'Format tidak valid: Wajib menyertakan Riot ID & Tagline (contoh: Player#IDN).',
        userMinLen: 6,
        userMaxLen: 23
      };
    }
    if (id === 'pointblank') {
      return {
        userRegex: /^[a-zA-Z0-9_-]{4,16}$/,
        userErrorMsg: 'Format tidak valid: ID Zepetto wajib 4–16 karakter huruf/angka tanpa spasi.',
        userMinLen: 4,
        userMaxLen: 16
      };
    }
    if (id === 'roblox') {
      return {
        userRegex: /^@?[a-zA-Z0-9_]{3,20}$/,
        userErrorMsg: 'Format tidak valid: Username Roblox wajib 3–20 karakter (huruf/angka/_).',
        userMinLen: 3,
        userMaxLen: 20
      };
    }
    if (id === 'supersus') {
      return {
        userRegex: /^\d{7,12}$/,
        userErrorMsg: 'Format tidak valid: Space ID Super Sus wajib 7–12 digit angka.',
        userMinLen: 7,
        userMaxLen: 12
      };
    }
    if (id === 'hok' || id === 'codm' || id === 'fcmobile') {
      return {
        userRegex: /^\d{7,16}$/,
        userErrorMsg: `Format tidak valid: ${prod.idLabel} wajib 7–16 digit angka.`,
        userMinLen: 7,
        userMaxLen: 16
      };
    }
    if (id === 'tiktok') {
      return {
        userRegex: /^@?[a-zA-Z0-9._]{2,24}$/,
        userErrorMsg: 'Format tidak valid: Username TikTok wajib 2–24 karakter.',
        userMinLen: 2,
        userMaxLen: 24
      };
    }
    if (id === 'pln' || /meter|pelanggan/i.test(label)) {
      return {
        userRegex: /^\d{11,12}$/,
        userErrorMsg: 'Format tidak valid: No. Meter / ID Pelanggan PLN wajib 11–12 digit angka.',
        userMinLen: 11,
        userMaxLen: 12
      };
    }
    if (
      id.startsWith('pulsa') ||
      id === 'paketdata' ||
      id === 'ewallet' ||
      id === 'gplay' ||
      id === 'steam' ||
      id === 'psn' ||
      /nomor\s*hp|nomor\s*wa|nomor\s*whatsapp|e-wallet|pulsa/i.test(label)
    ) {
      if (/email/i.test(label)) {
        return {
          userRegex: /^(08\d{8,12}|[^\s@]+@[^\s@]+\.[^\s@]+)$/,
          userErrorMsg: 'Format tidak valid: Masukkan Nomor WA (08xx) atau Email aktif.',
          userMinLen: 8,
          userMaxLen: 40
        };
      }
      return {
        userRegex: /^(08|\+628|628)\d{8,12}$/,
        userErrorMsg: 'Format tidak valid: Nomor wajib diawali 08 / 628 (10–14 digit angka).',
        userMinLen: 10,
        userMaxLen: 14
      };
    }
    if (id === 'ytprem' || id === 'canva') {
      return {
        userRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        userErrorMsg: 'Format tidak valid: Masukkan alamat email aktif (contoh: nama@gmail.com).',
        userMinLen: 6,
        userMaxLen: 45
      };
    }
    if (id === 'netflix' || id === 'spotify' || id === 'vidio') {
      return {
        userRegex: /^(08\d{8,12}|[^\s@]+@[^\s@]+\.[^\s@]+)$/,
        userErrorMsg: 'Format tidak valid: Masukkan Email valid atau Nomor WA (08xxxxxxxx).',
        userMinLen: 6,
        userMaxLen: 45
      };
    }

    return {
      userRegex: prod.hasZoneId ? /^\d{5,15}$/ : /^[a-zA-Z0-9._+#@/:=-]{4,60}$/,
      userErrorMsg: prod.hasZoneId
        ? `Format tidak valid: ${prod.idLabel} wajib 5–15 digit angka.`
        : `Format tidak valid: ${prod.idLabel} minimal 4 karakter.`,
      userMinLen: prod.hasZoneId ? 5 : 4,
      userMaxLen: prod.hasZoneId ? 15 : 40,
      zoneRegex: /^[a-zA-Z0-9_-]{2,15}$/,
      zoneErrorMsg: `Format tidak valid: ${prod.zoneLabel || 'Zone ID'} wajib 2–15 karakter.`,
      zoneMinLen: 2,
      zoneMaxLen: 15
    };
  };

  const checkIsUserIdValid = (prod: Product | null, val: string): boolean => {
    const trimmed = val.trim();
    if (!prod || !trimmed) return false;
    const rule = getProductValidationRule(prod);
    const id = prod.id.toLowerCase();
    const label = prod.idLabel.toLowerCase();

    // 1. PLN Token Listrik & Meter
    if (id === 'pln' || /meter|pelanggan|listrik/i.test(label)) {
      const cleanMeter = trimmed.replace(/[\s.-]/g, '');
      return /^\d{11,12}$/.test(cleanMeter) && !/^0+$/.test(cleanMeter);
    }

    // 2. Pulsa, Paket Data, E-Wallet, Nomor HP
    if (
      id.startsWith('pulsa') ||
      id === 'paketdata' ||
      id === 'ewallet' ||
      /nomor\s*hp|nomor\s*wa|nomor\s*whatsapp|e-wallet|pulsa/i.test(label)
    ) {
      if (/email/i.test(label)) {
        return /^(08\d{8,12}|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(trimmed);
      }
      const cleanPhone = trimmed.replace(/^(\+62|62)/, '0').replace(/[\s.-]/g, '');
      return /^08\d{8,12}$/.test(cleanPhone);
    }

    // 3. Products with Zone ID (MLBB, Genshin, etc.)
    if (prod.hasZoneId) {
      const cleanDigits = trimmed.replace(/[\s.-]/g, '');
      return rule.userRegex.test(trimmed) || rule.userRegex.test(cleanDigits);
    }

    // 4. Numeric Games (FF, PUBG, CODM, HOK, Super Sus)
    if (id === 'ff' || id === 'ffmax' || id === 'pubg' || id === 'codm' || id === 'hok' || id === 'supersus') {
      const cleanNum = trimmed.replace(/[\s.-]/g, '');
      return rule.userRegex.test(trimmed) || rule.userRegex.test(cleanNum);
    }

    return rule.userRegex.test(trimmed);
  };

  const checkIsZoneIdValid = (val: string, prod: Product | null = selectedProduct): boolean => {
    const trimmed = val.trim();
    if (!trimmed) return false;
    const rule = getProductValidationRule(prod);
    const clean = trimmed.replace(/[\s()-]/g, '');
    return (rule.zoneRegex || /^[a-zA-Z0-9_-]{2,15}$/).test(trimmed) || (rule.zoneRegex || /^[a-zA-Z0-9_-]{2,15}$/).test(clean);
  };

  // Real-time Server Authentication for all Game IDs, Phone Numbers, E-Wallets, and PLN Meters
  useEffect(() => {
    if (!selectedProduct) {
      setLiveTargetAuth({ status: 'idle' });
      return;
    }
    const cleanU = userId.trim();
    const cleanZ = zoneId.trim();

    if (!cleanU) {
      setLiveTargetAuth({ status: 'idle' });
      return;
    }

    const isFormatValid = checkIsUserIdValid(selectedProduct, cleanU);
    const isZoneFormatValid = !selectedProduct.hasZoneId || checkIsZoneIdValid(cleanZ, selectedProduct);

    if (!isFormatValid || !isZoneFormatValid) {
      setLiveTargetAuth({
        status: 'invalid',
        message: !isFormatValid
          ? `Format ${selectedProduct.idLabel} belum sesuai.`
          : `Lengkapi ${selectedProduct.zoneLabel || 'Zone ID'} dengan format yang benar.`
      });
      return;
    }

    let cancelled = false;
    setLiveTargetAuth({ status: 'checking' });

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/verify-target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            category: selectedProduct.category,
            idLabel: selectedProduct.idLabel,
            userId: cleanU,
            zoneId: cleanZ,
            hasZoneId: selectedProduct.hasZoneId,
            itemId: selectedProduct.id === 'ewallet' ? selectedItem?.id : undefined
          })
        });
        if (cancelled) return;
        const data = res.ok ? await res.json() : null;
        if (data?.valid && data.level === 'confirmed') {
          setLiveTargetAuth({
            status: 'verified',
            accountName: data.accountName,
            regionOrInfo: data.regionOrInfo,
            provider: data.provider,
            verifiedAt: data.verifiedAt
          });
        } else if (data?.valid) {
          // Format benar, tetapi pemilik akun tidak bisa dikonfirmasi: jangan tampil hijau.
          setLiveTargetAuth({
            status: 'unconfirmed',
            accountName: data.accountName,
            regionOrInfo: data.regionOrInfo,
            provider: data.provider
          });
        } else if (data) {
          setLiveTargetAuth({
            status: 'invalid',
            provider: data.provider,
            message: data.message || 'ID / nomor tujuan belum dapat diverifikasi.'
          });
        } else {
          setLiveTargetAuth({
            status: 'unconfirmed',
            accountName: `ID: ${cleanU}${cleanZ ? ` (${cleanZ})` : ''}`,
            regionOrInfo: 'Pemeriksaan otomatis sedang tidak tersedia. Periksa sendiri ID ini sebelum membayar.',
            provider: 'Pemeriksaan format'
          });
        }
      } catch {
        if (!cancelled) {
          setLiveTargetAuth({
            status: 'unconfirmed',
            accountName: `ID: ${cleanU}${cleanZ ? ` (${cleanZ})` : ''}`,
            regionOrInfo: 'Pemeriksaan otomatis sedang tidak tersedia. Periksa sendiri ID ini sebelum membayar.',
            provider: 'Pemeriksaan format'
          });
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedProduct?.id, selectedProduct?.id === 'ewallet' ? selectedItem?.id : undefined, userId, zoneId]);

  // Real-time friendly diagnostic helper that returns a clean error hint based on the game/product ID format
  const getSpecificUserIdErrorHint = (prod: Product | null, val: string): string => {
    const trimmed = val.trim();
    const rule = getProductValidationRule(prod);
    if (!prod || !trimmed) return rule.userErrorMsg;
    const id = prod.id.toLowerCase();
    const cleanDigits = trimmed.replace(/[\s.-]/g, '');

    if (id === 'mlbb' || id === 'magicchess') {
      if (/[()]/.test(trimmed) || /\s+/.test(trimmed)) {
        return 'Terdeteksi gabungan ID & Server. Silakan pisahkan atau masukkan hanya User ID (6–12 digit).';
      }
      if (!/^\d+$/.test(cleanDigits)) {
        return `User ID ${prod.name} hanya boleh berupa angka (6–12 digit).`;
      }
      if (cleanDigits.length < 6) {
        return `User ID ${prod.name} kurang ${6 - cleanDigits.length} digit lagi (wajib 6–12 digit angka).`;
      }
      if (cleanDigits.length > 12) {
        return `User ID ${prod.name} terlalu panjang (maksimal 12 digit angka).`;
      }
    }

    if (id === 'pubg') {
      if (!/^\d+$/.test(cleanDigits)) {
        return 'Character ID PUBG Mobile wajib berupa angka numerik murni.';
      }
      if (!cleanDigits.startsWith('5')) {
        return 'Character ID PUBG Mobile umumnya diawali angka 5 (contoh: 5182930475).';
      }
      if (cleanDigits.length < 9) {
        return `Character ID PUBG kurang ${9 - cleanDigits.length} digit (wajib 9–12 digit angka).`;
      }
      if (cleanDigits.length > 12) {
        return 'Character ID PUBG terlalu panjang (maksimal 12 digit angka).';
      }
    }

    if (id === 'ff' || id === 'ffmax') {
      if (!/^\d+$/.test(cleanDigits)) {
        return 'Player ID Free Fire wajib berupa angka 0–9 tanpa huruf.';
      }
      if (cleanDigits.length < 8) {
        return `Player ID Free Fire kurang ${8 - cleanDigits.length} digit lagi (wajib 8–12 digit angka).`;
      }
    }

    if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
      if (!/^\d+$/.test(cleanDigits)) {
        return `UID ${prod.name} wajib berupa angka murni (9–10 digit).`;
      }
      if (cleanDigits.startsWith('0')) {
        return `UID tidak boleh diawali angka 0 (Server Asia umumnya diawali angka 8).`;
      }
      if (cleanDigits.length < 9) {
        return `UID kurang ${9 - cleanDigits.length} digit (wajib 9–10 digit angka).`;
      }
    }

    if (id === 'valorant') {
      if (!trimmed.includes('#')) {
        return 'Wajib menyertakan tanda "#" diikuti Tagline (contoh: Player#IDN).';
      }
      const [riotName, riotTag] = trimmed.split('#');
      if (!riotName || riotName.length < 3) {
        return 'Username Riot sebelum tanda "#" minimal 3 karakter.';
      }
      if (!riotTag || !/^[a-zA-Z0-9]{2,6}$/.test(riotTag)) {
        return 'Tagline setelah tanda "#" wajib 2–6 huruf/angka (contoh: #IDN atau #SEA).';
      }
    }

    if (id === 'pln') {
      if (!/^\d+$/.test(cleanDigits)) {
        return 'Nomor Meter / ID Pelanggan PLN hanya boleh berisi angka murni.';
      }
      if (cleanDigits.length < 11) {
        return `Nomor Meter PLN kurang ${11 - cleanDigits.length} digit (wajib 11–12 digit angka).`;
      }
      if (cleanDigits.length > 12) {
        return 'Nomor Meter PLN maksimal 12 digit angka.';
      }
    }

    if (id === 'pulsa' || id === 'paketdata' || id === 'ewallet') {
      const cleanPhone = trimmed.replace(/^(\+62|62)/, '0').replace(/[\s.-]/g, '');
      if (!/^08\d+$/.test(cleanPhone)) {
        return 'Nomor telepon seluler wajib diawali 08 (contoh: 081234567890).';
      }
      if (cleanPhone.length < 10) {
        return `Nomor HP kurang ${10 - cleanPhone.length} digit lagi (minimal 10 digit).`;
      }
      if (cleanPhone.length > 14) {
        return 'Nomor HP maksimal 14 digit angka.';
      }
    }

    return rule.userErrorMsg;
  };

  const getSpecificZoneIdErrorHint = (prod: Product | null, val: string): string => {
    const trimmed = val.trim();
    const rule = getProductValidationRule(prod);
    if (!prod || !trimmed) return rule.zoneErrorMsg || 'Format Server / Zone ID tidak valid.';
    const id = prod.id.toLowerCase();
    const cleanDigits = trimmed.replace(/[\s()-]/g, '');

    if (id === 'mlbb' || id === 'magicchess') {
      if (!/^\d+$/.test(cleanDigits)) {
        return `Zone ID ${prod.name} hanya boleh berisi angka (3–6 digit, contoh: 2198).`;
      }
      if (cleanDigits.length < 3) {
        return `Zone ID ${prod.name} kurang ${3 - cleanDigits.length} digit (wajib 3–6 digit angka).`;
      }
      if (cleanDigits.length > 6) {
        return `Zone ID ${prod.name} maksimal 6 digit angka.`;
      }
    }

    if (id === 'genshin' || id === 'hsr' || id === 'zzz') {
      return 'Ketik nama Server resmi seperti "Asia", "America", "Europe", atau "TW/HK/MO".';
    }

    return rule.zoneErrorMsg || 'Format Server / Zone ID tidak valid.';
  };

  // Cart & Auth State
  const [cart, setCart] = useState<CartItem[]>(() => loadCartItems());
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<MemberUser | null>(() => loadSessionUser());
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Per-product form draft storage
  const draftsRef = useRef<Record<string, DraftData>>({});
  const checkoutSectionRef = useRef<HTMLElement | null>(null);
  const userIdInputRef = useRef<HTMLInputElement | null>(null);
  const zoneIdInputRef = useRef<HTMLInputElement | null>(null);
  const waInputRef = useRef<HTMLInputElement | null>(null);

  // Modals & Toasts
  const [trackerOpen, setTrackerOpen] = useState<boolean>(false);
  const [trackerActiveTab, setTrackerActiveTab] = useState<'track' | 'history'>('track');
  const [trackerInput, setTrackerInput] = useState<string>(() => {
    try {
      return localStorage.getItem('cahyostore_last_tracked_id') || '';
    } catch {
      return '';
    }
  });
  const [trackerResult, setTrackerResult] = useState<{
    found: boolean;
    data?: StoredTransaction;
  } | null>(null);

  const [confirmOrder, setConfirmOrder] = useState<OrderSnapshot | null>(null);
  const [serverOrderReady, setServerOrderReady] = useState<boolean>(false);
  const [qrisDisplayOrder, setQrisDisplayOrder] = useState<{ orderId: string; totalAmount: number } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(CHECKOUT_EXPIRY_SECONDS);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState<boolean>(false);
  const [showConfirmReceiptPreview, setShowConfirmReceiptPreview] = useState<boolean>(false);
  const [copiedConfirmNmid, setCopiedConfirmNmid] = useState<boolean>(false);
  const [showConfirmNmidTooltip, setShowConfirmNmidTooltip] = useState<boolean>(false);
  // QRIS GoPay Merchant on this account is static. The browser cannot detect payment,
  // lock a real payment scan, or infer settlement. Only the admin server action can verify it.
  const confirmQrisLocked = false;
  const handleRestartConfirmQrisScan = () => {
    showToast('Website tidak dapat mendeteksi pembayaran QRIS statis. Periksa transaksi di aplikasi GoPay Merchant.', 'info');
  };

  const handleDownloadHighResQrisPng = (orderId?: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = 3;
      const width = (img.naturalWidth || 680) * scale;
      const height = (img.naturalHeight || 960) * scale;
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
              showToast('Gambar QRIS Resolusi Tinggi (PNG) berhasil diunduh!', 'success');
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
      link.download = `QRIS-CAHYO-STORE-${orderId || 'OFFICIAL'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Gambar QRIS berhasil diunduh!', 'success');
    };
    img.src = CAHYO_QRIS_DATA_URL;
  };
  const [autoPaymentState, setAutoPaymentState] = useState<{
    status: 'waiting' | 'verified';
    label: string;
    verifiedAt?: string;
    gatewayRef?: string;
    message?: string;
  }>({
    status: 'waiting',
    label: 'Menunggu Pembayaran'
  });

  // Countdown timer anchored to the transaction timestamp (confirmOrder.createdAtMs)
  useEffect(() => {
    if (!confirmOrder) {
      setRemainingSeconds(CHECKOUT_EXPIRY_SECONDS);
      setAutoPaymentState({
        status: 'waiting',
        label: 'Menunggu Pembayaran'
      });
      return;
    }

    const updateTimer = () => {
      const elapsedSec = Math.floor((Date.now() - confirmOrder.createdAtMs) / 1000);
      const left = Math.max(0, CHECKOUT_EXPIRY_SECONDS - elapsedSec);
      setRemainingSeconds(left);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [confirmOrder]);

  // Payment state is read only from the server-side order record. For this GoPay Merchant
  // account there is no API/webhook yet, so manual admin confirmation is required.
  useEffect(() => {
    if (!confirmOrder) return;

    let cancelled = false;
    let pollInFlight = false;
    const uniqueCode = confirmOrder.uniqueCode || 0;
    const total = confirmOrder.item.price + confirmOrder.payment.fee + uniqueCode;
    const initialTx: StoredTransaction = {
      id: confirmOrder.orderId,
      product: confirmOrder.product.name,
      item: confirmOrder.item.name,
      productId: confirmOrder.product.id,
      itemId: confirmOrder.item.id,
      paymentId: confirmOrder.payment.id,
      target: `${confirmOrder.userId} ${confirmOrder.zoneId ? '(' + confirmOrder.zoneId + ')' : ''}`,
      status: 'Menunggu Pembayaran',
      total: `Rp ${total.toLocaleString('id-ID')}`,
      uniqueCode,
      payment: confirmOrder.payment.name,
      whatsapp: confirmOrder.wa,
      email: confirmOrder.email,
      memberName: currentUser ? currentUser.name : 'Guest',
      memberId: currentUser ? currentUser.id : '',
      createdAt: new Date().toLocaleString('id-ID')
    };

    setAutoPaymentState({
      status: 'waiting',
      label: 'Menunggu Pembayaran',
      message: 'GoPay Merchant belum terhubung ke webhook website. Pembayaran perlu diperiksa admin di aplikasi merchant.'
    });

    // Do not persist an invoice locally before the server accepts it.
    // Local browser storage is not proof that an order exists or was paid.
    setDashboardOrderId(confirmOrder.orderId);
    setServerOrderReady(false);
    setDashboardTrackedOrder({ found: false, searchedId: confirmOrder.orderId });

    const syncOrder = async () => {
      if (cancelled || pollInFlight) return;
      pollInFlight = true;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(confirmOrder.orderId)}`, {
          cache: 'no-store'
        });
        if (!res.ok) {
          if (res.status === 404) {
            // Create the server order once if the customer has opened checkout from an older local session.
            const createRes = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(initialTx)
            });
            const createData = await createRes.json().catch(() => null);
            const created = createData?.order;
            if (!createRes.ok || created?.id !== confirmOrder.orderId || cancelled) {
              setServerOrderReady(false);
              setAutoPaymentState({
                status: 'waiting',
                label: 'Menunggu Pembayaran',
                message: 'Pesanan belum tersimpan di server. Jangan membayar sampai ID pesanan tercatat.'
              });
              return;
            }
            setServerOrderReady(true);
          }
          return;
        }
        const json = await res.json();
        const order = json?.order;
        if (!order || order.id !== confirmOrder.orderId || cancelled) {
          setServerOrderReady(false);
          return;
        }
        setServerOrderReady(true);
        const isVerified = order.paymentStatus === 'verified';
        const syncedTx: StoredTransaction = { ...initialTx, ...order };
        try {
          localStorage.setItem(confirmOrder.orderId, JSON.stringify(syncedTx));
          refreshPastOrdersFromStorage();
        } catch {}
        setDashboardTrackedOrder({ found: true, searchedId: confirmOrder.orderId, data: syncedTx });
        if (isVerified) {
          setAutoPaymentState({
            status: 'verified',
            label: 'Pembayaran Terverifikasi',
            verifiedAt: order.verifiedAt ? new Date(order.verifiedAt).toLocaleTimeString('id-ID') + ' WIB' : undefined,
            message: 'Admin telah mengonfirmasi pembayaran berdasarkan riwayat GoPay Merchant.'
          });
        } else {
          setAutoPaymentState({
            status: 'waiting',
            label: 'Menunggu Pembayaran',
            message: 'Belum ada konfirmasi pembayaran yang sah. Admin memeriksa transaksi melalui aplikasi GoPay Merchant.'
          });
        }
      } catch {
        if (!cancelled) {
          setAutoPaymentState({
            status: 'waiting',
            label: 'Menunggu Pembayaran',
            message: 'Server belum dapat dihubungi. Status pembayaran belum terverifikasi.'
          });
        }
      } finally {
        pollInFlight = false;
      }
    };

    // Create order with a pending status; never trust browser elapsed time as payment proof.
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialTx)
    }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.order?.id !== confirmOrder.orderId) throw new Error('Order save failed');
      if (!cancelled) setServerOrderReady(true);
      void syncOrder();
    }).catch(() => {
      if (!cancelled) setServerOrderReady(false);
      if (!cancelled) setAutoPaymentState({
        status: 'waiting',
        label: 'Menunggu Pembayaran',
        message: 'Server gagal menyimpan pesanan. Status pembayaran tidak dapat diverifikasi.'
      });
    });

    const pollInterval = window.setInterval(() => void syncOrder(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
    };
  }, [confirmOrder?.orderId]);

  const formatCountdown = (totalSec: number): string => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleRefreshCheckoutTimer = () => {
    if (!confirmOrder) return;
    const nowMs = Date.now();
    const startStr =
      new Date(nowMs).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';
    const expStr =
      new Date(nowMs + CHECKOUT_EXPIRY_SECONDS * 1000).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';

    setConfirmOrder({
      ...confirmOrder,
      createdAtMs: nowMs,
      createdAtFormatted: startStr,
      expiresAtFormatted: expStr
    });
    setRemainingSeconds(CHECKOUT_EXPIRY_SECONDS);
    showToast('Batas waktu QR pembayaran diperbarui 2 menit!', 'info');
  };
  const [qrisModalOpen, setQrisModalOpen] = useState<boolean>(false);
  const [showAllTestimonials, setShowAllTestimonials] = useState<boolean>(false);
  const [completedReceipt, setCompletedReceipt] = useState<CompletedOrderReceipt | null>(null);

  // Widget AI dimuat saat browser sedang santai; modal struk & QRIS baru dimuat saat pertama dibutuhkan.
  const [aiWidgetReady, setAiWidgetReady] = useState<boolean>(false);
  const [receiptModalMounted, setReceiptModalMounted] = useState<boolean>(false);
  const [qrisModalMounted, setQrisModalMounted] = useState<boolean>(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const start = () => setAiWidgetReady(true);
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(start, { timeout: 4000 });
      return () => {
        (window as Window & { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(start, 2500);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (completedReceipt) setReceiptModalMounted(true);
  }, [completedReceipt]);
  useEffect(() => {
    if (qrisModalOpen) setQrisModalMounted(true);
  }, [qrisModalOpen]);

  const getPaymentInstructionText = (pay: PaymentMethod): string => {
    const id = pay.id.toLowerCase();
    if (id === 'qris') {
      return 'Scan QRIS statis resmi CAHYO STORE melalui aplikasi pembayaran Anda dan masukkan nominal tepat sesuai total tagihan. Pembayaran tidak terverifikasi otomatis; pesanan baru diproses setelah Author memeriksa transaksi di GoPay Merchant.';
    }
    if (['gopay', 'dana', 'ovo', 'shopeepay'].includes(id)) {
      return `Transfer melalui ${pay.name} ke nomor HP: 082228307663. Pastikan nama penerima yang muncul di aplikasi cocok sebelum menyelesaikan transfer. Masukkan nominal tepat sesuai total tagihan.`;
    }
    if (id === 'seabank') {
      return 'Transfer melalui SeaBank ke rekening: 901964227508. Pastikan nama penerima yang muncul di aplikasi cocok sebelum menyelesaikan transfer. Masukkan nominal tepat sesuai total invoice.';
    }
    if (['bca_va', 'bri_va', 'mandiri_va', 'bni_va', 'bca', 'bri', 'mandiri', 'bni'].includes(id)) {
      return 'Virtual Account bank masih dalam pemeliharaan. Silakan pilih QRIS atau salah satu metode transfer manual yang tersedia.';
    }
    return `Ikuti panduan pembayaran ${pay.name}. Pembayaran diperiksa manual oleh Author; status pesanan tidak berubah menjadi lunas secara otomatis.`;
  };
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentActivityItem[]>(() => loadRecentActivities());

  // Sync logged-in user's WhatsApp and Email into form automatically if empty
  useEffect(() => {
    if (currentUser) {
      if (currentUser.whatsapp && !whatsappNumber) {
        setWhatsappNumber(currentUser.whatsapp);
      }
      if (currentUser.email && !buyerEmail) {
        setBuyerEmail(currentUser.email);
      }
    }
  }, [currentUser]);

  const recordRecentActivity = (
    productId: string,
    actionType: 'viewed' | 'searched' | 'ordered',
    detail?: string
  ) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((item) => item.productId !== productId);
      const updated: RecentActivityItem[] = [
        {
          productId,
          actionType,
          detail,
          timestamp: Date.now()
        },
        ...filtered
      ].slice(0, 3);
      saveRecentActivities(updated);
      return updated;
    });
  };

  const handleClearRecent = () => {
    setRecentItems([]);
    saveRecentActivities([]);
    showToast('Riwayat pencarian & tampilan dihapus', 'info');
  };

  // Track searched items in localStorage after a brief debounce
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (q.length < 2) return;

    const timer = setTimeout(() => {
      const matched = products.find(
        (p) => p.name.toLowerCase().includes(q) || p.publisher.toLowerCase().includes(q)
      );
      if (matched) {
        recordRecentActivity(matched.id, 'searched', `Dicari: "${searchQuery.trim()}"`);
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [searchQuery, products]);

  // Resolve live product images (App Store / Wikipedia / HD Artwork fallback)
  useEffect(() => {
    const updateProductImg = (id: string, url: string, fit: 'cover' | 'contain') => {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, image: url, imageFit: fit } : p))
      );
      setSelectedProduct((prev) =>
        prev && prev.id === id ? { ...prev, image: url, imageFit: fit } : prev
      );
    };

    INITIAL_PRODUCTS_DATA.forEach((prod) => {
      resolveLiveProductImage(prod, updateProductImg);
    });

    const interval = setInterval(() => {
      INITIAL_PRODUCTS_DATA.forEach((prod) => {
        resolveLiveProductImage(prod, updateProductImg);
      });
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const showToast = React.useCallback(
    (message: string, type: 'info' | 'error' | 'success' = 'info') => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      window.setTimeout(() => {
        setToasts((prev) => [...prev, { id, message, type }]);
      }, 0);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const handleGlobalLogout = async () => {
    try {
      const memberToken = typeof localStorage !== 'undefined' ? localStorage.getItem('cahyo_member_session_v1') : null;
      const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('cahyo_admin_token_v1') : null;
      const headers: Record<string, string> = {};
      if (memberToken) headers['Authorization'] = `Bearer ${memberToken}`;
      if (adminToken) headers['x-admin-token'] = adminToken;

      await fetch('/api/users/logout', { method: 'POST', headers, credentials: 'same-origin' }).catch(() => {});
      await fetch('/api/admin/logout', { method: 'POST', headers, credentials: 'same-origin' }).catch(() => {});
    } finally {
      try {
        localStorage.removeItem('cahyo_member_session_v1');
        localStorage.removeItem('cahyo_admin_token_v1');
      } catch {}
      saveSessionUser(null);
      setCurrentUser(null);
      showToast('Anda telah berhasil keluar dari akun (Logout).', 'info');
    }
  };

  // Auto-restore shared cart from ?cart= URL parameter
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const cartParam = params.get('cart');
      if (cartParam) {
        const decoded = decodeCartFromUrl(cartParam);
        if (decoded && decoded.length > 0) {
          const hydrated = hydrateCartFromCompact(decoded, products);
          if (hydrated.length > 0) {
            setCart(hydrated);
            saveCartItems(hydrated);
            setCartOpen(true);
            showToast(`Berhasil memuat ${hydrated.length} item dari link Troli yang dibagikan!`, 'success');
            const cleanUrl = window.location.pathname + (window.location.hash || '');
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      }
    } catch {}
  }, [products, showToast]);

  const getStartingPrice = (prod: Product): number => {
    if (!prod.items || prod.items.length === 0) return 0;
    return Math.min(...prod.items.map((item) => item.price));
  };

  // Filtered & sorted products (Real-Time Search Filtering across Product Name, Publisher, Category, ID, and Item Nominals)
  const categorySearchKeywords: Record<string, string> = {
    game: 'game mobile diamond uc genesis crystal',
    pcgame: 'game pc konsol steam valorant point blank',
    streaming: 'streaming app pro netflix youtube spotify canva vidio',
    sosmed: 'sosmed tiktok koin',
    digital: 'pulsa kuota paket data telkomsel indosat xl tri smartfren',
    voucher: 'voucher google play psn steam',
    ewallet: 'ewallet saldo dana ovo gopay shopeepay',
    pln: 'listrik pln token'
  };

  const matchesSearchQuery = (prod: Product, rawQuery: string): boolean => {
    const q = rawQuery.toLowerCase().trim();
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const searchableCorpus = [
      prod.name,
      prod.publisher,
      prod.id,
      prod.category,
      categorySearchKeywords[prod.category] || '',
      ...prod.items.map((item) => item.name)
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((tok) => searchableCorpus.includes(tok));
  };

  // Count matching products per category for real-time category tab badges
  const [selectedTag, setSelectedTag] = useState<'all' | 'best-seller' | 'new-arrival' | 'promo'>('all');

  const getProductTags = (prodId: string): ('best-seller' | 'new-arrival' | 'promo')[] => {
    const id = prodId.toLowerCase();
    const tags: ('best-seller' | 'new-arrival' | 'promo')[] = [];

    // Best Seller items
    if (
      [
        'mlbb',
        'ff',
        'pubg',
        'roblox',
        'valorant',
        'pointblank',
        'netflix',
        'pulsa',
        'pln',
        'ewallet',
        'tiktok'
      ].includes(id)
    ) {
      tags.push('best-seller');
    }

    // New Arrival items
    if (
      [
        'hok',
        'zzz',
        'hsr',
        'fcmobile',
        'efootball',
        'supersus',
        'canva',
        'vidio',
        'igofficial'
      ].includes(id) ||
      !INITIAL_PRODUCTS_DATA.some((p) => p.id === prodId)
    ) {
      tags.push('new-arrival');
    }

    // Promo items
    if (
      [
        'mlbb',
        'ff',
        'genshin',
        'pointblank',
        'steam',
        'psn',
        'netflix',
        'spotify',
        'ytprem',
        'paketdata',
        'gplay',
        'codm'
      ].includes(id)
    ) {
      tags.push('promo');
    }

    if (tags.length === 0) {
      tags.push('promo');
    }
    return tags;
  };

  const matchesActiveTag = (prod: Product, tag: 'all' | 'best-seller' | 'new-arrival' | 'promo'): boolean => {
    if (tag === 'all') return true;
    return getProductTags(prod.id).includes(tag);
  };

  const tagMatchCounts = React.useMemo(() => {
    const counts: Record<'all' | 'best-seller' | 'new-arrival' | 'promo', number> = {
      all: 0,
      'best-seller': 0,
      'new-arrival': 0,
      promo: 0
    };
    for (const prod of products) {
      const matchesCat = currentCategory === 'all' || prod.category === currentCategory;
      if (matchesCat && matchesSearchQuery(prod, searchQuery)) {
        counts.all += 1;
        const pTags = getProductTags(prod.id);
        for (const t of pTags) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }
    return counts;
  }, [products, currentCategory, searchQuery]);

  const categoryMatchCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const prod of products) {
      if (matchesSearchQuery(prod, searchQuery) && matchesActiveTag(prod, selectedTag)) {
        counts.all = (counts.all || 0) + 1;
        counts[prod.category] = (counts[prod.category] || 0) + 1;
      }
    }
    return counts;
  }, [products, searchQuery, selectedTag]);

  const filteredProducts = products
    .filter((prod) => {
      const matchesCat = currentCategory === 'all' || prod.category === currentCategory;
      return (
        matchesCat &&
        matchesActiveTag(prod, selectedTag) &&
        matchesSearchQuery(prod, searchQuery)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') {
        return getStartingPrice(a) - getStartingPrice(b);
      }
      if (sortBy === 'price-desc') {
        return getStartingPrice(b) - getStartingPrice(a);
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name, 'id');
      }
      return 0;
    });

  // Save current product's draft
  const saveCurrentDraft = () => {
    if (!selectedProduct) return;
    draftsRef.current[selectedProduct.id] = {
      userId,
      zoneId,
      itemId: selectedItem ? selectedItem.id : null,
      payId: selectedPayment ? selectedPayment.id : null
    };
  };

  const handleCategoryChange = (newCategory: string) => {
    if (newCategory === currentCategory) return;
    triggerTopProgress();
    setCurrentCategory(newCategory);

    // Fix bug where selected product (e.g. Free Fire) stays open/overlapped when switching to another category
    if (selectedProduct && newCategory !== 'all' && selectedProduct.category !== newCategory) {
      saveCurrentDraft();
      setSelectedProduct(null);
      setSelectedItem(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    triggerTopProgress();
    // Auto-expand to matching category or 'all' when typing if current category has 0 matches
    if (value.trim() && currentCategory !== 'all') {
      const hasMatchInCurrent = products.some(
        (p) => p.category === currentCategory && matchesSearchQuery(p, value)
      );
      if (!hasMatchInCurrent) {
        const anyMatch = products.some((p) => matchesSearchQuery(p, value));
        if (anyMatch) {
          setCurrentCategory('all');
        }
      }
    }
  };

  // Dedicated Dashboard Order Tracker State & Real-Time ETA Estimator (Real Customer Orders Only)
  const [dashboardOrderId, setDashboardOrderId] = useState<string>(() => {
    try {
      return localStorage.getItem('cahyostore_last_tracked_id') || '';
    } catch {
      return '';
    }
  });
  const [dashboardTrackedOrder, setDashboardTrackedOrder] = useState<{
    found: boolean;
    searchedId: string;
    data?: StoredTransaction;
  } | null>(null);
  const [dashboardTrackingLoading, setDashboardTrackingLoading] = useState<boolean>(false);

  // Riwayat Transaksi (Past Orders fetched from localStorage)
  const [pastOrdersHistory, setPastOrdersHistory] = useState<StoredTransaction[]>([]);

  const refreshPastOrdersFromStorage = () => {
    try {
      // Purge legacy test orders reported by user
      try {
        localStorage.removeItem('CS-826467');
        localStorage.removeItem('CS-357185');
      } catch {}

      const found: StoredTransaction[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && /^CS-[A-Z0-9-]{5,40}$/i.test(key)) {
          if (key === 'CS-826467' || key === 'CS-357185') continue;
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as StoredTransaction;
              if (parsed && parsed.id && parsed.product) {
                found.push({
                  ...parsed,
                  status: parsed.status || 'Status belum diverifikasi server',
                  paymentStatus: parsed.paymentStatus || 'pending',
                  fulfillmentStatus: parsed.fulfillmentStatus || 'pending'
                } as StoredTransaction);
              }
            } catch {
              // ignore malformed record
            }
          }
        }
      }
      setPastOrdersHistory(found.reverse());
    } catch {
      // ignore storage errors
    }
  };

  const handleDeleteSinglePastOrder = async (orderId: string) => {
    try {
      localStorage.removeItem(orderId);
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('cahyostore_author_token_v1') : null;
      if (token) {
        await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch {}
    refreshPastOrdersFromStorage();
    showToast(`Pesanan #${orderId} berhasil dihapus dari riwayat perangkat.`, 'success');
  };

  const handleClearOrderHistory = async () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && /^CS-[A-Z0-9-]{5,40}$/i.test(key)) {
          localStorage.removeItem(key);
        }
      }
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('cahyostore_author_token_v1') : null;
      if (token) {
        await fetch('/api/orders', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch {}
    setPastOrdersHistory([]);
    showToast('Seluruh riwayat pesanan di perangkat ini berhasil dibersihkan!', 'success');
  };

  const handleReorderPastTransaction = (tx: StoredTransaction) => {
    // Find matching product by name or ID
    const matchedProd =
      products.find(
        (p) =>
          p.name.toLowerCase() === (tx.product || '').toLowerCase() ||
          (tx.product || '').toLowerCase().includes(p.name.toLowerCase())
      ) || products[0];

    if (!matchedProd) return;

    saveCurrentDraft();
    setSelectedProduct(matchedProd);

    // Match item by name
    const cleanItemName = (tx.item || '').replace(/\s*x\d+$/i, '').trim().toLowerCase();
    const matchedItem =
      matchedProd.items.find(
        (it) =>
          it.name.toLowerCase() === cleanItemName ||
          (tx.item || '').toLowerCase().includes(it.name.toLowerCase())
      ) ||
      matchedProd.items[0] ||
      null;
    setSelectedItem(matchedItem);

    // Parse target user ID and zone ID if formatted like "12345678 (1234)"
    const rawTarget = (tx.target || '').trim();
    const zoneMatch = rawTarget.match(/^([^\s(]+)\s*\(([^)]+)\)$/);
    if (matchedProd.hasZoneId && zoneMatch) {
      setUserId(zoneMatch[1].trim());
      setZoneId(zoneMatch[2].trim());
    } else if (rawTarget && !rawTarget.includes('Multi-Target')) {
      setUserId(rawTarget);
      setZoneId('');
    }

    // Match payment method
    const matchedPay =
      PAYMENT_METHODS.find(
        (pm) =>
          tx.payment &&
          (pm.name.toLowerCase() === tx.payment.toLowerCase() ||
            tx.payment.toLowerCase().includes(pm.id.toLowerCase()))
      ) ||
      PAYMENT_METHODS.find((m) => m.fee === 0) ||
      PAYMENT_METHODS[0] ||
      null;
    setSelectedPayment(matchedPay);

    if (tx.whatsapp) {
      setWhatsappNumber(tx.whatsapp);
    }

    setTrackerOpen(false);

    showToast(
      `Siap Pesan Ulang: ${matchedProd.name}${matchedItem ? ` — ${matchedItem.name}` : ''}!`,
      'success'
    );

    setTimeout(() => {
      checkoutSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const getOrderEtaDetails = (statusText: string) => {
    const mapped = mapStatusToStageIndex(statusText);
    const stageIdx = mapped.stageIndex;
    if (stageIdx >= 3) {
      return {
        stageIdx: 3,
        badgeLabel: 'PESANAN DITANDAI TERKIRIM',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
        etaTime: 'Status terakhir: selesai',
        etaSubtext: 'Admin menandai pesanan sebagai terkirim. Periksa akun tujuan untuk memastikan produk diterima.',
        progressPct: 100
      };
    }
    if (stageIdx === 2) {
      return {
        stageIdx: 2,
        badgeLabel: 'ANTREAN PENGIRIMAN MANUAL',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
        etaTime: 'Menunggu admin mengirim',
        etaSubtext: 'Pembayaran sudah dikonfirmasi admin. Pesanan menunggu pengiriman manual ke ID tujuan Anda.',
        progressPct: 76
      };
    }
    if (stageIdx === 1) {
      return {
        stageIdx: 1,
        badgeLabel: 'PEMBAYARAN DIKONFIRMASI ADMIN',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
        etaTime: 'Menunggu antrean pengiriman',
        etaSubtext: 'Status pembayaran dicatat setelah admin memeriksa transaksi di aplikasi GoPay Merchant.',
        progressPct: 48
      };
    }
    return {
      stageIdx: 0,
      badgeLabel: 'MENUNGGU VERIFIKASI PEMBAYARAN',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      etaTime: 'Estimasi Tiba: 1 – 3 Menit Setelah Pembayaran',
      etaSubtext: 'Selesaikan pembayaran sesuai nominal. Admin akan mencocokkan transaksi di aplikasi GoPay Merchant sebelum pengiriman.',
      progressPct: 22
    };
  };

  const handleTrackDashboardOrder = async (customOrderId?: string) => {
    const rawId = (customOrderId !== undefined ? customOrderId : dashboardOrderId).trim().toUpperCase();
    if (customOrderId !== undefined) {
      setDashboardOrderId(rawId);
    }
    if (!rawId) {
      showToast('Masukkan ID Pesanan Anda terlebih dahulu untuk melacak status!', 'error');
      return;
    }

    setDashboardTrackingLoading(true);
    triggerTopProgress();

    // 1. Check Backend API
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(rawId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.order) {
          setDashboardTrackedOrder({
            found: true,
            searchedId: rawId,
            data: json.order as StoredTransaction
          });
          setDashboardTrackingLoading(false);
          return;
        }
      }
    } catch {
      // Server is the source of truth; local browser data cannot prove payment or delivery.
    }

    setDashboardTrackedOrder({
      found: false,
      searchedId: rawId
    });
    setDashboardTrackingLoading(false);
  };

  // Auto-load the customer's latest real order from localStorage if available
  useEffect(() => {
    refreshPastOrdersFromStorage();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && /^CS-[A-Z0-9-]{5,40}$/i.test(key)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as StoredTransaction;
            if (parsed && parsed.id && parsed.product) {
              setDashboardOrderId(parsed.id);
              setDashboardTrackedOrder({
                found: false,
                searchedId: parsed.id
              });
              break;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectProduct = (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    // 1. Instant tactile vibration & audio feedback so the customer immediately feels the click
    playCheckoutClickDing();
    triggerValidIdHaptic([24, 38, 22]);
    showToast(`🎮 ${prod.name} dipilih! Menampilkan formulir pemesanan...`, 'info');

    if (selectedProduct && selectedProduct.id === prodId) {
      const el = document.getElementById('checkout-section') || checkoutSectionRef.current;
      if (el) {
        const topPos = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
      }
      return;
    }

    saveCurrentDraft();
    recordRecentActivity(prod.id, 'viewed', 'Baru saja dilihat');

    // 2. If current category does not match selected product, reset to 'all' so the card is visible
    if (currentCategory !== 'all' && currentCategory !== prod.category) {
      setCurrentCategory('all');
    }

    const draft = draftsRef.current[prod.id];
    setSelectedProduct(prod);
    setIsAiInputLocked(false);
    setAutoFillCopiedTooltip(false);
    setUserId(draft ? draft.userId : '');
    setZoneId(draft ? draft.zoneId : '');
    setSelectedItem(
      draft && draft.itemId
        ? prod.items.find((i) => i.id === draft.itemId) || prod.items[0]
        : prod.items[0] || null
    );
    setSelectedPayment(
      draft && draft.payId
        ? PAYMENT_METHODS.find((p) => p.id === draft.payId) || PAYMENT_METHODS[0]
        : selectedPayment || PAYMENT_METHODS[0]
    );

    setTimeout(() => {
      const target = document.getElementById('checkout-section') || checkoutSectionRef.current;
      if (target) {
        const topPos = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
      }
    }, 60);
  };

  const handleApplyAiRecommendation = (prodId: string, itemId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    saveCurrentDraft();
    setSelectedProduct(prod);
    const matchedItem = prod.items.find((i) => i.id === itemId) || prod.items[0] || null;
    setSelectedItem(matchedItem);
    const defaultPay = PAYMENT_METHODS.find((m) => m.fee === 0) || PAYMENT_METHODS[0] || null;
    if (!selectedPayment) {
      setSelectedPayment(defaultPay);
    }

    recordRecentActivity(prod.id, 'viewed', `AI Pick • ${matchedItem?.name || prod.publisher}`);

    setTimeout(() => {
      checkoutSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 90);
  };

  const handleCloseCheckout = () => {
    saveCurrentDraft();
    setSelectedProduct(null);
  };

  // Add to Cart handler
  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const cleanUserId = userId.trim();
    const cleanZoneId = zoneId.trim();
    const validUser = checkIsUserIdValid(selectedProduct, cleanUserId);
    const validZone = !selectedProduct.hasZoneId || checkIsZoneIdValid(cleanZoneId);

    if (!cleanUserId || !validUser) {
      triggerUserIdShake();
      if (selectedProduct.hasZoneId && (!cleanZoneId || !validZone)) {
        triggerZoneIdShake();
      }
      showToast(
        !cleanUserId
          ? 'Mohon isi User ID / Nomor Tujuan sebelum masuk troli!'
          : `Format ${selectedProduct.idLabel} belum valid!`,
        'error'
      );
      userIdInputRef.current?.focus();
      return;
    }

    if (selectedProduct.hasZoneId && (!cleanZoneId || !validZone)) {
      triggerZoneIdShake();
      showToast(
        !cleanZoneId
          ? 'Mohon isi Server / Zone ID!'
          : `Format ${selectedProduct.zoneLabel} belum valid!`,
        'error'
      );
      zoneIdInputRef.current?.focus();
      return;
    }

    if (!selectedItem) {
      showToast('Pilih nominal item terlebih dahulu!', 'error');
      return;
    }

    if (liveTargetAuth.status !== 'verified') {
      if (selectedProduct.id === 'ewallet' && liveTargetAuth.status === 'unconfirmed') {
        const manualConfirmed = window.confirm('Nama penerima belum dapat dipastikan oleh layanan online. Periksa nama dan nomor tujuan langsung di aplikasi e-wallet sebelum lanjut. Apakah kamu sudah mencocokkannya?');
        if (!manualConfirmed) {
          triggerUserIdShake();
          userIdInputRef.current?.focus();
          return;
        }
      } else {
        triggerUserIdShake();
        const message = liveTargetAuth.status === 'checking'
          ? 'Pemeriksaan ID masih berlangsung. Tunggu sampai selesai sebelum melanjutkan.'
          : liveTargetAuth.status === 'invalid'
            ? `${selectedProduct.idLabel} tidak ditemukan atau tidak valid.`
            : 'Tujuan belum dikonfirmasi oleh penyedia online. Pesanan diblokir untuk mencegah salah kirim.';
        showToast(message, 'error');
        userIdInputRef.current?.focus();
        return;
      }
    }

    const key = `${selectedProduct.id}-${selectedItem.id}-${cleanUserId}-${cleanZoneId}`;
    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.cartItemId === key);
      let updated: CartItem[];
      if (existingIndex > -1) {
        updated = prev.map((c, idx) =>
          idx === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
        );
      } else {
        updated = [
          ...prev,
          {
            cartItemId: key,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productImage: selectedProduct.image,
            productImageFit: selectedProduct.imageFit,
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            price: selectedItem.price,
            quantity: 1,
            userId: cleanUserId,
            zoneId: cleanZoneId || undefined
          }
        ];
      }
      saveCartItems(updated);
      return updated;
    });

    showToast(`${selectedProduct.name} (${selectedItem.name}) ditambahkan ke Troli!`, 'success');
  };

  const handleUpdateCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev
        .map((c) => (c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0);
      saveCartItems(updated);
      return updated;
    });
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => {
      const updated = prev.filter((c) => c.cartItemId !== cartItemId);
      saveCartItems(updated);
      return updated;
    });
    showToast('Item dihapus dari troli', 'info');
  };

  const handleClearCart = () => {
    setCart([]);
    saveCartItems([]);
    showToast('Troli dikosongkan', 'info');
  };

  const handleCheckoutCart = async () => {
    if (cart.length === 0 || submitting) return;
    if (!selectedPayment) {
      showToast('Pilih metode pembayaran di troli terlebih dahulu!', 'error');
      return;
    }
    if (selectedPayment.isMaintenance) {
      showToast(`Metode pembayaran ${selectedPayment.name} sedang dalam pemeliharaan (Maintenance). Silakan pilih QRIS All Payment.`, 'error');
      return;
    }
    const cleanWa = whatsappNumber.trim();
    if (!cleanWa || cleanWa.length < 9) {
      showToast('Masukkan nomor WhatsApp pembeli yang valid!', 'error');
      return;
    }
    const cleanEmail = buyerEmail.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('Format alamat Email struk tidak valid!', 'error');
      return;
    }

    // Buka tab kosong saat gesture klik masih aktif agar Android/browser tidak memblokir popup.
    // URL WhatsApp baru dipasang setelah server mengonfirmasi invoice tersimpan.
    const whatsappWindow = window.open('about:blank', '_blank');
    setSubmitting(true);

    const remoteCatalog = await fetchCatalog();
    if (!remoteCatalog) {
      try { whatsappWindow?.close(); } catch {}
      setSubmitting(false);
      showToast('Katalog terbaru belum dapat diperiksa. Troli tetap tersimpan; coba lagi saat koneksi pulih.', 'error');
      return;
    }

    const latestCart: CartItem[] = [];
    let unavailableCartItem = false;
    for (const entry of cart) {
      const product = remoteCatalog.products.find((candidate) => candidate.id === entry.productId);
      const item = product?.items.find((candidate) => candidate.id === entry.itemId);
      if (!product || !item || item.price <= 0) {
        unavailableCartItem = true;
        continue;
      }
      latestCart.push({
        ...entry,
        productName: product.name,
        productImage: product.image,
        productImageFit: product.imageFit,
        itemName: item.name,
        price: item.price
      });
    }
    setProducts(remoteCatalog.products);
    try { localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(remoteCatalog.products)); } catch {}
    if (unavailableCartItem || latestCart.length !== cart.length) {
      try { whatsappWindow?.close(); } catch {}
      setSubmitting(false);
      showToast('Ada produk/nominal di troli yang sudah tidak tersedia atau belum memiliki harga. Periksa katalog dan hapus item tersebut sebelum checkout.', 'error');
      return;
    }

    const catalogChanged = latestCart.some((entry, index) =>
      entry.productName !== cart[index].productName ||
      entry.itemName !== cart[index].itemName ||
      entry.price !== cart[index].price
    );
    setCart(latestCart);
    saveCartItems(latestCart);
    if (catalogChanged) {
      try { whatsappWindow?.close(); } catch {}
      setSubmitting(false);
      showToast('Harga/nominal katalog berubah. Troli sudah diperbarui dengan data terbaru; periksa kembali sebelum menekan checkout lagi.', 'info');
      return;
    }

    let orderId = generateOrderId();
    while (localStorage.getItem(orderId)) orderId = generateOrderId();

    const subtotal = latestCart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    // Strict 200-400 unique code range
    const cartUniqueCode = Math.floor(Math.random() * (400 - 200 + 1)) + 200;
    const total = subtotal + selectedPayment.fee + cartUniqueCode;
    const totalCount = latestCart.reduce((acc, item) => acc + item.quantity, 0);

    const txData: StoredTransaction = {
      id: orderId,
      product: `${latestCart[0].productName}${latestCart.length > 1 ? ` +${latestCart.length - 1} lainnya` : ''}`,
      item: `${totalCount} Voucher`,
      target: latestCart.map((c) => `${c.userId}${c.zoneId ? `(${c.zoneId})` : ''}`).join(', '),
      status: 'Proses / Menunggu Pembayaran',
      total: `Rp ${total.toLocaleString('id-ID')}`,
      uniqueCode: cartUniqueCode,
      payment: selectedPayment.name,
      whatsapp: cleanWa,
      email: cleanEmail || undefined,
      memberName: currentUser ? currentUser.name : 'Guest',
      memberId: currentUser ? currentUser.id : '',
      createdAt: new Date().toLocaleString('id-ID'),
      paymentId: selectedPayment.id,
      lineItems: latestCart.map((c) => ({ productId: c.productId, itemId: c.itemId, quantity: c.quantity, userId: c.userId, zoneId: c.zoneId }))
    };

    try {
      const serverRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(txData)
      });
      const serverData = await serverRes.json().catch(() => null);
      if (!serverRes.ok || !serverData?.order?.id || serverData.order.id !== orderId) {
        throw new Error(serverData?.error || 'Server belum menyimpan pesanan.');
      }
      const canonical = serverData.order;
      // Respons sukses berarti server sudah menyimpan invoice. Gunakan rincian kanonisnya
      // tanpa membatalkan struk karena perbedaan format teks dari browser.
      txData.product = String(canonical.product || txData.product);
      txData.item = String(canonical.item || txData.item);
      txData.target = String(canonical.target || txData.target);
      txData.total = String(canonical.total || txData.total);
      txData.payment = String(canonical.payment || txData.payment);
      txData.status = canonical.status || 'Menunggu Pembayaran';
      setServerOrderReady(true);
    } catch (err) {
      try { whatsappWindow?.close(); } catch {}
      setSubmitting(false);
      showToast(err instanceof Error ? err.message : 'Pesanan belum tersimpan. Jangan lakukan pembayaran dulu.', 'error');
      return;
    }

    try {
      localStorage.setItem(orderId, JSON.stringify(txData));
      refreshPastOrdersFromStorage();
    } catch {
      // ignore storage errors
    }

    setDashboardOrderId(orderId);
    setDashboardTrackedOrder({
      found: true,
      searchedId: orderId,
      data: txData
    });

    recordRecentActivity(
      latestCart[0].productId,
      'ordered',
      `Checkout Troli (${totalCount} item) • ${orderId}`
    );

    const itemsLines = cart
      .map(
        (c, idx) =>
          `🔹 *${idx + 1}. ${c.productName}*\n   ├ 💎 Item: *${c.itemName}* (x${c.quantity})\n   ├ 🎯 Target: *${
            c.userId
          }*${c.zoneId ? ` (Zone: *${c.zoneId}*)` : ''}\n   └ 💰 Subtotal: *Rp ${(
            c.price * c.quantity
          ).toLocaleString('id-ID')}*`
      )
      .join('\n\n');

    const textMsg = `✨ *HALO ADMIN FITYORASTORE* ✨
Saya ingin konfirmasi pesanan dari *Troli Belanja* 🛒

╔══════════════════════════╗
   🧾 *STRUK PESANAN TROLI*
╚══════════════════════════╝
🆔 *ID Transaksi* : *${orderId}*
${currentUser ? `👑 *Member* : *${currentUser.name}* (${currentUser.id})\n` : ''}📱 *WA Pembeli* : *${cleanWa}*${cleanEmail ? `\n📧 *Email Struk* : *${cleanEmail}*` : ''}

📦 *DAFTAR ITEM PESANAN:*
${itemsLines}

━━━━━━━━━━━━━━━━━━━━━━
💳 *INFO PEMBAYARAN*
━━━━━━━━━━━━━━━━━━━━━━
🏦 *Metode Bayar* : *${selectedPayment.name}*
💵 *TOTAL BAYAR* : *Rp ${total.toLocaleString('id-ID')}*

📲 *INFO PEMBAYARAN QRIS:*
• Merchant: *CAHYO STORE, PULSA & TAGIHAN*
• NMID: *ID1026469444966* (cocokkan nama merchant di aplikasi)
• Gunakan aplikasi pembayaran yang mendukung QRIS dan cocokkan nama merchant serta nominal.

🙏 _Mohon segera diproses ya Admin, pesanan menunggu verifikasi admin di aplikasi merchant. Bukti pembayaran tidak menggantikan pemeriksaan transaksi. Terima kasih!_`;

    const waUrl = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(textMsg)}`;
    let whatsappAutoOpened = false;
    if (whatsappWindow) {
      try {
        whatsappWindow.opener = null;
        whatsappWindow.location.replace(waUrl);
        whatsappAutoOpened = true;
      } catch {
        try { whatsappWindow.close(); } catch {}
      }
    }

    setCart([]);
    saveCartItems([]);
    setCartOpen(false);
    setQrisDisplayOrder({ orderId, totalAmount: total });
    playTransactionSuccessDing();
    setCompletedReceipt({
      orderId,
      productName: `${latestCart[0].productName}${latestCart.length > 1 ? ` +${latestCart.length - 1} lainnya` : ''}`,
      itemName: `${totalCount} Voucher Digital`,
      targetId: latestCart.map((c) => `${c.userId}${c.zoneId ? `(${c.zoneId})` : ''}`).join(', '),
      paymentId: selectedPayment.id,
      paymentName: selectedPayment.name,
      paymentGroup: selectedPayment.group,
      totalFormatted: `Rp ${total.toLocaleString('id-ID')}`,
      whatsapp: cleanWa,
      email: cleanEmail || undefined,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      waUrl
    });
    setSubmitting(false);
    showToast(`Pesanan Troli ${orderId} tersimpan. ${whatsappAutoOpened ? 'WhatsApp dibuka di tab baru.' : 'Buka tombol WhatsApp pada struk untuk mengirim konfirmasi.'} Pembayaran tetap menunggu verifikasi admin.`, 'success');
  };

  // Order summary calculations
  const itemPrice = selectedItem ? selectedItem.price : 0;
  const feePrice = selectedPayment ? selectedPayment.fee : 0;
  const grandTotal = itemPrice + feePrice;

  const validateAndSubmitOrder = () => {
    if (!selectedProduct) return;

    const cleanUserId = userId.trim();
    const cleanZoneId = zoneId.trim();
    const cleanWa = whatsappNumber.trim();
    const cleanEmail = buyerEmail.trim();
    const validUser = checkIsUserIdValid(selectedProduct, cleanUserId);
    const validZone = !selectedProduct.hasZoneId || checkIsZoneIdValid(cleanZoneId);

    if (!cleanUserId || !validUser) {
      triggerUserIdShake();
      if (selectedProduct.hasZoneId && (!cleanZoneId || !validZone)) {
        triggerZoneIdShake();
      }
      showToast(
        !cleanUserId
          ? 'Mohon isi User ID / Nomor Tujuan!'
          : `Format ${selectedProduct.idLabel} tidak valid!`,
        'error'
      );
      userIdInputRef.current?.focus();
      return;
    }

    if (selectedProduct.hasZoneId && (!cleanZoneId || !validZone)) {
      triggerZoneIdShake();
      showToast(
        !cleanZoneId
          ? 'Mohon isi Server / Zone ID!'
          : `Format ${selectedProduct.zoneLabel} tidak valid!`,
        'error'
      );
      zoneIdInputRef.current?.focus();
      return;
    }

    if (liveTargetAuth.status === 'invalid') {
      triggerUserIdShake();
      showToast(
        liveTargetAuth.message || `Autentikasi real-time gagal: ${selectedProduct.idLabel} tidak valid!`,
        'error'
      );
      userIdInputRef.current?.focus();
      return;
    }

    if (!selectedItem) {
      showToast('Pilih nominal item terlebih dahulu!', 'error');
      return;
    }

    if (selectedItem.price <= 0) {
      showToast('Harga nominal ini belum diatur oleh Author (Rp 0). Silakan hubungi WhatsApp Author untuk pemesanan!', 'error');
      return;
    }

    if (!selectedPayment) {
      showToast('Pilih metode pembayaran!', 'error');
      return;
    }

    if (selectedPayment.isMaintenance) {
      showToast(`Metode pembayaran ${selectedPayment.name} sedang dalam pemeliharaan (Maintenance). Silakan pilih QRIS All Payment.`, 'error');
      return;
    }

    if (!cleanWa || cleanWa.length < 9) {
      showToast('Masukkan nomor WhatsApp yang valid!', 'error');
      waInputRef.current?.focus();
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('Format alamat Email struk tidak valid!', 'error');
      return;
    }

    let generatedOrderId = generateOrderId();
    while (localStorage.getItem(generatedOrderId)) generatedOrderId = generateOrderId();

    const nowMs = Date.now();
    const createdAtFormatted =
      new Date(nowMs).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';
    const expiresAtFormatted =
      new Date(nowMs + CHECKOUT_EXPIRY_SECONDS * 1000).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';

    setServerOrderReady(false);
    setQrisDisplayOrder(null);
    setShowPaymentInstructions(selectedPayment.id === 'qris');
    setShowConfirmReceiptPreview(false);
    setCopiedConfirmNmid(false);
    setRemainingSeconds(CHECKOUT_EXPIRY_SECONDS);
    // Strict 200-400 unique code range
    const generatedUniqueCode = Math.floor(Math.random() * (400 - 200 + 1)) + 200;
    setConfirmOrder({
      orderId: generatedOrderId,
      product: selectedProduct,
      item: selectedItem,
      payment: selectedPayment,
      userId: cleanUserId,
      zoneId: cleanZoneId,
      wa: cleanWa,
      email: cleanEmail || undefined,
      uniqueCode: generatedUniqueCode,
      createdAtMs: nowMs,
      createdAtFormatted,
      expiresAtFormatted
    });
  };

  const processDirectWhatsAppCheckout = async () => {
    if (!confirmOrder || submitting) return;
    if (remainingSeconds <= 0) {
      showToast('Waktu pembayaran habis! Silakan klik Perbarui Waktu terlebih dahulu.', 'error');
      return;
    }
    // Buka tab sinkron dengan klik untuk menghindari popup blocker di Android.
    const whatsappWindow = window.open('about:blank', '_blank');
    setSubmitting(true);
    playCheckoutClickDing();

    const remoteCatalog = await fetchCatalog();
    if (!remoteCatalog) {
      try { whatsappWindow?.close(); } catch {}
      setSubmitting(false);
      showToast('Katalog terbaru belum dapat diperiksa. Pesanan belum dibuat; coba lagi saat koneksi pulih.', 'error');
      return;
    }
    setProducts(remoteCatalog.products);
    try { localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(remoteCatalog.products)); } catch {}

    const latestProduct = remoteCatalog.products.find((product) => product.id === confirmOrder.product.id);
    const latestItem = latestProduct?.items.find((item) => item.id === confirmOrder.item.id);
    if (!latestProduct || !latestItem || latestItem.price <= 0) {
      try { whatsappWindow?.close(); } catch {}
      setSelectedProduct(latestProduct || null);
      setSelectedItem(null);
      setConfirmOrder(null);
      setSubmitting(false);
      showToast('Produk/nominal sudah tidak tersedia atau harganya belum ditetapkan. Pilih nominal lain dari katalog terbaru.', 'error');
      return;
    }

    const snapshot = { ...confirmOrder, product: latestProduct, item: latestItem };
    const catalogChanged =
      latestProduct.name !== snapshot.product.name ||
      latestItem.name !== snapshot.item.name ||
      latestItem.price !== snapshot.item.price;
    setSelectedProduct(latestProduct);
    setSelectedItem(latestItem);
    if (catalogChanged) {
      try { whatsappWindow?.close(); } catch {}
      setConfirmOrder(snapshot);
      setSubmitting(false);
      showToast('Harga/nominal berubah. Rincian sudah diperbarui; periksa kembali lalu tekan konfirmasi sekali lagi.', 'info');
      return;
    }

    const orderId = snapshot.orderId;
    const uniqueCode = snapshot.uniqueCode || 0;
    const total = snapshot.item.price + snapshot.payment.fee + uniqueCode;

    const txData: StoredTransaction = {
      id: orderId,
      product: snapshot.product.name,
      item: snapshot.item.name,
      target: `${snapshot.userId} ${snapshot.zoneId ? '(' + snapshot.zoneId + ')' : ''}`,
      status: 'Menunggu Pembayaran',
      total: `Rp ${total.toLocaleString('id-ID')}`,
      uniqueCode,
      payment: snapshot.payment.name,
      whatsapp: snapshot.wa,
      email: snapshot.email,
      memberName: currentUser ? currentUser.name : 'Guest',
      memberId: currentUser ? currentUser.id : '',
      createdAt: new Date().toLocaleString('id-ID'),
      productId: snapshot.product.id,
      itemId: snapshot.item.id,
      paymentId: snapshot.payment.id
    };

    try {
      const serverRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(txData)
      });
      const serverData = await serverRes.json().catch(() => null);
      if (!serverRes.ok || !serverData?.order?.id || serverData.order.id !== orderId) {
        throw new Error(serverData?.error || 'Server belum menyimpan pesanan.');
      }
      const canonical = serverData.order;
      // Server sudah menyimpan invoice; struk mengikuti nilai kanonis dari server.
      txData.product = String(canonical.product || txData.product);
      txData.item = String(canonical.item || txData.item);
      txData.target = String(canonical.target || txData.target);
      txData.total = String(canonical.total || txData.total);
      txData.payment = String(canonical.payment || txData.payment);
      txData.status = canonical.status || 'Menunggu Pembayaran';
      setServerOrderReady(true);
    } catch (err) {
      try { whatsappWindow?.close(); } catch {}
      setSubmitting(false);
      showToast(err instanceof Error ? err.message : 'Pesanan belum tersimpan. Jangan lakukan pembayaran dulu.', 'error');
      return;
    }

    try {
      localStorage.setItem(orderId, JSON.stringify(txData));
      refreshPastOrdersFromStorage();
    } catch {
      // ignore storage quota errors
    }

    setDashboardOrderId(orderId);
    setDashboardTrackedOrder({
      found: true,
      searchedId: orderId,
      data: txData
    });

    recordRecentActivity(
      snapshot.product.id,
      'ordered',
      `${snapshot.item.name} • ${orderId}`
    );

    const textMsg = `✨ *HALO ADMIN FITYORASTORE* ✨
Saya ingin konfirmasi pesanan *Top Up Digital* 🚀

╔══════════════════════════╗
   🧾 *DETAIL PESANAN BARU*
╚══════════════════════════╝
🆔 *ID Transaksi* : *${orderId}*
${currentUser ? `👑 *Member* : *${currentUser.name}* (${currentUser.id})\n` : ''}🎮 *Layanan* : *${snapshot.product.name}*
💎 *Nominal Item* : *${snapshot.item.name}*
🎯 *Target / ID* : *${snapshot.userId}*${snapshot.zoneId ? ` (Zone: *${snapshot.zoneId}*)` : ''}
📱 *WA Pembeli* : *${snapshot.wa}*${snapshot.email ? `\n📧 *Email Struk* : *${snapshot.email}*` : ''}

━━━━━━━━━━━━━━━━━━━━━━
💳 *RINCIAN PEMBAYARAN*
━━━━━━━━━━━━━━━━━━━━━━
🏦 *Metode Bayar* : *${snapshot.payment.name}*
💵 *TOTAL BAYAR* : *Rp ${total.toLocaleString('id-ID')}*
⚠️ *PENTING:* Cocokkan nominal *Rp ${total.toLocaleString('id-ID')}*. Pembayaran belum terverifikasi sampai Admin memeriksa transaksi di aplikasi merchant.

📲 *TUJUAN TRANSFER PEMBAYARAN:*
• No. HP / E-Wallet (GoPay, DANA, OVO): *0813-9525-985* (a/n CAHYO)
• QRIS All Payment: *CAHYO STORE, PULSA & TAGIHAN* (NMID: ID1026469444966)

🙏 _Pesanan menunggu verifikasi admin. Kirim bukti pembayaran untuk diproses secepatnya. Terima kasih!_`;

    const encodedText = encodeURIComponent(textMsg);
    const waUrl = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodedText}`;
    let whatsappAutoOpened = false;
    if (whatsappWindow) {
      try {
        whatsappWindow.opener = null;
        whatsappWindow.location.replace(waUrl);
        whatsappAutoOpened = true;
      } catch {
        try { whatsappWindow.close(); } catch {}
      }
    }

    delete draftsRef.current[snapshot.product.id];
    setSubmitting(false);
    playTransactionSuccessDing();
    setQrisDisplayOrder({ orderId, totalAmount: total });
    setCompletedReceipt({
      orderId,
      productName: snapshot.product.name,
      itemName: snapshot.item.name,
      targetId: `${snapshot.userId} ${snapshot.zoneId ? '(' + snapshot.zoneId + ')' : ''}`,
      paymentId: snapshot.payment.id,
      paymentName: snapshot.payment.name,
      paymentGroup: snapshot.payment.group,
      totalFormatted: `Rp ${total.toLocaleString('id-ID')}`,
      whatsapp: snapshot.wa,
      email: snapshot.email,
      timestamp:
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      waUrl
    });
    setConfirmOrder(null);
    setServerOrderReady(false);
    showToast(`Pesanan ${orderId} tersimpan. ${whatsappAutoOpened ? 'WhatsApp dibuka di tab baru.' : 'Buka tombol WhatsApp pada struk untuk mengirim konfirmasi.'} Pembayaran tetap menunggu verifikasi admin.`, 'success');
  };

  const handleCheckOrderStatus = async () => {
    const input = trackerInput.trim().toUpperCase();
    if (!input) {
      showToast('Masukkan ID Transaksi!', 'error');
      return;
    }
    setTrackerResult(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(input)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.order?.id) {
        setTrackerResult({ found: true, data: json.order as StoredTransaction });
        try { localStorage.setItem(input, JSON.stringify(json.order)); } catch {}
        return;
      }
      if (res.status === 404) {
        setTrackerResult({ found: false });
        return;
      }
      setTrackerResult({ found: false });
      showToast(json?.error || 'Server status pesanan sedang tidak tersedia. Coba kembali.', 'error');
    } catch {
      setTrackerResult({ found: false });
      showToast('Server tidak dapat dihubungi. Status tidak bisa diverifikasi dari penyimpanan lokal.', 'error');
    }
  };

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const categories = [
    { id: 'all', label: '🌐 Semua Layanan' },
    { id: 'game', label: '🎮 Game Mobile' },
    { id: 'pcgame', label: '💻 Game PC & Konsol' },
    { id: 'streaming', label: '🎬 Streaming & App Pro' },
    { id: 'sosmed', label: '🔥 Sosmed & TikTok' },
    { id: 'digital', label: '📱 Pulsa' },
    { id: 'voucher', label: '🎟️ Voucher Game' },
    { id: 'ewallet', label: '💳 Saldo E-Wallet' },
    { id: 'pln', label: '⚡ Listrik PLN' }
  ];

  return (
    <div className="fy-storefront min-h-screen flex flex-col justify-between antialiased selection:bg-cyan-500 selection:text-black relative">
      {/* Top Animated Progress Bar for Category Switch & Search */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 pointer-events-none overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-emerald-400 shadow-neon-cyan transition-all ease-out"
          style={{
            width: `${progressWidth}%`,
            opacity: isFiltering ? 1 : 0,
            transitionDuration: progressWidth === 0 ? '0ms' : '220ms'
          }}
        />
      </div>

      <PWAInstallBanner />

      {/* Header Navigation */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo + Live 24H Green Status */}
          <a href="#" className="flex items-center gap-2.5 group focus:outline-none shrink-0">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-emerald-500 p-0.5 shadow-neon-cyan transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center overflow-hidden">
                <img
                  src="/icon.svg"
                  alt="FityoraStore Emblem"
                  className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(0,240,255,0.65)]"
                />
              </div>
              <span
                title="Status server"
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-[0_0_8px_#10b981]"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white flex items-center">
                  Fityora<span className="gradient-text">Store</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-extrabold text-emerald-400 tracking-wide">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span>Online 24 Jam</span>
                </span>
              </div>
              <span className="text-[10px] tracking-wider uppercase text-slate-400 -mt-0.5 font-semibold">
                Official Top Up &amp; Digital
              </span>
            </div>
          </a>

          {/* Actions / Navigation Items */}
          <div className="flex items-center gap-2">
            {/* Global Theme Switcher: Dark Theme vs High-Contrast Light Mode */}
            <button
              id="theme-mode-switcher"
              type="button"
              onClick={() => {
                const nextMode = fx.colorMode === 'light' ? 'dark' : 'light';
                const updatedFx: FxConfig = { ...fx, colorMode: nextMode };
                setFx(updatedFx);
                saveFxConfig(updatedFx);
                applyGlobalColorModeVars(
                  nextMode,
                  THEME_PRESETS[updatedFx.preset] || THEME_PRESETS.cyber
                );
                showToast(
                  nextMode === 'light'
                    ? 'Mode Terang Kontras Tinggi (High-Contrast Light) Diaktifkan!'
                    : 'Mode Gelap Cyber (Dark Theme) Diaktifkan!',
                  'info'
                );
              }}
              title={
                fx.colorMode === 'light'
                  ? 'Mode Siang Aktif (Klik untuk Mode Malam)'
                  : 'Mode Malam Aktif (Klik untuk Mode Siang)'
              }
              aria-label="Toggle Mode Siang atau Malam"
              className={`flex items-center justify-center gap-1.5 min-w-[38px] px-2.5 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                fx.colorMode === 'light'
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-600 shadow-sm'
                  : 'bg-slate-800/85 hover:bg-slate-700/85 border-white/10 text-cyan-300'
              }`}
            >
              {fx.colorMode === 'light' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                  <span className="hidden lg:inline text-[11px] font-bold">Siang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="hidden lg:inline text-[11px] font-bold">Malam</span>
                </>
              )}
            </button>

            {/* Mobile/Desktop Quick Logout Button when an account is active */}
            {currentUser && (
              <button
                type="button"
                onClick={handleGlobalLogout}
                title="Keluar / Logout Akun"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-bold text-rose-300 hover:text-white transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-sm"
              >
                <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8 flex-1 w-full space-y-8">
        {/* Banner / Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden glass-panel border border-cyan-500/30 p-6 sm:p-8 lg:p-10 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Cyber Neon Glow Accents */}
          <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-gradient-to-br from-cyan-500/20 via-purple-600/20 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-48 h-48 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            {/* Trust and Speed Micro Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-extrabold text-[11px]">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>⚡ 1–5 Detik Pengiriman Otomatis</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-extrabold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>🛡️ 100% Legal &amp; Bergaransi</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-300 font-extrabold text-[11px]">
                <QrCode className="w-3.5 h-3.5 text-purple-400" />
                <span>💳 QRIS All Payment Instan</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Top Up Game &amp; Digital <br />
              <span className="gradient-text-shine">Harga Termurah, Kilat 24 Jam</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Platform resmi voucher game favorit seperti <strong>Mobile Legends</strong>, <strong>Free Fire</strong>, <strong>PUBG Mobile</strong>, <strong>Roblox</strong>, hingga <strong>Token Listrik PLN</strong> &amp; <strong>Pulsa All Operator</strong> dengan proses otomatis kilat dan sistem transaksi aman terpercaya.
            </p>

          </div>
        </motion.section>

        {/* Assistant remains available */}
        {aiWidgetReady && (
          <Suspense fallback={null}>
            <AiSmartConcierge
              products={products}
              onApplyRecommendation={handleApplyAiRecommendation}
              showToast={showToast}
              onOpenQris={() => showToast('Buat invoice terlebih dahulu. QRIS ditampilkan setelah pesanan berhasil tercatat di server.', 'info')}
            />
          </Suspense>
        )}

        {/* Category Tabs & Real-Time Search Filtering Bar */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Grid className="w-5 h-5 text-cyan-400" />
                <span>Pilih Layanan</span>
              </h2>
              <span className="text-xs text-slate-400" id="product-count-badge">
                ({filteredProducts.length} dari {products.length} Layanan)
              </span>
            </div>

            {/* Real-Time Instant Search Input + Grid 4 Indicator + Sorting Dropdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  id="catalog-realtime-search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Ketik nama game, item, pulsa, atau kategori..."
                  className="w-full bg-slate-900/95 border border-white/15 focus:border-cyan-400 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    title="Hapus pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 justify-between sm:justify-end">
                {/* Locked Grid 4 Indicator */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 border border-cyan-500/30 text-[11px] font-bold text-cyan-300"
                  title="Tampilan Terkunci di Grid 4 Kolom untuk Stabilitas Semua HP"
                >
                  <Grid className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Grid 4</span>
                </div>

                <div className="relative flex items-center">
                  <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 absolute left-3 pointer-events-none" />
                  <select
                    aria-label="Sort Products"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(
                        e.target.value as 'default' | 'price-asc' | 'price-desc' | 'name-asc'
                      );
                      triggerTopProgress();
                    }}
                    className="bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 focus:border-cyan-500/60 rounded-xl pl-8 pr-7 py-2 text-xs font-semibold text-slate-200 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="default">Urut: Populer</option>
                    <option value="price-asc">Harga Terendah</option>
                    <option value="price-desc">Harga Tertinggi</option>
                    <option value="name-asc">Nama (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Buttons with Real-Time Match Counts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar" id="category-filters">
            {categories.map((cat) => {
              const isActive = currentCategory === cat.id;
              const matchCount = categoryMatchCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={
                    isActive
                      ? 'cat-btn active px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-neon-cyan cursor-pointer flex items-center gap-1.5'
                      : 'cat-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all bg-slate-800/80 text-slate-400 hover:text-white border border-white/5 cursor-pointer flex items-center gap-1.5'
                  }
                >
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums ${
                      isActive
                        ? 'bg-slate-950/40 text-cyan-200'
                        : matchCount > 0
                        ? 'bg-slate-900 text-cyan-400'
                        : 'bg-slate-900/50 text-slate-600'
                    }`}
                  >
                    {matchCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Virtualized 4-Column Product Grid (react-window) + Real-Time Search & Tag Highlight */}
          <VirtualizedProductGrid
            products={filteredProducts}
            selectedProductId={selectedProduct?.id || null}
            onSelectProduct={handleSelectProduct}
            getStartingPrice={getStartingPrice}
            categories={categories}
            currentCategory={currentCategory}
            onCategoryChange={handleCategoryChange}
            searchQuery={searchQuery}
            activeTag={selectedTag}
            getProductTags={getProductTags}
            onResetFilters={() => {
              setSearchQuery('');
              setCurrentCategory('all');
              setSelectedTag('all');
              triggerTopProgress();
            }}
          />
        </section>

        {/* Dynamic Store Order Section */}
        <AnimatePresence>
          {selectedProduct && (
            <motion.section
              ref={checkoutSectionRef}
              id="checkout-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="scroll-mt-24 space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-3xl glass-panel border border-cyan-500/30 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <img
                      id="selected-product-img"
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = placeholderImage(selectedProduct.id, selectedProduct.name);
                      }}
                      style={{
                        objectFit: selectedProduct.imageFit === 'contain' ? 'contain' : 'cover',
                        padding: selectedProduct.imageFit === 'contain' ? '4px' : '0'
                      }}
                      className="w-12 h-12 rounded-2xl object-cover bg-slate-900 border border-white/10"
                    />
                    <div>
                      <h3 id="selected-product-title" className="text-lg font-extrabold text-white">
                        {selectedProduct.name}
                      </h3>
                      <p id="selected-product-publisher" className="text-xs text-cyan-400">
                        {selectedProduct.publisher}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseCheckout}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Step 1: User Credentials Input */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-500/40">
                      1
                    </span>
                    <h4 className="text-sm font-bold text-white">Masukkan Data Akun / Tujuan</h4>
                  </div>

                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative"
                    id="input-fields-container"
                    style={
                      {
                        '--product-primary-color': getProductThemePalette(selectedProduct).primary,
                        '--product-primary-ring': getProductThemePalette(selectedProduct).primaryRing,
                        '--product-primary-glow': getProductThemePalette(selectedProduct).primaryGlow,
                        '--product-shift-color': getProductThemePalette(selectedProduct).secondary,
                        '--product-shift-ring': getProductThemePalette(selectedProduct).secondaryRing,
                        '--product-shift-glow': getProductThemePalette(selectedProduct).secondaryGlow
                      } as React.CSSProperties
                    }
                  >
                    {(() => {
                      const productTheme = getProductThemePalette(selectedProduct);
                      const validationRule = getProductValidationRule(selectedProduct);
                      const userCharCount = userId.trim().length;
                      const hasUserIdContent = userCharCount > 0;
                      const isValidUserId = checkIsUserIdValid(selectedProduct, userId);
                      const userHint = getProductFieldFormatHint(selectedProduct, 'user');
                      const userLabelColorClass = shakeUserId
                        ? 'text-rose-400 peer-placeholder-shown:text-rose-400 peer-focus:text-rose-300'
                        : hasUserIdContent
                          ? isValidUserId
                            ? 'text-emerald-400 peer-focus:text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.28)]'
                            : 'text-rose-400 peer-focus:text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.28)]'
                          : 'text-cyan-400 peer-placeholder-shown:text-slate-400 peer-focus:text-cyan-300';

                      const userUnderlineGradient = shakeUserId
                        ? 'from-transparent via-rose-400 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                        : hasUserIdContent
                          ? isValidUserId
                            ? 'from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.85)]'
                            : 'from-transparent via-rose-400 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                          : 'from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(0,240,255,0.85)]';

                      const zoneCharCount = zoneId.trim().length;
                      const hasZoneIdContent = zoneCharCount > 0;
                      const isValidZoneId = checkIsZoneIdValid(zoneId, selectedProduct);
                      const zoneHint = getProductFieldFormatHint(selectedProduct, 'zone');
                      const zoneLabelColorClass = shakeZoneId
                        ? 'text-rose-400 peer-placeholder-shown:text-rose-400 peer-focus:text-rose-300'
                        : hasZoneIdContent
                          ? isValidZoneId
                            ? 'text-emerald-400 peer-focus:text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.28)]'
                            : 'text-rose-400 peer-focus:text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.28)]'
                          : 'text-cyan-400 peer-placeholder-shown:text-slate-400 peer-focus:text-cyan-300';

                      const zoneUnderlineGradient = shakeZoneId
                        ? 'from-transparent via-rose-400 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                        : hasZoneIdContent
                          ? isValidZoneId
                            ? 'from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.85)]'
                            : 'from-transparent via-rose-400 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                          : 'from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(0,240,255,0.85)]';

                      const canAiSplitCurrentInput =
                        selectedProduct.hasZoneId &&
                        parseSmartGameIdString(selectedProduct, userId).wasSplit;

                      return (
                        <>
                          {/* Product Theme Glow Pill Indicator, Auto-Fill from Clipboard & Quick Floating QR Launcher */}
                          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/75 border border-white/10">
                            <div className="flex items-center gap-2 text-[10px] text-slate-300">
                              <span
                                className="w-2.5 h-2.5 rounded-full animate-pulse"
                                style={{
                                  backgroundColor: productTheme.primary,
                                  boxShadow: `0 0 10px ${productTheme.primary}`
                                }}
                              />
                              <span className="font-bold text-white">{productTheme.name}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400">
                                Klik kolom input untuk efek <em>color-shifting glow</em> sesuai tema produk
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={handleAutoFillFromClipboard}
                                title="Auto-Fill ID dari Clipboard & tampilkan konfirmasi Copied!"
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Auto-Fill from Clipboard</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (qrScanModalOpen) {
                                    setQrScannerRetracted((prev) => !prev);
                                  } else {
                                    openSimulatedQrScanner();
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  qrScanModalOpen
                                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                                    : 'bg-slate-800/90 hover:bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                }`}
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>
                                  {qrScanModalOpen
                                    ? qrScannerRetracted
                                      ? 'Buka Viewfinder QR'
                                      : 'Ciutkan Scanner'
                                    : 'Floating QR Viewfinder'}
                                </span>
                              </button>
                            </div>
                          </div>
                          {/* AI Assistant Smart ID Auto-Parser Bar inside #input-fields-container */}
                          {selectedProduct.hasZoneId && (
                            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-slate-900/80 border border-cyan-500/25">
                              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                                <span className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </span>
                                <span>
                                  <strong className="text-cyan-300">AI Smart Auto-Parse:</strong>{' '}
                                  Tempel format gabungan seperti{' '}
                                  <code className="px-1.5 py-0.5 rounded bg-slate-950/90 text-cyan-200 font-mono text-[10px] border border-white/10">
                                    {userHint.example} ({zoneHint.example.split(' ')[0]})
                                  </code>{' '}
                                  untuk pisah otomatis.
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {canAiSplitCurrentInput && (
                                  <button
                                    type="button"
                                    onClick={() => handleSmartFormatInput(userId, 'button')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Pisahkan ID Sekarang</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const clipText = await navigator.clipboard.readText();
                                      if (clipText && clipText.trim()) {
                                        triggerPasteBubble(
                                          'user',
                                          clipText,
                                          parseSmartGameIdString(selectedProduct, clipText).wasSplit
                                        );
                                        if (!handleSmartFormatInput(clipText, 'button')) {
                                          setUserId(clipText.trim());
                                          showToast('Teks ditempel ke kolom ID', 'info');
                                        }
                                        return;
                                      }
                                    } catch {
                                      // Fallback sample parse if clipboard permission is blocked in iframe
                                    }
                                    if (!handleSmartFormatInput(userId, 'button')) {
                                      const sampleCombo = `${userHint.example} (${
                                        zoneHint.example.split(' ')[0]
                                      })`;
                                      triggerPasteBubble('user', sampleCombo, true);
                                      handleSmartFormatInput(sampleCombo, 'button');
                                    } else {
                                      triggerPasteBubble('user', userId, true);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                                  title="Tempel & pisahkan User ID + Zone ID otomatis dengan AI"
                                >
                                  <Sparkles className="w-3 h-3 text-cyan-300" />
                                  <span>AI Paste &amp; Parse</span>
                                </button>
                              </div>
                            </div>
                          )}

                          <AnimatePresence>
                            {(aiParsedNotice || isAiInputLocked) && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="sm:col-span-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-[11px] text-emerald-300 font-semibold"
                              >
                                <span className="flex items-center gap-1.5">
                                  {isAiInputLocked ? (
                                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  )}
                                  <span>
                                    {aiParsedNotice ||
                                      'Kolom ID dikunci otomatis setelah AI Parsing untuk mencegah perubahan tidak sengaja.'}
                                  </span>
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isAiInputLocked && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsAiInputLocked(false);
                                        showToast('Kunci kolom ID dibuka, Anda dapat mengedit kembali', 'info');
                                        userIdInputRef.current?.focus();
                                      }}
                                      className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                      <Unlock className="w-3 h-3" />
                                      <span>Buka Kunci</span>
                                    </button>
                                  )}
                                  {aiParsedNotice && (
                                    <button
                                      type="button"
                                      onClick={() => setAiParsedNotice(null)}
                                      className="text-emerald-300/70 hover:text-emerald-200 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {selectedProduct.hasZoneId ? (
                            <>
                              <div className="space-y-1">
                                <div
                                  className={`relative group/input ${
                                    shakeUserId ? 'animate-input-shake' : ''
                                  }`}
                                >
                                  {/* Subtle 'Copied!' Feedback Tooltip above the ID input field when Auto-Fill from Clipboard is clicked */}
                                  <AnimatePresence>
                                    {autoFillCopiedTooltip && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.85 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.9 }}
                                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute left-4 -top-8 z-40 px-2.5 py-1 rounded-lg bg-slate-950/95 border border-emerald-400/60 text-emerald-300 text-[10px] font-extrabold shadow-[0_6px_18px_rgba(16,185,129,0.35)] flex items-center gap-1.5"
                                      >
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        <span>Copied! Auto-Filled</span>
                                        <span className="absolute -bottom-1 left-4 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-emerald-400/60" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  <AnimatePresence>
                                    {focusedField === 'user' && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 z-30 p-2.5 rounded-xl bg-slate-950/95 backdrop-blur-md border border-cyan-400/40 shadow-[0_10px_28px_rgba(0,240,255,0.2)] text-[11px] leading-relaxed"
                                      >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="font-extrabold text-cyan-300 flex items-center gap-1">
                                            <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                                            {userHint.title}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-mono text-cyan-200">
                                            Cth: {userHint.example}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-200 font-medium">
                                          Wajib:{' '}
                                          <span className="text-cyan-300">{userHint.format}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          {userHint.tip}
                                        </p>
                                        <div className="absolute -bottom-1 left-6 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-cyan-400/40" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  <input
                                    ref={userIdInputRef}
                                    type="text"
                                    inputMode={/pln|pulsa|paketdata|ewallet|mlbb|ff|pubg|genshin|hsr|codm|hok/i.test(selectedProduct.id) ? 'numeric' : 'text'}
                                    id="input-user-id"
                                    value={userId}
                                    readOnly={isAiInputLocked}
                                    onFocus={() => setFocusedField('user')}
                                    onBlur={() => {
                                      setFocusedField((prev) => (prev === 'user' ? null : prev));
                                      if (userId.trim().length > 0 && !checkIsUserIdValid(selectedProduct, userId)) {
                                        triggerUserIdShake();
                                      }
                                    }}
                                    onPaste={(e) => {
                                      if (isAiInputLocked) {
                                        e.preventDefault();
                                        showToast(
                                          'Kolom ID sedang dikunci! Klik ikon gembok di dalam kolom untuk mengedit.',
                                          'info'
                                        );
                                        return;
                                      }
                                      const pasted = e.clipboardData.getData('text');
                                      if (pasted && pasted.trim().length > 0) {
                                        const wasSplit = parseSmartGameIdString(
                                          selectedProduct,
                                          pasted
                                        ).wasSplit;
                                        triggerPasteBubble('user', pasted, wasSplit);
                                      }
                                      if (pasted && pasted.trim().length >= 5) {
                                        triggerAiPasteFlash(selectedProduct.hasZoneId ? 'both' : 'user');
                                      }
                                      if (pasted && handleSmartFormatInput(pasted, 'paste')) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      if (isAiInputLocked) return;
                                      const val = e.target.value;
                                      if (handleSmartFormatInput(val, 'typing')) {
                                        return;
                                      }
                                      if (checkShouldTriggerInvalidFormatHaptic(selectedProduct, val, userId, 'user')) {
                                        triggerUserIdShake();
                                      } else if (shakeUserId) {
                                        setShakeUserId(false);
                                      }
                                      setUserId(val);
                                    }}
                                    placeholder=" "
                                    className={`peer w-full bg-slate-900/75 backdrop-blur-md border rounded-xl pl-3.5 pr-28 pt-5 pb-2 text-xs font-medium text-white placeholder-transparent transition-all duration-300 ease-out hover:border-white/20 focus:outline-none focus:bg-slate-800/85 focus:ring-2 focus:scale-[1.015] focus:-translate-y-0.5 ${
                                      isAiInputLocked ? 'cursor-not-allowed opacity-95 ' : ''
                                    }${
                                      pasteBorderPulseField === 'user' ||
                                      pasteBorderPulseField === 'both'
                                        ? 'animate-paste-border-pulse border-amber-400/90 ring-2 ring-purple-500/35'
                                        : shakeUserId
                                          ? 'border-rose-500/80 ring-2 ring-rose-500/30 shadow-[0_0_18px_rgba(244,63,94,0.3)] animate-invalid-breathing-glow'
                                          : hasUserIdContent
                                            ? isValidUserId
                                              ? 'border-emerald-500/65 focus:border-emerald-400 focus:ring-emerald-400/25 shadow-[0_0_14px_rgba(16,185,129,0.2)] animate-valid-border-pulse'
                                              : 'border-rose-500/55 focus:border-rose-400 focus:ring-rose-400/25 animate-invalid-breathing-glow'
                                            : 'border-white/10 focus:border-cyan-400 focus:ring-cyan-400/25'
                                    }`}
                                  />
                                  {/* Success State Green Border Pulse Ring Overlay */}
                                  <AnimatePresence>
                                    {hasUserIdContent && isValidUserId && !shakeUserId && (
                                      <motion.div
                                        key="user-valid-border-pulse"
                                        initial={{ opacity: 0.9, scale: 0.985 }}
                                        animate={{ opacity: [0.85, 0.35, 0], scale: [0.99, 1.014, 1.022] }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-400/90 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)] z-20"
                                      />
                                    )}
                                  </AnimatePresence>
                                  {/* Haptic Invalid Format Ripple Overlay */}
                                  <AnimatePresence>
                                    {shakeUserId && (
                                      <motion.div
                                        initial={{ opacity: 0.9, scale: 0.98 }}
                                        animate={{ opacity: [0.95, 0.5, 0], scale: [0.985, 1.015, 1.02] }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-rose-400/90 bg-rose-500/10 shadow-[0_0_22px_rgba(244,63,94,0.45)] z-20 animate-invalid-haptic-ripple"
                                      />
                                    )}
                                  </AnimatePresence>
                                  {/* Visual Paste Summary Bubble Animation */}
                                  <AnimatePresence>
                                    {pasteBubbleInfo && pasteBubbleInfo.field === 'user' && (
                                      <motion.div
                                        key={pasteBubbleInfo.key}
                                        initial={{ opacity: 0, y: 10, scale: 0.72 }}
                                        animate={{
                                          opacity: 1,
                                          y: -8,
                                          scale: [0.72, 1.08, 1]
                                        }}
                                        exit={{ opacity: 0, y: -16, scale: 0.85 }}
                                        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute right-2 -top-7 z-40 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/95 via-teal-500/95 to-emerald-500/95 text-slate-950 text-[10px] font-extrabold shadow-[0_6px_20px_rgba(0,240,255,0.45)] border border-white/30 flex items-center gap-1.5"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0" />
                                        <span>
                                          {pasteBubbleInfo.charCount} karakter diproses
                                          {pasteBubbleInfo.wasSplit ? ' • AI Split' : ''}
                                        </span>
                                        <span className="absolute -bottom-1 right-6 w-2 h-2 rotate-45 bg-teal-500" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  {/* AI Paste Initiation Flash Overlay */}
                                  <AnimatePresence>
                                    {(aiPasteFlashField === 'user' ||
                                      aiPasteFlashField === 'both') && (
                                      <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 1, 0.85, 0] }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.9, ease: 'easeOut' }}
                                        className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden z-20 border border-cyan-300/80 shadow-[0_0_24px_rgba(0,240,255,0.45)]"
                                      >
                                        <motion.div
                                          initial={{ x: '-100%' }}
                                          animate={{ x: '120%' }}
                                          transition={{ duration: 0.75, ease: 'easeInOut' }}
                                          className="absolute inset-y-0 w-2/3 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
                                        />
                                        <span className="absolute left-3 top-1.5 px-1.5 py-0.5 rounded bg-cyan-500/30 border border-cyan-300/50 text-[8px] font-extrabold text-cyan-100 uppercase tracking-wider flex items-center gap-1">
                                          <Sparkles className="w-2.5 h-2.5 text-cyan-200" />
                                          AI Parsing...
                                        </span>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  <label
                                    htmlFor="input-user-id"
                                    className={`pointer-events-none absolute left-3.5 top-2 text-[10px] font-semibold transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-semibold ${userLabelColorClass}`}
                                  >
                                    {selectedProduct.idLabel}
                                  </label>

                                  {/* Center-expanding animated focus underline */}
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r ${userUnderlineGradient} origin-center scale-x-0 opacity-0 transition-all duration-300 ease-out peer-focus:scale-x-100 peer-focus:opacity-100`}
                                  />

                                  {/* Subtle inside-field character counter, QR icon button, Show/Hide Eye & validation controls */}
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                                    {(hasUserIdContent || focusedField === 'user') && (
                                      <span
                                        title={`Panjang karakter: ${userCharCount} (target ${validationRule.userMinLen}–${validationRule.userMaxLen} karakter)`}
                                        className={`pointer-events-none px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold tabular-nums border transition-colors duration-200 ${
                                          !hasUserIdContent
                                            ? 'bg-slate-800/70 text-slate-400 border-white/10'
                                            : isValidUserId
                                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        }`}
                                      >
                                        {userCharCount}/{validationRule.userMaxLen}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() =>
                                        setRecentScansDrawerOpen((prev) => !prev)
                                      }
                                      aria-label="Recent QR Scans"
                                      title={`Riwayat Scan QR Terakhir (${recentQrScans.length}/5)`}
                                      className={`relative flex items-center justify-center w-6 h-6 rounded-lg border transition-all cursor-pointer ${
                                        recentScansDrawerOpen
                                          ? 'bg-purple-500/25 text-purple-200 border-purple-400/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                                          : 'bg-slate-800/80 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 border-white/10 hover:border-purple-400/40'
                                      }`}
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                      {recentQrScans.length > 0 && (
                                        <span className="pointer-events-none absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 text-[8px] font-extrabold text-white flex items-center justify-center border border-slate-950">
                                          {recentQrScans.length}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={openSimulatedQrScanner}
                                      aria-label={`Scan QR ${selectedProduct.idLabel}`}
                                      title="Scan QR Profil Game / Akun untuk isi otomatis"
                                      className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 hover:text-cyan-200 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.12)] transition-all cursor-pointer"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                    <AnimatePresence>
                                      {(hasUserIdContent || clearingField === 'user') && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.75 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.75 }}
                                          transition={{ duration: 0.2, ease: 'easeOut' }}
                                          className="flex items-center gap-1.5"
                                        >
                                          <motion.span
                                            key={
                                              isValidUserId
                                                ? 'valid-user-badge'
                                                : 'invalid-user-badge'
                                            }
                                            initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                                            animate={{ scale: [0.55, 1.24, 1], opacity: 1, rotate: 0 }}
                                            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                                            title={
                                              isValidUserId
                                                ? 'Format ID valid'
                                                : validationRule.userErrorMsg
                                            }
                                            className={`pointer-events-none relative flex items-center justify-center w-5 h-5 rounded-full ${
                                              isValidUserId
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.45)] animate-validation-pulse'
                                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                            }`}
                                          >
                                            {isValidUserId ? (
                                              <svg
                                                className="w-3.5 h-3.5 text-emerald-400"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              >
                                                <path
                                                  d="M20 6L9 17l-5-5"
                                                  className="animate-valid-checkmark-path"
                                                />
                                              </svg>
                                            ) : (
                                              <AlertCircle className="w-3.5 h-3.5" />
                                            )}
                                          </motion.span>
                                          <motion.button
                                            type="button"
                                            initial={{ opacity: 0, scale: 0.65, rotate: -45 }}
                                            animate={{
                                              opacity: clearingField === 'user' ? 0 : 1,
                                              scale: clearingField === 'user' ? 0.75 : 1,
                                              rotate: clearingField === 'user' ? 90 : 0
                                            }}
                                            exit={{ opacity: 0, scale: 0.65, rotate: 90 }}
                                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleAnimatedClearField('user')}
                                            aria-label={`Hapus ${selectedProduct.idLabel}`}
                                            title="Hapus teks"
                                            className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition-colors cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </motion.button>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    <AnimatePresence>
                                      {(isAiInputLocked || aiParsedNotice) && hasUserIdContent && (
                                        <motion.button
                                          type="button"
                                          initial={{ opacity: 0, scale: 0.7 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.7 }}
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            const nextLock = !isAiInputLocked;
                                            setIsAiInputLocked(nextLock);
                                            showToast(
                                              nextLock
                                                ? 'Kolom ID dikunci untuk mencegah perubahan tidak sengaja'
                                                : 'Kunci kolom ID dibuka! Sekarang Anda dapat mengedit ID',
                                              'info'
                                            );
                                          }}
                                          aria-label={
                                            isAiInputLocked
                                              ? 'Buka kunci kolom ID'
                                              : 'Kunci kolom ID'
                                          }
                                          title={
                                            isAiInputLocked
                                              ? 'Terkunci setelah AI Parsing — Klik untuk membuka kunci & mengedit'
                                              : 'Klik untuk mengunci kolom ID'
                                          }
                                          className={`flex items-center justify-center w-6 h-6 rounded-lg border transition-all cursor-pointer ${
                                            isAiInputLocked
                                              ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/25'
                                          }`}
                                        >
                                          {isAiInputLocked ? (
                                            <Lock className="w-3.5 h-3.5" />
                                          ) : (
                                            <Unlock className="w-3.5 h-3.5" />
                                          )}
                                        </motion.button>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                                <AnimatePresence>
                                  {hasUserIdContent && !isValidUserId && (
                                    <motion.p
                                      initial={{ opacity: 0, y: -3 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -3 }}
                                      transition={{ duration: 0.16 }}
                                      className="text-[10px] font-semibold text-rose-400 flex items-center gap-1 pl-1"
                                    >
                                      <AlertCircle className="w-3 h-3 shrink-0" />
                                      <span>{getSpecificUserIdErrorHint(selectedProduct, userId)}</span>
                                    </motion.p>
                                  )}
                                  {hasUserIdContent && isValidUserId && (
                                    <motion.p
                                      initial={{ opacity: 0, y: -3 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -3 }}
                                      transition={{ duration: 0.16 }}
                                      className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 pl-1"
                                    >
                                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                                      <span>
                                        Format {selectedProduct.idLabel} valid &amp; sesuai.
                                      </span>
                                    </motion.p>
                                  )}
                                </AnimatePresence>
                              </div>

                              <div className="space-y-1">
                                <div
                                  className={`relative group/input ${
                                    shakeZoneId ? 'animate-input-shake' : ''
                                  }`}
                                >
                                  <AnimatePresence>
                                    {focusedField === 'zone' && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 z-30 p-2.5 rounded-xl bg-slate-950/95 backdrop-blur-md border border-cyan-400/40 shadow-[0_10px_28px_rgba(0,240,255,0.2)] text-[11px] leading-relaxed"
                                      >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="font-extrabold text-cyan-300 flex items-center gap-1">
                                            <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                                            {zoneHint.title}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-mono text-cyan-200">
                                            Cth: {zoneHint.example}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-200 font-medium">
                                          Wajib:{' '}
                                          <span className="text-cyan-300">{zoneHint.format}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          {zoneHint.tip}
                                        </p>
                                        <div className="absolute -bottom-1 left-6 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-cyan-400/40" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  <input
                                    ref={zoneIdInputRef}
                                    type="text"
                                    inputMode={/mlbb/i.test(selectedProduct.id) ? 'numeric' : 'text'}
                                    id="input-zone-id"
                                    value={zoneId}
                                    readOnly={isAiInputLocked}
                                    onFocus={() => setFocusedField('zone')}
                                    onBlur={() => {
                                      setFocusedField((prev) => (prev === 'zone' ? null : prev));
                                      if (zoneId.trim().length > 0 && !checkIsZoneIdValid(zoneId, selectedProduct)) {
                                        triggerZoneIdShake();
                                      }
                                    }}
                                    onPaste={(e) => {
                                      if (isAiInputLocked) {
                                        e.preventDefault();
                                        showToast(
                                          'Kolom Zone ID sedang dikunci! Klik ikon gembok di dalam kolom untuk mengedit.',
                                          'info'
                                        );
                                        return;
                                      }
                                      const pasted = e.clipboardData.getData('text');
                                      if (pasted && pasted.trim().length > 0) {
                                        const wasSplit = parseSmartGameIdString(
                                          selectedProduct,
                                          pasted
                                        ).wasSplit;
                                        triggerPasteBubble('zone', pasted, wasSplit);
                                      }
                                      if (pasted && pasted.trim().length >= 5) {
                                        triggerAiPasteFlash('both');
                                      }
                                      if (pasted && handleSmartFormatInput(pasted, 'paste')) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      if (isAiInputLocked) return;
                                      const val = e.target.value;
                                      if (checkShouldTriggerInvalidFormatHaptic(selectedProduct, val, zoneId, 'zone')) {
                                        triggerZoneIdShake();
                                      } else if (shakeZoneId) {
                                        setShakeZoneId(false);
                                      }
                                      setZoneId(val);
                                    }}
                                    placeholder=" "
                                    className={`peer w-full bg-slate-900/75 backdrop-blur-md border rounded-xl pl-3.5 pr-28 pt-5 pb-2 text-xs font-medium text-white placeholder-transparent transition-all duration-300 ease-out hover:border-white/20 focus:outline-none focus:bg-slate-800/85 focus:ring-2 focus:scale-[1.015] focus:-translate-y-0.5 ${
                                      isAiInputLocked ? 'cursor-not-allowed opacity-95 ' : ''
                                    }${
                                      pasteBorderPulseField === 'zone' ||
                                      pasteBorderPulseField === 'both'
                                        ? 'animate-paste-border-pulse border-amber-400/90 ring-2 ring-purple-500/35'
                                        : shakeZoneId
                                          ? 'border-rose-500/80 ring-2 ring-rose-500/30 shadow-[0_0_18px_rgba(244,63,94,0.3)] animate-invalid-breathing-glow'
                                          : hasZoneIdContent
                                            ? isValidZoneId
                                              ? 'border-emerald-500/65 focus:border-emerald-400 focus:ring-emerald-400/25 shadow-[0_0_14px_rgba(16,185,129,0.2)] animate-valid-border-pulse'
                                              : 'border-rose-500/55 focus:border-rose-400 focus:ring-rose-400/25 animate-invalid-breathing-glow'
                                            : 'border-white/10 focus:border-cyan-400 focus:ring-cyan-400/25'
                                    }`}
                                  />
                                  {/* Success State Green Border Pulse Ring Overlay */}
                                  <AnimatePresence>
                                    {hasZoneIdContent && isValidZoneId && !shakeZoneId && (
                                      <motion.div
                                        key="zone-valid-border-pulse"
                                        initial={{ opacity: 0.9, scale: 0.985 }}
                                        animate={{ opacity: [0.85, 0.35, 0], scale: [0.99, 1.014, 1.022] }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-400/90 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)] z-20"
                                      />
                                    )}
                                  </AnimatePresence>
                                  {/* Haptic Invalid Format Ripple Overlay */}
                                  <AnimatePresence>
                                    {shakeZoneId && (
                                      <motion.div
                                        initial={{ opacity: 0.9, scale: 0.98 }}
                                        animate={{ opacity: [0.95, 0.5, 0], scale: [0.985, 1.015, 1.02] }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-rose-400/90 bg-rose-500/10 shadow-[0_0_22px_rgba(244,63,94,0.45)] z-20 animate-invalid-haptic-ripple"
                                      />
                                    )}
                                  </AnimatePresence>
                                  {/* Visual Paste Summary Bubble Animation */}
                                  <AnimatePresence>
                                    {pasteBubbleInfo && pasteBubbleInfo.field === 'zone' && (
                                      <motion.div
                                        key={pasteBubbleInfo.key}
                                        initial={{ opacity: 0, y: 10, scale: 0.72 }}
                                        animate={{
                                          opacity: 1,
                                          y: -8,
                                          scale: [0.72, 1.08, 1]
                                        }}
                                        exit={{ opacity: 0, y: -16, scale: 0.85 }}
                                        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                                        className="pointer-events-none absolute right-2 -top-7 z-40 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/95 via-teal-500/95 to-emerald-500/95 text-slate-950 text-[10px] font-extrabold shadow-[0_6px_20px_rgba(0,240,255,0.45)] border border-white/30 flex items-center gap-1.5"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0" />
                                        <span>
                                          {pasteBubbleInfo.charCount} karakter diproses
                                          {pasteBubbleInfo.wasSplit ? ' • AI Split' : ''}
                                        </span>
                                        <span className="absolute -bottom-1 right-6 w-2 h-2 rotate-45 bg-teal-500" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  {/* AI Paste Initiation Flash Overlay */}
                                  <AnimatePresence>
                                    {(aiPasteFlashField === 'zone' ||
                                      aiPasteFlashField === 'both') && (
                                      <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 1, 0.85, 0] }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.9, ease: 'easeOut' }}
                                        className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden z-20 border border-cyan-300/80 shadow-[0_0_24px_rgba(0,240,255,0.45)]"
                                      >
                                        <motion.div
                                          initial={{ x: '-100%' }}
                                          animate={{ x: '120%' }}
                                          transition={{ duration: 0.75, ease: 'easeInOut' }}
                                          className="absolute inset-y-0 w-2/3 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
                                        />
                                        <span className="absolute left-3 top-1.5 px-1.5 py-0.5 rounded bg-cyan-500/30 border border-cyan-300/50 text-[8px] font-extrabold text-cyan-100 uppercase tracking-wider flex items-center gap-1">
                                          <Sparkles className="w-2.5 h-2.5 text-cyan-200" />
                                          AI Split Zone...
                                        </span>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  <label
                                    htmlFor="input-zone-id"
                                    className={`pointer-events-none absolute left-3.5 top-2 text-[10px] font-semibold transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-semibold ${zoneLabelColorClass}`}
                                  >
                                    {selectedProduct.zoneLabel}
                                  </label>

                                  {/* Center-expanding animated focus underline */}
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r ${zoneUnderlineGradient} origin-center scale-x-0 opacity-0 transition-all duration-300 ease-out peer-focus:scale-x-100 peer-focus:opacity-100`}
                                  />

                                  {/* Subtle inside-field character counter, QR icon button, Show/Hide Eye & validation controls */}
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                                    {(hasZoneIdContent || focusedField === 'zone') && (
                                      <span
                                        title={`Panjang karakter: ${zoneCharCount} (target ${
                                          validationRule.zoneMinLen || 2
                                        }–${validationRule.zoneMaxLen || 15} karakter)`}
                                        className={`pointer-events-none px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold tabular-nums border transition-colors duration-200 ${
                                          !hasZoneIdContent
                                            ? 'bg-slate-800/70 text-slate-400 border-white/10'
                                            : isValidZoneId
                                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        }`}
                                      >
                                        {zoneCharCount}/{validationRule.zoneMaxLen || 15}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={openSimulatedQrScanner}
                                      aria-label={`Scan QR ${selectedProduct.zoneLabel}`}
                                      title="Scan QR Profil Game untuk isi ID & Zone otomatis"
                                      className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 hover:text-cyan-200 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.12)] transition-all cursor-pointer"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                    <AnimatePresence>
                                      {(hasZoneIdContent || clearingField === 'zone') && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.75 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.75 }}
                                          transition={{ duration: 0.2, ease: 'easeOut' }}
                                          className="flex items-center gap-1.5"
                                        >
                                          <motion.span
                                            key={
                                              isValidZoneId
                                                ? 'valid-zone-badge'
                                                : 'invalid-zone-badge'
                                            }
                                            initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                                            animate={{ scale: [0.55, 1.24, 1], opacity: 1, rotate: 0 }}
                                            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                                            title={
                                              isValidZoneId
                                                ? 'Format Zone/Server valid'
                                                : validationRule.zoneErrorMsg ||
                                                  'Format Zone/Server tidak valid'
                                            }
                                            className={`pointer-events-none relative flex items-center justify-center w-5 h-5 rounded-full ${
                                              isValidZoneId
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.45)] animate-validation-pulse'
                                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                            }`}
                                          >
                                            {isValidZoneId ? (
                                              <svg
                                                className="w-3.5 h-3.5 text-emerald-400"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              >
                                                <path
                                                  d="M20 6L9 17l-5-5"
                                                  className="animate-valid-checkmark-path"
                                                />
                                              </svg>
                                            ) : (
                                              <AlertCircle className="w-3.5 h-3.5" />
                                            )}
                                          </motion.span>
                                          <motion.button
                                            type="button"
                                            initial={{ opacity: 0, scale: 0.65, rotate: -45 }}
                                            animate={{
                                              opacity: clearingField === 'zone' ? 0 : 1,
                                              scale: clearingField === 'zone' ? 0.75 : 1,
                                              rotate: clearingField === 'zone' ? 90 : 0
                                            }}
                                            exit={{ opacity: 0, scale: 0.65, rotate: 90 }}
                                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleAnimatedClearField('zone')}
                                            aria-label={`Hapus ${selectedProduct.zoneLabel}`}
                                            title="Hapus teks"
                                            className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition-colors cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </motion.button>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    <AnimatePresence>
                                      {(isAiInputLocked || aiParsedNotice) && hasZoneIdContent && (
                                        <motion.button
                                          type="button"
                                          initial={{ opacity: 0, scale: 0.7 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.7 }}
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            const nextLock = !isAiInputLocked;
                                            setIsAiInputLocked(nextLock);
                                            showToast(
                                              nextLock
                                                ? 'Kolom Zone ID dikunci untuk mencegah perubahan tidak sengaja'
                                                : 'Kunci kolom dibuka! Sekarang Anda dapat mengedit Zone ID',
                                              'info'
                                            );
                                          }}
                                          aria-label={
                                            isAiInputLocked
                                              ? 'Buka kunci kolom Zone ID'
                                              : 'Kunci kolom Zone ID'
                                          }
                                          title={
                                            isAiInputLocked
                                              ? 'Terkunci setelah AI Parsing — Klik untuk membuka kunci & mengedit'
                                              : 'Klik untuk mengunci kolom Zone ID'
                                          }
                                          className={`flex items-center justify-center w-6 h-6 rounded-lg border transition-all cursor-pointer ${
                                            isAiInputLocked
                                              ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/25'
                                          }`}
                                        >
                                          {isAiInputLocked ? (
                                            <Lock className="w-3.5 h-3.5" />
                                          ) : (
                                            <Unlock className="w-3.5 h-3.5" />
                                          )}
                                        </motion.button>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                                <AnimatePresence>
                                  {hasZoneIdContent && !isValidZoneId && (
                                    <motion.p
                                      initial={{ opacity: 0, y: -3 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -3 }}
                                      transition={{ duration: 0.16 }}
                                      className="text-[10px] font-semibold text-rose-400 flex items-center gap-1 pl-1"
                                    >
                                      <AlertCircle className="w-3 h-3 shrink-0" />
                                      <span>{getSpecificZoneIdErrorHint(selectedProduct, zoneId)}</span>
                                    </motion.p>
                                  )}
                                  {hasZoneIdContent && isValidZoneId && (
                                    <motion.p
                                      initial={{ opacity: 0, y: -3 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -3 }}
                                      transition={{ duration: 0.16 }}
                                      className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 pl-1"
                                    >
                                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                                      <span>
                                        Format {selectedProduct.zoneLabel || 'Server / Zone'} valid &amp; sesuai.
                                      </span>
                                    </motion.p>
                                  )}
                                </AnimatePresence>
                              </div>
                            </>
                          ) : (
                            <div className="sm:col-span-2 space-y-1">
                              <div
                                className={`relative group/input ${
                                  shakeUserId ? 'animate-input-shake' : ''
                                }`}
                              >
                                {/* Subtle 'Copied!' Feedback Tooltip above the ID input field when Auto-Fill from Clipboard is clicked */}
                                <AnimatePresence>
                                  {autoFillCopiedTooltip && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 8, scale: 0.85 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -6, scale: 0.9 }}
                                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                      className="pointer-events-none absolute left-4 -top-8 z-40 px-2.5 py-1 rounded-lg bg-slate-950/95 border border-emerald-400/60 text-emerald-300 text-[10px] font-extrabold shadow-[0_6px_18px_rgba(16,185,129,0.35)] flex items-center gap-1.5"
                                    >
                                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                      <span>Copied! Auto-Filled</span>
                                      <span className="absolute -bottom-1 left-4 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-emerald-400/60" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <AnimatePresence>
                                  {focusedField === 'user' && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                      className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 z-30 p-2.5 rounded-xl bg-slate-950/95 backdrop-blur-md border border-cyan-400/40 shadow-[0_10px_28px_rgba(0,240,255,0.2)] text-[11px] leading-relaxed"
                                    >
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-extrabold text-cyan-300 flex items-center gap-1">
                                          <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                                          {userHint.title}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-mono text-cyan-200">
                                          Cth: {userHint.example}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-200 font-medium">
                                        Wajib:{' '}
                                        <span className="text-cyan-300">{userHint.format}</span>
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        {userHint.tip}
                                      </p>
                                      <div className="absolute -bottom-1 left-6 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-cyan-400/40" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <input
                                  ref={userIdInputRef}
                                  type="text"
                                  inputMode={/pln|pulsa|paketdata|ewallet|mlbb|ff|pubg|genshin|hsr|codm|hok/i.test(selectedProduct.id) ? 'numeric' : 'text'}
                                  id="input-user-id"
                                  value={userId}
                                  readOnly={isAiInputLocked}
                                  onFocus={() => setFocusedField('user')}
                                  onBlur={() => {
                                    setFocusedField((prev) => (prev === 'user' ? null : prev));
                                    if (userId.trim().length > 0 && !checkIsUserIdValid(selectedProduct, userId)) {
                                      triggerUserIdShake();
                                    }
                                  }}
                                  onPaste={(e) => {
                                    if (isAiInputLocked) {
                                      e.preventDefault();
                                      showToast(
                                        'Kolom ID sedang dikunci! Klik ikon gembok di dalam kolom untuk mengedit.',
                                        'info'
                                      );
                                      return;
                                    }
                                    const pasted = e.clipboardData.getData('text');
                                    const parsed = parseSmartGameIdString(selectedProduct, pasted);
                                    if (pasted && pasted.trim().length > 0) {
                                      triggerPasteBubble(
                                        'user',
                                        pasted,
                                        Boolean(parsed.userId && parsed.userId !== pasted.trim())
                                      );
                                    }
                                    if (pasted && pasted.trim().length >= 5) {
                                      triggerAiPasteFlash('user');
                                    }
                                    if (parsed.userId && parsed.userId !== pasted.trim()) {
                                      e.preventDefault();
                                      setUserId(parsed.userId);
                                      triggerValidIdHaptic([18, 35, 24]);
                                      triggerAiParsedBanner(
                                        `AI Auto-Parse: "${parsed.userId}" diekstrak otomatis!`
                                      );
                                    } else if (pasted && pasted.trim().length >= 5) {
                                      triggerAiParsedBanner(
                                        `AI Auto-Parse: "${pasted.trim()}" ditangkap & dikunci otomatis!`
                                      );
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (isAiInputLocked) return;
                                    const val = e.target.value;
                                    if (checkShouldTriggerInvalidFormatHaptic(selectedProduct, val, userId, 'user')) {
                                      triggerUserIdShake();
                                    } else if (shakeUserId) {
                                      setShakeUserId(false);
                                    }
                                    setUserId(val);
                                  }}
                                  placeholder=" "
                                  className={`peer w-full bg-slate-900/75 backdrop-blur-md border rounded-xl pl-3.5 pr-28 pt-5 pb-2 text-xs font-medium text-white placeholder-transparent transition-all duration-300 ease-out hover:border-white/20 focus:outline-none focus:bg-slate-800/85 focus:ring-2 focus:scale-[1.015] focus:-translate-y-0.5 ${
                                    isAiInputLocked ? 'cursor-not-allowed opacity-95 ' : ''
                                  }${
                                    pasteBorderPulseField === 'user' ||
                                    pasteBorderPulseField === 'both'
                                      ? 'animate-paste-border-pulse border-amber-400/90 ring-2 ring-purple-500/35'
                                      : shakeUserId
                                        ? 'border-rose-500/80 ring-2 ring-rose-500/30 shadow-[0_0_18px_rgba(244,63,94,0.3)] animate-invalid-breathing-glow'
                                        : hasUserIdContent
                                          ? isValidUserId
                                            ? 'border-emerald-500/65 focus:border-emerald-400 focus:ring-emerald-400/25 shadow-[0_0_14px_rgba(16,185,129,0.2)] animate-valid-border-pulse'
                                            : 'border-rose-500/55 focus:border-rose-400 focus:ring-rose-400/25 animate-invalid-breathing-glow'
                                          : 'border-white/10 focus:border-cyan-400 focus:ring-cyan-400/25'
                                  }`}
                                />
                                {/* Success State Green Border Pulse Ring Overlay */}
                                <AnimatePresence>
                                  {hasUserIdContent && isValidUserId && !shakeUserId && (
                                    <motion.div
                                      key="single-user-valid-border-pulse"
                                      initial={{ opacity: 0.9, scale: 0.985 }}
                                      animate={{ opacity: [0.85, 0.35, 0], scale: [0.99, 1.014, 1.022] }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                                      className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-400/90 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)] z-20"
                                    />
                                  )}
                                </AnimatePresence>
                                {/* Haptic Invalid Format Ripple Overlay */}
                                <AnimatePresence>
                                  {shakeUserId && (
                                    <motion.div
                                      initial={{ opacity: 0.9, scale: 0.98 }}
                                      animate={{ opacity: [0.95, 0.5, 0], scale: [0.985, 1.015, 1.02] }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
                                      className="pointer-events-none absolute inset-0 rounded-xl border-2 border-rose-400/90 bg-rose-500/10 shadow-[0_0_22px_rgba(244,63,94,0.45)] z-20 animate-invalid-haptic-ripple"
                                    />
                                  )}
                                </AnimatePresence>
                                {/* Visual Paste Summary Bubble Animation */}
                                <AnimatePresence>
                                  {pasteBubbleInfo && pasteBubbleInfo.field === 'user' && (
                                    <motion.div
                                      key={pasteBubbleInfo.key}
                                      initial={{ opacity: 0, y: 10, scale: 0.72 }}
                                      animate={{
                                        opacity: 1,
                                        y: -8,
                                        scale: [0.72, 1.08, 1]
                                      }}
                                      exit={{ opacity: 0, y: -16, scale: 0.85 }}
                                      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                                      className="pointer-events-none absolute right-2 -top-7 z-40 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/95 via-teal-500/95 to-emerald-500/95 text-slate-950 text-[10px] font-extrabold shadow-[0_6px_20px_rgba(0,240,255,0.45)] border border-white/30 flex items-center gap-1.5"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0" />
                                      <span>
                                        {pasteBubbleInfo.charCount} karakter diproses
                                        {pasteBubbleInfo.wasSplit ? ' • AI Split' : ''}
                                      </span>
                                      <span className="absolute -bottom-1 right-6 w-2 h-2 rotate-45 bg-teal-500" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                {/* AI Paste Initiation Flash Overlay */}
                                <AnimatePresence>
                                  {(aiPasteFlashField === 'user' ||
                                    aiPasteFlashField === 'both') && (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: [0, 1, 0.85, 0] }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.9, ease: 'easeOut' }}
                                      className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden z-20 border border-cyan-300/80 shadow-[0_0_24px_rgba(0,240,255,0.45)]"
                                    >
                                      <motion.div
                                        initial={{ x: '-100%' }}
                                        animate={{ x: '120%' }}
                                        transition={{ duration: 0.75, ease: 'easeInOut' }}
                                        className="absolute inset-y-0 w-2/3 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
                                      />
                                      <span className="absolute left-3 top-1.5 px-1.5 py-0.5 rounded bg-cyan-500/30 border border-cyan-300/50 text-[8px] font-extrabold text-cyan-100 uppercase tracking-wider flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5 text-cyan-200" />
                                        AI Parsing...
                                      </span>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <label
                                  htmlFor="input-user-id"
                                  className={`pointer-events-none absolute left-3.5 top-2 text-[10px] font-semibold transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-semibold ${userLabelColorClass}`}
                                >
                                  {selectedProduct.idLabel}
                                </label>

                                {/* Center-expanding animated focus underline */}
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r ${userUnderlineGradient} origin-center scale-x-0 opacity-0 transition-all duration-300 ease-out peer-focus:scale-x-100 peer-focus:opacity-100`}
                                />

                                {/* Subtle inside-field character counter, QR icon button, Show/Hide Eye & validation controls */}
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                                  {(hasUserIdContent || focusedField === 'user') && (
                                    <span
                                      title={`Panjang karakter: ${userCharCount} (target ${validationRule.userMinLen}–${validationRule.userMaxLen} karakter)`}
                                      className={`pointer-events-none px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold tabular-nums border transition-colors duration-200 ${
                                        !hasUserIdContent
                                          ? 'bg-slate-800/70 text-slate-400 border-white/10'
                                          : isValidUserId
                                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                      }`}
                                    >
                                      {userCharCount}/{validationRule.userMaxLen}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() =>
                                      setRecentScansDrawerOpen((prev) => !prev)
                                    }
                                    aria-label="Recent QR Scans"
                                    title={`Riwayat Scan QR Terakhir (${recentQrScans.length}/5)`}
                                    className={`relative flex items-center justify-center w-6 h-6 rounded-lg border transition-all cursor-pointer ${
                                      recentScansDrawerOpen
                                        ? 'bg-purple-500/25 text-purple-200 border-purple-400/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                                        : 'bg-slate-800/80 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 border-white/10 hover:border-purple-400/40'
                                    }`}
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    {recentQrScans.length > 0 && (
                                      <span className="pointer-events-none absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 text-[8px] font-extrabold text-white flex items-center justify-center border border-slate-950">
                                        {recentQrScans.length}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={openSimulatedQrScanner}
                                    aria-label={`Scan QR ${selectedProduct.idLabel}`}
                                    title="Scan QR Profil Game / Akun untuk isi otomatis"
                                    className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 hover:text-cyan-200 border border-cyan-500/25 hover:border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.12)] transition-all cursor-pointer"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                  </button>
                                  <AnimatePresence>
                                    {(hasUserIdContent || clearingField === 'user') && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.75 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.75 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                        className="flex items-center gap-1.5"
                                      >
                                        <motion.span
                                          key={
                                            isValidUserId
                                              ? 'valid-single-user-badge'
                                              : 'invalid-single-user-badge'
                                          }
                                          initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                                          animate={{ scale: [0.55, 1.24, 1], opacity: 1, rotate: 0 }}
                                          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                                          title={
                                            isValidUserId
                                              ? 'Format valid'
                                              : validationRule.userErrorMsg
                                          }
                                          className={`pointer-events-none relative flex items-center justify-center w-5 h-5 rounded-full ${
                                            isValidUserId
                                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.45)] animate-validation-pulse'
                                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                          }`}
                                        >
                                          {isValidUserId ? (
                                            <svg
                                              className="w-3.5 h-3.5 text-emerald-400"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="3"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            >
                                              <path
                                                d="M20 6L9 17l-5-5"
                                                className="animate-valid-checkmark-path"
                                              />
                                            </svg>
                                          ) : (
                                            <AlertCircle className="w-3.5 h-3.5" />
                                          )}
                                        </motion.span>
                                        <motion.button
                                          type="button"
                                          initial={{ opacity: 0, scale: 0.65, rotate: -45 }}
                                          animate={{
                                            opacity: clearingField === 'user' ? 0 : 1,
                                            scale: clearingField === 'user' ? 0.75 : 1,
                                            rotate: clearingField === 'user' ? 90 : 0
                                          }}
                                          exit={{ opacity: 0, scale: 0.65, rotate: 90 }}
                                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => handleAnimatedClearField('user')}
                                          aria-label={`Hapus ${selectedProduct.idLabel}`}
                                          title="Hapus teks"
                                          className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition-colors cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </motion.button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  <AnimatePresence>
                                    {(isAiInputLocked || aiParsedNotice) && hasUserIdContent && (
                                      <motion.button
                                        type="button"
                                        initial={{ opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.7 }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          const nextLock = !isAiInputLocked;
                                          setIsAiInputLocked(nextLock);
                                          showToast(
                                            nextLock
                                              ? 'Kolom ID dikunci untuk mencegah perubahan tidak sengaja'
                                              : 'Kunci kolom ID dibuka! Sekarang Anda dapat mengedit ID',
                                            'info'
                                          );
                                        }}
                                        aria-label={
                                          isAiInputLocked
                                            ? 'Buka kunci kolom ID'
                                            : 'Kunci kolom ID'
                                        }
                                        title={
                                          isAiInputLocked
                                            ? 'Terkunci setelah AI Parsing — Klik untuk membuka kunci & mengedit'
                                            : 'Klik untuk mengunci kolom ID'
                                        }
                                        className={`flex items-center justify-center w-6 h-6 rounded-lg border transition-all cursor-pointer ${
                                          isAiInputLocked
                                            ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/25'
                                        }`}
                                      >
                                        {isAiInputLocked ? (
                                          <Lock className="w-3.5 h-3.5" />
                                        ) : (
                                          <Unlock className="w-3.5 h-3.5" />
                                        )}
                                      </motion.button>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                              <AnimatePresence>
                                {hasUserIdContent && !isValidUserId && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    transition={{ duration: 0.16 }}
                                    className="text-[10px] font-semibold text-rose-400 flex items-center gap-1 pl-1"
                                  >
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span>{getSpecificUserIdErrorHint(selectedProduct, userId)}</span>
                                  </motion.p>
                                )}
                                {hasUserIdContent && isValidUserId && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    transition={{ duration: 0.16 }}
                                    className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 pl-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span>
                                      Format {selectedProduct.idLabel} valid &amp; sesuai.
                                    </span>
                                  </motion.p>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Dedicated Retractable Floating UI Card for QR Scanner with Camera Viewfinder Overlay Animation inside #input-fields-container */}
                          <AnimatePresence>
                            {qrScanModalOpen && (
                              <motion.div
                                layout
                                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                  borderColor: productTheme.primary,
                                  boxShadow: `0 18px 42px -8px rgba(2, 6, 23, 0.9), 0 0 28px ${productTheme.primaryGlow}`
                                }}
                                className="sm:col-span-2 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border relative overflow-hidden z-20"
                              >
                                {/* Ambient Top Glow Bar Matching Selected Product Theme */}
                                <div
                                  className="h-1 w-full"
                                  style={{
                                    background: `linear-gradient(90deg, transparent, ${productTheme.primary}, ${productTheme.secondary}, transparent)`
                                  }}
                                />

                                {/* Floating Card Header with Retract / Expand & Close Controls */}
                                <div className="p-3.5 flex items-center justify-between gap-2 border-b border-white/10 bg-slate-900/60">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className="p-2 rounded-xl border flex items-center justify-center shrink-0 relative"
                                      style={{
                                        backgroundColor: productTheme.primaryGlow,
                                        borderColor: productTheme.primary,
                                        color: '#ffffff'
                                      }}
                                    >
                                      <Camera className="w-4 h-4" />
                                      {qrScanningActive && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h5 className="text-xs font-extrabold text-white tracking-tight">
                                          Pemindai QR Kamera (Nonaktif)
                                        </h5>
                                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/35 text-[9px] font-mono font-bold text-cyan-200 uppercase flex items-center gap-1">
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${
                                              qrScanningActive
                                                ? 'bg-emerald-400 animate-pulse'
                                                : 'bg-cyan-300'
                                            }`}
                                          />
                                          {qrScanningActive
                                            ? `SCANNING ${qrScanProgress}%`
                                            : qrDetectedString
                                              ? 'LOCKED'
                                              : 'READY'}
                                        </span>
                                        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-slate-300">
                                          60 FPS HUD • AF-LOCK
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {qrScannerRetracted
                                          ? `Mode ringkas aktif • Target: ${selectedProduct.name} (${
                                              qrDetectedString || 'Siap memindai'
                                            })`
                                          : `Pemindai kamera nonaktif; salin UID dari profil ${selectedProduct.name} ke bingkai optik kamera untuk isi otomatis.`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Rescan Button */}
                                    <button
                                      type="button"
                                      onClick={() => openSimulatedQrScanner()}
                                      title="Pindai Ulang"
                                      className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                      <RefreshCw
                                        className={`w-3 h-3 ${qrScanningActive ? 'animate-spin' : ''}`}
                                      />
                                      <span className="hidden sm:inline">Ulang</span>
                                    </button>

                                    {/* Retract / Expand Toggle Button */}
                                    <button
                                      type="button"
                                      onClick={() => setQrScannerRetracted((prev) => !prev)}
                                      title={
                                        qrScannerRetracted
                                          ? 'Perluas Camera Viewfinder'
                                          : 'Lipat (Retract) Kartu Scanner'
                                      }
                                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/15 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                      {qrScannerRetracted ? (
                                        <>
                                          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                                          <span>Buka Kamera</span>
                                        </>
                                      ) : (
                                        <>
                                          <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                                          <span>Lipat Kartu</span>
                                        </>
                                      )}
                                    </button>

                                    {/* Close Floating Scanner Card */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (qrScanIntervalRef.current) {
                                          window.clearInterval(qrScanIntervalRef.current);
                                          qrScanIntervalRef.current = null;
                                        }
                                        setQrScanningActive(false);
                                        setQrScanModalOpen(false);
                                      }}
                                      title="Tutup QR Scanner"
                                      className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/35 transition-all cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Retracted Compact Status Bar vs Full Camera Viewfinder Body */}
                                <AnimatePresence initial={false} mode="wait">
                                  {qrScannerRetracted ? (
                                    <motion.div
                                      key="retracted-bar"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.22 }}
                                      className="px-3.5 py-2.5 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <div className="flex items-center gap-2 text-[11px]">
                                        <ScanLine className="w-4 h-4 text-cyan-400 animate-pulse" />
                                        <span className="text-slate-300 font-medium">
                                          Status Viewfinder:
                                        </span>
                                        <span className="font-mono font-bold text-cyan-300">
                                          {qrDetectedString
                                            ? `Terbaca (${qrDetectedString})`
                                            : `Memindai ${qrScanProgress}%...`}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {getProductQrSampleStrings(selectedProduct)
                                          .slice(0, 2)
                                          .map((preset) => (
                                            <button
                                              key={preset.value}
                                              type="button"
                                              onClick={() => applyScannedQrString(preset.value)}
                                              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-200 text-[10px] font-mono font-bold transition-all cursor-pointer"
                                            >
                                              ⚡ {preset.value}
                                            </button>
                                          ))}
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="expanded-viewfinder"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.26 }}
                                      className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center"
                                    >
                                      {/* Interactive Camera Viewfinder Overlay Animation */}
                                      <div className="sm:col-span-6 flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-900/95 border border-white/10 relative overflow-hidden min-h-[195px] camera-viewfinder-grid">
                                        {/* Darkened Optical Vignette Overlay */}
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgba(2,6,23,0.82)_100%)] pointer-events-none" />

                                        {/* Top Camera HUD Telemetry */}
                                        <div className="w-full flex items-center justify-between text-[9px] font-mono text-cyan-300/90 z-10 mb-2 px-1">
                                          <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                            <span>REC • CAM-01</span>
                                          </span>
                                          <span>ISO 400 • 1/120s</span>
                                          <span className="text-emerald-300 font-bold">AI-VISION</span>
                                        </div>

                                        {/* Central Optical Reticle Frame */}
                                        <div className="relative w-36 h-32 rounded-2xl border border-cyan-400/35 bg-slate-950/75 flex items-center justify-center overflow-hidden z-10 animate-viewfinder-reticle shadow-[inset_0_0_24px_rgba(0,240,255,0.14)]">
                                          {/* 4 Animated Corner Viewfinder Brackets */}
                                          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-300 rounded-tl-md" />
                                          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-300 rounded-tr-md" />
                                          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-300 rounded-bl-md" />
                                          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-300 rounded-br-md" />

                                          {/* Subtle Center Crosshair Target */}
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-45">
                                            <div className="w-8 h-[1px] bg-cyan-400" />
                                            <div className="h-8 w-[1px] bg-cyan-400 absolute" />
                                            <div className="w-5 h-5 rounded-full border border-cyan-300/70 animate-ping absolute" />
                                          </div>

                                          {/* QR Matrix Graphic Inside Viewfinder */}
                                          <div className="flex flex-col items-center gap-1 z-10">
                                            <QrCode
                                              className={`w-12 h-12 transition-colors duration-300 ${
                                                qrDetectedString
                                                  ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.65)]'
                                                  : 'text-cyan-300/80'
                                              }`}
                                            />
                                            <span className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-900/90 text-cyan-200 border border-cyan-400/30">
                                              {qrDetectedString ? 'TARGET LOCKED' : 'ALIGN QR CODE'}
                                            </span>
                                          </div>

                                          {/* Sweeping Laser Scan Line & Glow Trail */}
                                          <motion.div
                                            initial={{ top: '8%' }}
                                            animate={{ top: ['8%', '88%', '8%'] }}
                                            transition={{
                                              duration: 1.65,
                                              repeat: Infinity,
                                              ease: 'easeInOut'
                                            }}
                                            className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_14px_#00f0ff] z-20"
                                          />
                                        </div>

                                        {/* Bottom Telemetry & Progress Bar */}
                                        <div className="w-full mt-2.5 space-y-1 z-10 px-1">
                                          <div className="flex items-center justify-between text-[9px] font-mono text-cyan-300">
                                            <span>
                                              {qrDetectedString
                                                ? `✓ ID Terkunci: ${qrDetectedString}`
                                                : 'Memfokuskan lensa & matriks QR...'}
                                            </span>
                                            <span className="font-bold">{qrScanProgress}%</span>
                                          </div>
                                          <div className="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden p-0.5">
                                            <motion.div
                                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400"
                                              animate={{ width: `${qrScanProgress}%` }}
                                              transition={{ duration: 0.15 }}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Quick Simulated Presets & Instant Profile Fill */}
                                      <div className="sm:col-span-6 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-extrabold text-slate-200 uppercase tracking-wider">
                                            Simulasi Kartu Profil Game:
                                          </p>
                                          <span className="text-[9px] text-cyan-400 font-mono">
                                            Auto-Parse + Haptic
                                          </span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {getProductQrSampleStrings(selectedProduct).map(
                                            (preset) => (
                                              <button
                                                key={preset.value}
                                                type="button"
                                                onClick={() => applyScannedQrString(preset.value)}
                                                className="w-full px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/50 flex items-center justify-between text-left transition-all cursor-pointer group"
                                              >
                                                <div className="min-w-0 pr-2">
                                                  <span className="text-[11px] font-bold text-white group-hover:text-cyan-300 block truncate">
                                                    {preset.label}
                                                  </span>
                                                  <span className="text-[10px] font-mono text-cyan-400 block truncate">
                                                    {preset.value}
                                                  </span>
                                                </div>
                                                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-400 group-hover:text-slate-950 text-cyan-200 text-[10px] font-extrabold transition-all">
                                                  Gunakan QR
                                                </span>
                                              </button>
                                            )
                                          )}
                                        </div>
                                        <p className="text-[9px] text-slate-400 leading-relaxed">
                                          💡 Anda dapat melipat (<em>retract</em>) kartu kamera ini
                                          kapan saja menggunakan tombol <strong>Lipat Kartu</strong>{' '}
                                          di kanan atas tanpa menutup sesi pemindaian.
                                        </p>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 'Recent Scans' Drawer / Popover inside #input-fields-container */}
                          <AnimatePresence>
                            {recentScansDrawerOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-purple-400/40 shadow-[0_12px_32px_rgba(168,85,247,0.22)] space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/35">
                                      <Clock className="w-3.5 h-3.5" />
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <h5 className="text-xs font-extrabold text-white">
                                          Recent Scans
                                        </h5>
                                        <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-[9px] font-mono font-bold text-purple-200">
                                          {recentQrScans.length}/5 Tersimpan
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-400">
                                        Klik salah satu hasil scan QR terakhir untuk mengisi ulang ID dengan cepat (+ Haptic Feedback).
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {recentQrScans.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRecentQrScans([]);
                                          try {
                                            localStorage.removeItem(RECENT_QR_SCANS_KEY);
                                          } catch {
                                            // ignore
                                          }
                                          showToast('Riwayat Recent Scans dibersihkan', 'info');
                                        }}
                                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/35 text-[10px] font-bold transition-all cursor-pointer"
                                      >
                                        Bersihkan
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setRecentScansDrawerOpen(false)}
                                      className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {recentQrScans.length === 0 ? (
                                  <div className="py-4 px-3 rounded-xl bg-slate-900/70 border border-white/5 text-center space-y-1">
                                    <p className="text-xs font-bold text-slate-300">
                                      Riwayat scan belum tersedia
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      Gunakan tombol ikon QR di sebelah kolom input untuk memindai ID akun.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {recentQrScans.slice(0, 5).map((scan, idx) => {
                                      const isCurrentProduct =
                                        scan.productId === selectedProduct.id;
                                      return (
                                        <button
                                          key={scan.id}
                                          type="button"
                                          onClick={() => applyRecentScanEntry(scan)}
                                          className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer group ${
                                            isCurrentProduct
                                              ? 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-400/35 hover:border-purple-400/60'
                                              : 'bg-slate-900/85 hover:bg-slate-800/90 border-white/10 hover:border-purple-400/40'
                                          }`}
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                #{idx + 1}
                                              </span>
                                              <span className="text-[11px] font-bold text-white group-hover:text-purple-200 truncate">
                                                {scan.productName}
                                              </span>
                                              <span className="text-[9px] text-slate-500">
                                                • {scan.scannedAt}
                                              </span>
                                            </div>
                                            <div className="text-[11px] font-mono font-bold text-cyan-300 truncate mt-0.5">
                                              {scan.rawValue}
                                            </div>
                                          </div>
                                          <span className="shrink-0 px-2 py-1 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/35 text-purple-200 text-[10px] font-extrabold border border-purple-400/30">
                                            Pakai
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      );
                    })()}
                  </div>
                  {/* Real-Time Game ID, Phone Operator, E-Wallet & PLN Meter Authentication Banner */}
                  {liveTargetAuth.status !== 'idle' && (
                    <div
                      id="realtime-id-auth-banner"
                      className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
                        liveTargetAuth.status === 'checking'
                          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                          : liveTargetAuth.status === 'verified'
                          ? 'bg-emerald-950/45 border-emerald-500/50 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          : liveTargetAuth.status === 'unconfirmed'
                          ? 'bg-amber-950/45 border-amber-500/50 text-amber-200'
                          : 'bg-rose-950/45 border-rose-500/50 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {liveTargetAuth.status === 'checking' && (
                          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                        )}
                        {liveTargetAuth.status === 'verified' && (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        {liveTargetAuth.status === 'unconfirmed' && (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        {liveTargetAuth.status === 'invalid' && (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          {liveTargetAuth.status === 'checking' && (
                            <p className="font-bold text-cyan-300 text-[11px]">
                              Memeriksa {selectedProduct.idLabel} melalui penyedia online...
                            </p>
                          )}
                          {liveTargetAuth.status === 'verified' && (
                            <>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                  Akun Terkonfirmasi
                                </span>
                                <span className="font-extrabold text-white text-xs truncate">
                                  {liveTargetAuth.accountName}
                                </span>
                              </div>
                              <p className="text-[10px] text-emerald-300/90 mt-0.5">
                                {liveTargetAuth.regionOrInfo} • Sumber: {liveTargetAuth.provider}
                              </p>
                            </>
                          )}
                          {liveTargetAuth.status === 'unconfirmed' && (
                            <>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                  Belum Terkonfirmasi
                                </span>
                                <span className="font-extrabold text-white text-xs break-all">{liveTargetAuth.accountName}</span>
                              </div>
                              <p className="text-[10px] text-amber-200/90 mt-0.5">{liveTargetAuth.regionOrInfo}</p>
                              <p className="text-[11px] font-bold text-amber-100 mt-2">
                                Nama tujuan belum dapat dikonfirmasi otomatis. Cocokkan kembali ID di game/aplikasi sebelum membayar.
                              </p>
                            </>
                          )}
                          {liveTargetAuth.status === 'invalid' && (
                            <p className="font-bold text-rose-300 text-[11px]">
                              {liveTargetAuth.message || 'ID / Nomor tidak valid atau tidak ditemukan.'}
                            </p>
                          )}
                        </div>
                      </div>
                      {liveTargetAuth.status === 'verified' && liveTargetAuth.verifiedAt && (
                        <span className="text-[9px] font-mono text-emerald-300/80 px-2 py-0.5 rounded-lg bg-slate-950/70 border border-emerald-500/30 shrink-0">
                          ✓ {liveTargetAuth.verifiedAt}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 italic" id="input-help-text">
                    {selectedProduct.id === 'ewallet'
                      ? 'Untuk cek nama, nomor e-wallet yang kamu masukkan akan dikirim ke layanan verifikasi pihak ketiga. Periksa hanya nomor tujuan yang kamu berwenang gunakan dan cocokkan nama penerima di aplikasi.'
                      : '*Pastikan User ID & Server ID diisi dengan benar untuk menghindari kesalahan pengiriman.'}
                  </p>
                </div>

                {/* Step 2: Select Item Nominal */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-500/40">
                      2
                    </span>
                    <h4 className="text-sm font-bold text-white">Pilih Nominal Top-Up</h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3" id="items-grid">
                    {selectedProduct.items.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const cat = selectedProduct.category;
                      const itemIcon =
                        cat === 'digital' ? '📶' :
                        cat === 'pln' ? '⚡' :
                        cat === 'ewallet' ? '💳' :
                        /diamond|dm/i.test(item.name) ? '💎' :
                        /cp|uc|points|point/i.test(item.name) ? '🎯' :
                        /token|coin/i.test(item.name) ? '🪙' :
                        /robux/i.test(item.name) ? '🧱' :
                        /pass|member/i.test(item.name) ? '👑' : '🎮';

                      return (
                        <motion.div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          whileHover={{ scale: 1.025, y: -2 }}
                          whileTap={{ scale: 0.94 }}
                          transition={{ duration: 0.12 }}
                          onClick={() => {
                            setSelectedItem(item);
                            playCheckoutClickDing();
                            triggerValidIdHaptic([24, 32]);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedItem(item);
                              playCheckoutClickDing();
                              triggerValidIdHaptic([24, 32]);
                            }
                          }}
                          className={`item-card relative p-3 sm:p-3.5 rounded-2xl cursor-pointer select-none transition-all flex flex-col justify-between space-y-2 overflow-hidden ${
                            isSelected
                              ? 'gradient-border-active border-cyan-400 shadow-[0_0_24px_rgba(0,240,255,0.45)] ring-2 ring-cyan-400/90 bg-gradient-to-br from-cyan-950/90 via-slate-900/95 to-slate-900'
                              : 'bg-slate-900/80 border border-white/10 hover:border-cyan-400/50 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-base select-none shrink-0" aria-hidden="true">{itemIcon}</span>
                            {isSelected ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black text-[9px] shadow-sm flex items-center gap-0.5 animate-pulse">
                                ✓ Terpilih
                              </span>
                            ) : (
                              <span className="w-2 h-2 rounded-full border border-white/20 bg-slate-800 shrink-0 mt-1" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs sm:text-[13px] font-bold text-white block line-clamp-2 leading-tight">
                              {item.name}
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-cyan-400 tabular-nums block mt-1">
                              {item.price > 0 ? `Rp ${item.price.toLocaleString('id-ID')}` : 'Rp 0 (Belum Diatur Author)'}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500 animate-pulse" />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Payment Method Selection */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-500/40">
                      3
                    </span>
                    <h4 className="text-sm font-bold text-white">Pilih Metode Pembayaran</h4>
                  </div>

                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                    id="payments-grid"
                  >
                    {PAYMENT_METHODS.map((pay, idx) => {
                      const isSelected = selectedPayment?.id === pay.id;
                      const isMaint = Boolean(pay.isMaintenance);
                      return (
                        <motion.div
                          key={pay.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: isSelected ? 1.02 : 1
                          }}
                          whileHover={isMaint ? undefined : { y: -3, scale: 1.015 }}
                          whileTap={isMaint ? undefined : { scale: 0.98 }}
                          transition={{
                            duration: 0.22,
                            delay: idx * 0.03,
                            ease: [0.16, 1, 0.3, 1]
                          }}
                          onClick={() => {
                            if (isMaint) {
                              showToast(`Metode pembayaran ${pay.name} sedang dalam pemeliharaan (Maintenance). Silakan pilih QRIS All Payment.`, 'info');
                              return;
                            }
                            setSelectedPayment(pay);
                          }}
                          className={`payment-card p-3.5 rounded-2xl border transition-colors flex items-center justify-between gap-3 relative overflow-hidden ${
                            isMaint
                              ? 'bg-slate-950/60 opacity-60 grayscale border-white/5 cursor-not-allowed'
                              : isSelected
                              ? 'gradient-border-active border-cyan-400 shadow-neon-cyan bg-slate-900/80 cursor-pointer'
                              : 'border-white/10 hover:border-cyan-500/50 bg-slate-900/80 cursor-pointer'
                          }`}
                        >
                          {isSelected && !isMaint && (
                            <motion.div
                              layoutId="active-payment-glow"
                              className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-transparent pointer-events-none"
                              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            />
                          )}
                          <div className="flex items-center gap-3 min-w-0 relative z-10">
                            <motion.div
                              animate={isSelected ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              <PaymentMethodLogo id={pay.id} size="md" />
                            </motion.div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                <span className="truncate">{pay.name}</span>
                                {isMaint && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold shrink-0 border border-amber-500/30">
                                    Maintenance
                                  </span>
                                )}
                              </h5>
                              <p className="text-[10px] text-slate-400 truncate">
                                {pay.group}
                                {isMaint
                                  ? ' • Sedang Pemeliharaan'
                                  : pay.id === 'qris'
                                  ? ' • QRIS statis, diperiksa manual'
                                  : ' • Transfer manual, diperiksa Author'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                            {pay.id === 'qris' && !isMaint && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPayment(pay);
                                  showToast('QRIS dapat dibuka setelah invoice dibuat dan tersimpan di server.', 'info');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Lihat & Scan QRIS Resmi Cahyo Store"
                              >
                                <QrCode className="w-3 h-3" />
                                <span>Scan QR</span>
                              </button>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isMaint
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold'
                                  : isSelected
                                  ? 'bg-cyan-500 text-slate-950 font-extrabold'
                                  : 'bg-cyan-500/10 text-cyan-400'
                              }`}
                            >
                              {isMaint ? 'Maintenance' : isSelected ? '✓ Dipilih' : pay.badge}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 4: WhatsApp & Email Contact + Summary */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-500/40">
                      4
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      Kontak WhatsApp &amp; Email Struk Pembeli
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="user-whatsapp"
                          className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Nomor WhatsApp Pembeli *</span>
                        </label>
                        <input
                          ref={waInputRef}
                          type="tel"
                          id="user-whatsapp"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          placeholder="Contoh: 081234567890"
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          WhatsApp akan dibuka dengan detail pesanan untuk dikirim oleh Anda.
                        </span>
                      </div>

                      <div>
                        <label
                          htmlFor="user-email"
                          className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5"
                        >
                          <Mail className="w-3.5 h-3.5 text-purple-400" />
                          <span>Alamat Email Struk (Opsional)</span>
                        </label>
                        <input
                          type="email"
                          id="user-email"
                          value={buyerEmail}
                          onChange={(e) => setBuyerEmail(e.target.value)}
                          placeholder="Contoh: pelanggan@email.com"
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Untuk membuat/unduh invoice HTML setelah pesanan dibuat. Ini bukan bukti pelunasan.
                        </span>
                      </div>
                    </div>

                    {/* Order Summary Card */}
                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Item Nominal:</span>
                        <span id="summary-item-name" className="font-medium text-slate-200">
                          {selectedItem ? selectedItem.name : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Metode Bayar:</span>
                        <span id="summary-payment-name" className="font-medium text-slate-200">
                          {selectedPayment ? selectedPayment.name : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-white/10">
                        <span>Total Harga:</span>
                        <span id="summary-total" className="text-cyan-400 tabular-nums">
                          Rp {itemPrice.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => showToast('Buat invoice terlebih dahulu. QRIS ditampilkan setelah pesanan berhasil tercatat di server.', 'info')}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <QrCode className="w-4 h-4 text-cyan-400" />
                        <span>Scan QRIS Resmi (GoPay Merchant)</span>
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons: Tambah ke Troli + Beli Sekarang */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="py-4 px-5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-extrabold text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span>+ Tambah ke Troli</span>
                    </button>

                    <button
                      id="btn-checkout"
                      type="button"
                      onClick={validateAndSubmitOrder}
                      className="sm:col-span-2 py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-emerald-500 text-white font-extrabold text-sm sm:text-base tracking-wide shadow-neon-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-5 h-5" />
                      <span>Beli &amp; Bayar Sekarang</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Guarantee & Features Bar */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl glass-card flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Antrean Terpantau</h5>
              <p className="text-[11px] text-slate-400">Status diperbarui setelah konfirmasi admin</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl glass-card flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Bantuan Admin</h5>
              <p className="text-[11px] text-slate-400">Jangan bagikan password akun game</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl glass-card flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Pembayaran Lengkap</h5>
              <p className="text-[11px] text-slate-400">QRIS, E-Wallet, Bank</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl glass-card flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Layanan CS 24/7</h5>
              <p className="text-[11px] text-slate-400">Bantuan Fast Response</p>
            </div>
          </div>
        </section>

        {/* Cara Order Section */}
        <section id="cara" className="scroll-mt-24 space-y-4">
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              Panduan
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">Cara Order</h2>
            <p className="text-xs text-slate-400">
              Hanya 4 langkah mudah, pesanan masuk antrean pemrosesan
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-extrabold text-white">
                1
              </div>
              <h4 className="text-sm font-bold text-white">Pilih Layanan</h4>
              <p className="text-[11px] text-slate-400">
                Pilih game atau layanan yang diinginkan
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-extrabold text-white">
                2
              </div>
              <h4 className="text-sm font-bold text-white">Pilih Nominal</h4>
              <p className="text-[11px] text-slate-400">
                Klik nominal yang diinginkan lalu isi User ID
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-extrabold text-white">
                3
              </div>
              <h4 className="text-sm font-bold text-white">Pilih Pembayaran</h4>
              <p className="text-[11px] text-slate-400">QRIS, e-wallet, atau transfer bank</p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-extrabold text-white">
                4
              </div>
              <h4 className="text-sm font-bold text-white">Selesai</h4>
              <p className="text-[11px] text-slate-400">
                Diproses setelah pembayaran diverifikasi admin
              </p>
            </div>
          </div>
        </section>

        {/* Testimoni Section (Neatly Organized Compact Landscape Cards) */}
        <section id="testimoni" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                Ulasan Pelanggan
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Apa Kata Pelanggan FityoraStore?
              </h2>
              <p className="text-xs text-slate-400">
                Hanya ulasan asli dari pesanan yang sudah terkirim dan diperiksa Author.
              </p>
            </div>


          </div>

          <CustomerReviews />
        </section>

        {/* FAQ Section with Topic Category Tabs & Animated Accordion */}
        <section id="faq" className="scroll-mt-24 space-y-5 max-w-3xl mx-auto">
          <div className="text-center space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              Pusat Bantuan &amp; FAQ
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Pertanyaan Umum Berdasarkan Topik
            </h2>
            <p className="text-xs text-slate-400">
              Pilih kategori topik di bawah ini untuk menemukan jawaban seputar Pembayaran, Proses Pesanan, dan Akun
            </p>
          </div>

          {/* Topic Category Tabs */}
          <div
            className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 no-scrollbar"
            role="tablist"
            aria-label="Kategori Topik FAQ"
          >
            {FAQ_TOPICS.map((tab) => {
              const isActive = activeFaqTopic === tab.id;
              const count =
                tab.id === 'Semua'
                  ? FAQ_ITEMS.length
                  : FAQ_ITEMS.filter((item) => item.topic === tab.id).length;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveFaqTopic(tab.id);
                    setOpenFaqIndex(0);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/25 to-purple-500/25 border-cyan-400 text-white shadow-neon-cyan'
                      : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:border-cyan-500/40'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                      isActive
                        ? 'bg-cyan-400 text-slate-950 font-extrabold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Categorized Accordion Items */}
          <div className="space-y-2.5">
            {FAQ_ITEMS.filter(
              (faq) => activeFaqTopic === 'Semua' || faq.topic === activeFaqTopic
            ).map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              const topicBadgeColor =
                faq.topic === 'Pembayaran'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : faq.topic === 'Proses Pesanan'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : faq.topic === 'Akun'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

              return (
                <div
                  key={`${faq.topic}-${idx}`}
                  className={`glass-card rounded-2xl border transition-all overflow-hidden ${
                    isOpen
                      ? 'border-cyan-400/50 bg-slate-900/90 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                      : 'border-white/10 hover:border-cyan-500/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <span
                        className={`self-start px-2 py-0.5 rounded-md text-[10px] font-extrabold border shrink-0 ${topicBadgeColor}`}
                      >
                        {faq.topic}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-white leading-snug">
                        {faq.q}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-cyan-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-white/5 text-xs text-slate-300 leading-relaxed">
                          {faq.a}{' '}
                          {faq.linkUrl && (
                            <a
                              href={faq.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 font-bold underline hover:text-cyan-300 ml-1"
                            >
                              {faq.linkText}
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/5 glass-panel py-8 pb-28 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-2 text-center md:text-left">
              <a href="#" className="inline-flex items-center gap-2.5">
                <img
                  src="/icon.svg"
                  alt="FityoraStore Logo"
                  className="w-7 h-7 rounded-lg object-contain"
                />
                <span className="font-extrabold text-xl tracking-tight text-white">
                  Fityora<span className="gradient-text">Store</span>
                </span>
              </a>
              <p className="text-xs text-slate-400 max-w-sm">
                Platform layanan top-up game online &amp; kebutuhan digital serba ada, aman,
                terpercaya, dan tercepat di Indonesia.
              </p>
            </div>

            {/* Contact & Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://instagram.com/fityoraa"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-pink-600/20 hover:border-pink-500/40 border border-white/10 text-slate-300 hover:text-pink-400 transition-all flex items-center gap-2 text-xs font-semibold"
              >
                <Instagram className="w-4 h-4" />
                <span>@fityoraa</span>
              </a>
              <a
                href="https://wa.me/628139525985"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600/20 hover:border-emerald-500/40 border border-white/10 text-slate-300 hover:text-emerald-400 transition-all flex items-center gap-2 text-xs font-semibold"
              >
                <Phone className="w-4 h-4" />
                <span>08139525985</span>
              </a>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 gap-2">
            <p>&copy; 2026 FityoraStore • Author: Cahyo Store. All rights reserved.</p>
            <div className="flex gap-4 items-center">
              <a href="#cara" className="hover:text-slate-400">
                Panduan Order
              </a>
              <a href="#faq" className="hover:text-slate-400">
                FAQ &amp; Ketentuan
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Payment Order Success Animated Receipt Modal */}
      {receiptModalMounted && (
      <Suspense fallback={null}>
      <OrderSuccessModal
        receipt={completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        onOpenQris={() => {
          if (!qrisDisplayOrder) {
            showToast('Data QRIS untuk invoice ini belum tersedia. Buat ulang pesanan jika perlu.', 'error');
            return;
          }
          setQrisModalOpen(true);
        }}
        showToast={showToast}
      />
      </Suspense>
      )}

      {/* Official GoPay Merchant QRIS Scanner Modal */}
      {qrisModalMounted && (
      <Suspense fallback={null}>
      <QrisScannerModal
        isOpen={qrisModalOpen && Boolean(qrisDisplayOrder || (confirmOrder && serverOrderReady))}
        onClose={() => setQrisModalOpen(false)}
        totalAmount={qrisDisplayOrder?.totalAmount ?? (confirmOrder ? confirmOrder.item.price + confirmOrder.payment.fee : undefined)}
        orderId={qrisDisplayOrder?.orderId ?? confirmOrder?.orderId}
        showToast={showToast}
      />
      </Suspense>
      )}

      {/* Admin Dashboard Modal (Has dedicated Author Login & Register separate from Member) */}
      <Suspense fallback={null}>
      <AdminDashboardModal
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        currentUser={currentUser}
        onAuthorAuthenticated={(authorUser) => {
          setCurrentUser(authorUser);
          if (authorUser.whatsapp) setWhatsappNumber(authorUser.whatsapp);
        }}
        fx={fx}
        onUpdateFx={handleAdminUpdateFx}
        products={products}
        onUpdateProducts={(newProducts) => {
          setProducts(newProducts);
          try {
            localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(newProducts));
          } catch {
            // ignore
          }
          // Simpan ke server (ditunda sebentar agar beberapa ubahan beruntun dikirim sekali).
          lastCatalogEditAtRef.current = Date.now();
          if (catalogPushTimerRef.current) window.clearTimeout(catalogPushTimerRef.current);
          catalogPushTimerRef.current = window.setTimeout(async () => {
            const ok = await pushCatalog(productsRef.current);
            if (ok) {
              lastCatalogEditAtRef.current = Date.now();
            } else {
              lastCatalogEditAtRef.current = Date.now() + 10 * 60 * 1000;
              showToast('Perubahan katalog/harga belum tersimpan ke server, pembeli belum melihatnya. Login ulang sebagai Author lalu coba lagi.', 'error');
            }
          }, 600);
          if (selectedProduct) {
            const updatedSelected = newProducts.find((p) => p.id === selectedProduct.id) || null;
            setSelectedProduct(updatedSelected);
          }
        }}
        showToast={showToast}
        initialTab={adminInitialTab}
      />
      </Suspense>

      {/* Shopping Cart Slide-Over Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        selectedPayment={selectedPayment}
        onSelectPayment={(pay) => setSelectedPayment(pay)}
        whatsappNumber={whatsappNumber}
        onChangeWhatsapp={(wa) => setWhatsappNumber(wa)}
        buyerEmail={buyerEmail}
        onChangeEmail={(em) => setBuyerEmail(em)}
        onCheckoutCart={handleCheckoutCart}
      />

      {/* Member Registration / Login Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        onOpenAdmin={() => setAdminOpen(true)}
        onSuccessAuth={(user, msg) => {
          setCurrentUser(user);
          if (user.whatsapp) setWhatsappNumber(user.whatsapp);
          showToast(msg, 'success');
        }}
        onLogout={() => {
          setCurrentUser(null);
          saveSessionUser(null);
          setAdminOpen(false);
          showToast('Anda telah keluar dari akun', 'info');
        }}
        showToast={showToast}
      />

      {/* Modal Order Tracker (Input Order ID & View Status + Processing Stages Breakdown from localStorage) */}
      <AnimatePresence>
        {trackerOpen && (
          <motion.div
            id="modal-tracker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel max-w-xl w-full p-5 sm:p-6 rounded-3xl border border-cyan-500/35 space-y-4 relative max-h-[90vh] overflow-y-auto shadow-neon-cyan"
            >
              <button
                onClick={() => setTrackerOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-neon-cyan shrink-0">
                  {trackerActiveTab === 'track' ? (
                    <SearchCheck className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-extrabold text-cyan-300 uppercase tracking-wider">
                    {trackerActiveTab === 'track' ? 'Pelacak Status & ETA Server' : 'Riwayat Transaksi Pelanggan'}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
                    {trackerActiveTab === 'track'
                      ? 'Lacak Status ID Pesanan & ETA'
                      : 'Riwayat Pesanan & Pesan Ulang (Re-Order)'}
                  </h3>
                </div>
              </div>

              {/* Segmented Tab Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setTrackerActiveTab('track')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    trackerActiveTab === 'track'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-neon-cyan'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SearchCheck className="w-3.5 h-3.5" />
                  <span>Lacak ID Pesanan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    refreshPastOrdersFromStorage();
                    setTrackerActiveTab('history');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    trackerActiveTab === 'history'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-neon-cyan'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Riwayat Pesanan ({pastOrdersHistory.length})</span>
                </button>
              </div>

              {trackerActiveTab === 'track' ? (
                <>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Masukkan Nomor / ID Pesanan Anda (contoh: <code className="text-cyan-300 font-mono">CS-xxxxx</code>) untuk melihat status terkini dan estimasi waktu tiba (ETA) langsung dari server.
                  </p>

                  {/* Quick Select from LocalStorage Past Orders if available */}
                  {pastOrdersHistory.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Pilih Cepat dari Riwayat Transaksi Anda ({pastOrdersHistory.length}):
                      </span>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {pastOrdersHistory.slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setTrackerInput(item.id);
                              setTrackerResult(null);
                            }}
                            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-extrabold border whitespace-nowrap transition-all cursor-pointer ${
                              trackerInput.toUpperCase() === item.id
                                ? 'bg-cyan-500/25 border-cyan-400 text-white'
                                : 'bg-slate-900 border-white/10 text-cyan-300 hover:border-cyan-500/40'
                            }`}
                          >
                            #{item.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        id="tracker-id-input"
                        value={trackerInput}
                        onChange={(e) => setTrackerInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCheckOrderStatus();
                        }}
                        placeholder="Masukkan ID Pesanan (cth: CS-84920)"
                        className="w-full bg-slate-900 border border-white/15 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono font-bold text-white uppercase focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleCheckOrderStatus}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs transition-all cursor-pointer shrink-0 shadow-neon-cyan"
                    >
                      Cek Status Sekarang
                    </button>
                  </div>

                  {trackerResult && (
                    <div
                      id="tracker-result"
                      className="p-4 rounded-2xl bg-slate-950/90 border border-cyan-500/30 text-xs space-y-4"
                    >
                      {trackerResult.found && trackerResult.data ? (
                        (() => {
                          const tx = trackerResult.data;
                          const eta = getOrderEtaDetails(tx.status);
                          return (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-extrabold">
                                    ✓ Data Pesanan Ditemukan
                                  </span>
                                  <span className="font-mono font-extrabold text-white px-2 py-0.5 rounded bg-slate-900 border border-white/10">
                                    #{tx.id}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(tx.id);
                                      showToast(`ID Pesanan #${tx.id} disalin!`, 'success');
                                    }}
                                    className="px-2 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer"
                                  >
                                    <ClipboardCheck className="w-3 h-3" />
                                    <span>Copy Order ID</span>
                                  </button>
                                  <a
                                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                      `Halo Admin CahyoStore, berikut status pesanan saya:\n\n📋 *STATUS PESANAN CAHYOSTORE*\n• ID Pesanan: *#${tx.id}*\n• Layanan: *${tx.product}*\n• Item: *${tx.item}*\n• Target / User ID: *${tx.target}*\n• Total Bayar: *${tx.total}*\n• Metode Bayar: *${tx.payment || 'QRIS'}*\n• Status: *${eta.badgeLabel}* (${eta.etaTime})\n\nMohon bantu cek proses pesanan saya, terima kasih!`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer"
                                    title="Bagikan status pesanan ini via WhatsApp"
                                  >
                                    <MessageCircle className="w-3 h-3 text-emerald-400" />
                                    <span>Bagikan ke WhatsApp</span>
                                  </a>
                                </div>
                                <span
                                  className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-extrabold ${eta.badgeColor}`}
                                >
                                  {eta.badgeLabel}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5">
                                  <span className="text-[10px] text-slate-400 block">Layanan &amp; Item</span>
                                  <span className="font-extrabold text-white">
                                    {tx.product} — <span className="text-cyan-300">{tx.item}</span>
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5">
                                  <span className="text-[10px] text-slate-400 block">ID Tujuan / Target</span>
                                  <span className="font-mono font-bold text-cyan-300">{tx.target}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5">
                                  <span className="text-[10px] text-slate-400 block">Total &amp; Metode Bayar</span>
                                  <span className="font-extrabold text-emerald-400">
                                    {tx.total} ({tx.payment || 'QRIS'})
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5">
                                  <span className="text-[10px] text-slate-400 block">Estimasi Waktu Tiba (ETA)</span>
                                  <span className="font-extrabold text-amber-300">{eta.etaTime}</span>
                                </div>
                              </div>

                              {/* Detailed Breakdown of Processing Stages */}
                              <div className="space-y-2.5 pt-2 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                                    Rincian Tahapan Pemrosesan (Processing Stages)
                                  </span>
                                  <span className="text-[11px] font-mono font-extrabold text-cyan-300">
                                    {eta.progressPct}% Selesai
                                  </span>
                                </div>

                                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-emerald-400 transition-all duration-500"
                                    style={{ width: `${eta.progressPct}%` }}
                                  />
                                </div>

                                <div className="space-y-2 pt-1">
                                  {ORDER_STAGES.map((st, idx) => {
                                    const isDone = idx < eta.stageIdx || eta.stageIdx === 3;
                                    const isCurrent = idx === eta.stageIdx && eta.stageIdx !== 3;
                                    return (
                                      <div
                                        key={st.key}
                                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                                          isCurrent
                                            ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                                            : isDone
                                            ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                                            : 'bg-slate-900/60 border-white/5 text-slate-500'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <div
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0 mt-0.5 ${
                                              isCurrent
                                                ? 'bg-cyan-400 text-slate-950'
                                                : isDone
                                                ? 'bg-emerald-500 text-slate-950'
                                                : 'bg-slate-800 text-slate-400'
                                            }`}
                                          >
                                            {isDone ? '✓' : idx + 1}
                                          </div>
                                          <div>
                                            <div className="text-xs font-extrabold">{st.label}</div>
                                            <div className="text-[11px] opacity-85">{st.desc}</div>
                                            {(() => {
                                              const iso = idx === 0 ? tx.createdAt : idx === 1 ? tx.verifiedAt : idx === 3 ? tx.shippedAt : undefined;
                                              const d = iso ? new Date(iso) : null;
                                              if (!d || Number.isNaN(d.getTime()) || !(isDone || isCurrent)) return null;
                                              return (
                                                <div className="text-[10px] font-mono opacity-70 mt-0.5">
                                                  {d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                        <span
                                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                                            isCurrent
                                              ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-300/40 animate-pulse'
                                              : isDone
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : 'bg-slate-800 text-slate-500'
                                          }`}
                                        >
                                          {isCurrent ? 'Tahap Saat Ini' : isDone ? 'Selesai' : 'Menunggu'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Kontak Author & ulasan */}
                              <div className="pt-3 border-t border-white/10 space-y-3">
                                <a
                                  href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                                    `Halo Admin FityoraStore, saya ingin menanyakan pesanan *#${tx.id}* (${tx.product} - ${tx.item}). Status saat ini: ${eta.badgeLabel}.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/35 transition-colors"
                                >
                                  <span className="flex items-center gap-2.5 min-w-0">
                                    <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="block text-xs font-extrabold text-white">Ada kendala? Hubungi Author via WhatsApp</span>
                                      <span className="block text-[10px] text-slate-400">+{ADMIN_WHATSAPP_NUMBER} • ID pesanan sudah terisi otomatis</span>
                                    </span>
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-300 shrink-0">Chat →</span>
                                </a>
                                {tx.fulfillmentStatus === 'shipped' && (
                                  <ReviewForm orderId={tx.id} defaultName={currentUser?.name?.split(' ')[0] || ''} showToast={showToast} />
                                )}
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        <div className="space-y-1.5 text-center py-3">
                          <div className="text-rose-400 font-extrabold text-sm">
                            ✕ ID Pesanan Tidak Ditemukan di Server
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            Pastikan Anda memasukkan ID Pesanan yang benar (contoh: CS-84920) atau pilih langsung dari tab <strong>Riwayat Pesanan</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Tab 2: Riwayat Transaksi */
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="text-xs text-slate-300">
                      Total <strong>{pastOrdersHistory.length}</strong> pesanan tersimpan di perangkat ini.
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={refreshPastOrdersFromStorage}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-[11px] font-bold text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Segarkan riwayat"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                      {pastOrdersHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearOrderHistory}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-[11px] font-black text-rose-300 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95"
                          title="Hapus seluruh riwayat pesanan yang tersimpan di perangkat ini"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Hapus Semua Riwayat Perangkat</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTrackerOpen(false);
                          setAdminInitialTab('orders');
                          setAdminOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-[11px] font-black text-purple-300 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        title="Menu Khusus Author: Kelola dan Hapus Riwayat Pesanan di Dashboard Author"
                      >
                        <span>Dashboard Author</span>
                      </button>
                    </div>
                  </div>

                  {pastOrdersHistory.length === 0 ? (
                    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">Belum Ada Riwayat Transaksi</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                          Setiap pesanan yang Anda buat di CahyoStore akan otomatis tersimpan di sini lengkap dengan lencana status dan tombol <strong>Pesan Ulang (Re-Order) 1-klik</strong>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTrackerOpen(false)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold text-xs shadow-neon-cyan cursor-pointer transition-all"
                      >
                        Pilih Game &amp; Top Up Sekarang
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {pastOrdersHistory.map((tx) => {
                        const eta = getOrderEtaDetails(tx.status);
                        const matchedProd = products.find(
                          (p) =>
                            p.name.toLowerCase() === (tx.product || '').toLowerCase() ||
                            (tx.product || '').toLowerCase().includes(p.name.toLowerCase())
                        );
                        return (
                          <div
                            key={tx.id}
                            className="rounded-2xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 p-3.5 space-y-3 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs font-extrabold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-lg">
                                  #{tx.id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(tx.id);
                                    showToast(`ID Pesanan #${tx.id} disalin!`, 'success');
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <ClipboardCheck className="w-3 h-3" />
                                  <span>Copy ID</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSinglePastOrder(tx.id)}
                                  className="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/35 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                  title="Hapus riwayat pesanan ini dari perangkat"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[9px] font-extrabold uppercase tracking-wide ${eta.badgeColor}`}
                              >
                                {eta.stageIdx >= 3
                                  ? '✓ Selesai'
                                  : eta.stageIdx === 2
                                  ? '⚡ Dikirim'
                                  : eta.stageIdx === 1
                                  ? '🔄 Diproses'
                                  : '⏳ Verifikasi'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {matchedProd && (
                                <img
                                  src={matchedProd.image}
                                  alt={tx.product}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const t = e.currentTarget;
                                    t.onerror = null;
                                    t.src = placeholderImage(matchedProd.id, matchedProd.name);
                                  }}
                                  className="w-11 h-11 rounded-xl object-cover bg-slate-900 border border-white/10 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-extrabold text-white truncate">
                                  {tx.product}
                                </h4>
                                <p className="text-[11px] font-bold text-cyan-400 truncate">
                                  {tx.item}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono truncate">
                                  Target: {tx.target}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] text-slate-400 block">
                                  {tx.createdAt || 'Baru saja'}
                                </span>
                                <span className="text-xs font-extrabold text-emerald-400 tabular-nums">
                                  {tx.total}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400">
                                Metode: <strong className="text-slate-200">{tx.payment || 'QRIS'}</strong>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrackerInput(tx.id);
                                    setTrackerResult({ found: true, data: tx });
                                    setTrackerActiveTab('track');
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 cursor-pointer transition-colors"
                                >
                                  Cek Status &amp; ETA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReorderPastTransaction(tx)}
                                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-95 text-white text-[10px] font-extrabold shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Pesan Ulang</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation Checkout */}
      <AnimatePresence>
        {confirmOrder && (
          <motion.div
            id="modal-checkout-confirm"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              backgroundColor: confirmQrisLocked
                ? 'rgba(0, 0, 0, 0.92)'
                : 'rgba(0, 0, 0, 0.78)'
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            onClick={() => setConfirmOrder(null)}
            className="fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.86, y: 24 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                boxShadow: confirmQrisLocked
                  ? '0 0 42px rgba(16, 185, 129, 0.28)'
                  : '0 0 32px rgba(0, 240, 255, 0.22)'
              }}
              exit={{ opacity: 0, scale: 0.92, y: 14, transition: { duration: 0.18 } }}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 24,
                mass: 0.85
              }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel max-w-lg w-full p-5 sm:p-6 rounded-3xl border border-cyan-500/30 space-y-4 sm:space-y-5 relative max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              {/* Prominent Floating Close Button (X) so user never gets stuck */}
              <button
                type="button"
                onClick={() => setConfirmOrder(null)}
                className="sticky float-right top-0 -mr-1 -mt-1 z-30 p-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/20 shadow-xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
                title="Tutup & Kembali"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              {/* Auto-Dim Background Overlay when QR Scanner Reticle Locks Onto a Valid Scan */}
              <AnimatePresence>
                {confirmQrisLocked && showPaymentInstructions && (
                  <motion.div
                    key="qris-lock-auto-dim-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/65 backdrop-blur-[1.5px] z-10"
                  />
                )}
              </AnimatePresence>

              <div
                className={`flex items-center justify-between gap-3 transition-all duration-300 ${
                  confirmQrisLocked && showPaymentInstructions
                    ? 'opacity-45 brightness-75'
                    : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white">Konfirmasi Pesanan</h3>
                    <p className="text-xs text-slate-400">
                      Periksa kembali detail transaksi sebelum melanjutkan
                    </p>
                  </div>
                </div>

                {/* Animated Live Status Indicator Badge in Checkout Confirmation Modal */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={autoPaymentState.status}
                    initial={{ opacity: 0, scale: 0.88, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.88, y: 4 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold shrink-0 select-none ${
                      autoPaymentState.status === 'verified'
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.28)]'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          autoPaymentState.status === 'verified' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          autoPaymentState.status === 'verified'
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                            : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                        }`}
                      />
                    </span>
                    <span className="leading-tight">
                      {submitting
                        ? 'Memproses Pesanan...'
                        : autoPaymentState.status === 'verified'
                        ? 'Pembayaran Dikonfirmasi Admin'
                        : 'Menunggu Pembayaran'}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Status pembayaran dari server */}
              <motion.div
                animate={{
                  borderColor:
                    autoPaymentState.status === 'verified'
                      ? [
                          'rgba(16, 185, 129, 0.45)',
                          'rgba(52, 211, 153, 0.85)',
                          'rgba(16, 185, 129, 0.45)'
                        ]
                      : [
                          'rgba(0, 240, 255, 0.2)',
                          'rgba(251, 191, 36, 0.45)',
                          'rgba(0, 240, 255, 0.2)'
                        ]
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className={`px-3.5 py-2.5 rounded-2xl border flex flex-col gap-1.5 text-[11px] transition-all duration-500 ${
                  confirmQrisLocked && showPaymentInstructions
                    ? 'opacity-40 brightness-75'
                    : 'opacity-100'
                } ${
                  autoPaymentState.status === 'verified'
                    ? 'bg-emerald-950/40 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-950/90 border-cyan-500/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {autoPaymentState.status === 'verified' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                      </span>
                    )}
                    <span className="text-slate-300 truncate">
                      Status Pembayaran:{' '}
                      <strong
                        className={
                          autoPaymentState.status === 'verified'
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }
                      >
                        {remainingSeconds <= 0
                          ? 'Batas Waktu Pembayaran Kedaluwarsa'
                          : autoPaymentState.status === 'verified'
                          ? `Pembayaran Terverifikasi (${confirmOrder.payment.name})`
                          : `Menunggu Pembayaran (${confirmOrder.payment.name})`}
                      </strong>
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-extrabold shrink-0 px-2 py-0.5 rounded-md ${
                      autoPaymentState.status === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-cyan-500/15 text-cyan-300 animate-pulse'
                    }`}
                  >
                    {autoPaymentState.status === 'verified' ? '✓ DIKONFIRMASI ADMIN' : 'MENUNGGU PEMBAYARAN'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pl-6">
                  <span className="truncate">
                    {autoPaymentState.message ||
                      'Untuk GoPay Merchant saat ini, admin harus memeriksa pembayaran melalui aplikasi merchant.'}
                  </span>
                  {autoPaymentState.verifiedAt && (
                    <span className="font-mono text-emerald-400 shrink-0 ml-2">
                      {autoPaymentState.verifiedAt}
                    </span>
                  )}
                </div>
              </motion.div>

              {/* 10-Minute Transaction Countdown Timer Card */}
              <div
                className={`p-3.5 rounded-2xl border space-y-2 transition-all duration-300 ${
                  confirmQrisLocked && showPaymentInstructions
                    ? 'opacity-40 brightness-75'
                    : 'opacity-100'
                } ${
                  remainingSeconds === 0
                    ? 'bg-rose-950/50 border-rose-500/40'
                    : remainingSeconds <= 120
                    ? 'bg-amber-950/40 border-amber-500/40'
                    : 'bg-slate-950/85 border-cyan-500/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className={`w-4 h-4 shrink-0 ${
                        remainingSeconds === 0
                          ? 'text-rose-400'
                          : remainingSeconds <= 120
                          ? 'text-amber-400 animate-pulse'
                          : 'text-cyan-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">
                        {remainingSeconds > 0
                          ? 'Selesaikan Pembayaran Sebelum Kedaluwarsa'
                          : 'Waktu Pembayaran Telah Habis (Expired)'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Dibuat: <span className="text-slate-200 font-semibold">{confirmOrder.createdAtFormatted}</span> • Batas:{' '}
                        <span className="text-amber-300 font-semibold">{confirmOrder.expiresAtFormatted}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {remainingSeconds === 0 ? (
                      <button
                        type="button"
                        onClick={handleRefreshCheckoutTimer}
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-neon-cyan"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Perbarui QR (2 Menit)</span>
                      </button>
                    ) : (
                      <div
                        id="checkout-countdown-timer"
                        className={`px-3 py-1 rounded-xl font-mono text-sm font-extrabold tabular-nums border ${
                          remainingSeconds <= 30
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 animate-pulse'
                            : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                        }`}
                      >
                        {formatCountdown(remainingSeconds)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Depleting Progress Bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    animate={{
                      width: `${Math.max(
                        0,
                        Math.min(100, (remainingSeconds / CHECKOUT_EXPIRY_SECONDS) * 100)
                      )}%`
                    }}
                    transition={{ duration: 0.4, ease: 'linear' }}
                    className={`h-full rounded-full ${
                      remainingSeconds === 0
                        ? 'bg-rose-500'
                        : remainingSeconds <= 120
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-cyan-400 via-purple-500 to-emerald-400'
                    }`}
                  />
                </div>
              </div>

              <div
                className={`space-y-2 bg-slate-900/90 p-4 rounded-2xl border border-white/5 text-xs text-slate-300 transition-all duration-300 ${
                  confirmQrisLocked && showPaymentInstructions
                    ? 'opacity-40 brightness-75'
                    : 'opacity-100'
                }`}
                id="confirm-details-list"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">ID Pesanan:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-cyan-400 tabular-nums">
                      {confirmOrder.orderId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(confirmOrder.orderId);
                        showToast(`Order ID ${confirmOrder.orderId} berhasil disalin!`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 transition-colors cursor-pointer"
                      title="Salin ID Pesanan"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin ID Pesanan</span>
                    </button>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="text-amber-300">PENTING — Wajib Salin ID Pesanan ({confirmOrder.orderId}):</strong>{' '}
                    Simpan / salin ID Pesanan ini untuk mengecek status pengiriman di halaman utama atau hubungi CS via WhatsApp jika ada kendala.
                  </div>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Layanan:</span>
                  <span className="font-bold text-white">{confirmOrder.product.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Tujuan (ID):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400">
                      {confirmOrder.userId} {confirmOrder.zoneId ? `(${confirmOrder.zoneId})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const targetText = `${confirmOrder.userId}${
                          confirmOrder.zoneId ? ` (${confirmOrder.zoneId})` : ''
                        }`;
                        navigator.clipboard?.writeText(targetText);
                        showToast(`Tujuan ID (${targetText}) berhasil disalin!`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] font-semibold text-slate-300 transition-colors cursor-pointer"
                      title="Salin Tujuan ID"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Nominal:</span>
                  <span className="font-bold text-white">{confirmOrder.item.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Pembayaran:</span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className="font-bold text-white">{confirmOrder.payment.name}</span>
                    {(() => {
                      const paymentIsVerified = autoPaymentState.status === 'verified';
                      const statusLabel = paymentIsVerified ? 'Terverifikasi Admin' : 'Perlu Verifikasi Admin';
                      return (
                        <span
                          id="payment-verification-badge"
                          title={`Status pembayaran (${confirmOrder.payment.name}): ${statusLabel}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition-all ${
                            paymentIsVerified
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                              : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          }`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>Status: {statusLabel}</span>
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => serverOrderReady ? setQrisModalOpen(true) : showToast('Invoice belum tercatat di server. Jangan membayar dulu.', 'error')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-[10px] font-extrabold text-emerald-300 transition-colors cursor-pointer"
                      title="Scan QRIS Resmi Cahyo Store"
                    >
                      <QrCode className="w-3 h-3" />
                      <span>Scan QR</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">No. WA Pembeli:</span>
                  <span className="font-bold text-white">{confirmOrder.wa}</span>
                </div>
                {confirmOrder.email && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Email Struk:</span>
                    <span className="font-bold text-cyan-300">{confirmOrder.email}</span>
                  </div>
                )}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Harga Item:</span>
                      <span className="font-bold text-white tabular-nums">
                        Rp {confirmOrder.item.price.toLocaleString('id-ID')}
                      </span>
                    </div>
                    {confirmOrder.uniqueCode && confirmOrder.uniqueCode > 0 ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Kode Unik Verifikasi:</span>
                        <span className="font-mono font-extrabold text-emerald-400 tabular-nums">
                          Rp {confirmOrder.uniqueCode.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ) : null}
                    {confirmOrder.payment.fee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Biaya Layanan Admin:</span>
                        <span className="font-bold text-slate-300 tabular-nums">
                          Rp {confirmOrder.payment.fee.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-white/10">
                      <span className="text-slate-200 font-extrabold text-xs">Total Pembayaran:</span>
                      <span className="font-extrabold text-cyan-400 text-base tabular-nums">
                        Rp {(confirmOrder.item.price + confirmOrder.payment.fee + (confirmOrder.uniqueCode || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-500/25 rounded-lg px-2.5 py-1 text-center font-medium">
                      ⚠️ Transfer tepat <strong>Rp {(confirmOrder.item.price + confirmOrder.payment.fee + (confirmOrder.uniqueCode || 0)).toLocaleString('id-ID')}</strong> agar transaksi langsung terverifikasi.
                    </div>
                  </div>

                  {/* Preview Struk Link & Expandable HTML Receipt Preview Section */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-purple-400" />
                        <span>Format E-Receipt HTML Resmi</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowConfirmReceiptPreview((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{showConfirmReceiptPreview ? 'Tutup Preview Struk' : 'Preview Struk'}</span>
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {showConfirmReceiptPreview && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-xl overflow-hidden border border-purple-500/35 bg-slate-950 space-y-2 p-2">
                            <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
                              <span className="font-bold text-purple-300 truncate">
                                Pratinjau Struk HTML ({confirmOrder.orderId})
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const previewHtml = generateHtmlEmailReceipt({
                                      orderId: confirmOrder.orderId,
                                      productName: confirmOrder.product.name,
                                      itemName: confirmOrder.item.name,
                                      targetId: `${confirmOrder.userId}${
                                        confirmOrder.zoneId ? ` (${confirmOrder.zoneId})` : ''
                                      }`,
                                      paymentId: confirmOrder.payment.id,
                                      paymentName: confirmOrder.payment.name,
                                      paymentGroup: confirmOrder.payment.group,
                                      totalFormatted: `Rp ${(
                                        confirmOrder.item.price + confirmOrder.payment.fee
                                      ).toLocaleString('id-ID')}`,
                                      whatsapp: confirmOrder.wa,
                                      email: confirmOrder.email,
                                      timestamp: confirmOrder.createdAtFormatted,
                                      waUrl: `https://wa.me/${ADMIN_WHATSAPP_NUMBER}`
                                    });
                                    navigator.clipboard?.writeText(previewHtml);
                                    showToast('Kode HTML Struk berhasil disalin!', 'success');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/35 text-purple-200 font-bold cursor-pointer transition-colors"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Salin HTML</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const previewHtml = generateHtmlEmailReceipt({
                                      orderId: confirmOrder.orderId,
                                      productName: confirmOrder.product.name,
                                      itemName: confirmOrder.item.name,
                                      targetId: `${confirmOrder.userId}${
                                        confirmOrder.zoneId ? ` (${confirmOrder.zoneId})` : ''
                                      }`,
                                      paymentId: confirmOrder.payment.id,
                                      paymentName: confirmOrder.payment.name,
                                      paymentGroup: confirmOrder.payment.group,
                                      totalFormatted: `Rp ${(
                                        confirmOrder.item.price + confirmOrder.payment.fee
                                      ).toLocaleString('id-ID')}`,
                                      whatsapp: confirmOrder.wa,
                                      email: confirmOrder.email,
                                      timestamp: confirmOrder.createdAtFormatted,
                                      waUrl: `https://wa.me/${ADMIN_WHATSAPP_NUMBER}`
                                    });
                                    const blob = new Blob([previewHtml], {
                                      type: 'text/html;charset=utf-8'
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `Struk-${confirmOrder.orderId}.html`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                    showToast(
                                      `Struk HTML (${confirmOrder.orderId}.html) berhasil diunduh!`,
                                      'success'
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold cursor-pointer transition-colors"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>Download Struk</span>
                                </button>
                              </div>
                            </div>
                            <iframe
                              title={`Preview Struk ${confirmOrder.orderId}`}
                              srcDoc={generateHtmlEmailReceipt({
                                orderId: confirmOrder.orderId,
                                productName: confirmOrder.product.name,
                                itemName: confirmOrder.item.name,
                                targetId: `${confirmOrder.userId}${
                                  confirmOrder.zoneId ? ` (${confirmOrder.zoneId})` : ''
                                }`,
                                paymentId: confirmOrder.payment.id,
                                paymentName: confirmOrder.payment.name,
                                paymentGroup: confirmOrder.payment.group,
                                totalFormatted: `Rp ${(
                                  confirmOrder.item.price + confirmOrder.payment.fee
                                ).toLocaleString('id-ID')}`,
                                whatsapp: confirmOrder.wa,
                                email: confirmOrder.email,
                                timestamp: confirmOrder.createdAtFormatted,
                                waUrl: `https://wa.me/${ADMIN_WHATSAPP_NUMBER}`
                              })}
                              className="w-full h-52 rounded-lg bg-slate-950 border border-white/10"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Collapsible Instruksi Pembayaran Section */}
                <div className="relative z-20 rounded-2xl bg-slate-900/75 border border-white/10 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setShowPaymentInstructions((prev) => !prev)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left font-bold text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Instruksi Pembayaran ({confirmOrder.payment.name})</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        showPaymentInstructions ? 'rotate-180 text-cyan-400' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {showPaymentInstructions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3.5 pt-2 border-t border-white/5 text-[11px] text-slate-300 leading-relaxed space-y-2.5">
                          <p>{getPaymentInstructionText(confirmOrder.payment)}</p>

                          {/* E-Wallet Direct Transfer Box (GoPay, DANA, OVO, ShopeePay) */}
                          {confirmOrder.payment.id !== 'qris' ? (
                            <div className="relative z-20 p-3.5 rounded-2xl bg-slate-950/95 border border-cyan-500/30 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2">
                                  <PaymentMethodLogo id={confirmOrder.payment.id} size="sm" />
                                  <div>
                                    <div className="font-extrabold text-white text-xs">{confirmOrder.payment.name} Transfer</div>
                                    <div className="text-[10px] text-slate-400">Tujuan Akun Resmi Cahyo Store</div>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-300">
                                  Akun Terverifikasi
                                </span>
                              </div>

                              <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">Nomor HP Akun {confirmOrder.payment.name}:</span>
                                  <span className="text-slate-300 font-bold">a/n <strong className="text-emerald-300">CAHYO</strong></span>
                                </div>
                                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-cyan-500/30">
                                  <span className="font-mono text-base font-extrabold text-cyan-300 tracking-wider">
                                    0813-9525-985
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText('08139525985');
                                      showToast('Nomor HP 08139525985 (a/n CAHYO) berhasil disalin!', 'success');
                                    }}
                                    className="px-2.5 py-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Salin No. HP</span>
                                  </button>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                                  <span className="text-slate-400">Jumlah Transfer Wajib:</span>
                                  <span className="font-mono font-extrabold text-emerald-400 text-sm">
                                    Rp {(confirmOrder.item.price + confirmOrder.payment.fee + (confirmOrder.uniqueCode || 0)).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[10px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl leading-relaxed">
                                💡 <strong>Penting:</strong> Masukkan jumlah transfer tepat sesuai total tagihan agar pembayaran diverifikasi secara otomatis.
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* QRIS Merchant Information Display with Custom 'NMID Info' Tooltip Trigger & Copy NMID Button */}
                              <div className="relative p-2.5 rounded-xl bg-slate-950/90 border border-cyan-500/25 flex items-center justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-[11px] font-extrabold text-white truncate">
                                    {CAHYO_QRIS_INFO.merchantName}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-cyan-400 truncate">
                                      NMID: {CAHYO_QRIS_INFO.nmid}
                                    </span>

                                    {/* Custom 'NMID Info' Tooltip Trigger near NMID text */}
                                    <div
                                      className="relative inline-flex items-center"
                                      onMouseEnter={() => setShowConfirmNmidTooltip(true)}
                                      onMouseLeave={() => setShowConfirmNmidTooltip(false)}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setShowConfirmNmidTooltip((prev) => !prev)}
                                        onFocus={() => setShowConfirmNmidTooltip(true)}
                                        onBlur={() => setShowConfirmNmidTooltip(false)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-[9px] font-extrabold text-emerald-300 transition-colors cursor-pointer"
                                        aria-label="Info identitas QRIS"
                                      >
                                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                                        <span>NMID Info</span>
                                      </button>

                                      {showConfirmNmidTooltip && (
                                        <div
                                          role="tooltip"
                                          className="absolute left-0 bottom-full mb-2 w-64 sm:w-72 p-2.5 rounded-xl bg-slate-950/98 border border-emerald-400/50 shadow-[0_12px_30px_rgba(2,6,23,0.95),0_0_18px_rgba(16,185,129,0.22)] z-40 text-left space-y-1.5 pointer-events-none"
                                        >
                                          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1">
                                            <span className="text-[10px] font-extrabold text-emerald-300 flex items-center gap-1">
                                              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                              <span>Informasi QRIS</span>
                                            </span>
                                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[8px] font-bold">
                                              TID: {CAHYO_QRIS_INFO.terminalId}
                                            </span>
                                          </div>
                                          <div className="space-y-1 text-[9px] leading-snug">
                                            <div>
                                              <span className="text-slate-400 block font-semibold">
                                                Merchant Category Code (MCC):
                                              </span>
                                              <span className="font-mono font-bold text-cyan-300">
                                                {CAHYO_QRIS_INFO.mcc}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 block font-semibold">Jenis QRIS:</span>
                                              <span className="text-slate-200 font-medium">QRIS statis — tidak menerima status pembayaran langsung ke website.</span>
                                            </div>
                                          </div>
                                          <span className="absolute -bottom-1 left-6 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-emerald-400/50" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(CAHYO_QRIS_INFO.nmid);
                                    setCopiedConfirmNmid(true);
                                    showToast(
                                      `NMID Disalin (${CAHYO_QRIS_INFO.nmid})`,
                                      'success'
                                    );
                                    window.setTimeout(() => setCopiedConfirmNmid(false), 2000);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-[10px] font-extrabold text-cyan-300 shrink-0 transition-colors cursor-pointer"
                                  title="Salin NMID Merchant QRIS"
                                >
                                  {copiedConfirmNmid ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">NMID Disalin</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-cyan-400" />
                                      <span>Copy NMID</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Error QR116XXS Guidance Box */}
                              <div className="w-full rounded-xl p-3 bg-amber-500/10 border border-amber-400/30 text-left space-y-1.5 text-[10px] text-amber-200">
                                <div className="font-bold flex items-center gap-1 text-amber-300">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Kendala Scan QR di GoPay? (Error QR116XXS)</span>
                                </div>
                                <p className="leading-relaxed text-slate-300">
                                  Jika pemilik toko scan QRIS tokonya sendiri menggunakan akun GoPay pribadinya, GoPay otomatis menolak dengan error <strong className="text-amber-300 font-mono">QR116XXS</strong> (sistem proteksi anti self-scan GoPay).
                                </p>
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-400/20">
                                  <span className="text-slate-200 font-semibold">Solusi: Transfer langsung ke No. HP:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText('08139525985');
                                      showToast('Nomor HP 08139525985 a/n CAHYO berhasil disalin!', 'success');
                                    }}
                                    className="px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 font-extrabold text-[9px] flex items-center gap-1 cursor-pointer shrink-0"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>Salin 0813-9525-985</span>
                                  </button>
                                </div>
                              </div>

                              {/* Static QRIS Card */}
                              <div className="relative z-20 p-4 rounded-2xl bg-slate-950/95 border border-cyan-500/30 flex flex-col items-center text-center gap-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-[10px] font-extrabold">
                                  <QrCode className="w-3.5 h-3.5" /> QRIS STATIS MERCHANT
                                </div>
                                {serverOrderReady ? (
                                  <img
                                    src={CAHYO_QRIS_DATA_URL}
                                    alt="QRIS statis Cahyo Store, Pulsa & Tagihan"
                                    className="w-56 max-w-full h-auto bg-white rounded-xl p-1.5"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).src = '/images/qris-official.png';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-200" role="status">
                                    Invoice belum dikonfirmasi tersimpan di server. Jangan membayar dahulu; periksa koneksi lalu buat ulang pesanan bila perlu.
                                  </div>
                                )}
                                <div className="w-full rounded-xl p-3 bg-slate-900 border border-white/10 text-left space-y-1.5">
                                  <p className="text-xs font-extrabold text-white">CAHYO STORE, PULSA &amp; TAGIHAN</p>
                                  <p className="text-[11px] text-slate-300">NMID: <span className="font-mono text-cyan-200">{CAHYO_QRIS_INFO.nmid}</span></p>
                                  <p className="text-[11px] text-emerald-300 font-semibold">
                                    Total tagihan: <strong className="text-white">Rp {(confirmOrder.item.price + confirmOrder.payment.fee + (confirmOrder.uniqueCode || 0)).toLocaleString('id-ID')}</strong> (pas sesuai tagihan)
                                  </p>
                                  <p className="text-[10px] text-slate-400 leading-relaxed">Pembayaran QRIS diproses langsung oleh Admin 24 jam setelah pembayaran terkonfirmasi.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                  <button
                                    type="button"
                                    onClick={() => serverOrderReady ? handleDownloadHighResQrisPng(confirmOrder.orderId) : showToast('Invoice belum tercatat di server. Jangan membayar dulu.', 'error')}
                                    className="py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" /><span>Download QRIS (PNG)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => serverOrderReady ? setQrisModalOpen(true) : showToast('Invoice belum tercatat di server. Jangan membayar dulu.', 'error')}
                                    className="py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <QrCode className="w-3.5 h-3.5" /><span>Perbesar QRIS</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative z-20 flex flex-col gap-2.5">
                  <div className="flex gap-3">
                    <button
                      onClick={() => !submitting && setConfirmOrder(null)}
                      disabled={submitting}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer disabled:opacity-50 transition-all"
                    >
                      Perbaiki Input
                    </button>
                    <button
                      onClick={processDirectWhatsAppCheckout}
                      disabled={submitting || remainingSeconds <= 0}
                      className="pulse-animation flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {submitting ? (
                        <>
                          <svg
                            className="w-4 h-4 animate-spin text-slate-950"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeOpacity="0.25"
                              strokeWidth="3"
                            />
                            <motion.circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray="56.5"
                              initial={{ strokeDashoffset: 56.5 }}
                              animate={{ strokeDashoffset: 8 }}
                              transition={{ duration: 0.85, ease: 'easeInOut' }}
                            />
                          </svg>
                          <span>Memproses Transaksi...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Lanjut ke WhatsApp</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Explicit Bottom Full-Width Close Button */}
                  <button
                    type="button"
                    onClick={() => !submitting && setConfirmOrder(null)}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tutup &amp; Batalkan Transaksi</span>
                  </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Bottom Navigation Dock (Ergonomic Bar for Mobile & Centered Floating Dock for Desktop/Tablet) */}
      <nav
        aria-label="Navigasi Utama CahyoStore"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-cyan-500/25 px-2 py-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.7)] md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto md:min-w-[560px] md:max-w-2xl md:rounded-2xl md:border md:border-cyan-500/30 md:px-5 md:py-2 md:shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_24px_rgba(6,182,212,0.25)] md:pb-2"
      >
        <div className="flex items-center justify-around md:justify-center gap-1 md:gap-3 max-w-md md:max-w-none mx-auto">
          {/* Beranda */}
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setSelectedProduct(null);
            }}
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 text-slate-400 hover:text-cyan-400 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title="Beranda & Katalog Game"
          >
            <Home className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] md:text-[11px] font-bold">Beranda</span>
          </button>

          {/* Lacak Pesanan */}
          <button
            type="button"
            onClick={() => {
              setTrackerResult(null);
              setTrackerActiveTab('track');
              setTrackerOpen(true);
            }}
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 text-slate-400 hover:text-cyan-400 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title="Lacak Status Pesanan & ETA"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] md:text-[11px] font-bold">Lacak</span>
          </button>

          {/* Riwayat Transaksi */}
          <button
            type="button"
            onClick={() => {
              refreshPastOrdersFromStorage();
              setTrackerActiveTab('history');
              setTrackerOpen(true);
            }}
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 relative text-slate-400 hover:text-purple-400 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title="Riwayat Pesanan & Re-Order 1-Klik"
          >
            <div className="relative">
              <Clock className="w-4 h-4 text-purple-400" />
              {pastOrdersHistory.length > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-purple-500 text-white font-extrabold text-[9px] leading-tight">
                  {pastOrdersHistory.length}
                </span>
              )}
            </div>
            <span className="text-[10px] md:text-[11px] font-bold">Riwayat</span>
          </button>

          {/* Troli Belanja */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 relative text-slate-400 hover:text-cyan-400 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title="Troli Belanja Multi-Order"
          >
            <div className="relative">
              <ShoppingCart className="w-4 h-4 text-cyan-400" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-extrabold text-[9px] leading-tight">
                  {totalCartItems}
                </span>
              )}
            </div>
            <span className="text-[10px] md:text-[11px] font-bold">Troli</span>
          </button>

          {/* Member */}
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 text-slate-400 hover:text-cyan-400 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title={currentUser && !isAuthorAccount(currentUser) ? `Akun: ${currentUser.name}` : 'Daftar / Masuk Akun Member'}
          >
            {currentUser && !isAuthorAccount(currentUser) ? (
              <UserCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <UserPlus className="w-4 h-4 text-cyan-400" />
            )}
            <span className="text-[10px] md:text-[11px] font-bold truncate max-w-[58px]">
              {currentUser && !isAuthorAccount(currentUser) ? currentUser.name.split(' ')[0] : 'Member'}
            </span>
          </button>

          {/* Author */}
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title="Author Control Panel (Pembuat Website)"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] md:text-[11px] font-extrabold text-amber-300">
              {isAuthorAccount(currentUser) ? 'Panel' : 'Author'}
            </span>
          </button>

          {/* CS WA */}
          <a
            href="https://wa.me/628139525985"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none py-1.5 px-1 md:px-3 flex flex-col items-center gap-1 text-emerald-400 hover:text-emerald-300 active:scale-95 transition-all cursor-pointer rounded-xl hover:bg-white/5"
            title="Layanan Bantuan WhatsApp 24 Jam"
          >
            <MessageCircle className="w-4 h-4 fill-emerald-400/20" />
            <span className="text-[10px] md:text-[11px] font-bold">CS WA</span>
          </a>
        </div>
      </nav>

      {/* Toast Notification Overlay Container */}
      <div
        id="toast-container"
        className="fixed bottom-24 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const isError = t.type === 'error';
          const isSuccess = t.type === 'success';
          const bgClass = isError
            ? 'border-rose-500/50 bg-rose-950/90 text-rose-200'
            : isSuccess
            ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200'
            : 'border-cyan-500/50 bg-slate-900/90 text-cyan-200';

          return (
            <div
              key={t.id}
              className={`p-3.5 rounded-2xl border text-xs font-semibold shadow-lg backdrop-blur-md flex items-center gap-2 transform transition-all duration-300 pointer-events-auto ${bgClass}`}
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0" />
              )}
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Background Engine (Controlled exclusively via Admin Dashboard) */}
      <FxThemeAndMusic fx={fx} />
    </div>
  );
}
