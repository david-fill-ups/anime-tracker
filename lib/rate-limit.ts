const timestamps = new Map<string, number>();

export function checkRateLimit(
  key: string,
  cooldownMs: number
): { limited: boolean; secsLeft: number } {
  const last = timestamps.get(key);
  if (last != null) {
    const elapsed = Date.now() - last;
    if (elapsed < cooldownMs) {
      return { limited: true, secsLeft: Math.ceil((cooldownMs - elapsed) / 1000) };
    }
  }
  return { limited: false, secsLeft: 0 };
}

export function recordRateLimit(key: string): void {
  timestamps.set(key, Date.now());
}
