/**
 * Japanese public holidays (国民の祝日) computed for any year — fixed dates,
 * Happy-Monday holidays, equinoxes, substitute holidays (振替休日), and the
 * sandwiched national holiday (国民の休日). Accurate for 2000–2099.
 * Plus custom non-working periods (お盆 / 年末年始 etc.). Pure — client + server.
 */

export interface NonWorkingPeriod {
  name: string;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd (inclusive)
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
function isoOf(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** day-of-month of the nth `weekday` (0=Sun) in month (1-based). */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function springEquinox(year: number): number {
  return Math.floor(
    20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
  );
}
function autumnEquinox(year: number): number {
  return Math.floor(
    23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
  );
}

export function japaneseHolidays(year: number): Record<string, string> {
  const base: { m: number; d: number; name: string }[] = [
    { m: 1, d: 1, name: "元日" },
    { m: 1, d: nthWeekday(year, 1, 1, 2), name: "成人の日" },
    { m: 2, d: 11, name: "建国記念の日" },
    { m: 2, d: 23, name: "天皇誕生日" },
    { m: 3, d: springEquinox(year), name: "春分の日" },
    { m: 4, d: 29, name: "昭和の日" },
    { m: 5, d: 3, name: "憲法記念日" },
    { m: 5, d: 4, name: "みどりの日" },
    { m: 5, d: 5, name: "こどもの日" },
    { m: 7, d: nthWeekday(year, 7, 1, 3), name: "海の日" },
    { m: 8, d: 11, name: "山の日" },
    { m: 9, d: nthWeekday(year, 9, 1, 3), name: "敬老の日" },
    { m: 9, d: autumnEquinox(year), name: "秋分の日" },
    { m: 10, d: nthWeekday(year, 10, 1, 2), name: "スポーツの日" },
    { m: 11, d: 3, name: "文化の日" },
    { m: 11, d: 23, name: "勤労感謝の日" },
  ];

  const result: Record<string, string> = {};
  for (const h of base) result[ymd(year, h.m, h.d)] = h.name;

  // 国民の休日: a non-holiday weekday sandwiched between two holidays
  for (const h of base) {
    const start = new Date(`${ymd(year, h.m, h.d)}T00:00:00Z`);
    const mid = new Date(start);
    mid.setUTCDate(mid.getUTCDate() + 1);
    const next = new Date(start);
    next.setUTCDate(next.getUTCDate() + 2);
    const midIso = isoOf(mid);
    if (
      result[isoOf(next)] &&
      !result[midIso] &&
      mid.getUTCDay() !== 0
    ) {
      result[midIso] = "国民の休日";
    }
  }

  // 振替休日: a holiday falling on Sunday moves to the next non-holiday day
  for (const dstr of Object.keys(result).sort()) {
    const d = new Date(`${dstr}T00:00:00Z`);
    if (d.getUTCDay() === 0) {
      const nx = new Date(d);
      do {
        nx.setUTCDate(nx.getUTCDate() + 1);
      } while (result[isoOf(nx)]);
      result[isoOf(nx)] = "振替休日";
    }
  }

  return result;
}

function expandPeriods(periods: NonWorkingPeriod[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of periods) {
    if (!p.start || !p.end) continue;
    const d = new Date(`${p.start}T00:00:00Z`);
    const end = new Date(`${p.end}T00:00:00Z`);
    let guard = 0;
    while (d.getTime() <= end.getTime() && guard < 400) {
      out[isoOf(d)] = p.name || "休業";
      d.setUTCDate(d.getUTCDate() + 1);
      guard++;
    }
  }
  return out;
}

export interface NonWorking {
  /** dates that are non-working because of a holiday or custom period */
  map: Map<string, string>;
  set: Set<string>;
}

/** Holidays for [startYear .. startYear+spanYears] merged with custom periods. */
export function buildNonWorking(
  startIso: string,
  spanYears: number,
  periods: NonWorkingPeriod[] = [],
): NonWorking {
  const startYear = Number(startIso.slice(0, 4)) || new Date().getUTCFullYear();
  const map = new Map<string, string>();
  for (let y = startYear; y <= startYear + spanYears; y++) {
    for (const [date, name] of Object.entries(japaneseHolidays(y))) {
      map.set(date, name);
    }
  }
  for (const [date, name] of Object.entries(expandPeriods(periods))) {
    map.set(date, name);
  }
  return { map, set: new Set(map.keys()) };
}

/** Named non-working days within [startIso, endIso] inclusive, sorted. */
export function namedInRange(
  nw: NonWorking,
  startIso: string,
  endIso: string,
): { date: string; name: string }[] {
  return Array.from(nw.map.entries())
    .filter(([d]) => d >= startIso && d <= endIso)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, name]) => ({ date, name }));
}
