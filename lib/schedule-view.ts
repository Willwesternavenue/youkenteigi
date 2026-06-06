import {
  computeSchedule,
  rollupByPhase,
  gridLines,
  type ComputedTask,
  type PhaseRollup,
  type GridLine,
} from "./schedule-calc";
import { buildNonWorking, namedInRange, type NonWorkingPeriod } from "./holidays";

/** Minimal stored-task shape needed to rebuild the view (matches ScheduleTaskRow). */
export interface StoredTask {
  taskKey?: string | null;
  taskName: string;
  phase?: string | null;
  durationDays?: number | null;
  assigneeRole?: string | null;
  dependencyTaskKeys?: string[] | null;
  progress?: number | null;
  needsClientReview?: boolean | null;
  risk?: string | null;
}

export interface ScheduleView {
  projectStart: string;
  projectEnd: string;
  totalBusinessDays: number;
  tasks: (ComputedTask & { progress: number })[];
  phases: PhaseRollup[];
  gridLines: GridLine[];
  /** named non-working days (jp holidays + custom periods) within the span */
  holidays: { date: string; name: string }[];
}

export interface ScheduleViewOpts {
  granularity?: "week" | "month";
  periods?: NonWorkingPeriod[];
}

/**
 * Recompute the gantt geometry (offsets, dates, critical path) and the
 * client-facing phase rollup. Working days exclude weekends + Japanese public
 * holidays + custom non-working periods. Shared by page / export / client.
 */
export function buildScheduleView(
  tasks: StoredTask[],
  startDate: string,
  opts: ScheduleViewOpts = {},
): ScheduleView {
  const nw = buildNonWorking(startDate, 2, opts.periods ?? []);
  const progressByKey = new Map(
    tasks.map((t) => [t.taskKey ?? t.taskName, t.progress ?? 0]),
  );
  const computed = computeSchedule(
    tasks.map((t) => ({
      taskKey: t.taskKey ?? t.taskName,
      taskName: t.taskName,
      phase: t.phase ?? "未分類",
      durationDays: t.durationDays ?? 1,
      assigneeRole: t.assigneeRole,
      dependencies: t.dependencyTaskKeys ?? [],
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    startDate,
    nw.set,
  );
  return {
    projectStart: computed.projectStart,
    projectEnd: computed.projectEnd,
    totalBusinessDays: computed.totalBusinessDays,
    tasks: computed.tasks.map((t) => ({
      ...t,
      progress: progressByKey.get(t.taskKey) ?? 0,
    })),
    phases: rollupByPhase(computed),
    gridLines: gridLines(computed.projectStart, computed.projectEnd, {
      granularity: opts.granularity ?? "week",
      holidays: nw.map,
    }),
    holidays: namedInRange(nw, computed.projectStart, computed.projectEnd),
  };
}
