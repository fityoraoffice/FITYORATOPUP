import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  User,
  LogOut,
  ShieldCheck,
  X,
  Phone,
  Mail,
  Award,
  KeyRound,
  MessageCircle,
  ArrowLeft,
  Database,
  RefreshCw,
  ShoppingBag,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ADMIN_WHATSAPP_NUMBER } from '../data/catalog';
import { OFFICIAL_AUTHOR_EMAIL, isKnownAuthorIdentifier } from '../utils/authorIdentity';

export interface MemberUser {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  joinedAt: string;
  points: number;
  isAuthor?: boolean;
}

const AUTHOR_EMAIL = OFFICIAL_AUTHOR_EMAIL;

export function isAuthorIdString(val: string): boolean {
  return isKnownAuthorIdentifier(val);
}

export function isAuthorAccount(user: MemberUser | null): boolean {
  if (!user) return false;
  return Boolean(user.isAuthor || isAuthorIdString(user.email) || isAuthorIdString(user.whatsapp));
}

const USERS_DB_KEY = 'cahyostore_users_db_v1';
const SESSION_USER_KEY = 'cahyostore_session_user_v1';

export interface StoredUserAccount extends MemberUser {
  passwordHash?: string;
}

export function getStoredUsers(): StoredUserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_DB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u: any) => u && typeof u.email === 'string' && !u.isAuthor && String(u.email).toLowerCase() !== AUTHOR_EMAIL)
      .map((u: any) => {
        const { passwordHash: _passwordHash, isAuthor: _isAuthor, ...safe } = u;
        return safe as StoredUserAccount;
      });
  } catch {
    return [];
  }
}

export function saveStoredUsers(users: StoredUserAccount[]) {
  try {
    const safeUsers = (Array.isArray(users) ? users : [])
      .map((u: any) => {
        const { passwordHash: _passwordHash, isAuthor: _isAuthor, ...safe } = u || {};
        return safe;
      })
      .filter((u: any) => u && typeof u.email === 'string' && String(u.email).toLowerCase() !== AUTHOR_EMAIL);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(safeUsers));
  } catch {
    // ignore storage errors
  }
}

/**
 * Syncs user list for admin control panel. Returns cached list if not authenticated as admin.
 */
export async function syncUsersWithServerDb(): Promise<StoredUserAccount[]> {
  try {
    const res = await fetch('/api/users', { cache: 'no-store', credentials: 'same-origin' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.users)) {
        const users = json.users as StoredUserAccount[];
        saveStoredUsers(users);
        return users;
      }
    }
  } catch {
    // Non-admin clients will not have access to full member list for privacy protection.
  }
  return getStoredUsers();
}

const MEMBER_TOKEN_KEY = 'cahyo_member_token_v1';

/**
 * Checks server session and retrieves up-to-date member data & loyalty points live from DB
 */
export async function refreshCurrentMemberProfile(): Promise<MemberUser | null> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(MEMBER_TOKEN_KEY) : null;
    const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('cahyo_admin_token_v1') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    else if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

    const res = await fetch('/api/users/me', { headers, cache: 'no-store', credentials: 'same-origin' });
    if (res.ok) {
      const json = await res.json();
      if (json?.authenticated && json.user) {
        saveSessionUser(json.user);
        return json.user as MemberUser;
      }
    } else if (res.status === 401) {
      // Session has expired on server
      const prev = loadSessionUser();
      if (prev && !prev.isAuthor) {
        saveSessionUser(null);
        try { localStorage.removeItem(MEMBER_TOKEN_KEY); } catch {}
      }
      return null;
    }
  } catch {
    // Fall back to local storage
  }
  return loadSessionUser();
}

export function loadSessionUser(): MemberUser | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MemberUser;
  } catch {
    return null;
  }
}

export function saveSessionUser(user: MemberUser | null) {
  try {
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: MemberUser | null;
  onSuccessAuth: (user: MemberUser, message: string) => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccessAuth,
  onLogout,
  onOpenAdmin,
  showToast
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Self-service password change states
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Member orders state
  const [showMemberOrders, setShowMemberOrders] = useState(false);
  const [memberOrders, setMemberOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Validate and refresh live session whenever modal opens
  useEffect(() => {
    if (isOpen) {
      refreshCurrentMemberProfile().then((fresh) => {
        if (fresh && (!currentUser || fresh.points !== currentUser.points)) {
          onSuccessAuth(fresh, '');
        }
      });
    }
  }, [isOpen]);

  const handleRefreshProfile = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await refreshCurrentMemberProfile();
      if (fresh) {
        onSuccessAuth(fresh, 'Data profil dan poin berhasil diperbarui dari server!');
        showToast('Data akun & saldo poin terverifikasi server!', 'success');
      } else {
        showToast('Sesi telah kedaluwarsa. Silakan masuk kembali.', 'info');
      }
    } catch {
      showToast('Gagal memperbarui status dari server.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMemberOrders = async () => {
    if (showMemberOrders) {
      setShowMemberOrders(false);
      return;
    }
    setShowMemberOrders(true);
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/users/me/orders', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setMemberOrders(json.orders || []);
      }
    } catch {
      showToast('Gagal memuat riwayat pesanan.', 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass || !newPass) {
      showToast('Masukkan kata sandi saat ini dan kata sandi baru!', 'error');
      return;
    }
    if (newPass.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter!', 'error');
      return;
    }
    if (newPass !== confirmNewPass) {
      showToast('Konfirmasi kata sandi baru tidak cocok!', 'error');
      return;
    }

    setChangingPass(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Gagal mengubah kata sandi.', 'error');
        return;
      }
      showToast('Kata sandi berhasil diperbarui! Simpan dengan aman.', 'success');
      setShowPasswordChange(false);
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
    } catch {
      showToast('Server tidak dapat dihubungi. Coba lagi nanti.', 'error');
    } finally {
      setChangingPass(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanWa = whatsapp.trim();

    if (cleanName.length < 2) {
      showToast('Masukkan nama lengkap minimal 2 karakter!', 'error');
      return;
    }
    if (!cleanEmail.includes('@')) {
      showToast('Masukkan alamat email yang valid!', 'error');
      return;
    }
    if (cleanWa.length < 9) {
      showToast('Masukkan nomor WhatsApp aktif yang valid!', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('Kata sandi minimal 8 karakter!', 'error');
      return;
    }

    const cleanPhone = cleanWa.replace(/[\s-]/g, '');
    const authorFlag = isAuthorIdString(cleanEmail) || isAuthorIdString(cleanPhone);

    if (authorFlag) {
      showToast(
        'Pendaftaran akun Author tidak diizinkan. Gunakan Author Login jika Anda pembuat website resmi.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          whatsapp: cleanWa,
          password
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Pendaftaran gagal disimpan di server. Coba lagi.', 'error');
        if (res.status === 409) setTab('login');
        return;
      }

      const sessionUser: MemberUser = json.user;
      if (json.token) {
        try { localStorage.setItem(MEMBER_TOKEN_KEY, json.token); } catch {}
      }
      saveSessionUser(sessionUser);
      onSuccessAuth(
        sessionUser,
        `Akun Member (${sessionUser.id}) berhasil dibuat! Bonus 100 Poin telah masuk ke akun Anda.`
      );
      onClose();
    } catch {
      showToast('Server pendaftaran tidak dapat dihubungi. Periksa koneksi internet Anda.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = email.trim().toLowerCase();
    const pass = password;
    if (!identifier || !pass.trim()) {
      showToast('Masukkan Email / No. WA dan Kata Sandi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Direct gateway if logging in with Author identity
      if (isAuthorIdString(identifier)) {
        const adminRes = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ identifier, password: pass })
        });
        const adminJson = await adminRes.json().catch(() => ({}));
        if (adminRes.ok && adminJson.ok && adminJson.user) {
          const authorSession: MemberUser = {
            id: adminJson.user.id || 'AUTHOR-01',
            name: adminJson.user.name || 'Author CahyoStore',
            email: adminJson.user.email || AUTHOR_EMAIL,
            whatsapp: adminJson.user.whatsapp || '08139525985',
            joinedAt: adminJson.user.joinedAt || '1 Jan 2025',
            points: 99999,
            isAuthor: true
          };
          if (adminJson.token) {
            try {
              localStorage.setItem('cahyo_admin_token_v1', adminJson.token);
              localStorage.setItem(MEMBER_TOKEN_KEY, adminJson.token);
            } catch {}
          }
          saveSessionUser(authorSession);
          onSuccessAuth(authorSession, `Selamat datang, ${authorSession.name}! Akses Author Aktif.`);
          onClose();
          if (onOpenAdmin) onOpenAdmin();
          showToast(`Berhasil masuk sebagai Author! Membuka Control Panel...`, 'success');
          return;
        } else if (!adminRes.ok) {
          showToast(adminJson?.error || 'Kata sandi Author tidak cocok. Pastikan kata sandi dimasukkan dengan benar.', 'error');
          return;
        }
      }

      // Member Login
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier, password: pass })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json?.error || 'Akun tidak ditemukan atau kata sandi salah!', 'error');
        return;
      }

      const sessionUser: MemberUser = json.user;
      if (json.token) {
        try { localStorage.setItem(MEMBER_TOKEN_KEY, json.token); } catch {}
      }
      if (json.isAuthor || json.adminToken) {
        try { localStorage.setItem('cahyo_admin_token_v1', json.adminToken || json.token); } catch {}
      }
      saveSessionUser(sessionUser);
      onSuccessAuth(sessionUser, `Selamat datang kembali, ${sessionUser.name}!`);
      onClose();
      if (sessionUser.isAuthor && onOpenAdmin) onOpenAdmin();
    } catch {
      showToast('Server login tidak dapat dihubungi. Periksa koneksi internet Anda.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem(MEMBER_TOKEN_KEY) : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/users/logout', { method: 'POST', headers, credentials: 'same-origin' }).catch(() => {});
      if (isAuthorAccount(currentUser)) {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      }
    } finally {
      try {
        localStorage.removeItem(MEMBER_TOKEN_KEY);
        localStorage.removeItem('cahyo_admin_token_v1');
      } catch {}
      saveSessionUser(null);
      onLogout();
      onClose();
      showToast('Anda telah berhasil keluar dari akun.', 'info');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 glass-panel max-w-md w-full p-6 rounded-3xl border border-cyan-500/30 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {currentUser ? (
              /* Logged-in Member Profile View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg shadow-neon-cyan">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">{currentUser.name}</h3>
                      <p className="text-xs text-cyan-400 font-semibold">
                        Member ID: {currentUser.id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRefreshProfile}
                    disabled={isRefreshing}
                    title="Perbarui Data & Poin dari Basis Data Server"
                    className="p-2 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                  </button>
                </div>

                {/* Member Stats Card */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email
                    </span>
                    <span className="font-semibold text-white">{currentUser.email}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
                    </span>
                    <span className="font-semibold text-white">{currentUser.whatsapp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" /> Poin Loyalitas
                    </span>
                    <span className="font-extrabold text-amber-400 text-sm tabular-nums">
                      {currentUser.points} Pts
                    </span>
                  </div>
                </div>

                {/* Database Synchronization Indicator */}
                <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-[10px] text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Basis Data Server Persisten • Status Akun Terverifikasi</span>
                  </span>
                  <span className="font-mono text-emerald-400">Aktif</span>
                </div>

                {/* Toggle Member Orders */}
                <div>
                  <button
                    type="button"
                    onClick={handleLoadMemberOrders}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-cyan-400" />
                      <span>Riwayat Pesanan Saya</span>
                    </span>
                    {showMemberOrders ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showMemberOrders && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-white/5 max-h-48 overflow-y-auto space-y-2">
                      {loadingOrders ? (
                        <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> Memuat pesanan Anda...
                        </div>
                      ) : memberOrders.length === 0 ? (
                        <div className="py-3 text-center text-xs text-slate-400">
                          Belum ada transaksi dengan akun ini. Pesanan Anda akan otomatis tercatat di sini!
                        </div>
                      ) : (
                        memberOrders.map((ord: any) => (
                          <div
                            key={ord.id}
                            className="p-2.5 rounded-lg bg-slate-900 border border-white/5 text-[11px] flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-white">{ord.product} - {ord.item}</div>
                              <div className="text-slate-400 font-mono text-[10px]">ID: {ord.id}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-400">{ord.total}</div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-semibold">
                                {ord.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Toggle Password Change */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-purple-400" />
                      <span>Ganti Kata Sandi Member</span>
                    </span>
                    {showPasswordChange ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showPasswordChange && (
                    <form onSubmit={handleChangePassword} className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Kata Sandi Saat Ini
                        </label>
                        <input
                          type="password"
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          placeholder="Masukkan kata sandi lama"
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Kata Sandi Baru (Min. 8 Karakter)
                        </label>
                        <input
                          type="password"
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          placeholder="Kata sandi baru"
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Konfirmasi Kata Sandi Baru
                        </label>
                        <input
                          type="password"
                          value={confirmNewPass}
                          onChange={(e) => setConfirmNewPass(e.target.value)}
                          placeholder="Ulangi kata sandi baru"
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={changingPass}
                        className="w-full py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs transition-colors cursor-pointer"
                      >
                        {changingPass ? 'Memperbarui...' : 'Simpan Kata Sandi Baru'}
                      </button>
                    </form>
                  )}
                </div>

                {isAuthorAccount(currentUser) && onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-neon-cyan hover:opacity-95 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Buka Author Panel (Pembuat Website)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            ) : (
              /* Login / Register / Forgot Form */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white">
                      {tab === 'register'
                        ? 'Daftar Member Baru'
                        : tab === 'login'
                        ? 'Masuk Akun Member'
                        : 'Bantuan Lupa Kata Sandi'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {tab === 'forgot'
                        ? 'Hubungi Author resmi untuk pengecekan & reset kata sandi Anda'
                        : 'Simpan nomor WhatsApp & nikmati checkout lebih cepat'}
                    </p>
                  </div>
                </div>

                {/* Segmented Tab Switcher */}
                {tab !== 'forgot' && (
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setTab('register')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tab === 'register'
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-neon-cyan'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Daftar Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('login')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tab === 'login'
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-neon-cyan'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Masuk Akun
                    </button>
                  </div>
                )}

                {tab === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Muhammad Cahyo"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Alamat Email Aktif
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nomor WhatsApp Aktif
                      </label>
                      <input
                        type="tel"
                        required
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Kata Sandi Member (Min. 8 Karakter)
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold text-xs shadow-neon-cyan hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Mendaftarkan ke Basis Data...</span>
                        </>
                      ) : (
                        <span>Daftar Sekarang (+100 Poin Gratis)</span>
                      )}
                    </button>
                  </form>
                )}

                {tab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email atau Nomor WhatsApp Terdaftar
                      </label>
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com atau 081234567890"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-300">
                          Kata Sandi
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotIdentifier(email);
                            setTab('forgot');
                          }}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          Lupa Kata Sandi?
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi Anda"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold text-xs shadow-neon-cyan hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Memverifikasi Akun...</span>
                        </>
                      ) : (
                        <span>Masuk ke Akun Member</span>
                      )}
                    </button>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Pembuat Website (Author)?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenAdmin) onOpenAdmin();
                        }}
                        className="text-amber-300 hover:text-amber-200 font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Portal Author Login ➔</span>
                      </button>
                    </div>
                  </form>
                )}

                {tab === 'forgot' && (
                  <div className="space-y-3.5">
                    <button
                      type="button"
                      onClick={() => setTab('login')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Masuk
                    </button>
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-white/10 text-xs text-slate-300 leading-relaxed space-y-2">
                      <p>
                        Demi keamanan akun Member CahyoStore, reset kata sandi dibantu langsung oleh <strong>Author Resmi</strong>. Masukkan Email atau Nomor WhatsApp terdaftar Anda di bawah ini:
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email atau Nomor WhatsApp Terdaftar
                      </label>
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="Contoh: nama@email.com atau 081234567890"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <a
                      href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                        `Halo Author CahyoStore, saya lupa kata sandi akun Member saya.\n\n• Email / No. WA Terdaftar: *${
                          forgotIdentifier.trim() || '(Belum diisi)'
                        }*\n\nMohon bantuannya untuk verifikasi & reset kata sandi akun saya. Terima kasih!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Hubungi Author di WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
