/**
 * Schedule math (spec §12). Computes calendar dates from durations + task
 * dependencies (business days, skipping weekends), the critical path, and a
 * client-facing phase rollup. Pure functions — safe on client and server.
 */

export interface SchedTaskInput {
  taskKey: string;
  taskName: string;
  phase: string;
  durationDays: number; // business days
  assigneeRole?: string | null;
  dependencies: string[]; // predecessor taskKeys
  needsClientReview?: boolean | null;
  risk?: string | null;
}

export interface ComputedTask extends SchedTaskInput {
  startOffset: number; // business-day offset from project start (inclusive)
  finishOffset: number; // exclusive
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd (inclusive)
  isCriticalPath: boolean;
}

export interface ScheduleComputed {
  projectStart: string;
  projectEnd: string;
  totalBusinessDays: number;
  tasks: ComputedTask[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Holidays = Set<string> | undefined;

function isWorking(d: Date, holidays: Holidays): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !holidays?.has(iso(d));
}

function snapToWorkingDay(d: Date, holidays: Holidays): Date {
  const r = new Date(d);
  while (!isWorking(r, holidays)) r.setUTCDate(r.getUTCDate() + 1);
  return r;
}

/** Add `n` working days to a (working-day) start. offset 0 → start itself. */
function addWorkingDays(start: Date, n: number, holidays: Holidays): Date {
  const r = new Date(start);
  let added = 0;
  while (added < n) {
    r.setUTCDate(r.getUTCDate() + 1);
    if (isWorking(r, holidays)) added++;
  }
  return r;
}

function topoSort(tasks: SchedTaskInput[]): SchedTaskInput[] {
  const byKey = new Map(tasks.map((t) => [t.taskKey, t]));
  const visited = new Set<string>();
  const out: SchedTaskInput[] = [];
  const visit = (t: SchedTaskInput, stack: Set<string>) => {
    if (visited.has(t.taskKey)) return;
    if (stack.has(t.taskKey)) return; // break cycles defensively
    stack.add(t.taskKey);
    for (const dep of t.dependencies) {
      const d = byKey.get(dep);
      if (d) visit(d, stack);
    }
    stack.delete(t.taskKey);
    visited.add(t.taskKey);
    out.push(t);
  };
  for (const t of tasks) visit(t, new Set());
  return out;
}

export function computeSchedule(
  tasks: SchedTaskInput[],
  startDateIso: string,
  holidays?: Set<string>,
): ScheduleComputed {
  const start = snapToWorkingDay(new Date(`${startDateIso}T00:00:00Z`), holidays);
  const ordered = topoSort(tasks);
  const offsets = new Map<string, { s: number; f: number }>();

  for (const t of ordered) {
    const depFinish = t.dependencies
      .map((d) => offsets.get(d)?.f ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const s = depFinish;
    const f = s + Math.max(1, t.durationDays);
    offsets.set(t.taskKey, { s, f });
  }

  const projectFinish = Math.max(
    1,
    ...Array.from(offsets.values()).map((o) => o.f),
  );

  // critical path: walk back from end tasks
  const critical = new Set<string>();
  for (const [key, o] of offsets) if (o.f === projectFinish) critical.add(key);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const t = ordered[i];
    if (!critical.has(t.taskKey)) continue;
    const ts = offsets.get(t.taskKey)!.s;
    for (const dep of t.dependencies) {
      if (offsets.get(dep)?.f === ts) critical.add(dep);
    }
  }

  const computed: ComputedTask[] = tasks.map((t) => {
    const o = offsets.get(t.taskKey)!;
    return {
      ...t,
      startOffset: o.s,
      finishOffset: o.f,
      startDate: iso(addWorkingDays(start, o.s, holidays)),
      endDate: iso(addWorkingDays(start, o.f - 1, holidays)),
      isCriticalPath: critical.has(t.taskKey),
    };
  });

  return {
    projectStart: iso(start),
    projectEnd: iso(addWorkingDays(start, projectFinish - 1, holidays)),
    totalBusinessDays: projectFinish,
    tasks: computed,
  };
}

export interface GridLine {
  offset: number; // working-day offset position on the gantt axis
  kind: "week" | "month" | "holiday";
  label?: string; // month label (e.g. "7月") or holiday name
}

/**
 * Vertical gridlines for the gantt, positioned on the working-day axis so they
 * align with the bars. `granularity` picks week-level (thin weekly + holiday
 * marks) or month-level (months only). Holidays (jp public + custom) are both
 * excluded from the axis and marked in week mode.
 */
export function gridLines(
  startIso: string,
  endIso: string,
  opts: { granularity?: "week" | "month"; holidays?: Map<string, string> } = {},
): GridLine[] {
  const granularity = opts.granularity ?? "week";
  const holidays = opts.holidays ?? new Map<string, string>();
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const lines: GridLine[] = [];
  let work = 0;
  let weekNo = 0;
  const d = new Date(start);
  let guard = 0;
  while (d.getTime() <= end.getTime() && guard < 3000) {
    const dow = d.getUTCDay();
    const dIso = iso(d);
    const isHol = holidays.has(dIso);
    const isWeekendDay = dow === 0 || dow === 6;
    const isStart = d.getTime() === start.getTime();

    if (d.getUTCDate() === 1) {
      lines.push({ offset: work, kind: "month", label: `${d.getUTCMonth() + 1}月` });
    }
    // numbered week boundary: project start + every Monday
    if (granularity === "week" && (isStart || dow === 1)) {
      weekNo++;
      lines.push({ offset: work, kind: "week", label: `W${weekNo}` });
    }
    if (granularity === "week" && isHol && !isWeekendDay) {
      lines.push({ offset: work, kind: "holiday", label: holidays.get(dIso) });
    }

    if (!isWeekendDay && !isHol) work++;
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return lines;
}

export interface PhaseRollup {
  phase: string;
  startDate: string;
  endDate: string;
  businessDays: number;
  weeks: number;
}

/** Client-facing phase-level summary derived from the detailed tasks. */
export function rollupByPhase(sc: ScheduleComputed): PhaseRollup[] {
  const map = new Map<
    string,
    { s: number; f: number; startDate: string; endDate: string }
  >();
  const order: string[] = [];
  for (const t of sc.tasks) {
    if (!map.has(t.phase)) {
      map.set(t.phase, {
        s: t.startOffset,
        f: t.finishOffset,
        startDate: t.startDate,
        endDate: t.endDate,
      });
      order.push(t.phase);
    } else {
      const cur = map.get(t.phase)!;
      if (t.startOffset < cur.s) {
        cur.s = t.startOffset;
        cur.startDate = t.startDate;
      }
      if (t.finishOffset > cur.f) {
        cur.f = t.finishOffset;
        cur.endDate = t.endDate;
      }
    }
  }
  return order.map((phase) => {
    const o = map.get(phase)!;
    const bd = o.f - o.s;
    return {
      phase,
      startDate: o.startDate,
      endDate: o.endDate,
      businessDays: bd,
      weeks: Math.max(1, Math.round(bd / 5)),
    };
  });
}
