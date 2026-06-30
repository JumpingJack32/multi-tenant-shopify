interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitStore {
  requests: number;
  windowStart: number;
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitStore>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private options: RateLimitOptions) {
    this.cleanupInterval = setInterval(() => this.cleanup(), options.windowMs * 2);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now - value.windowStart > this.options.windowMs * 2) {
        this.store.delete(key);
      }
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now - existing.windowStart > this.options.windowMs) {
      this.store.set(key, {
        requests: 1,
        windowStart: now,
      });
      return {
        success: true,
        remaining: this.options.maxRequests - 1,
        resetAt: now + this.options.windowMs,
      };
    }

    if (existing.requests >= this.options.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetAt: existing.windowStart + this.options.windowMs,
      };
    }

    existing.requests++;
    return {
      success: true,
      remaining: this.options.maxRequests - existing.requests,
      resetAt: existing.windowStart + this.options.windowMs,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

export function createRateLimiter(options: RateLimitOptions): InMemoryRateLimiter {
  return new InMemoryRateLimiter(options);
}

export type { RateLimitResult };
