import React, { useEffect, useRef, useState } from 'react';
import { canLoadImage } from '../utils/imageResolver';

export const FX_STORAGE_KEY = 'cahyostore_fx_v2';

export type PresetId =
  | 'cyber'
  | 'obsidian'
  | 'aurora'
  | 'crimson'
  | 'goldvip'
  | 'sakura'
  | 'arctic'
  | 'sunset'
  | 'galaxy'
  | 'emeraldroyal';

export type AnimationMode =
  | 'constellation'
  | 'matrix'
  | 'orbs'
  | 'starfield'
  | 'hexpulse'
  | 'fireflies'
  | 'meteor'
  | 'cyberwave'
  | 'snow'
  | 'off';

export interface ThemePreset {
  id: PresetId;
  name: string;
  desc: string;
  badge?: string;
  bgBase: string;
  orb1: string;
  orb2: string;
  orb3: string;
  gridColor: string;
  particleColor: string;
}

export const THEME_PRESETS: Record<PresetId, ThemePreset> = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Nexus (Default)',
    desc: 'Deep navy & neon cyan-violet gaming mesh',
    badge: 'POPULER',
    bgBase: '#060911',
    orb1: 'rgba(0, 240, 255, 0.14)',
    orb2: 'rgba(112, 0, 255, 0.14)',
    orb3: 'rgba(16, 185, 129, 0.08)',
    gridColor: 'rgba(0, 240, 255, 0.045)',
    particleColor: '0, 240, 255'
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Pro',
    desc: 'Ultra-dark carbon slate & royal indigo glow',
    badge: 'ELEGAN',
    bgBase: '#050508',
    orb1: 'rgba(99, 102, 241, 0.14)',
    orb2: 'rgba(14, 165, 233, 0.11)',
    orb3: 'rgba(168, 85, 247, 0.09)',
    gridColor: 'rgba(148, 163, 184, 0.04)',
    particleColor: '129, 140, 248'
  },
  aurora: {
    id: 'aurora',
    name: 'Emerald Matrix',
    desc: 'Futuristic teal, emerald & cyber cyan atmosphere',
    badge: 'PRO',
    bgBase: '#040a0e',
    orb1: 'rgba(16, 185, 129, 0.14)',
    orb2: 'rgba(6, 182, 212, 0.14)',
    orb3: 'rgba(59, 130, 246, 0.09)',
    gridColor: 'rgba(16, 185, 129, 0.045)',
    particleColor: '52, 211, 153'
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Esports',
    desc: 'High-contrast dark arena with ruby & amber accents',
    badge: 'ESPORTS',
    bgBase: '#0a0507',
    orb1: 'rgba(244, 63, 94, 0.14)',
    orb2: 'rgba(245, 158, 11, 0.10)',
    orb3: 'rgba(139, 92, 246, 0.09)',
    gridColor: 'rgba(244, 63, 94, 0.045)',
    particleColor: '251, 113, 133'
  },
  goldvip: {
    id: 'goldvip',
    name: 'Gold Sultan VIP',
    desc: 'Luxury black onyx with sovereign gold & champagne aura',
    badge: 'SULTAN VIP',
    bgBase: '#090704',
    orb1: 'rgba(250, 204, 21, 0.14)',
    orb2: 'rgba(245, 158, 11, 0.12)',
    orb3: 'rgba(168, 85, 247, 0.08)',
    gridColor: 'rgba(250, 204, 21, 0.045)',
    particleColor: '250, 204, 21'
  },
  sakura: {
    id: 'sakura',
    name: 'Tokyo Sakura Drift',
    desc: 'Japanese cyber-pink magenta & electric violet',
    badge: 'ANIME',
    bgBase: '#0a050b',
    orb1: 'rgba(236, 72, 153, 0.14)',
    orb2: 'rgba(192, 132, 252, 0.13)',
    orb3: 'rgba(56, 189, 248, 0.08)',
    gridColor: 'rgba(236, 72, 153, 0.045)',
    particleColor: '244, 114, 182'
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic Frost Glacier',
    desc: 'Crisp sub-zero ice blue & diamond white clarity',
    badge: 'COOL',
    bgBase: '#030810',
    orb1: 'rgba(56, 189, 248, 0.15)',
    orb2: 'rgba(125, 211, 252, 0.12)',
    orb3: 'rgba(99, 102, 241, 0.09)',
    gridColor: 'rgba(56, 189, 248, 0.05)',
    particleColor: '125, 211, 252'
  },
  sunset: {
    id: 'sunset',
    name: 'Synthwave Sunset 84',
    desc: 'Retro-futuristic neon orange, magenta & dusk purple',
    badge: 'RETRO',
    bgBase: '#0b050d',
    orb1: 'rgba(249, 115, 22, 0.14)',
    orb2: 'rgba(217, 70, 239, 0.13)',
    orb3: 'rgba(244, 63, 94, 0.09)',
    gridColor: 'rgba(249, 115, 22, 0.045)',
    particleColor: '251, 146, 60'
  },
  galaxy: {
    id: 'galaxy',
    name: 'Deep Space Nebula',
    desc: 'Cosmic ultraviolet & stardust indigo space horizon',
    badge: 'COSMIC',
    bgBase: '#05030d',
    orb1: 'rgba(139, 92, 246, 0.16)',
    orb2: 'rgba(59, 130, 246, 0.13)',
    orb3: 'rgba(236, 72, 153, 0.09)',
    gridColor: 'rgba(139, 92, 246, 0.045)',
    particleColor: '167, 139, 250'
  },
  emeraldroyal: {
    id: 'emeraldroyal',
    name: 'Royal Jade & Gold',
    desc: 'Imperial emerald forest with warm golden highlights',
    badge: 'ROYAL',
    bgBase: '#030907',
    orb1: 'rgba(16, 185, 129, 0.15)',
    orb2: 'rgba(234, 179, 8, 0.11)',
    orb3: 'rgba(20, 184, 166, 0.09)',
    gridColor: 'rgba(16, 185, 129, 0.045)',
    particleColor: '110, 231, 183'
  }
};

export interface AnimationModeOption {
  id: AnimationMode;
  label: string;
  desc: string;
  badge?: string;
}

export const ANIMATION_MODES: AnimationModeOption[] = [
  {
    id: 'constellation',
    label: 'Cyber Constellation',
    desc: 'Jaringan titik saraf siber yang saling terhubung',
    badge: 'DEFAULT'
  },
  {
    id: 'matrix',
    label: 'Data Matrix Stream',
    desc: 'Aliran sinar data vertikal ala server masa depan',
    badge: 'CYBER'
  },
  {
    id: 'orbs',
    label: 'Quantum Glow Orbs',
    desc: 'Bola energi lembut yang melayang tenang',
    badge: 'SMOOTH'
  },
  {
    id: 'starfield',
    label: 'Warp Starfield 3D',
    desc: 'Lintasan bintang luar angkasa berkecepatan warp',
    badge: 'BARU'
  },
  {
    id: 'hexpulse',
    label: 'Hexagon Cyber Pulse',
    desc: 'Cincin heksagonal neon yang memancar halus',
    badge: 'BARU'
  },
  {
    id: 'fireflies',
    label: 'Golden Fireflies',
    desc: 'Partikel kunang-kunang bercahaya berkedip dinamis',
    badge: 'BARU'
  },
  {
    id: 'meteor',
    label: 'Meteor Shower',
    desc: 'Hujan meteor diagonal dengan ekor cahaya neon',
    badge: 'BARU'
  },
  {
    id: 'cyberwave',
    label: 'Aurora Sine Wave',
    desc: 'Gelombang frekuensi harmonik berlapis di latar',
    badge: 'BARU'
  },
  {
    id: 'snow',
    label: 'Crystal Snowflakes',
    desc: 'Butiran salju kristal lembut yang turun perlahan',
    badge: 'WINTER'
  },
  {
    id: 'off',
    label: 'Nonaktif (Statis)',
    desc: 'Tanpa partikel bergerak (hemat baterai maksimal)',
    badge: 'HEMAT'
  }
];

export interface FxConfig {
  music: string;
  musicPlaying: boolean;
  bgUrl: string;
  preset: PresetId;
  animationMode: AnimationMode;
  vol: number;
  colorMode?: 'dark' | 'light';
}

export const DEFAULT_FX: FxConfig = {
  music: '',
  musicPlaying: false,
  bgUrl: '',
  preset: 'cyber',
  animationMode: 'constellation',
  vol: 40,
  colorMode: 'dark'
};

export function applyGlobalColorModeVars(
  colorMode: 'dark' | 'light' = 'dark',
  preset: ThemePreset = THEME_PRESETS.cyber
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isLight = colorMode === 'light';

  root.setAttribute('data-color-mode', isLight ? 'light' : 'dark');
  root.style.colorScheme = isLight ? 'light' : 'dark';
  if (isLight) {
    root.classList.add('light-contrast');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light-contrast');
  }

  if (typeof document !== 'undefined' && document.body) {
    document.body.style.backgroundColor = isLight ? '#f5f8fc' : (preset.bgBase || '#060911');
    document.body.style.color = isLight ? '#0f172a' : '#f3f4f6';
  }

  // Synchronize Android browser status bar & navbar theme color
  try {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isLight ? '#f5f8fc' : (preset.bgBase || '#07090e'));
    }
    const metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaApple) {
      metaApple.setAttribute('content', isLight ? 'default' : 'black-translucent');
    }
  } catch {
    // ignore
  }

  const vars: Record<string, string> = isLight
    ? {
        '--bg-primary': '#f5f8fc',
        '--bg-secondary': '#eaf0f7',
        '--bg-panel': 'rgba(255, 255, 255, 0.78)',
        '--bg-panel-mobile': 'rgba(255, 255, 255, 0.92)',
        '--bg-card': 'rgba(255, 255, 255, 0.82)',
        '--bg-card-hover': '#f8fafc',
        '--bg-card-active': '#eff6ff',
        '--bg-input': '#ffffff',
        '--bg-input-focus': '#f0f9ff',
        '--text-primary': '#090d16',
        '--text-secondary': '#1e293b',
        '--text-muted': '#334155',
        '--border-subtle': 'rgba(15, 23, 42, 0.08)',
        '--border-card': 'rgba(15, 23, 42, 0.07)',
        '--border-hover': '#0284c7',
        '--accent-primary': '#0284c7',
        '--accent-secondary': '#6d28d9',
        '--shadow-glass-color': 'rgba(15, 23, 42, 0.08)',
        '--scrollbar-track': '#eaf0f7',
        '--scrollbar-thumb': '#64748b'
      }
    : {
        '--bg-primary': preset.bgBase || '#07090e',
        '--bg-secondary': '#0b1120',
        '--bg-panel': 'rgba(15, 23, 42, 0.88)',
        '--bg-panel-mobile': 'rgba(15, 23, 42, 0.96)',
        '--bg-card': 'rgba(23, 32, 54, 0.88)',
        '--bg-card-hover': 'rgba(28, 40, 68, 0.94)',
        '--bg-card-active': 'rgba(23, 32, 54, 0.92)',
        '--bg-input': 'rgba(15, 23, 42, 0.9)',
        '--bg-input-focus': 'rgba(24, 35, 58, 0.92)',
        '--text-primary': '#f3f4f6',
        '--text-secondary': '#cbd5e1',
        '--text-muted': '#94a3b8',
        '--border-subtle': 'rgba(255, 255, 255, 0.08)',
        '--border-card': 'rgba(255, 255, 255, 0.07)',
        '--border-hover': `rgba(${preset.particleColor}, 0.45)`,
        '--accent-primary': '#00F0FF',
        '--accent-secondary': '#7000FF',
        '--shadow-glass-color': 'rgba(0, 0, 0, 0.37)',
        '--scrollbar-track': '#0B0F17',
        '--scrollbar-thumb': '#1f293d'
      };

  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

export function loadFxConfig(): FxConfig {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY);
    if (!raw) return DEFAULT_FX;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_FX,
      ...parsed,
      preset: THEME_PRESETS[parsed.preset as PresetId] ? parsed.preset : 'cyber',
      animationMode: parsed.animationMode || (parsed.particles === false ? 'off' : 'constellation'),
      colorMode: parsed.colorMode === 'light' ? 'light' : 'dark'
    };
  } catch {
    return DEFAULT_FX;
  }
}

export function saveFxConfig(cfg: FxConfig) {
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
}

export function validUrl(u: string): boolean {
  try {
    return /^https?:$/.test(new URL(u).protocol);
  } catch {
    return false;
  }
}

export function extractYtId(u: string): string | null {
  const m = u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------
 * Pengaturan publik (tema, animasi, wallpaper, musik) disimpan di server
 * supaya SEMUA pengunjung melihat & mendengar hal yang sama.
 * Mode siang/malam (colorMode) tetap pilihan pribadi tiap pengunjung.
 * ------------------------------------------------------------------ */
export interface PublicFxSettings {
  preset: string;
  animationMode: string;
  bgUrl: string;
  music: string;
  musicPlaying: boolean;
  vol: number;
}

const ADMIN_TOKEN_STORAGE_KEY = 'cahyo_admin_token_v1';

export async function fetchPublicFx(): Promise<{ settings: PublicFxSettings | null; updatedAt: string | null } | null> {
  try {
    const res = await fetch('/api/site-settings', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return { settings: data?.settings || null, updatedAt: data?.updatedAt || null };
  } catch {
    return null;
  }
}

export function pickPublicFx(fx: FxConfig): PublicFxSettings {
  return {
    preset: fx.preset,
    animationMode: fx.animationMode,
    bgUrl: fx.bgUrl,
    music: fx.music,
    musicPlaying: fx.musicPlaying,
    vol: fx.vol
  };
}

/** Hanya berhasil bila pemanggil adalah Author yang sedang login (server menolak selain itu). */
export async function pushPublicFx(fx: FxConfig): Promise<boolean> {
  try {
    let token = '';
    try {
      token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
    } catch {
      // ignore
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }
    const res = await fetch('/api/admin/site-settings', {
      method: 'PUT',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(pickPublicFx(fx))
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Gabungkan pengaturan server ke konfigurasi lokal; colorMode lokal selalu dipertahankan. */
export function mergePublicFx(local: FxConfig, remote: PublicFxSettings): FxConfig {
  const preset = THEME_PRESETS[remote.preset as PresetId] ? (remote.preset as PresetId) : 'cyber';
  const mode = ANIMATION_MODES.some((m) => m.id === remote.animationMode)
    ? (remote.animationMode as AnimationMode)
    : 'constellation';
  return {
    ...local,
    preset,
    animationMode: mode,
    bgUrl: remote.bgUrl || '',
    music: remote.music || '',
    musicPlaying: Boolean(remote.musicPlaying && remote.music),
    vol: Number.isFinite(remote.vol) ? remote.vol : local.vol
  };
}

export function samePublicFx(a: FxConfig, b: FxConfig): boolean {
  const x = pickPublicFx(a);
  const y = pickPublicFx(b);
  return (
    x.preset === y.preset &&
    x.animationMode === y.animationMode &&
    x.bgUrl === y.bgUrl &&
    x.music === y.music &&
    x.musicPlaying === y.musicPlaying &&
    x.vol === y.vol
  );
}

/** Warna partikel untuk mode siang: digelapkan supaya tetap terlihat di latar terang. */
function darkenRgb(rgb: string, factor = 0.55): string {
  const parts = rgb.split(',').map((n) => Math.round(Number(n.trim()) * factor));
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? parts.join(', ') : '51, 65, 85';
}

interface FxThemeAndMusicProps {
  fx: FxConfig;
}

export const FxThemeAndMusic: React.FC<FxThemeAndMusicProps> = ({ fx }) => {
  const [activeBgImage, setActiveBgImage] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activePreset = THEME_PRESETS[fx.preset] || THEME_PRESETS.cyber;
  const isLightMode = fx.colorMode === 'light';
  const ytVideoIdRaw = fx.musicPlaying && validUrl(fx.music) ? extractYtId(fx.music) : null;

  useEffect(() => {
    applyGlobalColorModeVars(isLightMode ? 'light' : 'dark', activePreset);
  }, [isLightMode, activePreset]);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = (fx.vol ?? 40) / 100;
    audioRef.current = audio;
    return () => {
      audio.pause();
    };
  }, []);

  // Browser memblokir suara otomatis sebelum pengunjung menyentuh halaman. Jadi kita coba putar,
  // dan bila diblokir, musik dimulai pada sentuhan/klik/tombol pertama pengunjung.
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const ytVideoId = audioUnlocked ? ytVideoIdRaw : null;

  useEffect(() => {
    if (audioUnlocked) return;
    const unlock = () => setAudioUnlocked(true);
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'click'];
    events.forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, unlock));
    };
  }, [audioUnlocked]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, (fx.vol ?? 40) / 100));

    const u = fx.music.trim();
    const isYt = validUrl(u) && Boolean(extractYtId(u));

    if (!fx.musicPlaying || !validUrl(u) || isYt) {
      audio.pause();
      return;
    }

    if (audio.src !== u) {
      audio.src = u;
    }
    audio.play().catch(() => {
      // Diblokir autoplay: efek ini dijalankan ulang saat audioUnlocked berubah.
    });
  }, [fx.music, fx.musicPlaying, fx.vol, audioUnlocked]);

  useEffect(() => {
    let active = true;
    if (fx.bgUrl && validUrl(fx.bgUrl)) {
      canLoadImage(fx.bgUrl, 100, 9000).then((ok: boolean) => {
        if (active) setActiveBgImage(ok ? fx.bgUrl : '');
      });
    } else {
      setActiveBgImage('');
    }
    return () => {
      active = false;
    };
  }, [fx.bgUrl]);

  // Multi-Mode Canvas Animation Engine (9 Active Modes + Static Mode)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (fx.animationMode === 'off' || reduceMotion) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      return;
    }

    const isMobileDevice =
      window.innerWidth < 768 ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    let W = (cv.width = window.innerWidth);
    let H = (cv.height = window.innerHeight);
    let animId = 0;
    let running = true;
    let isScrolling = false;
    let scrollStopTimer = 0;
    let lastFrameTime = 0;
    let wavePhase = 0;
    const frameInterval = isMobileDevice ? 48 : 22;

    const onResize = () => {
      if (!cv) return;
      if (Math.abs(window.innerWidth - W) > 20 || Math.abs(window.innerHeight - H) > 160) {
        W = cv.width = window.innerWidth;
        H = cv.height = window.innerHeight;
      }
    };
    const onScroll = () => {
      isScrolling = true;
      window.clearTimeout(scrollStopTimer);
      scrollStopTimer = window.setTimeout(() => {
        isScrolling = false;
      }, 150);
    };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const rgb = isLightMode ? darkenRgb(activePreset.particleColor) : activePreset.particleColor;

    // 1. Constellation Nodes
    const nodeCount = isMobileDevice ? 12 : 30;
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1.2 + Math.random() * 1.6,
      alpha: 0.25 + Math.random() * 0.4,
      pulse: Math.random() * Math.PI * 2
    }));

    // 2. Matrix Streams
    const streamCount = isMobileDevice ? 10 : 24;
    const streams = Array.from({ length: streamCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      len: 40 + Math.random() * 80,
      speed: 0.9 + Math.random() * 1.5,
      alpha: 0.08 + Math.random() * 0.22
    }));

    // 3. Quantum Orbs
    const orbCount = isMobileDevice ? 8 : 16;
    const orbs = Array.from({ length: orbCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 8 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.15 - Math.random() * 0.25,
      alpha: 0.04 + Math.random() * 0.09
    }));

    // 4. Warp Starfield 3D
    const starCount = isMobileDevice ? 22 : 55;
    const stars = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * W,
      y: (Math.random() - 0.5) * H,
      z: Math.random() * W
    }));

    // 5. Hexagon Cyber Pulse
    const hexCount = isMobileDevice ? 7 : 15;
    const hexes = Array.from({ length: hexCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 12 + Math.random() * 28,
      maxR: 42 + Math.random() * 40,
      speed: 0.18 + Math.random() * 0.28,
      alpha: 0.18 + Math.random() * 0.2
    }));

    // 6. Fireflies
    const fireflyCount = isMobileDevice ? 14 : 32;
    const fireflies = Array.from({ length: fireflyCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      angle: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.45,
      r: 1.5 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2
    }));

    // 7. Meteor Shower
    const meteorCount = isMobileDevice ? 5 : 11;
    const meteors = Array.from({ length: meteorCount }, () => ({
      x: Math.random() * W * 1.3,
      y: Math.random() * H * 0.8 - H * 0.3,
      len: 55 + Math.random() * 75,
      speed: 2.6 + Math.random() * 2.4,
      alpha: 0.18 + Math.random() * 0.32
    }));

    // 8. Snowflakes
    const snowCount = isMobileDevice ? 18 : 42;
    const snowflakes = Array.from({ length: snowCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 2.4,
      vy: 0.35 + Math.random() * 0.65,
      sway: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.35
    }));

    const drawHexagon = (cx: number, cy: number, radius: number) => {
      ctx.beginPath();
      for (let side = 0; side < 6; side++) {
        const angle = (Math.PI / 3) * side - Math.PI / 6;
        const hx = cx + radius * Math.cos(angle);
        const hy = cy + radius * Math.sin(angle);
        if (side === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    };

    const tick = (now = 0) => {
      if (!running) return;
      animId = requestAnimationFrame(tick);

      if (isScrolling || now - lastFrameTime < frameInterval) {
        return;
      }
      lastFrameTime = now;

      ctx.clearRect(0, 0, W, H);

      if (fx.animationMode === 'constellation') {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          n.x += n.vx;
          n.y += n.vy;
          n.pulse += 0.015;
          if (n.x < 0) n.x = W;
          if (n.x > W) n.x = 0;
          if (n.y < 0) n.y = H;
          if (n.y > H) n.y = 0;

          const currentAlpha = n.alpha * (0.65 + 0.35 * Math.sin(n.pulse));
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${currentAlpha.toFixed(2)})`;
          ctx.fill();

          for (let j = i + 1; j < nodes.length; j++) {
            const m = nodes[j];
            const dx = n.x - m.x;
            const dy = n.y - m.y;
            const distSq = dx * dx + dy * dy;
            const maxDistSq = 125 * 125;
            if (distSq < maxDistSq) {
              const lineAlpha = (1 - distSq / maxDistSq) * 0.11;
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(m.x, m.y);
              ctx.strokeStyle = `rgba(${rgb}, ${lineAlpha.toFixed(3)})`;
              ctx.lineWidth = 0.75;
              ctx.stroke();
            }
          }
        }
      } else if (fx.animationMode === 'matrix') {
        for (let i = 0; i < streams.length; i++) {
          const s = streams[i];
          s.y += s.speed;
          if (s.y - s.len > H) {
            s.y = -20;
            s.x = Math.random() * W;
          }
          const grad = ctx.createLinearGradient(s.x, s.y - s.len, s.x, s.y);
          grad.addColorStop(0, `rgba(${rgb}, 0)`);
          grad.addColorStop(1, `rgba(${rgb}, ${s.alpha.toFixed(2)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - s.len);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
      } else if (fx.animationMode === 'orbs') {
        for (let i = 0; i < orbs.length; i++) {
          const o = orbs[i];
          o.x += o.vx;
          o.y += o.vy;
          if (o.y + o.r < 0) o.y = H + o.r;
          if (o.x < -o.r) o.x = W + o.r;
          if (o.x > W + o.r) o.x = -o.r;

          const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
          grad.addColorStop(0, `rgba(${rgb}, ${o.alpha.toFixed(2)})`);
          grad.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.animationMode === 'starfield') {
        const cx = W / 2;
        const cy = H / 2;
        for (let i = 0; i < stars.length; i++) {
          const st = stars[i];
          st.z -= 3.2;
          if (st.z <= 1) {
            st.x = (Math.random() - 0.5) * W;
            st.y = (Math.random() - 0.5) * H;
            st.z = W;
          }
          const sx = cx + (st.x / st.z) * (W * 0.65);
          const sy = cy + (st.y / st.z) * (H * 0.65);
          const size = Math.max(0.6, (1 - st.z / W) * 2.6);
          const alpha = Math.max(0.08, (1 - st.z / W) * 0.55);
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(2)})`;
          ctx.fill();
        }
      } else if (fx.animationMode === 'hexpulse') {
        for (let i = 0; i < hexes.length; i++) {
          const h = hexes[i];
          h.r += h.speed;
          if (h.r >= h.maxR) {
            h.r = 8;
            h.x = Math.random() * W;
            h.y = Math.random() * H;
          }
          const progress = h.r / h.maxR;
          const curAlpha = (1 - progress) * h.alpha;
          drawHexagon(h.x, h.y, h.r);
          ctx.strokeStyle = `rgba(${rgb}, ${curAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      } else if (fx.animationMode === 'fireflies') {
        for (let i = 0; i < fireflies.length; i++) {
          const f = fireflies[i];
          f.angle += (Math.random() - 0.5) * 0.16;
          f.x += Math.cos(f.angle) * f.speed;
          f.y += Math.sin(f.angle) * f.speed;
          f.phase += 0.04;
          if (f.x < 0) f.x = W;
          if (f.x > W) f.x = 0;
          if (f.y < 0) f.y = H;
          if (f.y > H) f.y = 0;
          const glowAlpha = 0.12 + 0.35 * (0.5 + 0.5 * Math.sin(f.phase));
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${glowAlpha.toFixed(2)})`;
          ctx.fill();
        }
      } else if (fx.animationMode === 'meteor') {
        for (let i = 0; i < meteors.length; i++) {
          const m = meteors[i];
          m.x -= m.speed;
          m.y += m.speed * 0.65;
          if (m.x + m.len < 0 || m.y - m.len > H) {
            m.x = Math.random() * W * 1.2 + W * 0.2;
            m.y = -30 - Math.random() * 140;
          }
          const tailX = m.x + m.len;
          const tailY = m.y - m.len * 0.65;
          const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
          grad.addColorStop(0, `rgba(${rgb}, ${m.alpha.toFixed(2)})`);
          grad.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
        }
      } else if (fx.animationMode === 'cyberwave') {
        wavePhase += 0.022;
        for (let layer = 0; layer < 3; layer++) {
          ctx.beginPath();
          const baseY = H * (0.35 + layer * 0.22);
          const amp = 18 + layer * 10;
          const freq = 0.004 + layer * 0.0015;
          for (let x = 0; x <= W; x += 24) {
            const y = baseY + Math.sin(x * freq + wavePhase + layer) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${rgb}, ${(0.14 - layer * 0.03).toFixed(2)})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      } else if (fx.animationMode === 'snow') {
        for (let i = 0; i < snowflakes.length; i++) {
          const sn = snowflakes[i];
          sn.sway += 0.02;
          sn.x += Math.sin(sn.sway) * 0.3;
          sn.y += sn.vy;
          if (sn.y > H) {
            sn.y = -6;
            sn.x = Math.random() * W;
          }
          ctx.beginPath();
          ctx.arc(sn.x, sn.y, sn.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${sn.alpha.toFixed(2)})`;
          ctx.fill();
        }
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animId);
      } else if (!running) {
        running = true;
        tick();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.clearTimeout(scrollStopTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fx.animationMode, activePreset.particleColor, isLightMode]);

  return (
    <>
      <div
        id="fx-bg"
        className="fixed inset-0 -z-20 pointer-events-none overflow-hidden transition-colors duration-500"
        style={{
          backgroundColor: isLightMode ? '#f5f8fc' : activePreset.bgBase,
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
        aria-hidden="true"
      >
        {/* Dasar gradien lembut: menyatu tanpa garis/kotak (grid sengaja dihapus). */}
        <div
          className="absolute inset-0"
          style={{
            background: isLightMode
              ? 'linear-gradient(180deg, #f8fafd 0%, #f3f6fb 55%, #eef2f9 100%)'
              : 'transparent'
          }}
        />

        <div
          className="absolute -top-32 left-1/4 w-[40rem] h-[40rem] rounded-full"
          style={{
            background: `radial-gradient(circle, ${activePreset.orb1} 0%, transparent 68%)`,
            opacity: isLightMode ? 0.7 : 1
          }}
        />
        <div
          className="absolute top-1/3 -right-24 w-[36rem] h-[36rem] rounded-full"
          style={{
            background: `radial-gradient(circle, ${activePreset.orb2} 0%, transparent 68%)`,
            opacity: isLightMode ? 0.7 : 1
          }}
        />
        <div
          className="absolute -bottom-32 left-10 w-[34rem] h-[34rem] rounded-full"
          style={{
            background: `radial-gradient(circle, ${activePreset.orb3} 0%, transparent 68%)`,
            opacity: isLightMode ? 0.7 : 1
          }}
        />

        <div
          id="fx-img"
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: activeBgImage ? `url("${activeBgImage}")` : 'none',
            opacity: activeBgImage ? (isLightMode ? 0.14 : 0.35) : 0
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background: isLightMode
              ? 'radial-gradient(circle at 50% 30%, transparent 0%, rgba(241, 245, 251, 0.5) 100%)'
              : 'radial-gradient(circle at 50% 30%, transparent 0%, rgba(6, 9, 17, 0.75) 100%)'
          }}
        />

        <canvas ref={canvasRef} id="fx-particles" className="absolute inset-0 w-full h-full" />
      </div>

      {ytVideoId && (
        <div className="fixed -bottom-96 -left-96 w-1 h-1 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <iframe
            width="10"
            height="10"
            src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&loop=1&playsinline=1&playlist=${ytVideoId}`}
            allow="autoplay; encrypted-media"
            title="Background Audio"
          />
        </div>
      )}
    </>
  );
};
