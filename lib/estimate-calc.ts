/** Estimate math (spec §11). Activity-hours model. Pure functions. */

export const HOURS_PER_DAY = 8;

export const ACTIVITIES = [
  { key: "hoursDesign", label: "設計" },
  { key: "hoursImpl", label: "実装" },
  { key: "hoursTest", label: "テスト" },
  { key: "hoursCoord", label: "調整" },
  { key: "hoursMgmt", label: "管理" },
] as const;

export type ActivityKey = (typeof ACTIVITIES)[number]["key"];

export interface EstimateItemCalc {
  category?: string | null;
  subCategory?: string | null;
  taskName: string;
  role?: string | null;
  hoursDesign: number;
  hoursImpl: number;
  hoursTest: number;
  hoursCoord: number;
  hoursMgmt: number;
  unitPrice: number;
}

export interface EstimateTotals {
  totalHours: number;
  totalPersonDays: number;
  subtotal: number;
  buffer: number;
  preTax: number;
  tax: number;
  total: number;
}

export function itemHours(i: EstimateItemCalc): number {
  return (
    (i.hoursDesign || 0) +
    (i.hoursImpl || 0) +
    (i.hoursTest || 0) +
    (i.hoursCoord || 0) +
    (i.hoursMgmt || 0)
  );
}

export function hoursToDays(hours: number): number {
  return Math.round((hours / HOURS_PER_DAY) * 100) / 100;
}

export function itemAmount(i: EstimateItemCalc): number {
  return Math.round((itemHours(i) / HOURS_PER_DAY) * i.unitPrice);
}

export function computeTotals(
  items: EstimateItemCalc[],
  bufferRate: number,
  taxRate: number,
): EstimateTotals {
  const totalHours = items.reduce((a, i) => a + itemHours(i), 0);
  const subtotal = items.reduce((a, i) => a + itemAmount(i), 0);
  const buffer = Math.round(subtotal * bufferRate);
  const preTax = subtotal + buffer;
  const tax = Math.round(preTax * taxRate);
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalPersonDays: hoursToDays(totalHours),
    subtotal,
    buffer,
    preTax,
    tax,
    total: preTax + tax,
  };
}

export interface CategoryAggregate {
  key: string;
  hours: number;
  personDays: number;
  amount: number;
  count: number;
}

export function aggregateByCategory(
  items: EstimateItemCalc[],
): CategoryAggregate[] {
  const map = new Map<string, CategoryAggregate>();
  const order: string[] = [];
  for (const i of items) {
    const key = (i.category || "その他") as string;
    if (!map.has(key)) {
      map.set(key, { key, hours: 0, personDays: 0, amount: 0, count: 0 });
      order.push(key);
    }
    const cur = map.get(key)!;
    cur.hours += itemHours(i);
    cur.amount += itemAmount(i);
    cur.count += 1;
  }
  return order.map((k) => {
    const a = map.get(k)!;
    return { ...a, hours: Math.round(a.hours * 10) / 10, personDays: hoursToDays(a.hours) };
  });
}

export function aggregateByActivity(
  items: EstimateItemCalc[],
): { key: string; label: string; hours: number; personDays: number }[] {
  return ACTIVITIES.map((act) => {
    const hours = items.reduce((a, i) => a + (i[act.key] || 0), 0);
    return {
      key: act.key,
      label: act.label,
      hours: Math.round(hours * 10) / 10,
      personDays: hoursToDays(hours),
    };
  });
}

/** Reference plan tiers (spec §11.6). */
export const PLAN_TIERS = [
  { name: "Light", desc: "要件定義 + 小規模PoC", min: 3_000_000, max: 7_000_000 },
  { name: "Standard", desc: "MVP開発", min: 7_000_000, max: 15_000_000 },
  { name: "Professional", desc: "本番運用前提開発", min: 15_000_000, max: 30_000_000 },
  { name: "Enterprise", desc: "閉域・高セキュリティ・大規模連携", min: 30_000_000, max: null },
] as const;

export function planForTotal(total: number): string {
  for (const p of PLAN_TIERS) {
    if (p.max === null) return p.name;
    if (total <= p.max) return p.name;
  }
  return "Enterprise";
}

/**
 * Parse a target amount (in yen) and its intent from a natural-language
 * instruction like「900万円にして」「700万円以内に収めて」「1,200万以上で」.
 * `amount` is yen; `mode` is how to apply it against the current grand total:
 *  - "set": match exactly        (にして / に / bare)
 *  - "max": only reduce to it     (以内 / 以下 / まで / 抑えて / 収めて)
 *  - "min": only raise to it      (以上 / 最低 / 超えて)
 * Returns null when no amount is present (e.g.「テストを厚めに」).
 */
export interface YenTarget {
  amount: number;
  mode: "set" | "max" | "min";
}

export function parseTargetYen(text: string): YenTarget | null {
  // Normalize full-width digits/comma/period (Japanese IME emits ９００ , ．)
  // to half-width so the numeric patterns below match.
  const t = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，､]/g, ",")
    .replace(/．/g, ".");
  let amount: number | null = null;
  const man = t.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*万/);
  if (man) {
    amount = Math.round(parseFloat(man[1].replace(/,/g, "")) * 10_000);
  } else {
    const yen = t.match(/([0-9][0-9,]{2,})\s*円/);
    if (yen) amount = parseInt(yen[1].replace(/,/g, ""), 10);
  }
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;

  let mode: YenTarget["mode"] = "set";
  if (/以内|以下|まで|未満|抑え|収め|圧縮|削減|減ら/.test(text)) mode = "max";
  else if (/以上|最低|超え|増やし|上げ/.test(text)) mode = "min";
  return { amount, mode };
}
