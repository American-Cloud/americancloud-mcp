/**
 * A per-user request limit, in memory: a sliding window of one minute. It is
 * a first brake only. The API applies its own limit to each caller.
 */
export const REQUESTS_PER_MINUTE = 120;
const WINDOW_MS = 60_000;
/** Above this number of users, a check removes the users with no recent request. */
const SWEEP_THRESHOLD = 10_000;

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number = REQUESTS_PER_MINUTE,
    private readonly now: () => number = Date.now,
  ) {}

  /** Count one request for the key, or refuse it when the window is full. */
  check(key: string): LimitResult {
    const t = this.now();
    if (this.hits.size > SWEEP_THRESHOLD) this.sweep(t);
    const start = t - WINDOW_MS;
    const times = (this.hits.get(key) ?? []).filter((x) => x > start);
    if (times.length >= this.limit) {
      this.hits.set(key, times);
      const oldest = times[0]!;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + WINDOW_MS - t) / 1000)) };
    }
    times.push(t);
    this.hits.set(key, times);
    return { allowed: true };
  }

  private sweep(t: number): void {
    const start = t - WINDOW_MS;
    for (const [key, times] of this.hits) {
      if ((times[times.length - 1] ?? 0) <= start) this.hits.delete(key);
    }
  }
}
