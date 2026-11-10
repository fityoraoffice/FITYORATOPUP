import React, { useCallback, useEffect, useState } from 'react';
import { adminHeaders } from '../utils/adminAuth';

interface Props {
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

const urlBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
};

/** Aktifkan notifikasi pesanan baru di perangkat ini (HP/laptop Author). */
export const AdminPushPanel: React.FC<Props> = ({ showToast }) => {
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/push/config', { headers: adminHeaders(), credentials: 'same-origin', cache: 'no-store' });
      const json = await res.json();
      setServerReady(Boolean(json?.enabled));
      setPublicKey(String(json?.publicKey || ''));
    } catch {
      setServerReady(false);
    }
    if (supported) {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        setSubscribed(Boolean(reg && (await reg.pushManager.getSubscription())));
      } catch {
        setSubscribed(false);
      }
    }
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.', 'error');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToArrayBuffer(publicKey) }));
      const res = await fetch('/api/admin/push/subscribe', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'same-origin',
        body: JSON.stringify(sub.toJSON())
      });
      if (!res.ok) throw new Error('subscribe failed');
      setSubscribed(true);
      showToast('Notifikasi pesanan aktif di perangkat ini.', 'success');
    } catch {
      showToast('Gagal mengaktifkan notifikasi. Pastikan situs memakai HTTPS dan sesi Author aktif.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push/unsubscribe', {
          method: 'POST',
          headers: adminHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'same-origin',
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      showToast('Notifikasi dimatikan di perangkat ini.', 'info');
    } catch {
      showToast('Gagal mematikan notifikasi.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/push/test', { method: 'POST', headers: adminHeaders(), credentials: 'same-origin' });
      const json = await res.json();
      showToast(json?.sent ? `Tes terkirim ke ${json.sent} perangkat.` : 'Tidak ada perangkat yang menerima. Aktifkan dulu di perangkat ini.', json?.sent ? 'success' : 'info');
    } catch {
      showToast('Tes notifikasi gagal.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5">
      <h4 className="text-sm font-extrabold text-white">Notifikasi Pesanan Baru ke HP</h4>
      {!supported ? (
        <p className="text-xs text-slate-400">Browser ini belum mendukung notifikasi push. Di iPhone, tambahkan situs ke Layar Utama lebih dulu (iOS 16.4+).</p>
      ) : serverReady === false ? (
        <p className="text-xs text-slate-400">
          Belum aktif di server. Jalankan <code className="text-cyan-300">node scripts/generate-vapid-keys.mjs</code>, isi
          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, dan VAPID_SUBJECT di Vercel, lalu deploy ulang.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            Notifikasi muncul di perangkat ini saat ada pesanan masuk, bahkan ketika dashboard tertutup. Pesan push tidak memuat data pembeli.
          </p>
          <div className="flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <button type="button" disabled={busy} onClick={test} className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-[11px] font-extrabold cursor-pointer disabled:opacity-60">Kirim Tes</button>
                <button type="button" disabled={busy} onClick={disable} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 text-[11px] font-bold cursor-pointer disabled:opacity-60">Matikan di Perangkat Ini</button>
              </>
            ) : (
              <button type="button" disabled={busy || serverReady === null} onClick={enable} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-extrabold cursor-pointer disabled:opacity-60">Aktifkan di Perangkat Ini</button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
