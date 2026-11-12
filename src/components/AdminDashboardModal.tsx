import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Shield,
  Palette,
  Music,
  ShoppingBag,
  Package,
  PackageCheck,
  Users,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  Lock,
  Sparkles,
  RefreshCw,
  Download,
  FileArchive,
  Smartphone,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  BellRing,
  Film,
  Tv,
  Percent,
  Tag,
  Globe,
  Rocket,
  Server,
  BarChart3,
  Sun,
  Moon,
  Wallet,
  AlertCircle,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Database
} from 'lucide-react';
import {
  Product,
  INITIAL_PRODUCTS_DATA,
  createArtworkSvg,
  DEFAULT_MARGIN_PERCENT,
  calculateSellingPriceFromSupplier,
  calculateSupplierPriceFromSelling
} from '../data/catalog';
import { WEBSITE_FILES_MANIFEST } from '../utils/zipExporter';
import {
  FxConfig,
  PresetId,
  AnimationMode,
  THEME_PRESETS,
  ANIMATION_MODES,
  DEFAULT_FX,
  validUrl,
  applyGlobalColorModeVars
} from './FxThemeAndMusic';
import { AdminReviewsPanel } from './AdminReviewsPanel';
import { AdminPushPanel } from './AdminPushPanel';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import {
  MemberUser,
  isAuthorAccount,
  syncUsersWithServerDb,
  getStoredUsers,
  saveStoredUsers,
  saveSessionUser
} from './AuthModal';
import { OFFICIAL_AUTHOR_EMAIL } from '../utils/authorIdentity';
import { canLoadImage } from '../utils/imageResolver';
import { playAdminIncomingOrderAlarm } from '../utils/soundEffects';
import { PaymentMethodLogo } from './PaymentMethodLogo';

export interface AdminStoredTransaction {
  id: string;
  product: string;
  item: string;
  target: string;
  status: string;
  total: string;
  uniqueCode?: number;
  payment?: string;
  whatsapp?: string;
  memberName?: string;
  memberId?: string;
  createdAt?: string;
  paymentStatus?: 'pending' | 'verified';
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped';
  verifiedAt?: string;
  shippedAt?: string;
}

const ADMIN_ORDER_ALARM_KEY = 'cahyostore_admin_order_alarm_v1';
export const ADMIN_TOKEN_KEY = 'cahyo_admin_token_v1';

export function getAdminAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) || '' : '';
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }
  return headers;
}

export async function getOrRefreshAdminToken(): Promise<string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) || '' : '';
  if (token) {
    try {
      const check = await fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${token}`, 'x-admin-token': token },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (check.ok) {
        const data = await check.json();
        if (data?.authenticated) return token;
      }
    } catch {}
  }
  return '';
}

export async function fetchAllSyncedTransactions(): Promise<AdminStoredTransaction[]> {
  // Server records are the only source of truth. Include Admin authorization headers.
  try {
    let headers = getAdminAuthHeaders();
    if (!headers['Authorization']) {
      await getOrRefreshAdminToken();
      headers = getAdminAuthHeaders();
    }
    let res = await fetch('/api/orders', { headers, credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401 || res.status === 403) {
      await getOrRefreshAdminToken();
      headers = getAdminAuthHeaders();
      res = await fetch('/api/orders', { headers, credentials: 'same-origin', cache: 'no-store' });
    }
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.orders) ? (json.orders as AdminStoredTransaction[]) : [];
  } catch {
    return [];
  }
}

async function fetchOrdersPulse(): Promise<{ count: number; lastUpdated: string } | null> {
  try {
    const res = await fetch('/api/admin/orders/pulse', { headers: getAdminAuthHeaders(), credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.count === 'number' ? { count: json.count, lastUpdated: String(json.lastUpdated || '') } : null;
  } catch {
    return null;
  }
}

async function fetchRealtimeConfig(): Promise<{ url: string; anonKey: string; channel: string } | null> {
  try {
    const res = await fetch('/api/admin/realtime-config', { headers: getAdminAuthHeaders(), credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.enabled && json.url && json.anonKey && json.channel ? { url: json.url, anonKey: json.anonKey, channel: json.channel } : null;
  } catch {
    return null;
  }
}

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: MemberUser | null;
  onAuthorAuthenticated?: (authorUser: MemberUser) => void;
  fx: FxConfig;
  onUpdateFx: (newFx: FxConfig) => void;
  products: Product[];
  onUpdateProducts: (newProducts: Product[]) => void;
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
  initialTab?: 'analytics' | 'theme' | 'studio' | 'orders' | 'streaming' | 'catalog' | 'members' | 'zip';
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthorAuthenticated,
  fx,
  onUpdateFx,
  products,
  onUpdateProducts,
  showToast,
  initialTab
}) => {
  const [hasServerAdminSession, setHasServerAdminSession] = useState(false);
  const [isSubmittingAuthor, setIsSubmittingAuthor] = useState(false);
  const isAuthor = Boolean(hasServerAdminSession || isAuthorAccount(currentUser));

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/admin/session', { headers, credentials: 'same-origin', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (!cancelled && data?.authenticated) {
          setHasServerAdminSession(true);
          if (data.token) {
            try { localStorage.setItem(ADMIN_TOKEN_KEY, data.token); } catch {}
          }
          if (data.user && onAuthorAuthenticated && !isAuthorAccount(currentUser)) {
            onAuthorAuthenticated(data.user);
          }
        } else if (!cancelled && !isAuthorAccount(currentUser)) {
          setHasServerAdminSession(false);
        }
      })
      .catch(() => {
        if (!cancelled && !isAuthorAccount(currentUser)) setHasServerAdminSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser]);

  const [authorLoginId, setAuthorLoginId] = useState('');
  const [authorLoginPass, setAuthorLoginPass] = useState('');
  const [showAuthorPass, setShowAuthorPass] = useState(false);

  const executeAuthorLogin = async (targetId?: string, targetPass?: string) => {
    const rawId = (targetId ?? authorLoginId).trim();
    const idf = rawId ? rawId.toLowerCase() : '';
    const pass = targetPass ?? authorLoginPass;

    if (!idf || !pass.trim()) {
      showToast('Masukkan ID/Email dan Kata Sandi Author terlebih dahulu!', 'error');
      return;
    }

    setIsSubmittingAuthor(true);
    let matchedAuthor: any = null;
    let sessionToken = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier: idf, password: pass })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Login admin gagal. Periksa kredensial Author Anda.', 'error');
        return;
      }
      matchedAuthor = json?.user;
      sessionToken = json?.token || '';
    } catch {
      showToast('Server login admin tidak dapat dihubungi. Periksa koneksi server.', 'error');
      return;
    } finally {
      setIsSubmittingAuthor(false);
    }

    if (!matchedAuthor) {
      showToast('Server tidak memberikan sesi admin yang valid.', 'error');
      return;
    }

    if (sessionToken) {
      try { localStorage.setItem(ADMIN_TOKEN_KEY, sessionToken); } catch {}
    }

    const authorSession: MemberUser = {
      id: matchedAuthor.id || 'AUTHOR-01',
      name: matchedAuthor.name || 'Author CahyoStore',
      email: matchedAuthor.email || OFFICIAL_AUTHOR_EMAIL,
      whatsapp: matchedAuthor.whatsapp || '08139525985',
      joinedAt: matchedAuthor.joinedAt || '1 Jan 2025',
      points: matchedAuthor.points || 99999,
      isAuthor: true
    };
    saveSessionUser(authorSession);
    setHasServerAdminSession(true);
    if (onAuthorAuthenticated) onAuthorAuthenticated(authorSession);
    showToast(`Selamat datang di Control Panel, ${authorSession.name}!`, 'success');
  };

  const handleDedicatedAuthorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeAuthorLogin();
  };

  const [activeTab, setActiveTab] = useState<
    'analytics' | 'theme' | 'studio' | 'orders' | 'streaming' | 'catalog' | 'members' | 'zip'
  >(initialTab || 'analytics');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleAuthorLogout = async () => {
    try {
      const headers = getAdminAuthHeaders();
      await fetch('/api/admin/logout', { method: 'POST', headers, credentials: 'same-origin' }).catch(() => {});
    } finally {
      try {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      } catch {}
      setHasServerAdminSession(false);
      saveSessionUser(null);
      if (onAuthorAuthenticated) onAuthorAuthenticated(null as any);
      showToast('Berhasil keluar dari sesi Author CahyoStore.', 'info');
      onClose();
    }
  };

  const handleDownloadFullWebsiteZip = async () => {
    try {
      setDownloadingZip(true);
      let token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) || '' : '';
      if (!token) {
        token = await getOrRefreshAdminToken();
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      const zipUrl = '/api/export/website-zip';
      let res = await fetch(zipUrl, {
        method: 'GET',
        headers,
        credentials: 'same-origin',
        cache: 'no-store'
      });

      // Auto retry once if 401: re-authenticate automatically
      if (res.status === 401) {
        const freshToken = await getOrRefreshAdminToken();
        if (freshToken) {
          const freshHeaders: Record<string, string> = {
            'Authorization': `Bearer ${freshToken}`,
            'x-admin-token': freshToken
          };
          res = await fetch('/api/export/website-zip', {
            method: 'GET',
            headers: freshHeaders,
            credentials: 'same-origin',
            cache: 'no-store'
          });
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || 'Unduhan ditolak server. Pastikan sesi admin masih aktif.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'CahyoStore-Full-Website-Files.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Arsip sumber website CahyoStore berhasil diunduh lengkap!', 'success');
    } catch {
      showToast('Server tidak dapat membuat arsip. Periksa koneksi jaringan dan sesi admin.', 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadVercelZip = async () => {
    try {
      setDownloadingZip(true);
      let token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) || '' : '';
      if (!token) {
        token = await getOrRefreshAdminToken();
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      const zipUrl = '/api/export/vercel-zip';
      let res = await fetch(zipUrl, {
        method: 'GET',
        headers,
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (res.status === 401) {
        const freshToken = await getOrRefreshAdminToken();
        if (freshToken) {
          const freshHeaders: Record<string, string> = {
            'Authorization': `Bearer ${freshToken}`,
            'x-admin-token': freshToken
          };
          res = await fetch('/api/export/vercel-zip', {
            method: 'GET',
            headers: freshHeaders,
            credentials: 'same-origin',
            cache: 'no-store'
          });
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || 'Gagal mengunduh paket Vercel ZIP.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'CahyoStore-Vercel-Deploy.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Paket ZIP khusus Vercel (dengan vercel.json) berhasil diunduh!', 'success');
    } catch {
      showToast('Gagal membuat paket deploy Vercel.', 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSupabaseZip = async () => {
    try {
      setDownloadingZip(true);
      let token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) || '' : '';
      if (!token) {
        token = await getOrRefreshAdminToken();
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      const zipUrl = '/api/export/supabase-zip';
      let res = await fetch(zipUrl, {
        method: 'GET',
        headers,
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (res.status === 401) {
        const freshToken = await getOrRefreshAdminToken();
        if (freshToken) {
          const freshHeaders: Record<string, string> = {
            'Authorization': `Bearer ${freshToken}`,
            'x-admin-token': freshToken
          };
          res = await fetch('/api/export/supabase-zip', {
            method: 'GET',
            headers: freshHeaders,
            credentials: 'same-origin',
            cache: 'no-store'
          });
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || 'Gagal mengunduh paket Supabase + Vercel ZIP.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'CahyoStore-Supabase-Vercel.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Paket ZIP Supabase + Vercel (dengan Skema PostgreSQL & RLS) berhasil diunduh!', 'success');
    } catch {
      showToast('Gagal membuat paket deploy Supabase + Vercel.', 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  // Author Studio & Store Broadcast states
  const [authorAnnouncementEnabled, setAuthorAnnouncementEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('cahyostore_author_announcement_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return typeof parsed.enabled === 'boolean' ? parsed.enabled : true;
      }
    } catch {}
    return true;
  });
  const [authorAnnouncementBadge, setAuthorAnnouncementBadge] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('cahyostore_author_announcement_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.badge) return parsed.badge;
      }
    } catch {}
    return '🔥 PROMO AUTHOR VIP';
  });
  const [authorAnnouncementText, setAuthorAnnouncementText] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('cahyostore_author_announcement_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.text) return parsed.text;
      }
    } catch {}
    return 'Top Up Game, Streaming & Pulsa Otomatis 24 Jam Nonstop • Bebas Biaya Admin via QRIS Resmi GPN!';
  });
  const [storeOpen24h, setStoreOpen24h] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cahyostore_store_open_24h_v1') !== 'false';
    } catch {
      return true;
    }
  });
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('Toko sedang dalam pemeliharaan. Silakan kembali beberapa saat lagi.');
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/store-status', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const settings = json?.settings;
        if (cancelled || !settings) return;
        setAuthorAnnouncementEnabled(Boolean(settings.announcementEnabled));
        setAuthorAnnouncementBadge(String(settings.announcementBadge || '📢 INFO RESMI TOKO'));
        setAuthorAnnouncementText(String(settings.announcementText || ''));
        setStoreOpen24h(settings.storeOpen24h !== false);
        setMaintenanceMessage(String(settings.maintenanceMessage || 'Toko sedang dalam pemeliharaan. Silakan kembali beberapa saat lagi.'));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  const [profitMarginPct, setProfitMarginPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('cahyostore_author_margin_pct_v1'));
      return saved > 0 && saved <= 80 ? saved : DEFAULT_MARGIN_PERCENT;
    } catch {
      return DEFAULT_MARGIN_PERCENT;
    }
  });
  const [serverPingInfo, setServerPingInfo] = useState<{
    ok: boolean;
    uptimeSeconds: number;
    timestamp: string;
  } | null>(null);
  const [checkingPing, setCheckingPing] = useState<boolean>(false);
  const restoreJsonInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveAuthorStudioConfig = async () => {
    const payload = {
      announcementEnabled: authorAnnouncementEnabled,
      announcementBadge: authorAnnouncementBadge.trim() || '📢 INFO RESMI TOKO',
      announcementText: authorAnnouncementText.trim(),
      storeOpen24h,
      maintenanceMessage: maintenanceMessage.trim() || 'Toko sedang dalam pemeliharaan. Silakan kembali beberapa saat lagi.'
    };
    try {
      let headers = getAdminAuthHeaders();
      if (!headers['Authorization']) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
      }
      headers['Content-Type'] = 'application/json';
      const res = await fetch('/api/admin/store-status', {
        method: 'PUT', headers, credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || 'Pengaturan Studio gagal disimpan ke server. Login Author ulang lalu coba lagi.', 'error');
        return;
      }
      try {
        localStorage.setItem('cahyostore_author_announcement_v1', JSON.stringify({
          enabled: payload.announcementEnabled, badge: payload.announcementBadge,
          text: payload.announcementText, storeOpen24h: payload.storeOpen24h
        }));
        localStorage.setItem('cahyostore_store_open_24h_v1', String(storeOpen24h));
        localStorage.setItem('cahyostore_author_margin_pct_v1', String(profitMarginPct));
        window.dispatchEvent(new CustomEvent('cahyostore-author-config-updated', { detail: payload }));
      } catch {}
      showToast('Studio Author tersimpan di server dan berlaku untuk semua pengunjung.', 'success');
    } catch {
      showToast('Server tidak dapat dihubungi. Pengaturan Studio belum tersimpan; coba lagi.', 'error');
    }
  };

  const handleCheckServerHeartbeat = async () => {
    setCheckingPing(true);
    try {
      const res = await fetch('/api/ping');
      if (res.ok) {
        const data = await res.json();
        setServerPingInfo({
          ok: Boolean(data.ok),
          uptimeSeconds: Number(data.uptimeSeconds || 0),
          timestamp: String(data.timestamp || new Date().toISOString())
        });
        showToast('Heartbeat Server 24 Jam (/api/ping) Merespons Normal & Aktif!', 'success');
      } else {
        showToast('Endpoint /api/ping belum merespons.', 'error');
      }
    } catch {
      showToast('Gagal mengecek endpoint /api/ping.', 'error');
    } finally {
      setCheckingPing(false);
    }
  };

  const handleRestoreAuthorBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (parsed.fx && typeof parsed.fx === 'object') {
          onUpdateFx(parsed.fx);
        }
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          onUpdateProducts(parsed.products);
        }
        if (Array.isArray(parsed.transactions)) {
          for (const tx of parsed.transactions) {
            if (tx && tx.id) {
              localStorage.setItem(tx.id, JSON.stringify(tx));
            }
          }
          setTransactions(parsed.transactions);
        }
        if (Array.isArray(parsed.members) && parsed.members.length > 0) {
          saveStoredUsers(parsed.members);
          setMembers(parsed.members);
        }
        showToast('Backup Database JSON Author berhasil dipulihkan (Restore Sukses)!', 'success');
      } catch {
        showToast('Format file JSON Backup tidak valid!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateSimulatedTestOrder = () => {
    // Test only the alarm/notification sound; never create a fake payment/order in the live queue.
    playAdminIncomingOrderAlarm();
    showToast('Alarm admin berhasil diuji. Tidak ada invoice atau transaksi simulasi yang dibuat.', 'info');
  };

  // Film & Streaming Studio Admin states
  const [newFilmTitle, setNewFilmTitle] = useState('');
  const [newFilmProvider, setNewFilmProvider] = useState('Official Streaming');
  const [newFilmIdLabel, setNewFilmIdLabel] = useState('Email / Nomor WA Aktif');
  const [newFilmPlanName, setNewFilmPlanName] = useState('1 Bulan Sharing');
  const [newFilmPlanPrice, setNewFilmPlanPrice] = useState('25000');
  const [selectedStreamingProdId, setSelectedStreamingProdId] = useState<string>('netflix');
  const [newStreamingItemName, setNewStreamingItemName] = useState('');
  const [newStreamingItemPrice, setNewStreamingItemPrice] = useState('');

  // Theme & Audio local draft states inside Admin
  const [presetInput, setPresetInput] = useState<PresetId>(fx.preset);
  const [animInput, setAnimInput] = useState<AnimationMode>(fx.animationMode);
  const [bgUrlInput, setBgUrlInput] = useState<string>(fx.bgUrl);
  const [musicInput, setMusicInput] = useState<string>(fx.music);
  const [volInput, setVolInput] = useState<number>(fx.vol);

  // Transactions state
  const [transactions, setTransactions] = useState<AdminStoredTransaction[]>([]);
  const [orderSoundEnabled, setOrderSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_ORDER_ALARM_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        return window.Notification.permission;
      }
    } catch {}
    return 'default';
  });
  const [newOrderRingId, setNewOrderRingId] = useState<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initializedOrdersRef = useRef<boolean>(false);

  const sendDesktopOrderPushNotification = (order: AdminStoredTransaction) => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (window.Notification.permission !== 'granted') return;

      const notif = new window.Notification(`🔔 Order Baru Masuk: ${order.id}`, {
        body: `${order.product} (${order.item})\nTujuan: ${order.target} • Total: ${order.total}`,
        tag: `cahyostore-order-${order.id}`,
        requireInteraction: false
      });

      notif.onclick = () => {
        try {
          window.focus();
          setActiveTab('orders');
          notif.close();
        } catch {}
      };
    } catch {
      // Ignore Notification API restrictions inside sandboxed contexts
    }
  };

  const handleRequestPushPermission = async () => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        showToast('Browser Anda tidak mendukung Web Push Notification.', 'error');
        return;
      }
      const perm = await window.Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        playAdminIncomingOrderAlarm();
        sendDesktopOrderPushNotification({
          id: 'CS-TEST99',
          product: 'Mobile Legends: Bang Bang',
          item: '257 Diamonds',
          target: '104928371 (2541)',
          status: 'Menunggu Pembayaran (Payment Pending)',
          total: 'Rp 65.000'
        });
        showToast('Web Push Notification Desktop berhasil diaktifkan!', 'success');
      } else if (perm === 'denied') {
        showToast('Izin notifikasi desktop ditolak di pengaturan browser.', 'error');
      }
    } catch {
      showToast('Gagal meminta izin Web Push Notification pada perangkat ini.', 'error');
    }
  };

  const toggleOrderSound = () => {
    const next = !orderSoundEnabled;
    setOrderSoundEnabled(next);
    try {
      localStorage.setItem(ADMIN_ORDER_ALARM_KEY, String(next));
    } catch {}
    if (next) {
      playAdminIncomingOrderAlarm();
      showToast('Bunyi Ping notifikasi order baru diaktifkan!', 'success');
    } else {
      showToast('Bunyi Ping notifikasi order baru dinonaktifkan.', 'info');
    }
  };

  // Catalog Management state
  const [selectedProdId, setSelectedProdId] = useState<string>(products[0]?.id || 'mlbb');
  const [newItemName, setNewItemName] = useState('');
  const [newItemSupplierPrice, setNewItemSupplierPrice] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [editingItemSupplierPriceVal, setEditingItemSupplierPriceVal] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('all');
  const [itemPriceFilter, setItemPriceFilter] = useState<'all' | 'zero' | 'priced'>('all');
  const [itemPriceDrafts, setItemPriceDrafts] = useState<Record<string, string>>({});
  const [globalMarginPercent, setGlobalMarginPercent] = useState<number>(7);

  const handleGlobalMarginChange = (marginPct: number) => {
    const nextMargin = Math.max(5, Math.min(10, Math.round(marginPct)));
    setGlobalMarginPercent(nextMargin);
    const supplierPrice = Number(newItemSupplierPrice);
    if (Number.isFinite(supplierPrice) && supplierPrice > 0) {
      setNewItemPrice(String(calculateSellingPriceFromSupplier(supplierPrice, nextMargin)));
    }
  };

  const handleSupplierPriceInput = (valStr: string) => {
    setNewItemSupplierPrice(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      const calculatedSell = calculateSellingPriceFromSupplier(num, globalMarginPercent);
      setNewItemPrice(String(calculatedSell));
    } else if (!valStr.trim()) {
      setNewItemPrice('');
    }
  };

  const handleEditingSupplierPriceChange = (valStr: string) => {
    setEditingItemSupplierPriceVal(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      setEditingItemPriceVal(String(calculateSellingPriceFromSupplier(num, globalMarginPercent)));
    }
  };

  // New Product Creation State inside Kelola Katalog
  const [newProdName, setNewProdName] = useState('');
  const [newProdPublisher, setNewProdPublisher] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<Product['category']>('game');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdIdLabel, setNewProdIdLabel] = useState('User ID / Nomor Tujuan');
  const [newProdHasZone, setNewProdHasZone] = useState(false);
  const [newProdZoneLabel, setNewProdZoneLabel] = useState('Zone / Server ID');
  const [newProdFirstItemName, setNewProdFirstItemName] = useState('Paket Standar');
  const [newProdFirstItemPrice, setNewProdFirstItemPrice] = useState('15000');

  // Inline Edit Selected Product State
  const [editProdName, setEditProdName] = useState('');
  const [editProdPublisher, setEditProdPublisher] = useState('');
  const [editProdImage, setEditProdImage] = useState('');
  const [editProdIdLabel, setEditProdIdLabel] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemPriceVal, setEditingItemPriceVal] = useState<string>('');

  // Registered Members state
  const [members, setMembers] = useState<any[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [newMemberPassword, setNewMemberPassword] = useState<string>('');

  const handleResetMemberPassword = async (memberId: string, memberName: string) => {
    const cleanPass = newMemberPassword.trim();
    if (cleanPass.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter!', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify({ password: cleanPass })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Gagal mereset sandi. Pastikan sesi admin masih aktif.', 'error');
        return;
      }
      const updated = members.map((m) => m.id === memberId ? { ...m, passwordHash: undefined } : m);
      saveStoredUsers(updated);
      setMembers(updated);
      setEditingMemberId(null);
      setNewMemberPassword('');
      showToast(`Kata sandi member ${memberName} berhasil direset. Sandi tidak disimpan atau ditampilkan kembali.`, 'success');
    } catch {
      showToast('Server tidak dapat dihubungi; kata sandi belum diubah.', 'error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPresetInput(fx.preset);
      setAnimInput(fx.animationMode);
      setBgUrlInput(fx.bgUrl);
      setMusicInput(fx.music);
      setVolInput(fx.vol);
      // Admin queue/analytics must come only from server records, never browser-local storage.
      fetchAllSyncedTransactions().then((merged) => setTransactions(merged));
      setMembers(getStoredUsers());
      syncUsersWithServerDb().then((syncedUsers) => setMembers(syncedUsers));
    }
  }, [isOpen, fx]);

  // Real-time background polling for Author Dashboard: detects new orders and rings alarm
  useEffect(() => {
    if (!isAuthor) return;

    let disposed = false;
    let checking = false;
    let rerunRequested = false;
    let realtimeActive = false;
    let lastSignature = '';
    let timer: number | undefined;
    let rtClient: any = null;
    let rtChannel: any = null;

    const checkIncomingOrders = async (force = false) => {
      if (disposed) return;
      if (!force && typeof document !== 'undefined' && document.hidden) return;
      if (checking) { rerunRequested = true; return; }
      checking = true;
      try {
        await runOrdersCheck();
      } finally {
        checking = false;
      }
      if (rerunRequested && !disposed) {
        rerunRequested = false;
        await checkIncomingOrders(true);
      }
    };

    const runOrdersCheck = async () => {
      // Take the change signature first, then the list, so an order arriving in between is not missed.
      const pulse = await fetchOrdersPulse();
      const signature = pulse ? `${pulse.count}:${pulse.lastUpdated}` : '';
      if (initializedOrdersRef.current && signature && signature === lastSignature) return;
      const merged = await fetchAllSyncedTransactions();
      if (signature) lastSignature = signature;
      setTransactions(merged);

      if (!initializedOrdersRef.current) {
        merged.forEach((tx) => knownOrderIdsRef.current.add(tx.id));
        initializedOrdersRef.current = true;
        return;
      }

      const newlyArrived = merged.filter((tx) => !knownOrderIdsRef.current.has(tx.id));
      if (newlyArrived.length > 0) {
        newlyArrived.forEach((tx) => knownOrderIdsRef.current.add(tx.id));
        const newest = newlyArrived[0];
        setNewOrderRingId(newest.id);
        window.setTimeout(() => {
          setNewOrderRingId((curr) => (curr === newest.id ? null : curr));
        }, 6000);

        if (orderSoundEnabled) {
          playAdminIncomingOrderAlarm();
        }
        sendDesktopOrderPushNotification(newest);
        showToast(
          `🔔 ORDER BARU MASUK: ${newest.id} — ${newest.product} (${newest.item}) senilai ${newest.total}!`,
          'success'
        );
      }
    };

    const schedule = () => {
      // With a live Realtime connection polling is only a safety net; without it, poll the cheap pulse often.
      timer = window.setTimeout(async () => {
        await checkIncomingOrders();
        if (!disposed) schedule();
      }, realtimeActive ? 30000 : 6000);
    };
    const onVisible = () => { if (!document.hidden) void checkIncomingOrders(true); };

    void checkIncomingOrders(true).then(() => { if (!disposed) schedule(); });
    document.addEventListener('visibilitychange', onVisible);

    // Optional instant refresh through Supabase Realtime Broadcast (PII-free ping; falls back to polling).
    (async () => {
      try {
        const cfg = await fetchRealtimeConfig();
        if (!cfg || disposed) return;
        const { createClient } = await import('@supabase/supabase-js');
        if (disposed) return;
        rtClient = createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: { params: { eventsPerSecond: 5 } },
        });
        rtChannel = rtClient.channel(cfg.channel, { config: { broadcast: { self: false } } })
          .on('broadcast', { event: 'order-changed' }, () => { void checkIncomingOrders(true); })
          .subscribe((status: string) => { realtimeActive = status === 'SUBSCRIBED'; });
      } catch {
        realtimeActive = false;
      }
    })();

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      try { if (rtClient && rtChannel) void rtClient.removeChannel(rtChannel); } catch {}
    };
  }, [isAuthor, orderSoundEnabled]);

  const handleSaveTheme = async () => {
    const trimmedBg = bgUrlInput.trim();
    let verifiedBg = '';

    if (trimmedBg) {
      if (validUrl(trimmedBg) && (await canLoadImage(trimmedBg, 100, 9000))) {
        verifiedBg = trimmedBg;
      } else {
        showToast('URL Wallpaper tidak valid atau gagal dimuat.', 'error');
        return;
      }
    }

    const updated: FxConfig = {
      ...fx,
      preset: presetInput,
      animationMode: animInput,
      bgUrl: verifiedBg
    };
    onUpdateFx(updated);
    showToast('Tema & animasi disimpan dan berlaku untuk semua pengunjung', 'success');
  };

  const handleResetTheme = () => {
    const resetCfg: FxConfig = {
      ...DEFAULT_FX,
      music: fx.music,
      musicPlaying: fx.musicPlaying,
      vol: fx.vol
    };
    setPresetInput(resetCfg.preset);
    setAnimInput(resetCfg.animationMode);
    setBgUrlInput('');
    onUpdateFx(resetCfg);
    showToast('Tema dikembalikan ke pengaturan default (Cyber Nexus)', 'info');
  };

  const handleToggleMusic = () => {
    if (fx.musicPlaying) {
      onUpdateFx({ ...fx, musicPlaying: false });
      showToast('Musik latar dihentikan untuk semua pengunjung', 'info');
      return;
    }

    const cleanMusic = musicInput.trim();
    if (!validUrl(cleanMusic)) {
      showToast('Masukkan URL MP3 atau link YouTube yang valid (https://...)', 'error');
      return;
    }

    onUpdateFx({
      ...fx,
      music: cleanMusic,
      musicPlaying: true,
      vol: volInput
    });
    showToast('Musik latar aktif untuk semua pengunjung', 'success');
  };

  const handleVolumeChange = (val: number) => {
    setVolInput(val);
    onUpdateFx({ ...fx, vol: val });
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(json?.error || 'Perubahan status ditolak server.', 'error'); return; }
      if (json.order) localStorage.setItem(orderId, JSON.stringify(json.order));
      setTransactions(await fetchAllSyncedTransactions());
      showToast(`Status ${orderId} diperbarui.`, 'success');
    } catch { showToast('Server tidak dapat dihubungi; status tidak diubah.', 'error'); }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      let headers = getAdminAuthHeaders();
      if (!headers['Authorization']) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
      }
      let res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
        headers,
        credentials: 'same-origin'
      });
      if (res.status === 401 || res.status === 403) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
        res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'DELETE',
          headers,
          credentials: 'same-origin'
        });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Gagal menghapus pesanan.', 'error');
        return;
      }
      try {
        localStorage.removeItem(orderId);
      } catch {
        // ignore
      }
      setTransactions(await fetchAllSyncedTransactions());
      showToast(`Pesanan #${orderId} berhasil dihapus permanen oleh Author.`, 'success');
    } catch {
      showToast('Gagal terhubung ke server saat menghapus pesanan.', 'error');
    }
  };

  const handleClearAllOrders = async () => {
    try {
      let headers = getAdminAuthHeaders();
      if (!headers['Authorization']) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
      }
      let res = await fetch('/api/orders', {
        method: 'DELETE',
        headers,
        credentials: 'same-origin'
      });
      if (res.status === 401 || res.status === 403) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
        res = await fetch('/api/orders', {
          method: 'DELETE',
          headers,
          credentials: 'same-origin'
        });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Gagal membersihkan riwayat pesanan.', 'error');
        return;
      }
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && /^CS-[A-Z0-9-]{5,40}$/i.test(k)) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
      setTransactions([]);
      showToast('Seluruh riwayat pesanan masuk berhasil dibersihkan permanen oleh Author.', 'success');
    } catch {
      showToast('Gagal terhubung ke server saat membersihkan antrean pesanan.', 'error');
    }
  };

  const handleClearCompletedOrders = async () => {
    const completedOrCancelled = transactions.filter(
      (tx) =>
        tx.paymentStatus === 'verified' ||
        /selesai|terkirim|sukses|batal|cancel|gagal/i.test(tx.status || '')
    );
    if (completedOrCancelled.length === 0) {
      showToast('Tidak ada transaksi dengan status Selesai atau Dibatalkan untuk dibersihkan.', 'info');
      return;
    }
    try {
      let headers = getAdminAuthHeaders();
      if (!headers['Authorization']) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
      }
      for (const tx of completedOrCancelled) {
        await fetch(`/api/orders/${encodeURIComponent(tx.id)}`, {
          method: 'DELETE',
          headers,
          credentials: 'same-origin'
        }).catch(() => {});
        try {
          localStorage.removeItem(tx.id);
        } catch {}
      }
      setTransactions(await fetchAllSyncedTransactions());
      showToast(`${completedOrCancelled.length} riwayat transaksi selesai/batal berhasil dibersihkan permanen oleh Author.`, 'success');
    } catch {
      showToast('Gagal membersihkan riwayat pesanan selesai/batal.', 'error');
    }
  };

  const handleVerifyPayment = async (orderId: string) => {
    try {
      let headers = getAdminAuthHeaders();
      if (!headers['Authorization']) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
      }
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/verify-payment`, {
        method: 'POST',
        headers,
        credentials: 'same-origin'
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(json?.error || 'Konfirmasi pembayaran gagal.', 'error'); return; }
      try { localStorage.setItem(orderId, JSON.stringify(json.order)); } catch {}
      setTransactions(await fetchAllSyncedTransactions());
      showToast(`Pembayaran #${orderId} berhasil dikonfirmasi sah oleh Author.`, 'success');
    } catch { showToast('Server tidak dapat dihubungi; pembayaran belum dikonfirmasi.', 'error'); }
  };

  const handleMarkShipped = async (orderId: string) => {
    try {
      let headers = getAdminAuthHeaders();
      if (!headers['Authorization']) {
        await getOrRefreshAdminToken();
        headers = getAdminAuthHeaders();
      }
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/mark-shipped`, {
        method: 'POST',
        headers,
        credentials: 'same-origin'
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(json?.error || 'Status pengiriman gagal diperbarui.', 'error'); return; }
      try { localStorage.setItem(orderId, JSON.stringify(json.order)); } catch {}
      setTransactions(await fetchAllSyncedTransactions());
      showToast(`Pesanan #${orderId} berhasil ditandai Terkirim & Selesai.`, 'success');
    } catch { showToast('Server tidak dapat dihubungi; status pengiriman tidak diubah.', 'error'); }
  };

  const handleVerifyAndCompleteOrder = async (orderId: string) => {
    const target = transactions.find((item) => item.id === orderId);
    const confirmed = window.confirm(
      `Verifikasi saldo masuk & selesaikan pesanan ${orderId}?\n\nPastikan nominal ${target?.total || 'invoice'} sudah benar-benar masuk ke saldo GoPay / DANA / OVO / QRIS merchant Anda.`
    );
    if (!confirmed) return;
    try {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}/verify-payment`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        credentials: 'same-origin'
      });
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/mark-shipped`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        credentials: 'same-origin'
      });
      const json = await res.json().catch(() => ({}));
      if (json.order) localStorage.setItem(orderId, JSON.stringify(json.order));
      setTransactions(await fetchAllSyncedTransactions());
      showToast(`Pesanan ${orderId} sukses diverifikasi & diselesaikan! Saldo masuk tercatat.`, 'success');
    } catch {
      showToast('Server tidak dapat dihubungi; transaksi belum selesai.', 'error');
    }
  };

  const handleAddNominalItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItemName.trim();
    const price = Number(newItemPrice);
    if (!name || !price || price < 100) {
      showToast('Masukkan nama item dan harga yang valid!', 'error');
      return;
    }

    const updatedProducts = products.map((p) => {
      if (p.id !== selectedProdId) return p;
      const newItem = {
        id: `${p.id}-adm-${Date.now()}`,
        name,
        price
      };
      const items = [...p.items, newItem];
      return { ...p, items };
    });

    onUpdateProducts(updatedProducts);
    setNewItemName('');
    setNewItemSupplierPrice('');
    setNewItemPrice('');
    showToast(`Item "${name}" berhasil ditambahkan ke katalog (Rp ${price.toLocaleString('id-ID')})!`, 'success');
  };

  const handleDeleteNominalItem = (prodId: string, itemId: string) => {
    const updatedProducts = products.map((p) => {
      if (p.id !== prodId) return p;
      return { ...p, items: p.items.filter((i) => i.id !== itemId) };
    });
    onUpdateProducts(updatedProducts);
    showToast('Nominal item dihapus dari katalog', 'info');
  };

  const handleMoveNominalItem = (prodId: string, itemId: string, direction: -1 | 1) => {
    const updatedProducts = products.map((p) => {
      if (p.id !== prodId) return p;
      const fromIndex = p.items.findIndex((item) => item.id === itemId);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= p.items.length) return p;
      const items = [...p.items];
      [items[fromIndex], items[toIndex]] = [items[toIndex], items[fromIndex]];
      return { ...p, items };
    });
    onUpdateProducts(updatedProducts);
    showToast('Urutan nominal berhasil diperbarui.', 'success');
  };

  const activeCatalogProduct = products.find((p) => p.id === selectedProdId) || products[0];

  useEffect(() => {
    if (activeCatalogProduct) {
      setEditProdName(activeCatalogProduct.name);
      setEditProdPublisher(activeCatalogProduct.publisher);
      setEditProdImage(activeCatalogProduct.image.startsWith('data:image/svg') ? '' : activeCatalogProduct.image);
      setEditProdIdLabel(activeCatalogProduct.idLabel);
    }
  }, [activeCatalogProduct?.id]);

  const handleCreateNewCatalogProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProdName.trim();
    const publisher = newProdPublisher.trim() || 'Official Partner';
    const idLabel = newProdIdLabel.trim() || 'User ID / Nomor Tujuan';
    const firstItemName = newProdFirstItemName.trim() || 'Paket Reguler';
    const firstItemPrice = Math.max(500, Number(newProdFirstItemPrice) || 15000);

    if (!name) {
      showToast('Masukkan Nama Produk / Layanan baru terlebih dahulu!', 'error');
      return;
    }

    const cleanId =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 14) +
      '-' +
      String(Date.now()).slice(-4);

    const customImg = newProdImage.trim();
    const fallbackSvg = createArtworkSvg(
      name.toUpperCase().slice(0, 16),
      publisher.toUpperCase().slice(0, 22),
      '#0891b2',
      '#4f46e5',
      `<circle cx="0" cy="-6" r="28" fill="#0f172a" stroke="#22d3ee" stroke-width="4"/>
       <polygon points="-8,-16 14,-6 -8,4" fill="#22d3ee"/>`
    );

    const newProduct: Product = {
      id: cleanId,
      name,
      publisher,
      category: newProdCategory,
      image: customImg || fallbackSvg,
      imageFit: 'cover',
      hasZoneId: newProdHasZone,
      idLabel,
      zoneLabel: newProdHasZone ? newProdZoneLabel.trim() || 'Zone / Server ID' : undefined,
      items: [
        {
          id: `${cleanId}-item-1`,
          name: firstItemName,
          price: firstItemPrice
        }
      ]
    };

    const updated = [newProduct, ...products];
    onUpdateProducts(updated);
    setSelectedProdId(newProduct.id);
    setNewProdName('');
    setNewProdPublisher('');
    setNewProdImage('');
    showToast(`Produk baru "${name}" berhasil ditambahkan ke Katalog!`, 'success');
  };

  const handleDeleteCatalogProduct = (prodId: string, prodName: string) => {
    if (products.length <= 1) {
      showToast('Minimal harus ada 1 produk aktif di katalog!', 'error');
      return;
    }
    const updated = products.filter((p) => p.id !== prodId);
    onUpdateProducts(updated);
    if (selectedProdId === prodId && updated.length > 0) {
      setSelectedProdId(updated[0].id);
    }
    showToast(`Produk "${prodName}" berhasil dihapus dari katalog!`, 'info');
  };

  const handleDuplicateCatalogProduct = (prod: Product) => {
    const dupId = `${prod.id}-copy-${String(Date.now()).slice(-4)}`;
    const duplicated: Product = {
      ...prod,
      id: dupId,
      name: `${prod.name} (VIP)`,
      items: prod.items.map((it, idx) => ({
        ...it,
        id: `${dupId}-it-${idx + 1}`
      }))
    };
    const updated = [duplicated, ...products];
    onUpdateProducts(updated);
    setSelectedProdId(duplicated.id);
    showToast(`Produk "${prod.name}" berhasil diduplikasi!`, 'success');
  };

  const handleSaveCatalogProductDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCatalogProduct) return;
    const cleanName = editProdName.trim();
    if (!cleanName) {
      showToast('Nama produk tidak boleh kosong!', 'error');
      return;
    }
    const updated = products.map((p) => {
      if (p.id !== activeCatalogProduct.id) return p;
      return {
        ...p,
        name: cleanName,
        publisher: editProdPublisher.trim() || p.publisher,
        idLabel: editProdIdLabel.trim() || p.idLabel,
        image: editProdImage.trim() ? editProdImage.trim() : p.image
      };
    });
    onUpdateProducts(updated);
    showToast(`Detail produk "${cleanName}" berhasil diperbarui!`, 'success');
  };

  const handleResetAllPricesToZero = (scope: 'all' | 'selected' = 'all') => {
    const updated = products.map((p) => {
      if (scope === 'selected' && p.id !== activeCatalogProduct?.id) return p;
      return {
        ...p,
        items: p.items.map((it) => ({
          ...it,
          price: 0
        }))
      };
    });
    onUpdateProducts(updated);
    setItemPriceDrafts({});
    if (scope === 'all') {
      showToast(
        'Semua harga produk di seluruh katalog berhasil diubah menjadi Rp 0! Anda sekarang dapat mengisi dan mengubah harga satu per satu secara leluasa.',
        'success'
      );
    } else {
      showToast(
        `Harga seluruh nominal pada produk "${activeCatalogProduct?.name}" berhasil diubah menjadi Rp 0!`,
        'success'
      );
    }
  };

  const handleApplyGlobalMargin = (marginPct: number, scope: 'all' | 'selected' = 'all') => {
    const factor = 1 + marginPct / 100;
    const updated = products.map((p) => {
      if (scope === 'selected' && p.id !== activeCatalogProduct?.id) return p;
      return {
        ...p,
        items: p.items.map((it) => {
          const base = Number(it.price);
          if (!Number.isFinite(base) || base <= 0) return it;
          return {
            ...it,
            price: Math.max(500, Math.round((base * factor) / 500) * 500)
          };
        })
      };
    });
    onUpdateProducts(updated);
    setItemPriceDrafts({});
    showToast(
      `Margin keuntungan +${marginPct}% berhasil diterapkan ke ${scope === 'all' ? 'seluruh katalog' : activeCatalogProduct?.name}!`,
      'success'
    );
  };

  const handleApplyGlobalDiscount = (discountPct: number) => {
    const safeDiscount = Math.max(1, Math.min(10, Math.round(discountPct)));
    let updatedItemCount = 0;
    const factor = 1 - safeDiscount / 100;
    const updated = products.map((p) => ({
      ...p,
      items: p.items.map((it) => {
        const currentPrice = Number(it.price);
        // Never invent a price for catalog entries that are still unpriced (Rp 0).
        if (!Number.isFinite(currentPrice) || currentPrice <= 0) return it;
        updatedItemCount += 1;
        return { ...it, price: Math.max(1, Math.round(currentPrice * factor)) };
      })
    }));

    if (updatedItemCount === 0) {
      showToast('Belum ada nominal dengan harga di atas Rp 0 untuk diberi diskon.', 'info');
      return;
    }

    onUpdateProducts(updated);
    setItemPriceDrafts({});
    showToast(
      `Diskon ${safeDiscount}% diterapkan ke ${updatedItemCount} nominal di seluruh katalog. Harga Rp 0 tetap Rp 0.`,
      'success'
    );
  };

  const handleAdjustCatalogPrices = (percentDelta: number, targetScope: 'selected' | 'all') => {
    const factor = 1 + percentDelta / 100;
    const updated = products.map((p) => {
      if (targetScope === 'selected' && p.id !== activeCatalogProduct?.id) return p;
      return {
        ...p,
        items: p.items.map((it) => {
          const base = Number(it.price);
          if (!Number.isFinite(base) || base <= 0) return it;
          return {
            ...it,
            price: Math.max(1, Math.round(base * factor))
          };
        })
      };
    });
    onUpdateProducts(updated);
    const label = percentDelta > 0 ? `+${percentDelta}%` : `${percentDelta}%`;
    showToast(
      `Harga nominal (${targetScope === 'all' ? 'Seluruh Katalog' : activeCatalogProduct?.name}) disesuaikan ${label}!`,
      'success'
    );
  };

  const handleSaveInlineItemPrice = (prodId: string, itemId: string, overridePrice?: number) => {
    const rawVal = overridePrice !== undefined ? overridePrice : Number(editingItemPriceVal);
    if (isNaN(rawVal) || rawVal < 0) {
      showToast('Masukkan harga rupiah yang valid (minimal Rp 0)!', 'error');
      return;
    }
    const updated = products.map((p) => {
      if (p.id !== prodId) return p;
      return {
        ...p,
        items: p.items
          .map((it) => (it.id === itemId ? { ...it, price: rawVal } : it))

      };
    });
    onUpdateProducts(updated);
    setEditingItemId(null);
    setEditingItemPriceVal('');
    setItemPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    showToast(`Harga item berhasil disimpan: Rp ${rawVal.toLocaleString('id-ID')}!`, 'success');
  };

  const handleSaveSingleDraftPrice = (prodId: string, itemId: string, customPrice?: number) => {
    const rawVal = customPrice !== undefined ? customPrice : Number(itemPriceDrafts[itemId] ?? 0);
    if (isNaN(rawVal) || rawVal < 0) {
      showToast('Masukkan harga rupiah yang valid (minimal Rp 0)!', 'error');
      return;
    }
    const updated = products.map((p) => {
      if (p.id !== prodId) return p;
      return {
        ...p,
        items: p.items
          .map((it) => (it.id === itemId ? { ...it, price: rawVal } : it))

      };
    });
    onUpdateProducts(updated);
    setItemPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    showToast(`Harga nominal berhasil disimpan: Rp ${rawVal.toLocaleString('id-ID')}!`, 'success');
  };

  const handleSaveAllDraftPrices = (prodId: string) => {
    const draftKeys = Object.keys(itemPriceDrafts);
    if (draftKeys.length === 0) {
      showToast('Tidak ada perubahan harga yang perlu disimpan.', 'info');
      return;
    }
    const updated = products.map((p) => {
      if (p.id !== prodId) return p;
      return {
        ...p,
        items: p.items
          .map((it) => {
            if (itemPriceDrafts[it.id] !== undefined) {
              const parsed = Number(itemPriceDrafts[it.id]);
              if (!isNaN(parsed) && parsed >= 0) {
                return { ...it, price: parsed };
              }
            }
            return it;
          })

      };
    });
    onUpdateProducts(updated);
    setItemPriceDrafts({});
    showToast(`Seluruh perubahan harga produk "${activeCatalogProduct?.name}" berhasil disimpan!`, 'success');
  };

  const handleResetDefaultCatalog = () => {
    onUpdateProducts(INITIAL_PRODUCTS_DATA);
    setSelectedProdId(INITIAL_PRODUCTS_DATA[0]?.id || 'mlbb');
    setItemPriceDrafts({});
    showToast('Katalog berhasil dikembalikan ke daftar produk & harga standar bawaan sistem!', 'info');
  };
  const streamingProducts = products.filter((p) => p.category === 'streaming');
  const activeStreamingProduct =
    streamingProducts.find((p) => p.id === selectedStreamingProdId) || streamingProducts[0];

  const handleAddStreamingPresetOrCustom = (
    name: string,
    publisher: string,
    idLabel: string,
    c1: string,
    c2: string,
    defaultItems: { name: string; price: number }[]
  ) => {
    const cleanId =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 14) || `film${Date.now()}`;
    const existing = products.find(
      (p) => p.id === cleanId || p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setSelectedStreamingProdId(existing.id);
      showToast(`Layanan Film "${existing.name}" sudah tersedia di katalog!`, 'info');
      return;
    }

    const svgImage = createArtworkSvg(
      name.toUpperCase().slice(0, 16),
      publisher.toUpperCase().slice(0, 22),
      c1,
      c2,
      `<rect x="-42" y="-34" width="84" height="62" rx="12" fill="#0f172a" stroke="#00F0FF" stroke-width="4"/>
       <polygon points="-10,-16 -10,10 16,-3" fill="#00F0FF"/>`
    );

    const newProd: Product = {
      id: cleanId,
      name,
      publisher,
      category: 'streaming',
      image: svgImage,
      imageFit: 'cover',
      hasZoneId: false,
      idLabel,
      items: defaultItems.map((it, idx) => ({
        id: `${cleanId}-${idx + 1}-${Date.now()}`,
        name: it.name,
        price: it.price
      }))
    };

    const updated = [...products, newProd];
    onUpdateProducts(updated);
    setSelectedStreamingProdId(newProd.id);
    showToast(`Layanan Film & Streaming "${name}" berhasil ditambahkan!`, 'success');
  };

  const handleCreateCustomFilmService = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newFilmTitle.trim();
    const provider = newFilmProvider.trim() || 'Official Streaming';
    const idLabel = newFilmIdLabel.trim() || 'Email / Nomor WA Aktif';
    const planName = newFilmPlanName.trim() || '1 Bulan Premium';
    const planPrice = Number(newFilmPlanPrice) || 25000;

    if (!title) {
      showToast('Masukkan nama layanan Film / Bioskop / Streaming!', 'error');
      return;
    }

    handleAddStreamingPresetOrCustom(title, provider, idLabel, '#dc2626', '#1e1b4b', [
      { name: planName, price: Math.max(1000, planPrice) },
      { name: '3 Bulan VIP', price: Math.max(2500, planPrice * 3 - 5000) }
    ]);
    setNewFilmTitle('');
  };

  const handleAddStreamingNominal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStreamingProduct) return;
    const name = newStreamingItemName.trim();
    const price = Number(newStreamingItemPrice);
    if (!name || !price || price < 100) {
      showToast('Masukkan nama paket langganan & harga yang valid!', 'error');
      return;
    }

    const updatedProducts = products.map((p) => {
      if (p.id !== activeStreamingProduct.id) return p;
      const newItem = {
        id: `${p.id}-str-${Date.now()}`,
        name,
        price
      };
      return {
        ...p,
        items: [...p.items, newItem]
      };
    });

    onUpdateProducts(updatedProducts);
    setNewStreamingItemName('');
    setNewStreamingItemPrice('');
    showToast(`Paket "${name}" ditambahkan ke ${activeStreamingProduct.name}!`, 'success');
  };

  const handleApplyStreamingBulkPromo = (discountPercent: number) => {
    const factor = 1 - discountPercent / 100;
    const updatedProducts = products.map((p) => {
      if (p.category !== 'streaming') return p;
      return {
        ...p,
        items: p.items.map((item) => ({
          ...item,
          price: Math.max(1000, Math.round((item.price * factor) / 500) * 500)
        }))
      };
    });
    onUpdateProducts(updatedProducts);
    showToast(
      `Promo Diskon ${discountPercent}% berhasil diterapkan ke semua layanan Film & Streaming!`,
      'success'
    );
  };

  const handleDeleteStreamingProduct = (prodId: string, prodName: string) => {
    if (streamingProducts.length <= 1) {
      showToast('Minimal harus tersisa 1 layanan di kategori Film & Streaming.', 'error');
      return;
    }
    const updated = products.filter((p) => p.id !== prodId);
    onUpdateProducts(updated);
    showToast(`Layanan "${prodName}" dihapus dari katalog.`, 'info');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fy-admin-shell relative z-10 glass-panel backdrop-blur-2xl bg-slate-950/85 w-full max-w-6xl max-h-[92vh] rounded-3xl border border-cyan-400/30 shadow-[0_16px_48px_rgba(0,0,0,0.85),0_0_35px_rgba(0,240,255,0.18)] ring-1 ring-white/10 flex flex-col overflow-hidden"
          >
            {/* Modal Header with Frosted Glassmorphism */}
            <div className="px-5 py-4 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-emerald-500 p-0.5 shadow-neon-cyan shrink-0">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                    <img
                      src="/icon.svg"
                      alt="Author Emblem"
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                      Author Control Panel
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-extrabold text-amber-300">
                      AUTHOR: CAHYO STORE
                    </span>
                    {isAuthor && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          orderSoundEnabled
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-800 border-white/10 text-slate-400'
                        }`}
                      >
                        <BellRing
                          className={`w-3 h-3 ${
                            newOrderRingId
                              ? 'text-amber-300 animate-bounce'
                              : orderSoundEnabled
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        />
                        <span>
                          {orderSoundEnabled ? 'Alarm Order Aktif' : 'Alarm Order Bisu'}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Pusat Kendali FityoraStore • Tema, Animasi, Musik Latar, Pesanan, Katalog &amp; File ZIP Website
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isAuthor && (
                  <>
                    <button
                      type="button"
                      onClick={handleRequestPushPermission}
                      title="Aktifkan Web Push Notification Desktop saat ada order baru"
                      className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        pushPermission === 'granted'
                          ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300'
                          : 'bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-300'
                      }`}
                    >
                      <BellRing className="w-4 h-4 text-cyan-400" />
                      <span className="hidden sm:inline">
                        {pushPermission === 'granted' ? 'Push Desktop: Aktif' : 'Aktifkan Push Desktop'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleOrderSound}
                      title={
                        orderSoundEnabled
                          ? 'Matikan Suara Ping Order Masuk'
                          : 'Aktifkan Suara Ping Order Masuk'
                      }
                      className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        orderSoundEnabled
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-400'
                      }`}
                    >
                      {orderSoundEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="hidden sm:inline">
                        {orderSoundEnabled ? 'Audio Ping: ON' : 'Audio Ping: OFF'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAuthorLogout}
                      title="Keluar dari sesi Author (Logout)"
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-bold text-rose-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span className="hidden sm:inline">Logout Author</span>
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {!isAuthor ? (
              /* Dedicated Author Login Only Portal (Pendaftaran Author Dimatikan demi Keamanan) */
              <div className="p-6 sm:p-10 flex-1 overflow-y-auto flex items-center justify-center">
                <div className="w-full max-w-md rounded-3xl bg-slate-900/95 border border-cyan-500/35 p-6 space-y-5 shadow-neon-cyan text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-neon-cyan shrink-0">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-extrabold text-amber-300">
                        AUTHOR LOGIN (PEMBUAT WEBSITE)
                      </span>
                      <h4 className="text-base font-extrabold text-white mt-1">
                        Author Login
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Portal khusus Pembuat Website (Author). Pendaftaran ditutup permanen untuk mencegah penyalahgunaan.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleDedicatedAuthorLogin} className="space-y-3.5">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Email, Username, atau No. WhatsApp Author
                      </label>
                      <input
                        type="text"
                        value={authorLoginId}
                        onChange={(e) => setAuthorLoginId(e.target.value)}
                        placeholder="Email, Username, atau WhatsApp resmi Author"
                        className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Kata Sandi / PIN Author
                      </label>
                      <div className="relative">
                        <input
                          type={showAuthorPass ? 'text' : 'password'}
                          value={authorLoginPass}
                          onChange={(e) => setAuthorLoginPass(e.target.value)}
                          placeholder="Masukkan kata sandi Author"
                          className="w-full bg-slate-950 border border-white/15 rounded-xl pl-3.5 pr-11 py-2.5 text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-600 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAuthorPass(!showAuthorPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                          title={showAuthorPass ? 'Sembunyikan Sandi' : 'Lihat Sandi'}
                        >
                          {showAuthorPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Strict Security Badge - No Auto-Fill, No Credential Exposure */}
                    <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/25 text-[11px] text-cyan-200/90 space-y-1.5 backdrop-blur-md">
                      <div className="flex items-center gap-2 font-bold text-cyan-300">
                        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Sistem Keamanan Ketat (Strict Security Enforced)</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Akses khusus Pembuat Website (Author). Dilindungi verifikasi server, enkripsi sandi scrypt, dan proteksi anti brute-force. Seluruh input wajib diisi secara manual.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmittingAuthor}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-purple-600 to-cyan-500 text-white font-extrabold text-xs shadow-neon-cyan cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmittingAuthor ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-white" />
                            <span>Memverifikasi Akses Server...</span>
                          </>
                        ) : (
                          <span>🔑 Masuk ke Control Panel Author</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              /* Unlocked Admin Dashboard for Verified Author - Modern Full-Width Tab-Based Layout */
              <div className="fy-admin-main flex flex-col flex-1 overflow-hidden bg-slate-950/40 backdrop-blur-md w-full">
                {/* Modern Horizontal Tab Navigation Bar with frosted glass effect */}
                <div className="w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-xl px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0 shadow-sm z-20">
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Tab 1: Reset & Kelola Harga */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'catalog'
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-cyan-300/60 shadow-neon-cyan ring-1 ring-cyan-400/50'
                          : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-white/10'
                      }`}
                    >
                      <Package className="w-4 h-4 text-cyan-300 shrink-0" />
                      <span>Reset &amp; Kelola Harga</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                          activeTab === 'catalog' ? 'bg-black/30 text-cyan-200' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {products.length}
                      </span>
                    </button>

                    {/* Tab 2: Riwayat & Hapus Pesanan */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'orders'
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-emerald-300/60 shadow-neon-cyan ring-1 ring-emerald-400/50'
                          : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-white/10'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span>Riwayat &amp; Hapus Pesanan</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                          activeTab === 'orders' ? 'bg-black/30 text-emerald-200' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {transactions.length}
                      </span>
                    </button>

                    {/* Tab 3: Analitik & Tren Live */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('analytics')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'analytics'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300/60 shadow-neon-cyan ring-1 ring-cyan-400/50'
                          : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-white/10'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4 text-cyan-300 shrink-0" />
                      <span>Analitik &amp; Omzet</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[9px] font-extrabold text-emerald-300">
                        LIVE
                      </span>
                    </button>

                    {/* Tab 4: Film & Streaming */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('streaming')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'streaming'
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-pink-300/60 shadow-neon-cyan ring-1 ring-pink-400/50'
                          : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-white/10'
                      }`}
                    >
                      <Film className="w-4 h-4 text-pink-300 shrink-0" />
                      <span>Film &amp; Streaming</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                          activeTab === 'streaming' ? 'bg-black/30 text-pink-200' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {streamingProducts.length}
                      </span>
                    </button>

                    {/* Tab 5: Tema & Desain */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('theme')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'theme'
                          ? 'bg-gradient-to-r from-purple-500 to-cyan-600 text-white border-purple-300/60 shadow-neon-cyan ring-1 ring-purple-400/50'
                          : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-white/10'
                      }`}
                    >
                      <Palette className="w-4 h-4 text-purple-300 shrink-0" />
                      <span>10 Tema &amp; 20 FX</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[9px] font-extrabold text-cyan-300">
                        FX
                      </span>
                    </button>

                    {/* Tab 6: Data Member */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('members')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'members'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-300/60 shadow-neon-cyan ring-1 ring-amber-400/50'
                          : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-white/10'
                      }`}
                    >
                      <Users className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>Data Member</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                          activeTab === 'members' ? 'bg-black/30 text-amber-200' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {members.length}
                      </span>
                    </button>

                    {/* Tab 7: Studio Fitur */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'studio'
                          ? 'bg-gradient-to-r from-amber-500 via-purple-600 to-cyan-500 text-white border-amber-300/60 shadow-neon-cyan ring-1 ring-amber-400/50'
                          : 'text-amber-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border-amber-500/20'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>Studio Fitur</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[9px] font-extrabold">
                        PRO
                      </span>
                    </button>

                    {/* Tab 8: ZIP Website */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('zip')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        activeTab === 'zip'
                          ? 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-600 text-white border-emerald-300/60 shadow-neon-cyan ring-1 ring-emerald-400/50'
                          : 'text-emerald-300 hover:text-white bg-emerald-950/25 hover:bg-slate-900 border-emerald-500/30'
                      }`}
                    >
                      <FileArchive className="w-4 h-4 shrink-0" />
                      <span>Backup ZIP</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[9px] font-extrabold text-emerald-300">
                        ZIP
                      </span>
                    </button>
                  </div>

                  <div className="hidden lg:flex items-center gap-2 shrink-0 text-[10px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-cyan-300 font-bold">Author: fityorastoreoffice@gmail.com</span>
                  </div>
                </div>

                {/* Full-Width Tab Content Area */}
                <div className="flex-1 w-full overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
                  {/* Neat Author Executive KPI & Quick Actions Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/25 shadow-inner">
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/20 flex flex-col justify-between gap-1">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Total Omzet &amp; Est. Profit ({profitMarginPct}%)
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-400 tabular-nums block">
                        Rp{' '}
                        {transactions
                          .filter((t) => !/batal/i.test(t.status))
                          .reduce((acc, t) => {
                            const num = Number(String(t.total || '').replace(/[^\d]/g, '')) || 0;
                            return acc + num;
                          }, 0)
                          .toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] text-amber-300 font-bold tabular-nums">
                        Laba Bersih: ~Rp{' '}
                        {Math.round(
                          transactions
                            .filter((t) => !/batal/i.test(t.status))
                            .reduce((acc, t) => {
                              const num = Number(String(t.total || '').replace(/[^\d]/g, '')) || 0;
                              return acc + num;
                            }, 0) *
                            (profitMarginPct / 100)
                        ).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/20 flex flex-col justify-between gap-1">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Total Pesanan / Sukses
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-cyan-400 tabular-nums block">
                        {transactions.length} Order (
                        {transactions.filter((t) => /selesai|complete|sukses/i.test(t.status)).length}{' '}
                        Sukses)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Status Toko:{' '}
                        <strong className={storeOpen24h ? 'text-emerald-400' : 'text-amber-400'}>
                          {storeOpen24h ? '🟢 Buka 24 Jam' : '🟠 Maintenance'}
                        </strong>
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-purple-500/20 flex flex-col justify-between gap-1">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Katalog &amp; Tema Aktif
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-purple-300 tabular-nums block">
                        {products.length} Layanan •{' '}
                        {products.reduce((acc, p) => acc + p.items.length, 0)} Item
                      </span>
                      <span className="text-[10px] text-cyan-300 truncate block">
                        {THEME_PRESETS[fx.preset]?.name} •{' '}
                        {ANIMATION_MODES.find((a) => a.id === fx.animationMode)?.label}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/20 flex flex-col justify-between gap-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Pintasan Aksi Cepat Author
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const backupPayload = {
                              exportedAt: new Date().toISOString(),
                              fx,
                              products,
                              transactions,
                              members
                            };
                            const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
                              type: 'application/json'
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `CahyoStore-Backup-Author-${new Date().toISOString().slice(0, 10)}.json`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            showToast('Backup Database JSON Author berhasil diunduh!', 'success');
                          }}
                          className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-extrabold text-[10px] text-center cursor-pointer"
                          title="Backup Seluruh Data Toko (JSON)"
                        >
                          Backup JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => restoreJsonInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-300 font-extrabold text-[10px] text-center cursor-pointer"
                          title="Pulihkan / Restore Data Toko dari File JSON"
                        >
                          Restore JSON
                        </button>
                        <input
                          ref={restoreJsonInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={handleRestoreAuthorBackupJson}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const header = 'ID,Produk,Nominal,Tujuan,Total,Pembayaran,WhatsApp,Status,Waktu\n';
                            const rowsCsv = transactions
                              .map(
                                (t) =>
                                  `"${t.id}","${t.product}","${t.item}","${t.target}","${t.total}","${t.payment || 'QRIS'}","${t.whatsapp || '-'}","${t.status}","${t.createdAt || '-'}"`
                              )
                              .join('\n');
                            const blob = new Blob([header + rowsCsv], {
                              type: 'text/csv;charset=utf-8'
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Laporan-Transaksi-CahyoStore.csv`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            showToast('Laporan CSV Transaksi berhasil diunduh!', 'success');
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-extrabold text-[10px] text-center cursor-pointer"
                          title="Export Laporan Pesanan ke Excel / CSV"
                        >
                          Export CSV
                        </button>
                        <button
                          type="button"
                          disabled={downloadingZip}
                          onClick={handleDownloadSupabaseZip}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-extrabold text-[10px] text-center cursor-pointer disabled:opacity-50"
                          title="Download ZIP Khusus Supabase + Vercel dengan skema PostgreSQL"
                        >
                          {downloadingZip ? 'Menyiapkan...' : 'ZIP Supabase'}
                        </button>
                        <button
                          type="button"
                          disabled={downloadingZip}
                          onClick={handleDownloadVercelZip}
                          className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-extrabold text-[10px] text-center cursor-pointer disabled:opacity-50"
                          title="Download ZIP Khusus Deploy ke Vercel"
                        >
                          {downloadingZip ? 'Menyiapkan...' : 'ZIP Vercel'}
                        </button>
                        <button
                          type="button"
                          disabled={downloadingZip}
                          onClick={handleDownloadFullWebsiteZip}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-extrabold text-[10px] text-center cursor-pointer disabled:opacity-50"
                          title="Download ZIP Seluruh File Website Ini"
                        >
                          {downloadingZip ? 'Membuat ZIP...' : 'ZIP Website'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {activeTab === 'analytics' && (
                    <AdminAnalyticsDashboard
                      transactions={transactions}
                      products={products}
                      onSimulateOrder={handleCreateSimulatedTestOrder}
                    />
                  )}

                  {activeTab === 'theme' && (
                    <div className="space-y-6">
                      {/* Global Color Mode Switcher: Dark Theme vs High-Contrast Light Mode */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                              {fx.colorMode === 'light' ? (
                                <Sun className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Moon className="w-4 h-4 text-cyan-400" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-white">
                                Mode Kontras Global: Dark Theme vs High-Contrast Light Mode
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                Perbarui variabel CSS root global (<code>--bg-primary</code>, <code>--text-primary</code>, <code>--border-subtle</code>) secara real-time untuk seluruh halaman.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const updated: FxConfig = { ...fx, colorMode: 'dark' };
                                onUpdateFx(updated);
                                applyGlobalColorModeVars('dark', THEME_PRESETS[updated.preset] || THEME_PRESETS.cyber);
                                showToast('Mode Gelap Cyber (Dark Theme) Diaktifkan!', 'info');
                              }}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                                fx.colorMode !== 'light'
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-neon-cyan'
                                  : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-cyan-400/40'
                              }`}
                            >
                              <Moon className="w-3.5 h-3.5" />
                              <span>Dark Mode</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated: FxConfig = { ...fx, colorMode: 'light' };
                                onUpdateFx(updated);
                                applyGlobalColorModeVars('light', THEME_PRESETS[updated.preset] || THEME_PRESETS.cyber);
                                showToast('Mode Terang Kontras Tinggi (High-Contrast Light) Diaktifkan!', 'info');
                              }}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                                fx.colorMode === 'light'
                                  ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md'
                                  : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-amber-400/40'
                              }`}
                            >
                              <Sun className="w-3.5 h-3.5" />
                              <span>High-Contrast Light</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Theme & Animation Control */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <div>
                              <h4 className="text-sm font-extrabold text-white">
                                Studio Tema (10 Preset) &amp; Animasi Partikel (10 Mode)
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                Klik salah satu kartu tema atau animasi untuk melihat pratinjau langsung, lalu klik Simpan.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleResetTheme}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-cyan-400 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reset Default</span>
                          </button>
                        </div>

                        {/* 10 Theme Presets Grid */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="block font-extrabold text-slate-200">
                              1. Pilih Warna &amp; Atmosfer Tema ({Object.keys(THEME_PRESETS).length} Pilihan)
                            </label>
                            <span className="text-[10px] text-cyan-400 font-bold">
                              Aktif: {THEME_PRESETS[presetInput]?.name}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {(Object.keys(THEME_PRESETS) as PresetId[]).map((key) => {
                              const p = THEME_PRESETS[key];
                              const active = presetInput === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setPresetInput(key);
                                    onUpdateFx({
                                      ...fx,
                                      preset: key,
                                      animationMode: animInput
                                    });
                                  }}
                                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                    active
                                      ? 'gradient-border-active border-cyan-400 shadow-neon-cyan'
                                      : 'bg-slate-950/75 border-white/10 hover:border-cyan-500/40'
                                  }`}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold text-white truncate">
                                        {p.name}
                                      </span>
                                      {p.badge && (
                                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/30 text-[8px] font-extrabold text-cyan-300 shrink-0">
                                          {p.badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 line-clamp-1">
                                      {p.desc}
                                    </div>
                                  </div>
                                  <div className="flex items-center -space-x-1.5 shrink-0">
                                    <span
                                      className="w-5 h-5 rounded-full border border-white/30"
                                      style={{ background: `rgb(${p.particleColor})` }}
                                    />
                                    <span
                                      className="w-5 h-5 rounded-full border border-white/20"
                                      style={{ background: p.bgBase }}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 10 Animation Mode Selector Grid */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="block font-extrabold text-slate-200">
                              2. Gaya Animasi Latar ({ANIMATION_MODES.length} Mode Interaktif)
                            </label>
                            <span className="text-[10px] text-purple-300 font-bold">
                              Mode: {ANIMATION_MODES.find((a) => a.id === animInput)?.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {ANIMATION_MODES.map((m) => {
                              const active = animInput === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setAnimInput(m.id);
                                    onUpdateFx({
                                      ...fx,
                                      preset: presetInput,
                                      animationMode: m.id
                                    });
                                  }}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-0.5 ${
                                    active
                                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-neon-cyan'
                                      : 'bg-slate-950/75 border-white/10 text-slate-300 hover:border-white/25'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-extrabold text-white text-xs">
                                      {m.label}
                                    </span>
                                    {m.badge && (
                                      <span className="px-1.5 py-0.2 rounded bg-purple-500/25 border border-purple-400/40 text-[8px] font-extrabold text-purple-200">
                                        {m.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 line-clamp-1">
                                    {m.desc}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Wallpaper Image URL */}
                        <div className="space-y-1.5">
                          <label className="block font-bold text-slate-300">
                            URL Gambar Wallpaper Kustom (Opsional)
                          </label>
                          <input
                            type="url"
                            value={bgUrlInput}
                            onChange={(e) => setBgUrlInput(e.target.value)}
                            placeholder="https://.../wallpaper.jpg (kosongkan untuk grid bawaan)"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveTheme}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold shadow-neon-cyan hover:opacity-95 transition-all cursor-pointer"
                        >
                          Simpan &amp; Terapkan Tema Website
                        </button>
                      </div>

                      {/* Hidden Background Music Control (Admin-only) */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-purple-400" />
                            <div>
                              <h4 className="text-sm font-extrabold text-white">
                                Kontrol Musik Latar (Khusus Author)
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                Musik terdengar oleh semua pengunjung (mulai setelah mereka menyentuh
                                layar, aturan browser). Pengunjung tidak punya ikon/tombol musik: hanya
                                Author yang bisa memutar, menghentikan, dan mengatur volume di sini.
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              fx.musicPlaying
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {fx.musicPlaying ? '● Sedang Diputar' : 'Berhenti'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <label className="block font-bold text-slate-300">
                            URL Audio MP3 atau Link YouTube
                          </label>
                          <input
                            type="url"
                            value={musicInput}
                            onChange={(e) => setMusicInput(e.target.value)}
                            placeholder="https://.../musik.mp3 atau https://youtube.com/watch?v=..."
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleToggleMusic}
                            className={`px-4 py-2.5 rounded-xl font-extrabold flex items-center gap-2 cursor-pointer transition-all ${
                              fx.musicPlaying
                                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                                : 'bg-emerald-500 text-slate-950'
                            }`}
                          >
                            {fx.musicPlaying ? (
                              <>
                                <VolumeX className="w-4 h-4" />
                                <span>Hentikan Musik</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-4 h-4" />
                                <span>Putar Musik Latar</span>
                              </>
                            )}
                          </button>

                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-slate-400">Vol:</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={volInput}
                              onChange={(e) => handleVolumeChange(Number(e.target.value))}
                              className="flex-1 accent-cyan-400"
                            />
                            <span className="text-slate-300 font-bold w-8 tabular-nums">
                              {volInput}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'studio' && (
                    <div className="space-y-4">
                      {/* 1. Live Broadcast / Pengumuman Banner Beranda Toko */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-amber-500/35 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-white">
                                1. Pengumuman Live &amp; Banner Broadcast Toko (Khusus Author)
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Tampilkan pengumuman promo, info diskon, atau jadwal flash sale di bagian atas halaman utama toko.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAuthorAnnouncementEnabled((v) => !v)}
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] border cursor-pointer transition-all ${
                              authorAnnouncementEnabled
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                : 'bg-slate-800 border-white/10 text-slate-400'
                            }`}
                          >
                            {authorAnnouncementEnabled ? '● Banner Aktif' : '○ Banner Nonaktif'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-bold text-slate-300 mb-1">
                              Label Lencana Promo
                            </label>
                            <select
                              value={authorAnnouncementBadge}
                              onChange={(e) => setAuthorAnnouncementBadge(e.target.value)}
                              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-amber-400"
                            >
                              <option value="🔥 PROMO AUTHOR VIP">🔥 PROMO AUTHOR VIP</option>
                              <option value="⚡ FLASH SALE 24 JAM">⚡ FLASH SALE 24 JAM</option>
                              <option value="📢 INFO RESMI TOKO">📢 INFO RESMI TOKO</option>
                              <option value="🎁 BONUS QRIS INSTANT">🎁 BONUS QRIS INSTANT</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block font-bold text-slate-300 mb-1">
                              Isi Teks Pengumuman Beranda
                            </label>
                            <input
                              type="text"
                              value={authorAnnouncementText}
                              onChange={(e) => setAuthorAnnouncementText(e.target.value)}
                              placeholder="Tulis pengumuman promo atau info penting untuk pengunjung..."
                              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-white block">Status Operasional Toko</span>
                              <span className="text-[10px] text-slate-400">
                                Atur apakah toko melayani otomatis 24 jam atau sedang pemeliharaan.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setStoreOpen24h((v) => !v)}
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] border shrink-0 cursor-pointer ${
                                storeOpen24h
                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                  : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                              }`}
                            >
                              {storeOpen24h ? '🟢 Buka 24 Jam' : '🟠 Maintenance'}
                            </button>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="font-bold text-white block">
                                Target Margin Profit Author ({profitMarginPct}%)
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Digunakan untuk menghitung estimasi laba bersih di bar atas.
                              </span>
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={80}
                              value={profitMarginPct}
                              onChange={(e) =>
                                setProfitMarginPct(Math.max(1, Math.min(80, Number(e.target.value) || 12)))
                              }
                              className="w-16 bg-slate-900 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-center font-extrabold text-cyan-300"
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/25 space-y-2">
                          <label className="font-bold text-white block" htmlFor="author-maintenance-message">Pesan yang tampil saat Maintenance</label>
                          <textarea
                            id="author-maintenance-message"
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value.slice(0, 240))}
                            maxLength={240}
                            rows={2}
                            placeholder="Contoh: Sistem sedang diperbarui. Pesanan sementara ditutup."
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                          />
                          <p className="text-[10px] text-slate-500">Saat status toko diubah ke Maintenance, checkout pelanggan akan ditolak oleh server sampai toko dibuka kembali.</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveAuthorStudioConfig}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-purple-600 to-cyan-500 text-white font-extrabold text-xs shadow-neon-cyan cursor-pointer"
                        >
                          Simpan &amp; Terapkan Pengumuman / Status Toko
                        </button>
                      </div>

                      {/* 2. Simulator Kasir & Manajemen Cepat Harga Katalog */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
                          <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <BellRing className="w-4 h-4 text-cyan-400" />
                            <span>2. Simulator Order Masuk &amp; Pembersih Transaksi</span>
                          </h5>
                          <p className="text-[11px] text-slate-400">
                            Tombol ini hanya menguji bunyi alarm notifikasi. Tidak ada invoice palsu yang ditambahkan ke antrean transaksi.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleCreateSimulatedTestOrder}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-extrabold text-xs cursor-pointer"
                            >
                              Tes Alarm Tanpa Membuat Transaksi
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setTransactions(await fetchAllSyncedTransactions());
                                showToast('Antrean dimuat ulang dari server. Riwayat transaksi tetap disimpan untuk audit.', 'info');
                              }}
                              className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-200 font-bold text-xs cursor-pointer"
                            >
                              Muat Ulang Antrean
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 space-y-3">
                          <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <Percent className="w-4 h-4 text-purple-400" />
                            <span>3. Kontrol Cepat Promo &amp; Markup Seluruh Katalog</span>
                          </h5>
                          <p className="text-[11px] text-slate-400">
                            Ubah seluruh harga layanan sekaligus untuk event Flash Sale atau penyesuaian margin keuntungan Author.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdjustCatalogPrices(-5, 'all')}
                              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs cursor-pointer"
                            >
                              ⚡ Diskon Semua -5%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustCatalogPrices(5, 'all')}
                              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-extrabold text-xs cursor-pointer"
                            >
                              📈 Markup Semua +5%
                            </button>
                            <button
                              type="button"
                              onClick={handleResetDefaultCatalog}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 font-bold text-xs cursor-pointer"
                            >
                              Reset Harga Awal
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'orders' && (() => {
                    const parseNominal = (val?: string) =>
                      Number(String(val || '').replace(/[^\d]/g, '')) || 0;

                    const verifiedOrders = transactions.filter(
                      (t) =>
                        t.paymentStatus === 'verified' ||
                        /selesai|terkirim|sukses/i.test(t.status || '')
                    );
                    const pendingOrders = transactions.filter(
                      (t) =>
                        t.paymentStatus !== 'verified' &&
                        !/batal|cancel|gagal/i.test(t.status || '')
                    );

                    const totalVerifiedRevenue = verifiedOrders.reduce(
                      (sum, t) => sum + parseNominal(t.total),
                      0
                    );
                    const totalPendingRevenue = pendingOrders.reduce(
                      (sum, t) => sum + parseNominal(t.total),
                      0
                    );

                    const paymentStats: Record<
                      string,
                      { name: string; iconId: string; verifiedTotal: number; pendingTotal: number; count: number }
                    > = {
                      qris: { name: 'QRIS All Payment', iconId: 'qris', verifiedTotal: 0, pendingTotal: 0, count: 0 },
                      gopay: { name: 'GoPay (08139525985)', iconId: 'gopay', verifiedTotal: 0, pendingTotal: 0, count: 0 },
                      dana: { name: 'DANA (08139525985)', iconId: 'dana', verifiedTotal: 0, pendingTotal: 0, count: 0 },
                      ovo: { name: 'OVO (08139525985)', iconId: 'ovo', verifiedTotal: 0, pendingTotal: 0, count: 0 },
                      shopeepay: { name: 'ShopeePay (08139525985)', iconId: 'shopeepay', verifiedTotal: 0, pendingTotal: 0, count: 0 },
                    };

                    transactions.forEach((tx) => {
                      const payStr = (tx.payment || '').toLowerCase();
                      let key = 'qris';
                      if (payStr.includes('gopay')) key = 'gopay';
                      else if (payStr.includes('dana')) key = 'dana';
                      else if (payStr.includes('ovo')) key = 'ovo';
                      else if (payStr.includes('shopee')) key = 'shopeepay';
                      else if (payStr.includes('qris')) key = 'qris';

                      const amt = parseNominal(tx.total);
                      const isV =
                        tx.paymentStatus === 'verified' ||
                        /selesai|terkirim|sukses/i.test(tx.status || '');
                      const isBatal = /batal|cancel|gagal/i.test(tx.status || '');

                      paymentStats[key].count += 1;
                      if (isV) {
                        paymentStats[key].verifiedTotal += amt;
                      } else if (!isBatal) {
                        paymentStats[key].pendingTotal += amt;
                      }
                    });

                    return (
                      <div className="space-y-4">
                        {/* Real-time Financial Revenue & Balance Tracking Dashboard */}
                        <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/95 border border-cyan-500/35 space-y-4 shadow-neon-cyan">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                <Wallet className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                                  <span>Monitoring Saldo Masuk &amp; Keuangan Toko (Real-Time)</span>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold border border-emerald-500/40">
                                    LIVE REVENUE
                                  </span>
                                </h4>
                                <p className="text-[10px] text-slate-400">
                                  Pantau saldo uang masuk dari GoPay, DANA, OVO, ShopeePay (0813-9525-985 a/n CAHYO) &amp; QRIS Merchant.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  const refreshed = await fetchAllSyncedTransactions();
                                  setTransactions(refreshed);
                                  showToast('Data saldo & mutasi transaksi disinkronkan dari server!', 'success');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Sinkron Saldo</span>
                              </button>
                            </div>
                          </div>

                          {/* 3 Summary Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col justify-between">
                              <span className="text-[10px] text-emerald-300 font-bold block">
                                TOTAL SALDO MASUK TERVERIFIKASI
                              </span>
                              <div className="text-lg sm:text-xl font-extrabold text-emerald-400 font-mono tabular-nums my-1">
                                Rp {totalVerifiedRevenue.toLocaleString('id-ID')}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                Dari {verifiedOrders.length} transaksi yang telah dikonfirmasi sah.
                              </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col justify-between">
                              <span className="text-[10px] text-amber-300 font-bold block">
                                SALDO MENUNGGU VERIFIKASI (PENDING)
                              </span>
                              <div className="text-lg sm:text-xl font-extrabold text-amber-400 font-mono tabular-nums my-1">
                                Rp {totalPendingRevenue.toLocaleString('id-ID')}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {pendingOrders.length} pesanan baru menunggu pencocokan mutasi.
                              </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 flex flex-col justify-between">
                              <span className="text-[10px] text-slate-400 font-bold block">
                                TOTAL VOLUME TRANSAKSI TOKO
                              </span>
                              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tabular-nums my-1">
                                {transactions.length} Pesanan
                              </div>
                              <span className="text-[10px] text-cyan-300">
                                Rekening Utama: 0813-9525-985 (a/n CAHYO)
                              </span>
                            </div>
                          </div>

                          {/* Channels Balance Breakdown (GoPay, DANA, OVO, ShopeePay, QRIS) */}
                          <div className="space-y-2 pt-2 border-t border-white/10">
                            <div className="text-[11px] font-extrabold text-slate-200">
                              Rincian Saldo Masuk per Metode Pembayaran:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                              {Object.entries(paymentStats).map(([key, st]) => (
                                <div
                                  key={key}
                                  className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col justify-between gap-1.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <PaymentMethodLogo id={st.iconId} size="sm" />
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-extrabold text-white truncate">
                                        {st.name}
                                      </div>
                                      <div className="text-[9px] text-slate-400">
                                        {st.count} Order
                                      </div>
                                    </div>
                                  </div>
                                  <div className="pt-1 border-t border-white/5 space-y-0.5 text-[10px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Masuk:</span>
                                      <span className="font-extrabold text-emerald-400 tabular-nums">
                                        Rp {st.verifiedTotal.toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Pending:</span>
                                      <span className="font-bold text-amber-300 tabular-nums">
                                        Rp {st.pendingTotal.toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Author Order History Master Control (Always visible & prominent) */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-purple-950/40 border border-rose-500/40 space-y-3.5 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-400">
                                <Trash2 className="w-5 h-5" />
                              </div>
                              <div>
                                <h5 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                                  <span>Manajemen &amp; Kontrol Hapus Riwayat Pesanan</span>
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-black border border-rose-500/40">
                                    HAK EKSKLUSIF AUTHOR
                                  </span>
                                </h5>
                                <p className="text-[11px] text-slate-300">
                                  Demi keamanan dan garansi, buyer/pelanggan tidak dapat menghapus riwayat. Hanya Anda sebagai Author yang berwenang menghapus pesanan atau mengosongkan riwayat secara permanen.
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-cyan-300 font-black text-xs shrink-0">
                              {transactions.length} Pesanan Masuk
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={handleClearAllOrders}
                              disabled={transactions.length === 0}
                              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                                transactions.length === 0
                                  ? 'bg-slate-800/60 text-slate-500 border border-white/5 cursor-not-allowed opacity-50'
                                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.45)] active:scale-95'
                              }`}
                              title="Hapus seluruh riwayat pesanan secara permanen dari server database"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Hapus Semua Riwayat Pesanan ({transactions.length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleClearCompletedOrders}
                              disabled={transactions.length === 0}
                              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                transactions.length === 0
                                  ? 'bg-slate-800/60 text-slate-500 border-white/5 cursor-not-allowed opacity-50'
                                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/35 hover:text-white'
                              }`}
                              title="Hapus riwayat pesanan yang statusnya sudah Selesai atau Dibatalkan"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>Bersihkan Pesanan Selesai / Batal</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const refreshed = await fetchAllSyncedTransactions();
                                setTransactions(refreshed);
                                showToast('Riwayat pesanan berhasil disinkronkan dari server database!', 'info');
                              }}
                              className="px-3 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Sinkronkan Riwayat</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                playAdminIncomingOrderAlarm();
                                showToast('🔔 Tes bunyi Ping order baru berhasil diputar!', 'info');
                              }}
                              className="px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer ml-auto"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Tes Alarm</span>
                            </button>
                          </div>
                        </div>

                        {/* Order Queue Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <div>
                            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                              <span>
                                Daftar Transaksi &amp; Verifikasi ({transactions.length})
                              </span>
                              {newOrderRingId && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-extrabold animate-pulse">
                                  🔔 Order Baru Masuk!
                                </span>
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              Cocokkan nominal transfer dengan mutasi pembayaran GoPay / DANA / OVO / Bank Anda sebelum menyelesaikan order.
                            </p>
                          </div>
                        </div>

                        {transactions.length === 0 ? (
                          <div className="p-10 rounded-2xl bg-slate-900/60 border border-white/5 text-center text-slate-500">
                            Belum ada transaksi yang tercatat. Setiap pesanan baru pelanggan akan otomatis muncul di sini.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {transactions.map((tx) => {
                              const cleanBuyerWa = String(tx.whatsapp || '')
                                .replace(/^0/, '62')
                                .replace(/[^\d]/g, '');

                              const payStr = (tx.payment || '').toLowerCase();
                              let methodId = 'qris';
                              if (payStr.includes('gopay')) methodId = 'gopay';
                              else if (payStr.includes('dana')) methodId = 'dana';
                              else if (payStr.includes('ovo')) methodId = 'ovo';
                              else if (payStr.includes('shopee')) methodId = 'shopeepay';

                              const isVerified =
                                tx.paymentStatus === 'verified' ||
                                /selesai|terkirim|sukses/i.test(tx.status || '');
                              const isShipped =
                                tx.fulfillmentStatus === 'shipped' ||
                                /selesai|terkirim/i.test(tx.status || '');

                              return (
                                <div
                                  key={tx.id}
                                  className={`p-4 rounded-2xl bg-slate-900/90 border flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-all duration-500 ${
                                    newOrderRingId === tx.id
                                      ? 'fy-order-pop border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] bg-emerald-950/30'
                                      : isVerified
                                      ? 'border-emerald-500/30 bg-slate-900/90'
                                      : 'border-white/10'
                                  }`}
                                >
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <PaymentMethodLogo id={methodId} size="sm" />
                                      <span className="font-mono font-extrabold text-cyan-400">
                                        #{tx.id}
                                      </span>
                                      <span className="text-slate-500">•</span>
                                      <span className="font-bold text-white">{tx.product}</span>
                                      <span className="text-cyan-300 font-semibold">({tx.item})</span>
                                      {tx.uniqueCode && tx.uniqueCode > 0 ? (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-mono font-extrabold text-emerald-300">
                                          Kode Unik Verifikasi: +Rp {tx.uniqueCode.toLocaleString('id-ID')}
                                        </span>
                                      ) : null}
                                      {tx.createdAt && (
                                        <span className="text-[10px] text-slate-500">
                                          • {tx.createdAt}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span>
                                        Tujuan / ID:{' '}
                                        <strong className="text-cyan-300 font-mono">{tx.target}</strong>
                                      </span>
                                      <span>|</span>
                                      <span>
                                        Nominal Transfer Wajib:{' '}
                                        <strong className="text-emerald-400 font-mono text-xs">
                                          {tx.total}
                                        </strong>
                                      </span>
                                      {tx.payment && (
                                        <>
                                          <span>|</span>
                                          <span>
                                            Metode: <strong className="text-white">{tx.payment}</strong>
                                          </span>
                                        </>
                                      )}
                                      {tx.whatsapp && (
                                        <>
                                          <span>|</span>
                                          <span>
                                            WA: <strong className="text-slate-200">{tx.whatsapp}</strong>
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    <div className="text-[11px] flex items-center gap-2 flex-wrap">
                                      <span className="flex items-center gap-1.5">
                                        <span className="text-slate-400">Status Transaksi:</span>
                                        <span
                                          className={`font-extrabold px-2 py-0.5 rounded-md ${
                                            isVerified
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          }`}
                                        >
                                          {tx.status}
                                        </span>
                                      </span>
                                      {tx.memberName && (
                                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-[10px] text-purple-300 font-semibold">
                                          Member: {tx.memberName}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                    {cleanBuyerWa && (
                                      <a
                                        href={`https://wa.me/${cleanBuyerWa}?text=${encodeURIComponent(
                                          `✨ *INFO PESANAN CAHYOSTORE* ✨\n\nHalo Kak, pesanan Anda dengan ID Transaksi *${tx.id}* (*${tx.product} - ${tx.item}*) dengan nominal *${tx.total}* saat ini berstatus: *${tx.status}*.\n\nTerima kasih telah berbelanja di CahyoStore! 🚀`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1 text-xs"
                                        title="Hubungi WA Pembeli"
                                      >
                                        <span>Chat WA</span>
                                      </a>
                                    )}

                                    {/* 1-Click Fast Verify & Complete Order Button */}
                                    {!isVerified && !/batal|cancel|gagal/i.test(tx.status || '') && (
                                      <button
                                        type="button"
                                        onClick={() => handleVerifyAndCompleteOrder(tx.id)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold flex items-center gap-1 text-xs cursor-pointer shadow-md transition-all active:scale-95"
                                        title="Konfirmasi saldo masuk dan selesaikan pesanan dalam 1 klik"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>✓ Verifikasi &amp; Selesaikan</span>
                                      </button>
                                    )}

                                    {!isVerified && !/batal|cancel|gagal/i.test(tx.status || '') && (
                                      <button
                                        type="button"
                                        onClick={() => handleVerifyPayment(tx.id)}
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1 text-xs cursor-pointer"
                                        title="Klik hanya setelah transaksi cocok di GoPay/DANA/OVO"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Konfirmasi Bayar</span>
                                      </button>
                                    )}

                                    {isVerified && !isShipped && (
                                      <button
                                        type="button"
                                        onClick={() => handleMarkShipped(tx.id)}
                                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1 text-xs cursor-pointer"
                                        title="Klik setelah produk benar-benar dikirim"
                                      >
                                        <PackageCheck className="w-3.5 h-3.5" />
                                        <span>Tandai Terkirim</span>
                                      </button>
                                    )}

                                    {!isVerified && !/batal|cancel|gagal/i.test(tx.status || '') && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOrderStatus(tx.id, 'Dibatalkan')}
                                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold flex items-center gap-1 text-xs cursor-pointer"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Batal</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOrder(tx.id)}
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-white font-bold flex items-center gap-1.5 text-xs cursor-pointer transition-all active:scale-95"
                                      title="Author: Hapus riwayat pesanan ini secara permanen dari server database"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Hapus Riwayat</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {activeTab === 'orders' && (
                    <>
                      <AdminPushPanel showToast={showToast} />
                      <AdminReviewsPanel showToast={showToast} />
                    </>
                  )}

                  {activeTab === 'streaming' && (
                    <div className="space-y-5">
                      {/* Header & Summary Stats */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-600/10 to-slate-900/90 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              <Film className="w-4 h-4" />
                            </span>
                            <div>
                              <h4 className="text-sm font-extrabold text-white">
                                Studio Film, Bioskop &amp; Layanan Streaming
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Kelola paket berlangganan Film &amp; OTT (Netflix, Disney+, Prime Video, VIU, iQIYI, WeTV, HBO GO, CGV/XXI) dengan rapi.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 shrink-0">
                          <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                            <div className="text-sm font-extrabold text-cyan-400 tabular-nums">
                              {streamingProducts.length}
                            </div>
                            <div className="text-[9px] text-slate-400 font-semibold">Platform</div>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                            <div className="text-sm font-extrabold text-purple-300 tabular-nums">
                              {streamingProducts.reduce((acc, p) => acc + p.items.length, 0)}
                            </div>
                            <div className="text-[9px] text-slate-400 font-semibold">Paket Aktif</div>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                            <div className="text-sm font-extrabold text-emerald-400 tabular-nums">
                              {
                                transactions.filter((tx) =>
                                  streamingProducts.some((sp) =>
                                    tx.product.toLowerCase().includes(sp.name.toLowerCase())
                                  )
                                ).length
                              }
                            </div>
                            <div className="text-[9px] text-slate-400 font-semibold">Order Film</div>
                          </div>
                        </div>
                      </div>

                      {/* Section 1: One-Click Preset Film & Streaming Platforms + Bulk Promo */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Tv className="w-4 h-4 text-cyan-400" />
                              <h5 className="text-xs font-extrabold text-white">
                                1. Tambah Cepat Platform Film &amp; Bioskop Populer
                              </h5>
                            </div>
                            <span className="text-[10px] text-slate-400">Klik 1x untuk aktifkan</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                              {
                                name: 'Disney+ Hotstar',
                                pub: 'Walt Disney Studios',
                                idLabel: 'Nomor HP / Email Disney+',
                                c1: '#1e3a8a',
                                c2: '#0f172a',
                                items: [
                                  { name: '1 Bulan Basic HD', price: 29000 },
                                  { name: '1 Bulan Premium 4K', price: 49000 },
                                  { name: '1 Tahun Basic HD', price: 159000 }
                                ]
                              },
                              {
                                name: 'Prime Video',
                                pub: 'Amazon MGM Studios',
                                idLabel: 'Email / Nomor WA Aktif',
                                c1: '#0284c7',
                                c2: '#0f172a',
                                items: [
                                  { name: '1 Bulan Sharing 4K', price: 18000 },
                                  { name: '1 Bulan Private Full', price: 45000 },
                                  { name: '3 Bulan Private 4K', price: 120000 }
                                ]
                              },
                              {
                                name: 'VIU Premium',
                                pub: 'PCCW Media Drama Korea',
                                idLabel: 'Email / Nomor WA Pembeli',
                                c1: '#eab308',
                                c2: '#422006',
                                items: [
                                  { name: '1 Bulan VIU Tanpa Iklan', price: 15000 },
                                  { name: '3 Bulan VIU VIP', price: 35000 },
                                  { name: '1 Tahun VIU Premium', price: 79000 }
                                ]
                              },
                              {
                                name: 'iQIYI VIP',
                                pub: 'iQIYI Cinema & Anime',
                                idLabel: 'Email / Nomor WA Aktif',
                                c1: '#16a34a',
                                c2: '#052e16',
                                items: [
                                  { name: '1 Bulan Standard VIP', price: 19000 },
                                  { name: '1 Bulan Gold VIP 4K', price: 32000 },
                                  { name: '3 Bulan Standard VIP', price: 49000 }
                                ]
                              },
                              {
                                name: 'WeTV VIP',
                                pub: 'Tencent Video Official',
                                idLabel: 'Nomor WA / Email WeTV',
                                c1: '#f97316',
                                c2: '#431407',
                                items: [
                                  { name: '1 Bulan WeTV VIP', price: 16000 },
                                  { name: '3 Bulan WeTV VIP', price: 42000 },
                                  { name: '1 Tahun WeTV VIP', price: 115000 }
                                ]
                              },
                              {
                                name: 'Voucher Bioskop XXI / CGV',
                                pub: 'Cinema Tiket & Snack',
                                idLabel: 'Nomor WhatsApp Penerima Kode',
                                c1: '#b45309',
                                c2: '#1c1917',
                                items: [
                                  { name: 'Voucher Tiket Reguler 2D', price: 45000 },
                                  { name: 'Paket Couple 2 Tiket + Popcorn', price: 110000 },
                                  { name: 'Voucher Premiere / IMAX', price: 95000 }
                                ]
                              }
                            ].map((preset) => {
                              const alreadyExists = streamingProducts.some(
                                (p) => p.name.toLowerCase() === preset.name.toLowerCase()
                              );
                              return (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() =>
                                    handleAddStreamingPresetOrCustom(
                                      preset.name,
                                      preset.pub,
                                      preset.idLabel,
                                      preset.c1,
                                      preset.c2,
                                      preset.items
                                    )
                                  }
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                                    alreadyExists
                                      ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                                      : 'bg-slate-950/80 hover:bg-slate-800 border-white/10 hover:border-cyan-400/50 text-white'
                                  }`}
                                >
                                  <div className="font-extrabold text-[11px] truncate">
                                    {preset.name}
                                  </div>
                                  <div className="flex items-center justify-between text-[9px]">
                                    <span className="text-slate-400 truncate">{preset.pub}</span>
                                    <span
                                      className={`font-bold shrink-0 ${
                                        alreadyExists ? 'text-emerald-400' : 'text-cyan-400'
                                      }`}
                                    >
                                      {alreadyExists ? '✓ Aktif' : '+ Tambah'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bulk Promo & Discount Controller */}
                        <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex flex-col justify-between space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Percent className="w-4 h-4 text-amber-400" />
                              <h5 className="text-xs font-extrabold text-white">
                                2. Promo &amp; Diskon Massal Kategori Film
                              </h5>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Terapkan potongan harga otomatis ke seluruh paket langganan di kategori
                              Streaming &amp; Film dengan pembulatan rapi.
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { pct: 5, label: 'Diskon 5%', desc: 'Promo Harian' },
                              { pct: 10, label: 'Diskon 10%', desc: 'Promo Weekend' },
                              { pct: 20, label: 'Diskon 20%', desc: 'Flash Sale Film' }
                            ].map((promo) => (
                              <button
                                key={promo.pct}
                                type="button"
                                onClick={() => handleApplyStreamingBulkPromo(promo.pct)}
                                className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-center transition-all cursor-pointer"
                              >
                                <div className="text-xs font-extrabold text-amber-300">
                                  {promo.label}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">{promo.desc}</div>
                              </button>
                            ))}
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-[10px] text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span>Semua perubahan otomatis tersimpan di Katalog Utama</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Add Custom Film Service Form */}
                      <form
                        onSubmit={handleCreateCustomFilmService}
                        className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-extrabold text-white flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            <span>3. Buat Layanan Film / Bioskop / Aplikasi Baru</span>
                          </h5>
                          <span className="text-[10px] text-slate-400">
                            Otomatis masuk ke tab &quot;🎬 Streaming &amp; App Pro&quot;
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                          <input
                            type="text"
                            value={newFilmTitle}
                            onChange={(e) => setNewFilmTitle(e.target.value)}
                            placeholder="Nama Layanan (cth: HBO GO / Bstation)"
                            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                          />
                          <input
                            type="text"
                            value={newFilmProvider}
                            onChange={(e) => setNewFilmProvider(e.target.value)}
                            placeholder="Publisher (cth: Warner Bros)"
                            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                          />
                          <input
                            type="text"
                            value={newFilmIdLabel}
                            onChange={(e) => setNewFilmIdLabel(e.target.value)}
                            placeholder="Label Input (cth: Email / No. WA)"
                            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                          />
                          <input
                            type="text"
                            value={newFilmPlanName}
                            onChange={(e) => setNewFilmPlanName(e.target.value)}
                            placeholder="Paket Awal (cth: 1 Bulan UHD)"
                            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={newFilmPlanPrice}
                              onChange={(e) => setNewFilmPlanPrice(e.target.value)}
                              placeholder="Harga (25000)"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <button
                              type="submit"
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold shrink-0 cursor-pointer"
                            >
                              Simpan
                            </button>
                          </div>
                        </div>
                      </form>

                      {/* Section 3: Neat Grid of Active Film & Streaming Platforms + Package Editor */}
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                          <div>
                            <h5 className="text-xs font-extrabold text-white">
                              4. Daftar Platform Film &amp; Paket Langganan Aktif
                            </h5>
                            <p className="text-[11px] text-slate-400">
                              Pilih platform di bawah untuk mengatur paket durasi (1 Hari, 1 Bulan, 1 Tahun, Sharing / Private).
                            </p>
                          </div>
                        </div>

                        {/* Platform Selector Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {streamingProducts.map((sp) => {
                            const isSelected = activeStreamingProduct?.id === sp.id;
                            return (
                              <div
                                key={sp.id}
                                onClick={() => setSelectedStreamingProdId(sp.id)}
                                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'gradient-border-active border-cyan-400 bg-slate-900'
                                    : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <img
                                    src={sp.image}
                                    alt={sp.name}
                                    className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-white text-[11px] truncate">
                                      {sp.name}
                                    </div>
                                    <div className="text-[10px] text-cyan-400 font-semibold">
                                      {sp.items.length} Paket
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStreamingProduct(sp.id, sp.name);
                                  }}
                                  title={`Hapus ${sp.name}`}
                                  className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Active Streaming Product Package List & Add Form */}
                        {activeStreamingProduct && (
                          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/25 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400">
                                  Mengelola Paket Film / Aplikasi:
                                </span>
                                <h6 className="text-sm font-extrabold text-white">
                                  {activeStreamingProduct.name}{' '}
                                  <span className="text-xs font-normal text-slate-400">
                                    ({activeStreamingProduct.publisher})
                                  </span>
                                </h6>
                              </div>
                              <form
                                onSubmit={handleAddStreamingNominal}
                                className="flex flex-wrap sm:flex-nowrap items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={newStreamingItemName}
                                  onChange={(e) => setNewStreamingItemName(e.target.value)}
                                  placeholder="Nama Paket (cth: 1 Bulan Private 4K)"
                                  className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                                <input
                                  type="number"
                                  value={newStreamingItemPrice}
                                  onChange={(e) => setNewStreamingItemPrice(e.target.value)}
                                  placeholder="Harga (Rp)"
                                  className="w-28 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Tambah Paket</span>
                                </button>
                              </form>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {activeStreamingProduct.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-white text-[11px] truncate">
                                      {item.name}
                                    </div>
                                    <div className="text-emerald-400 font-extrabold text-xs tabular-nums">
                                      Rp {item.price.toLocaleString('id-ID')}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteNominalItem(activeStreamingProduct.id, item.id)
                                    }
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                                    title="Hapus paket"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'catalog' && (
                    <div className="space-y-5">
                      {/* ⚡ Reset & Manajemen Cepat Harga Seluruh Katalog (Author Feature) */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-slate-900/90 border border-cyan-500/35 space-y-3.5 shadow-neon-cyan">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black border border-cyan-500/40">
                                FITUR AUTHOR
                              </span>
                              <h4 className="text-sm font-black text-white flex items-center gap-2">
                                <Package className="w-4 h-4 text-cyan-400" />
                                <span>Manajemen Harga &amp; Reset Katalog ({products.length} Produk)</span>
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed max-w-2xl">
                              Fitur khusus Author untuk <strong>mereset semua harga produk menjadi Rp 0</strong>, sehingga Anda dapat menentukan dan mengubah harga nominal satu per satu secara leluasa atau menerapkan margin keuntungan otomatis.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={() => handleResetAllPricesToZero('all')}
                              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.45)] cursor-pointer active:scale-95 transition-all"
                              title="Ubah SEMUA harga nominal di seluruh game/produk menjadi Rp 0 agar Anda dapat mengisi harga satu per satu"
                            >
                              <RotateCcw className="w-4 h-4 text-amber-200" />
                              <span>Reset Semua Harga Menjadi Rp 0</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleResetDefaultCatalog}
                              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                              title="Kembalikan semua produk ke daftar harga standar bawaan sistem"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Kembalikan Harga Standar</span>
                            </button>
                          </div>
                        </div>

                        {/* Quick Margin Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-extrabold text-slate-300 flex items-center gap-1">
                              <Percent className="w-3.5 h-3.5 text-purple-400" />
                              <span>Terapkan Margin Keuntungan Otomatis:</span>
                            </span>
                            {[5, 6, 7, 8, 9, 10].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleApplyGlobalMargin(pct, 'all')}
                                className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/35 text-purple-300 hover:text-white font-black text-[11px] cursor-pointer transition-all active:scale-95"
                                title={`Terapkan margin keuntungan +${pct}% ke seluruh harga produk`}
                              >
                                +{pct}% Margin
                              </button>
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            *Pilih margin di atas untuk kalkulasi cepat harga jual
                          </span>
                        </div>

                        {/* Quick Global Discount Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pt-3 mt-2 border-t border-white/5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-extrabold text-slate-300 flex items-center gap-1">
                              <Tag className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Terapkan Diskon ke Seluruh Katalog:</span>
                            </span>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pct) => (
                              <button
                                key={`global-discount-${pct}`}
                                type="button"
                                onClick={() => handleApplyGlobalDiscount(pct)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300 hover:text-white font-black text-[11px] cursor-pointer transition-all active:scale-95"
                                title={`Terapkan diskon ${pct}% ke seluruh nominal katalog yang sudah memiliki harga`}
                              >
                                -{pct}% Diskon
                              </button>
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            *Diskon dihitung dari harga saat ini; nominal Rp 0 tetap Rp 0.
                          </span>
                        </div>
                      </div>

                      {/* 1. Form Tambah Produk / Layanan Baru ke Katalog */}
                      <form
                        onSubmit={handleCreateNewCatalogProduct}
                        className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-3.5"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                          <h5 className="text-xs font-extrabold text-white flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            <span>1. Tambah Produk / Layanan Baru ke Katalog</span>
                          </h5>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-extrabold text-emerald-300">
                            Langsung Tampil di Halaman Utama
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Nama Produk / Game *
                            </label>
                            <input
                              type="text"
                              value={newProdName}
                              onChange={(e) => setNewProdName(e.target.value)}
                              placeholder="cth: Honor of Kings / Roblox"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Publisher / Penyedia
                            </label>
                            <input
                              type="text"
                              value={newProdPublisher}
                              onChange={(e) => setNewProdPublisher(e.target.value)}
                              placeholder="cth: Tencent / Official"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Kategori Katalog
                            </label>
                            <select
                              value={newProdCategory}
                              onChange={(e) =>
                                setNewProdCategory(e.target.value as Product['category'])
                              }
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            >
                              <option value="game">🎮 Game Mobile</option>
                              <option value="pcgame">💻 Game PC &amp; Konsol</option>
                              <option value="streaming">🎬 Streaming &amp; App Pro</option>
                              <option value="sosmed">🔥 Sosmed &amp; TikTok</option>
                              <option value="digital">📱 Pulsa &amp; Kuota</option>
                              <option value="voucher">🎟️ Voucher</option>
                              <option value="ewallet">💳 E-Wallet</option>
                              <option value="pln">⚡ Listrik PLN</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              URL Gambar Ikon (Opsional)
                            </label>
                            <input
                              type="text"
                              value={newProdImage}
                              onChange={(e) => setNewProdImage(e.target.value)}
                              placeholder="https://... (Kosongkan = Auto Artwork)"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Label Input Tujuan
                            </label>
                            <input
                              type="text"
                              value={newProdIdLabel}
                              onChange={(e) => setNewProdIdLabel(e.target.value)}
                              placeholder="cth: Masukkan Player ID"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Nama Paket / Nominal Awal
                            </label>
                            <input
                              type="text"
                              value={newProdFirstItemName}
                              onChange={(e) => setNewProdFirstItemName(e.target.value)}
                              placeholder="cth: 100 Tokens / Diamonds"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Harga Awal (Rp)
                            </label>
                            <input
                              type="number"
                              value={newProdFirstItemPrice}
                              onChange={(e) => setNewProdFirstItemPrice(e.target.value)}
                              placeholder="15000"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none bg-slate-950 border border-white/10 rounded-xl px-3 py-2">
                              <input
                                type="checkbox"
                                checked={newProdHasZone}
                                onChange={(e) => setNewProdHasZone(e.target.checked)}
                                className="accent-cyan-400"
                              />
                              <span>Pakai Zone ID</span>
                            </label>

                            <button
                              type="submit"
                              className="flex-1 py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-neon-cyan cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Tambah Produk</span>
                            </button>
                          </div>
                        </div>
                      </form>

                      {/* 2. Daftar Semua Produk Katalog (Pilih, Duplikasi, atau Hapus Produk) */}
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                          <div>
                            <h5 className="text-xs font-extrabold text-white">
                              2. Daftar Produk Aktif — Klik untuk Kelola atau Hapus Produk
                            </h5>
                            <p className="text-[10px] text-slate-400">
                              Klik kartu produk untuk mengedit nominalnya, atau klik ikon tempat sampah merah untuk menghapus produk dari website.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={catalogSearch}
                              onChange={(e) => setCatalogSearch(e.target.value)}
                              placeholder="Cari nama produk..."
                              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                            <select
                              value={catalogCategoryFilter}
                              onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                              className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                            >
                              <option value="all">Semua Kategori</option>
                              <option value="game">Game Mobile</option>
                              <option value="pcgame">Game PC</option>
                              <option value="streaming">Streaming</option>
                              <option value="sosmed">Sosmed</option>
                              <option value="digital">Pulsa &amp; Kuota</option>
                              <option value="voucher">Voucher</option>
                              <option value="ewallet">E-Wallet</option>
                              <option value="pln">PLN</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                          {products
                            .filter((p) => {
                              const matchCat =
                                catalogCategoryFilter === 'all' ||
                                p.category === catalogCategoryFilter;
                              const matchQuery =
                                !catalogSearch.trim() ||
                                p.name.toLowerCase().includes(catalogSearch.trim().toLowerCase()) ||
                                p.publisher
                                  .toLowerCase()
                                  .includes(catalogSearch.trim().toLowerCase());
                              return matchCat && matchQuery;
                            })
                            .map((p) => {
                              const isSelected = activeCatalogProduct?.id === p.id;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => setSelectedProdId(p.id)}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                    isSelected
                                      ? 'gradient-border-active border-cyan-400 bg-slate-900'
                                      : 'bg-slate-950/80 border-white/10 hover:border-white/25'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <img
                                      src={p.image}
                                      alt={p.name}
                                      className="w-10 h-10 rounded-lg object-cover border border-white/10 bg-slate-900 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-white text-[11px] truncate">
                                        {p.name}
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {p.publisher}
                                      </div>
                                      <div className="text-[10px] text-cyan-400 font-bold">
                                        {p.items.length} Nominal
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateCatalogProduct(p);
                                      }}
                                      title={`Duplikasi ${p.name}`}
                                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 border border-white/5 cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCatalogProduct(p.id, p.name);
                                      }}
                                      title={`Hapus produk ${p.name}`}
                                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-slate-950 border border-rose-500/30 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* 3. Editor Produk Terpilih & Manajemen Nominal + Fitur Bulk Harga */}
                      {activeCatalogProduct && (
                        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={activeCatalogProduct.image}
                                alt={activeCatalogProduct.name}
                                className="w-11 h-11 rounded-xl object-cover border border-cyan-400/40"
                              />
                              <div>
                                <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400">
                                  Sedang Mengelola Produk:
                                </span>
                                <h5 className="text-sm font-extrabold text-white">
                                  {activeCatalogProduct.name}{' '}
                                  <span className="text-xs font-normal text-slate-400">
                                    ({activeCatalogProduct.publisher})
                                  </span>
                                </h5>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleAdjustCatalogPrices(-5, 'selected')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-extrabold text-[10px] cursor-pointer"
                              >
                                Diskon -5% Produk Ini
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustCatalogPrices(5, 'selected')}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-extrabold text-[10px] cursor-pointer"
                              >
                                Markup +5% Produk Ini
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteCatalogProduct(
                                    activeCatalogProduct.id,
                                    activeCatalogProduct.name
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-slate-950 border border-rose-500/40 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus Produk Ini</span>
                              </button>
                            </div>
                          </div>

                          {/* Edit Info Produk (Nama, Publisher, Gambar, Label Input) */}
                          <form
                            onSubmit={handleSaveCatalogProductDetails}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-slate-950/75 p-3 rounded-xl border border-white/5"
                          >
                            <input
                              type="text"
                              value={editProdName}
                              onChange={(e) => setEditProdName(e.target.value)}
                              placeholder="Nama Produk"
                              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                            <input
                              type="text"
                              value={editProdPublisher}
                              onChange={(e) => setEditProdPublisher(e.target.value)}
                              placeholder="Publisher"
                              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                            <input
                              type="text"
                              value={editProdIdLabel}
                              onChange={(e) => setEditProdIdLabel(e.target.value)}
                              placeholder="Label Input ID"
                              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                            <input
                              type="text"
                              value={editProdImage}
                              onChange={(e) => setEditProdImage(e.target.value)}
                              placeholder="URL Gambar Baru (opsional)"
                              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                            <button
                              type="submit"
                              className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs cursor-pointer"
                            >
                              Simpan Info Produk
                            </button>
                          </form>

                          {/* Add New Nominal Item Form */}
                          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/75 border border-cyan-500/25">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                              <span className="font-extrabold text-white flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Tambah Item Nominal Baru (Auto Margin {globalMarginPercent}%)</span>
                              </span>
                              <span className="text-[10px] text-amber-300 font-semibold">
                                *Isi Harga Modal Supplier &rarr; Harga Jual Terpasang Otomatis (+{globalMarginPercent}%)
                              </span>
                            </div>
                            <form
                              onSubmit={handleAddNominalItem}
                              className="grid grid-cols-1 sm:grid-cols-5 gap-2.5"
                            >
                              <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Nama Item (cth: 500 Diamonds)"
                                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                              />
                              <input
                                type="number"
                                value={newItemSupplierPrice}
                                onChange={(e) => handleSupplierPriceInput(e.target.value)}
                                placeholder="Harga Modal Supplier (Rp)"
                                className="bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300 text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
                              />
                              <select
                                value={globalMarginPercent}
                                onChange={(e) => handleGlobalMarginChange(Number(e.target.value))}
                                aria-label="Persentase margin keuntungan"
                                className="bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-purple-300 text-xs focus:outline-none focus:border-purple-400"
                              >
                                {[5, 6, 7, 8, 9, 10].map((pct) => (
                                  <option key={pct} value={pct}>Margin +{pct}%</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={newItemPrice}
                                onChange={(e) => setNewItemPrice(e.target.value)}
                                placeholder={`Harga Jual (+${globalMarginPercent}% Auto)`}
                                className="bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-cyan-300 font-bold text-xs focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
                              />
                              <button
                                type="submit"
                                className="py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-neon-cyan"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Tambah Item</span>
                              </button>
                            </form>
                          </div>

                          {/* Nominal Items Filter Toolbar & Quick Batch Save */}
                          {(() => {
                            const zeroCount = activeCatalogProduct.items.filter((it) => it.price === 0).length;
                            const pricedCount = activeCatalogProduct.items.filter((it) => it.price > 0).length;
                            const draftCount = Object.keys(itemPriceDrafts).length;

                            const visibleItems = activeCatalogProduct.items.filter((item) => {
                              if (itemPriceFilter === 'zero') return item.price === 0;
                              if (itemPriceFilter === 'priced') return item.price > 0;
                              return true;
                            });

                            return (
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-950/85 p-3 rounded-2xl border border-white/10">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">
                                      Filter Nominal:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setItemPriceFilter('all')}
                                      className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                                        itemPriceFilter === 'all'
                                          ? 'bg-cyan-500 text-slate-950 font-black shadow-neon-cyan'
                                          : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                                      }`}
                                    >
                                      Semua ({activeCatalogProduct.items.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemPriceFilter('zero')}
                                      className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                                        itemPriceFilter === 'zero'
                                          ? 'bg-amber-500 text-slate-950 font-black'
                                          : 'bg-slate-900 text-amber-300 hover:text-amber-200 border border-amber-500/30'
                                      }`}
                                    >
                                      <span>⚠️ Belum Diatur (Rp 0)</span>
                                      <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                                        {zeroCount}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemPriceFilter('priced')}
                                      className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                                        itemPriceFilter === 'priced'
                                          ? 'bg-emerald-500 text-slate-950 font-black'
                                          : 'bg-slate-900 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30'
                                      }`}
                                    >
                                      <span>✓ Sudah Berharga</span>
                                      <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                                        {pricedCount}
                                      </span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleResetAllPricesToZero('selected')}
                                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 font-extrabold text-[11px] cursor-pointer transition-all active:scale-95"
                                      title="Reset seluruh harga nominal produk ini ke Rp 0"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Reset Produk Ini ke Rp 0</span>
                                    </button>

                                    {draftCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleSaveAllDraftPrices(activeCatalogProduct.id)}
                                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-neon-emerald animate-pulse flex items-center gap-1.5"
                                      >
                                        <span>💾 Simpan Semua Perubahan ({draftCount})</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-[10px] text-slate-400">
                                  Urutan nominal di toko mengikuti urutan di sini. Gunakan tombol ↑ dan ↓ pada setiap kartu; mengubah harga tidak akan mengubah posisi.
                                </p>

                                {/* Items Grid */}
                                {visibleItems.length === 0 ? (
                                  <div className="p-8 rounded-xl bg-slate-950/60 border border-white/5 text-center text-xs text-slate-400">
                                    Tidak ada item nominal yang sesuai dengan filter.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {visibleItems.map((item) => {
                                      const isZero = item.price === 0;
                                      const itemIndex = activeCatalogProduct.items.findIndex((candidate) => candidate.id === item.id);
                                      const currentDraft = itemPriceDrafts[item.id] !== undefined
                                        ? itemPriceDrafts[item.id]
                                        : String(item.price);
                                      const isModified =
                                        itemPriceDrafts[item.id] !== undefined &&
                                        Number(itemPriceDrafts[item.id]) !== item.price;

                                      return (
                                        <div
                                          key={item.id}
                                          className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                                            isZero
                                              ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                                              : isModified
                                              ? 'bg-cyan-950/30 border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                                              : 'bg-slate-950/85 border-white/10'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="font-extrabold text-white text-xs truncate">
                                                {item.name}
                                              </div>
                                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {isZero ? (
                                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-300 font-black text-[9px] border border-amber-500/40 animate-pulse">
                                                    ⚠️ Rp 0 (Belum Diatur)
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black text-[10px] border border-emerald-500/30 font-mono">
                                                    ✓ Rp {item.price.toLocaleString('id-ID')}
                                                  </span>
                                                )}
                                                {isModified && (
                                                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                                                    Perubahan Belum Disimpan
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => handleMoveNominalItem(activeCatalogProduct.id, item.id, -1)}
                                                disabled={itemIndex <= 0}
                                                className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                                title="Pindahkan nominal ke atas"
                                                aria-label={`Pindahkan ${item.name} ke atas`}
                                              >
                                                ↑
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleMoveNominalItem(activeCatalogProduct.id, item.id, 1)}
                                                disabled={itemIndex < 0 || itemIndex >= activeCatalogProduct.items.length - 1}
                                                className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                                title="Pindahkan nominal ke bawah"
                                                aria-label={`Pindahkan ${item.name} ke bawah`}
                                              >
                                                ↓
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteNominalItem(activeCatalogProduct.id, item.id)}
                                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                                                title="Hapus nominal ini"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Direct Quick-Edit Price Input & Save */}
                                          <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                              Harga Jual:
                                            </span>
                                            <div className="relative flex-1">
                                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                                Rp
                                              </span>
                                              <input
                                                type="number"
                                                min="0"
                                                step="100"
                                                value={currentDraft}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setItemPriceDrafts((prev) => ({
                                                    ...prev,
                                                    [item.id]: v
                                                  }));
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleSaveSingleDraftPrice(
                                                      activeCatalogProduct.id,
                                                      item.id,
                                                      Number(currentDraft)
                                                    );
                                                  }
                                                }}
                                                placeholder="0"
                                                className={`w-full bg-slate-900 border rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none transition-colors ${
                                                  isZero
                                                    ? 'border-amber-500/60 focus:border-amber-400'
                                                    : 'border-white/10 focus:border-cyan-400'
                                                }`}
                                              />
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleSaveSingleDraftPrice(
                                                  activeCatalogProduct.id,
                                                  item.id,
                                                  Number(currentDraft)
                                                )
                                              }
                                              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shrink-0 transition-all active:scale-95"
                                            >
                                              Simpan
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'members' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-extrabold text-white">
                          Daftar Member Terdaftar &amp; Manajemen Kata Sandi ({members.length})
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Kata sandi tersimpan sebagai hash sehingga tidak dapat dilihat. Admin hanya dapat melakukan reset kata sandi.
                        </p>
                      </div>

                      {members.length === 0 ? (
                        <div className="p-10 rounded-2xl bg-slate-900/60 border border-white/5 text-center text-slate-500">
                          Belum ada member yang mendaftar.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {members.map((m) => {
                            const isEditing = editingMemberId === m.id;
                            const cleanMemberWa = String(m.whatsapp || '').replace(/^0/, '62').replace(/[^\d]/g, '');

                            return (
                              <div
                                key={m.id}
                                className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-2">
                                      <span>{m.name}</span>
                                      <span className="text-[10px] text-cyan-400 font-semibold">
                                        ({m.id})
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      Email: <span className="text-slate-200">{m.email}</span> • WA:{' '}
                                      <span className="text-emerald-400 font-semibold">{m.whatsapp}</span>
                                    </div>
                                  </div>
                                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                                    <div className="font-extrabold text-amber-400 tabular-nums">
                                      {m.points || 100} Pts
                                    </div>
                                    <div className="text-[10px] text-slate-500">{m.joinedAt}</div>
                                  </div>
                                </div>

                                {/* Passwords are never revealed; admin can perform a secure reset. */}
                                <div className="pt-2.5 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-white/10">
                                    <KeyRound className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    <span className="text-[11px] text-slate-400">Sandi Member:</span>
                                    <code className="text-xs font-extrabold text-slate-300 tracking-wide">Tersimpan sebagai hash</code>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEditing) {
                                          setEditingMemberId(null);
                                          setNewMemberPassword('');
                                        } else {
                                          setEditingMemberId(m.id);
                                          setNewMemberPassword('');
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-[11px] cursor-pointer transition-all"
                                    >
                                      {isEditing ? 'Batal Ubah' : 'Reset / Ubah Sandi'}
                                    </button>
                                    {cleanMemberWa && (
                                      <a
                                        href={`https://wa.me/${cleanMemberWa}?text=${encodeURIComponent(`Halo *${m.name}*, untuk keamanan akun CahyoStore, silakan gunakan fitur reset kata sandi bila lupa. Admin tidak dapat melihat kata sandi lama Anda.`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] transition-all"
                                      >
                                        Hubungi Member via WA
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* Inline Reset Password Form */}
                                {isEditing && (
                                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <input
                                      type="password"
                                      value={newMemberPassword}
                                      onChange={(e) => setNewMemberPassword(e.target.value)}
                                      placeholder="Masukkan kata sandi baru (min. 8 karakter)"
                                      className="flex-1 bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleResetMemberPassword(m.id, m.name)}
                                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold text-xs cursor-pointer"
                                    >
                                      Simpan Sandi Baru
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'zip' && (
                    <div className="space-y-4">
                      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 border border-emerald-500/35 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-neon-cyan shrink-0">
                              <FileArchive className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-extrabold text-emerald-300">
                                FULL SOURCE CODE (TANPA DATA SENSITIF)
                              </span>
                              <h4 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                                Unduh File ZIP Semua File Website Ini (Khusus Author)
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Berisi kode sumber aplikasi dan konfigurasi, tanpa database live, hash kata sandi, sesi admin, atau secret environment.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={downloadingZip}
                              onClick={handleDownloadSupabaseZip}
                              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-neon-cyan cursor-pointer disabled:opacity-50"
                              title="Download ZIP khusus Supabase + Vercel (dilengkapi SQL skema base PostgreSQL, RLS, dan vercel.json)"
                            >
                              <Database className="w-4 h-4 text-emerald-200" />
                              <span>
                                {downloadingZip
                                  ? 'Mengemas ZIP...'
                                  : '⚡ Download ZIP Supabase + Vercel'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={downloadingZip}
                              onClick={handleDownloadVercelZip}
                              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-neon-cyan cursor-pointer disabled:opacity-50"
                              title="Download ZIP khusus siap deploy ke Vercel (dilengkapi vercel.json)"
                            >
                              <Rocket className="w-4 h-4 text-cyan-200" />
                              <span>
                                {downloadingZip
                                  ? 'Mengemas ZIP...'
                                  : '⚡ Download ZIP Khusus Vercel'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={downloadingZip}
                              onClick={handleDownloadFullWebsiteZip}
                              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-neon-cyan cursor-pointer disabled:opacity-50"
                              title="Download seluruh source code website lengkap"
                            >
                              <Download className="w-4 h-4" />
                              <span>
                                {downloadingZip
                                  ? 'Mengemas...'
                                  : 'Download Full Website ZIP'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Status Sinkronisasi ZIP Otomatis Live */}
                        <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-600/20 border border-emerald-400/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                            </span>
                            <div>
                              <span className="text-xs font-extrabold text-white">
                                FILE ZIP: DIRAKIT SAAT DIUNDUH
                              </span>
                              <p className="text-[10px] text-emerald-300">
                                Paket dirakit dari file yang tersedia pada deployment Production aktif. Setelah commit terbaru selesai dideploy, unduh ulang untuk mendapat source versi terbaru.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-emerald-400/30 text-[10px] font-mono font-bold text-emerald-300">
                              Format: .ZIP • Vercel + Supabase Ready
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-bold text-cyan-200">
                              Status: Siap Unduh
                            </span>
                          </div>
                        </div>

                        {/* Ringkasan Pembaruan Terbaru di Dalam ZIP Author */}
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-[11px] text-slate-200">
                          <div className="font-extrabold text-emerald-300">
                            ✓ Pembaruan &amp; Peningkatan Sistem Terbaru yang Otomatis Masuk ke Paket ZIP Ini:
                          </div>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-300 list-disc list-inside">
                            <li><strong className="text-white">Migrasi Supabase PostgreSQL:</strong> SQL tambahan untuk sesi backend dan penyimpanan database (<code className="text-emerald-300">supabase/migrations/20261107_backend_storage.sql</code>).</li>
                            <li><strong className="text-white">Keamanan Ketat (Strict Security):</strong> Penghapusan total tombol isi otomatis, sandi terbuka, dan login bypass 1-klik.</li>
                            <li><strong className="text-white">QRIS Resmi ASPI Baru:</strong> Integrasi langsung image resmi dan salinan lokal HD.</li>
                            <li><strong className="text-white">Perapihan Header Mobile:</strong> Menghapus 6 tombol duplikat atas agar tampilan mobile bersih &amp; rapi.</li>
                            <li><strong className="text-white">Fitur Logout Akun:</strong> Akses logout mudah di header HP, navbar desktop, &amp; panel admin.</li>
                            <li><strong className="text-white">Sesi Admin 30 Hari:</strong> Tersimpan di Supabase PostgreSQL dengan token yang di-hash.</li>
                            <li><strong className="text-white">Download ZIP Otomatis:</strong> Multi-source token (<code className="text-cyan-300">Bearer</code> &amp; query) tanpa error 401.</li>
                            <li><strong className="text-white">Backend Production:</strong> Express Function di Vercel dengan Supabase PostgreSQL sebagai sumber data utama.</li>
                          </ul>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-cyan-300">
                              Daftar File Website di Dalam Paket ZIP ({WEBSITE_FILES_MANIFEST.length} File Utama):
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              CahyoStore-Full-Website-Files.zip
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                            {WEBSITE_FILES_MANIFEST.map((f: any) => (
                              <div
                                key={f.path}
                                className="px-3 py-2 rounded-xl bg-slate-900/90 border border-white/5 flex flex-col gap-0.5"
                              >
                                <span className="font-mono text-[11px] font-bold text-emerald-300 truncate">
                                  {f.path}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate">
                                  {f.desc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
