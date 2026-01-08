import { describe, expect, it, vi } from "vitest";
import { createBackoff } from "./backoff";

describe("createBackoff", () => {
  it("increases delays with jitter up to a ceiling", () => {
    const backoff = createBackoff({ baseMs: 100, factor: 2, maxMs: 1600, jitterRatio: 0.2 });
    const delays: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      delays.push(backoff.nextDelay());
    }
    // Each delay should grow and stay under max with jitter applied
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1] * 0.8);
    }
    expect(Math.max(...delays)).toBeLessThanOrEqual(1920);
  });

  it("resets after success", () => {
    const backoff = createBackoff({ baseMs: 50, factor: 2, maxMs: 400, jitterRatio: 0.1 });
    backoff.nextDelay();
    backoff.nextDelay();
    backoff.reset();
    const resetDelay = backoff.nextDelay();
    expect(resetDelay).toBeLessThanOrEqual(55);
  });

  it("supports async retry helper", async () => {
    const backoff = createBackoff({ baseMs: 10, factor: 2, maxMs: 50, jitterRatio: 0 });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await backoff.retry(fn, { maxAttempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
