import { afterEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, resetRateLimits } from "./rate-limit";

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows calls up to the limit and blocks beyond it", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("k1", opts)).toBe(true);
    expect(checkRateLimit("k1", opts)).toBe(true);
    expect(checkRateLimit("k1", opts)).toBe(true);
    expect(checkRateLimit("k1", opts)).toBe(false);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("a", opts)).toBe(true);
    expect(checkRateLimit("b", opts)).toBe(true);
    expect(checkRateLimit("a", opts)).toBe(false);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const opts = { limit: 1, windowMs: 1_000 };
    expect(checkRateLimit("k", opts)).toBe(true);
    expect(checkRateLimit("k", opts)).toBe(false);
    vi.advanceTimersByTime(1_100);
    expect(checkRateLimit("k", opts)).toBe(true);
  });
});
