import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request AI token accounting. The provider calls addUsage() for every
 * model call; runAi() establishes the scope via withUsageCapture() and reads the
 * summed tokens after generation. AsyncLocalStorage keeps this correct under
 * concurrent serverless requests (no shared mutable module state).
 */
export interface UsageSink {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

const store = new AsyncLocalStorage<UsageSink>();

export function addUsage(inputTokens: number, outputTokens: number): void {
  const s = store.getStore();
  if (s) {
    s.inputTokens += inputTokens || 0;
    s.outputTokens += outputTokens || 0;
    s.calls += 1;
  }
}

export async function withUsageCapture<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; usage: UsageSink }> {
  const sink: UsageSink = { inputTokens: 0, outputTokens: 0, calls: 0 };
  const result = await store.run(sink, fn);
  return { result, usage: sink };
}
