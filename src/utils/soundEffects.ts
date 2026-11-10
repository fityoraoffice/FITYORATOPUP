/**
 * Sound effects utility for CahyoStore
 * Uses the Web Audio API to generate zero-latency, high-quality audio cues
 * without relying on external MP3 assets that can fail to load.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Short crisp ding for clicks and selection actions
 */
export function playCheckoutClickDing(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Audio errors should never crash the app
  }
}

/**
 * Triumphant multi-tone chord for successful order submission
 */
export function playTransactionSuccessDing(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch {
    // Ignore audio error
  }
}

/**
 * High-pitched crisp confirmation chime for admin payment verification
 */
export function playPaymentVerifiedChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [880, 1174.66, 1760]; // A5, D6, A6

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch {
    // Ignore audio error
  }
}

/**
 * Pulsing double-beep notification alarm for new incoming admin orders
 */
export function playAdminIncomingOrderAlarm(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.2].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now + offset); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + offset + 0.1); // E6

      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  } catch {
    // Ignore audio error
  }
}
