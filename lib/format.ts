/** Display helpers (yen, dates) — pure, safe on client and server. */

export function formatYen(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億円`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString()}万円`;
  return `${value.toLocaleString()}円`;
}

export function formatBudgetRange(
  min?: number | null,
  max?: number | null,
): string {
  if (!min && !max) return "—";
  if (min && max) return `${formatYen(min)} 〜 ${formatYen(max)}`;
  return formatYen(min ?? max);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Append the honorific さん once, stripping any existing trailing honorific
 * first so legacy names like "pm さん" don't become "pm さん さん".
 */
export function withHonorific(name?: string | null): string {
  const base = (name ?? "").replace(/[ 　]*(さん|さま|様|くん|君|ちゃん)$/u, "").trim();
  return base ? `${base} さん` : "";
}
