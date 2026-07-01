import { describe, it, expect } from "vitest";
import { createRateLimiter } from "../rate-limit";

describe("createRateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    const result = limiter.check("test-key");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60000 });
    limiter.check("exceed-key");
    limiter.check("exceed-key");
    const result = limiter.check("exceed-key");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
