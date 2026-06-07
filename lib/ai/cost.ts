/**
 * Rough Claude Sonnet cost estimate in JPY, for budgeting/visibility only
 * (not billing-accurate). Based on public Sonnet pricing (~$3 / MTok input,
 * ~$15 / MTok output) at an approximate JPY rate. Tune the constants if pricing
 * or the FX rate changes.
 */
const USD_PER_MTOK_INPUT = 3;
const USD_PER_MTOK_OUTPUT = 15;
const JPY_PER_USD = 155;

export function estimateCostYen(
  inputTokens: number,
  outputTokens: number,
): number {
  const usd =
    (inputTokens / 1_000_000) * USD_PER_MTOK_INPUT +
    (outputTokens / 1_000_000) * USD_PER_MTOK_OUTPUT;
  return Math.round(usd * JPY_PER_USD);
}
