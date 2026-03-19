import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit";

// The rate-limit module keeps a module-level Map, so we need to clear state
// between tests. We do this by recording a fake key and advancing time past
// any cooldown — but a simpler approach is to use unique keys per test.

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("is not limited on the first call (no record exists for the key)", () => {
    const result = checkRateLimit("first-call-unique-key", 5000);
    expect(result.limited).toBe(false);
    expect(result.secsLeft).toBe(0);
  });

  it("is not limited when the cooldown has fully elapsed", () => {
    vi.useFakeTimers();
    const key = "elapsed-key";
    const cooldownMs = 10_000;

    vi.setSystemTime(1_000_000);
    recordRateLimit(key);

    // Advance time beyond the cooldown
    vi.setSystemTime(1_000_000 + cooldownMs + 1);
    const result = checkRateLimit(key, cooldownMs);
    expect(result.limited).toBe(false);
    expect(result.secsLeft).toBe(0);
  });

  it("is limited within the cooldown window and reports secsLeft > 0", () => {
    vi.useFakeTimers();
    const key = "within-window-key";
    const cooldownMs = 30_000; // 30 seconds

    vi.setSystemTime(2_000_000);
    recordRateLimit(key);

    // Advance 10 seconds — still 20 seconds remaining
    vi.setSystemTime(2_000_000 + 10_000);
    const result = checkRateLimit(key, cooldownMs);
    expect(result.limited).toBe(true);
    expect(result.secsLeft).toBe(20);
  });

  it("returns secsLeft rounded up (ceiling) for sub-second remainders", () => {
    vi.useFakeTimers();
    const key = "ceil-key";
    const cooldownMs = 5_000; // 5 seconds

    vi.setSystemTime(3_000_000);
    recordRateLimit(key);

    // Advance 4001 ms — 999 ms remaining, which rounds up to 1 second
    vi.setSystemTime(3_000_000 + 4_001);
    const result = checkRateLimit(key, cooldownMs);
    expect(result.limited).toBe(true);
    expect(result.secsLeft).toBe(1);
  });

  it("different keys are independent — limiting one does not affect another", () => {
    vi.useFakeTimers();
    const keyA = "independent-key-A";
    const keyB = "independent-key-B";
    const cooldownMs = 60_000;

    vi.setSystemTime(4_000_000);
    recordRateLimit(keyA);

    // keyA is now limited
    const resultA = checkRateLimit(keyA, cooldownMs);
    expect(resultA.limited).toBe(true);

    // keyB has never been recorded — must not be affected
    const resultB = checkRateLimit(keyB, cooldownMs);
    expect(resultB.limited).toBe(false);
    expect(resultB.secsLeft).toBe(0);
  });
});

describe("recordRateLimit", () => {
  it("causes checkRateLimit to return limited=true immediately after recording", () => {
    vi.useFakeTimers();
    const key = "record-then-check-key";
    const cooldownMs = 60_000;

    vi.setSystemTime(5_000_000);

    // Before recording: not limited
    expect(checkRateLimit(key, cooldownMs).limited).toBe(false);

    recordRateLimit(key);

    // After recording: limited
    const result = checkRateLimit(key, cooldownMs);
    expect(result.limited).toBe(true);
    expect(result.secsLeft).toBe(60);
  });
});
