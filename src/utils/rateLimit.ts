/** Pembatas laju di memori (cadangan bila database tidak tersedia). Murni, mudah diuji. */
export function createMemoryLimiter() {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size > 6000) buckets.clear();
    }
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= max) return false;
    current.count += 1;
    return true;
  };
}
