export interface RetryPolicyDecision {
  shouldRetry: boolean;
  nextAttemptAt?: string;
}

export interface RetryPolicy {
  schedule(attempts: number, now: string): RetryPolicyDecision;
}

export interface RetryPolicyOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  jitterRatio?: number;
  random?: () => number;
}

const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_JITTER_RATIO = 0.2;

export function createRetryPolicy(options: RetryPolicyOptions = {}): RetryPolicy {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const random = options.random ?? Math.random;

  return {
    schedule(attempts, now) {
      if (attempts >= maxAttempts) {
        return { shouldRetry: false };
      }

      const exponentialDelay = Math.min(baseDelayMs * 2 ** Math.max(attempts - 1, 0), maxDelayMs);
      const jitter = Math.round(exponentialDelay * jitterRatio * random());
      const nextAttempt = new Date(new Date(now).getTime() + exponentialDelay + jitter);

      return {
        shouldRetry: true,
        nextAttemptAt: nextAttempt.toISOString(),
      };
    },
  };
}
