/**
 * Pemeriksaan ID/nomor tujuan sebelum pembeli membayar.
 *
 * ATURAN KERAS: tidak pernah mengarang nama akun, operator aktif, tarif, dsb.
 *  - 'confirmed'   : nama akun benar-benar dikembalikan penyedia (Roblox resmi / lookup nickname game).
 *  - 'format_only' : format valid, tetapi pemilik akun TIDAK bisa dikonfirmasi otomatis. Pembeli wajib memeriksa sendiri.
 *  - 'invalid'     : format salah, atau penyedia memastikan akun tidak ada.
 */
export type TargetLevel = 'confirmed' | 'format_only' | 'invalid';

export interface TargetInput {
  productId?: unknown;
  productName?: unknown;
  category?: unknown;
  idLabel?: unknown;
  userId?: unknown;
  zoneId?: unknown;
  hasZoneId?: unknown;
}

export interface TargetResult {
  valid: boolean;
  level: TargetLevel;
  accountName?: string;
  regionOrInfo?: string;
  provider: string;
  message?: string;
}

/** Format-only means the syntax passed, but the account owner was not confirmed online. */
export function isTargetAcceptable(result: Pick<TargetResult, 'valid' | 'level'>): boolean {
  return result.valid && result.level !== 'invalid';
}

const GAME_NICKNAME_SLUGS: Record<string, string> = {
  // Alias game yang tercantum pada dokumentasi publik provider.
  codm: 'cod',
  ff: 'ff',
  ffmax: 'ff',
  genshin: 'gi',
  hsr: 'hsr',
  magicchess: 'mcgg',
  mlbb: 'ml',
  pointblank: 'pb',
  supersus: 'sus',
  valorant: 'valo',
  zzz: 'zzz',
};

const OPERATOR_PREFIXES: Array<[RegExp, string]> = [
  [/^(0811|0812|0813|0821|0822|0823|0851|0852|0853)$/, 'Telkomsel'],
  [/^(0814|0815|0816|0855|0856|0857|0858)$/, 'Indosat'],
  [/^(0895|0896|0897|0898|0899)$/, 'Tri'],
  [/^(0817|0818|0819|0859|0877|0878)$/, 'XL'],
  [/^(0831|0832|0833|0838)$/, 'AXIS'],
  [/^(0881|0882|0883|0884|0885|0886|0887|0888|0889)$/, 'Smartfren'],
];

async function fetchJson(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyTarget(input: TargetInput, fetchImpl: typeof fetch = fetch): Promise<TargetResult> {
  const user = String(input.userId ?? '').trim();
  const zone = String(input.zoneId ?? '').trim();
  const pid = String(input.productId ?? '').toLowerCase();
  const cat = String(input.category ?? '').toLowerCase();
  const label = String(input.idLabel ?? '').toLowerCase();
  const name = String(input.productName ?? '');

  if (!user) return { valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'ID / nomor tujuan kosong.' };

  // 1) Nomor HP / pulsa / paket data / e-wallet: hanya format + awalan operator.
  const isPhoneLike =
    pid === 'pulsa' || pid.startsWith('pulsa') || pid === 'paketdata' || pid === 'ewallet' ||
    cat === 'digital' || cat === 'ewallet' || /nomor\s*hp|nomor\s*wa|telepon|e-wallet|pulsa/i.test(label);
  if (isPhoneLike) {
    const phone = user.replace(/^(\+62|62)/, '0').replace(/[\s.-]/g, '');
    if (!/^08\d{8,12}$/.test(phone)) {
      return { valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'Format nomor tidak valid. Gunakan nomor HP Indonesia, contoh: 081234567890.' };
    }
    const operator = OPERATOR_PREFIXES.find(([re]) => re.test(phone.slice(0, 4)))?.[1];
    const isEwallet = pid === 'ewallet' || cat === 'ewallet' || /e-wallet|dana|ovo|gopay|shopee/i.test(`${label} ${name}`);
    return {
      valid: true,
      level: 'format_only',
      accountName: `Nomor tujuan: ${phone}`,
      regionOrInfo: isEwallet
        ? 'Nama pemilik akun e-wallet tidak dapat dicek otomatis. Pastikan nomor ini benar.'
        : `${operator ? `Awalan nomor menunjukkan ${operator} (perkiraan). ` : ''}Aktif/tidaknya nomor tidak dapat dicek otomatis.`,
      provider: 'Pemeriksaan format',
    };
  }

  // 2) PLN: hanya format. Nama pelanggan & tarif TIDAK dikarang.
  if (pid === 'pln' || cat === 'pln' || /meter|pelanggan|listrik/i.test(label)) {
    const meter = user.replace(/[\s.-]/g, '');
    if (!/^\d{11,12}$/.test(meter) || /^0+$/.test(meter)) {
      return { valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'Nomor meter / ID pelanggan PLN harus 11–12 digit angka.' };
    }
    return {
      valid: true,
      level: 'format_only',
      accountName: `No. Meter / IDPEL: ${meter}`,
      regionOrInfo: 'Nama pelanggan tidak dapat dicek otomatis. Cocokkan dengan nomor di meteran atau struk PLN Anda.',
      provider: 'Pemeriksaan format',
    };
  }

  // 3) Roblox: API publik resmi. Tidak ditemukan = invalid; jaringan gagal = format_only.
  if (pid === 'roblox') {
    const username = user.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return { valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'Username Roblox 3–20 karakter: huruf, angka, atau underscore.' };
    }
    const json = await fetchJson(fetchImpl, 'https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    }, 2600);
    if (json && Array.isArray(json.data)) {
      const found = json.data[0];
      if (found) {
        return { valid: true, level: 'confirmed', accountName: `${found.displayName} (@${found.name})`, regionOrInfo: `Roblox UID: ${found.id}`, provider: 'Roblox Users API (resmi)' };
      }
      return { valid: false, level: 'invalid', provider: 'Roblox Users API (resmi)', message: `Username "${username}" tidak ditemukan di Roblox. Periksa ejaannya.` };
    }
    return { valid: true, level: 'format_only', accountName: `Username: @${username}`, regionOrInfo: 'Roblox tidak dapat dihubungi, jadi username belum terkonfirmasi. Periksa ejaannya.', provider: 'Pemeriksaan format' };
  }

  // 4) Game ber-ID: butuh Zone ID bila ada; tolak angka berulang.
  if (input.hasZoneId && !zone) {
    return { valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'Lengkapi Zone ID / Server ID terlebih dahulu.' };
  }
  if (/^(\d)\1{6,}$/.test(user)) {
    return { valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'ID akun tidak valid (angka berulang).' };
  }

  const slug = GAME_NICKNAME_SLUGS[pid];
  if (slug) {
    const q = new URLSearchParams({ id: user });
    if (zone) {
      q.set('zone', zone);
      q.set('server', zone);
    }
    const data = await fetchJson(
      fetchImpl,
      `https://api.isan.eu.org/nickname/${slug}?${q.toString()}`,
      { headers: { Accept: 'application/json' } },
      6500
    );
    if (data?.success && typeof data?.name === 'string' && data.name.trim()) {
      let accountName = data.name.trim();
      // Some gateways return percent-encoded Unicode; decode only encoded byte sequences.
      if (/%[0-9a-fA-F]{2}/.test(accountName)) {
        try { accountName = decodeURIComponent(accountName); } catch { /* keep provider value */ }
      }
      accountName = accountName.replace(/[\u0000-\u001F\u007F]/g, '').trim();
      if (accountName) {
        return {
          valid: true,
          level: 'confirmed',
          accountName: accountName.slice(0, 60),
          regionOrInfo: zone ? `Server/Zone: ${zone}` : 'ID ditemukan',
          provider: 'Lookup nickname (pihak ketiga)',
        };
      }
    }
  }

  // Tidak terkonfirmasi: JANGAN mengarang nama. Tampilkan apa yang diketik pembeli agar mudah diperiksa ulang.
  return {
    valid: true,
    level: 'format_only',
    accountName: `ID: ${user}${zone ? ` (${zone})` : ''}`,
    regionOrInfo: 'Nama akun belum bisa dikonfirmasi otomatis. Periksa ID di dalam game sebelum membayar.',
    provider: 'Pemeriksaan format',
  };
}
