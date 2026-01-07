export type BackoffConfig = {
  baseMs: number;
  factor: number;
  maxMs: number;
  jitterRatio?: number;
};

export type RetryOptions = {
  maxAttempts: number;
};

export function createBackoff(config: BackoffConfig) {
  const jitterRatio = config.jitterRatio ?? 0.2;
  let attempt = 0;

  function withJitter(value: number) {
    const jitter = value * jitterRatio;
    const delta = (Math.random() * 2 - 1) * jitter;
    return Math.max(0, value + delta);
  }

  return {
    nextDelay() {
      const raw = config.baseMs * config.factor ** attempt;
      attempt += 1;
      const capped = Math.min(raw, config.maxMs);
      return withJitter(capped);
    },
    reset() {
      attempt = 0;
    },
    async retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
      let lastError: unknown;
      for (let i = 0; i < options.maxAttempts; i += 1) {
        try {
          const result = await fn();
          this.reset();
          return result;
        } catch (error) {
          lastError = error;
          const delay = this.nextDelay();
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      this.reset();
      throw lastError ?? new Error("Retry attempts exhausted");
    },
  };
}
