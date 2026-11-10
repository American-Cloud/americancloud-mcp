/**
 * A map with an expiry time for each entry and a maximum size. The hosted
 * server keeps one grant for each token A here, keyed by the sha256 of the
 * token, never by the token.
 *
 * When the map is full, an insert first removes the expired entries. If the
 * map is still full, the insert removes the oldest entry.
 */
export class ExpiringCache<V extends { expiresAt: number }> {
  private readonly entries = new Map<string, V>();

  constructor(
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (!value) return undefined;
    if (value.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return value;
  }

  /** Store the value. A value that is already expired is not stored. */
  set(key: string, value: V): void {
    if (value.expiresAt <= this.now()) return;
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.sweep();
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, value);
  }

  /** Remove the entry, if there is one. */
  evict(key: string): void {
    this.entries.delete(key);
  }

  /** Remove every expired entry. */
  sweep(): void {
    const t = this.now();
    for (const [key, value] of this.entries) {
      if (value.expiresAt <= t) this.entries.delete(key);
    }
  }
}
