"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db, type ScheduleInput } from "@/lib/db";
import { getProvider, type GeneratedSchedule } from "@/lib/ai/providers";
import { buildGenerationContext } from "@/lib/ai/context";
import { computeSchedule } from "@/lib/schedule-calc";
import { buildNonWorking, type NonWorkingPeriod } from "@/lib/holidays";

/** Turn an AI-generated schedule into persisted, date-resolved rows. */
function toScheduleInput(
  gen: GeneratedSchedule,
  userId: string,
  periods: NonWorkingPeriod[] = [],
): ScheduleInput {
  const holidays = buildNonWorking(gen.startDate, 2, periods).set;
  const computed = computeSchedule(
    gen.tasks.map((t) => ({
      taskKey: t.taskKey,
      taskName: t.taskName,
      phase: t.phase,
      // AI may emit a fractional duration; normalize to a whole working-day
      durationDays: Math.max(1, Math.round(t.durationDays)),
      assigneeRole: t.assigneeRole,
      dependencies: t.dependencies,
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    gen.startDate,
    holidays,
  );
  const endByKey = new Map(computed.tasks.map((t) => [t.taskKey, t.endDate]));

  return {
    scheduleName: gen.scheduleName,
    startDate: computed.projectStart,
    endDate: computed.projectEnd,
    nonWorkingPeriods: periods,
    tasks: computed.tasks.map((t) => ({
      taskKey: t.taskKey,
      taskName: t.taskName,
      phase: t.phase,
      startDate: t.startDate,
      endDate: t.endDate,
      durationDays: t.durationDays,
      assigneeRole: t.assigneeRole,
      dependencyTaskKeys: t.dependencies,
      isCriticalPath: t.isCriticalPath,
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    milestones: gen.milestones.map((m) => ({
      title: m.title,
      milestoneDate:
        (m.afterTaskKey && endByKey.get(m.afterTaskKey)) ||
        computed.projectEnd,
      milestoneType: m.type,
      isClientVisible: m.isClientVisible ?? true,
    })),
    createdBy: userId,
  };
}

/** Reconstruct a GeneratedSchedule from the latest saved version (for adjust). */
async function latestAsGenerated(
  orgId: string,
  projectId: string,
): Promise<GeneratedSchedule | null> {
  const latest = await db.schedules.getLatest(orgId, projectId);
  if (!latest) return null;
  // first task per end-date wins (deterministic; multiple tasks can share a date)
  const endToKey = new Map<string, string>();
  for (const t of latest.tasks) {
    const k = t.endDate ?? "";
    if (!endToKey.has(k)) endToKey.set(k, t.taskKey ?? "");
  }
  return {
    scheduleName: latest.schedule.scheduleName,
    startDate: latest.schedule.startDate ?? new Date().toISOString().slice(0, 10),
    tasks: latest.tasks.map((t) => ({
      taskKey: t.taskKey ?? "",
      taskName: t.taskName,
      phase: t.phase ?? "",
      durationDays: t.durationDays ?? 1,
      assigneeRole: t.assigneeRole ?? "",
      dependencies: t.dependencyTaskKeys ?? [],
      needsClientReview: t.needsClientReview ?? false,
      risk: t.risk ?? undefined,
    })),
    milestones: latest.milestones.map((m) => ({
      title: m.title,
      afterTaskKey: endToKey.get(m.milestoneDate ?? "") || undefined,
      type: m.milestoneType ?? undefined,
      isClientVisible: m.isClientVisible ?? true,
    })),
  };
}

export interface ScheduleTaskEdit {
  taskKey: string;
  taskName: string;
  phase: string;
  durationDays: number;
  assigneeRole?: string;
  dependencyTaskKeys: string[];
  needsClientReview?: boolean;
  risk?: string;
}

export interface ScheduleMilestoneEdit {
  title: string;
  afterTaskKey?: string;
  type?: string;
  isClientVisible?: boolean;
}

/** Persist edited task durations + non-working periods → new version. */
export async function saveScheduleEdit(
  projectId: string,
  scheduleName: string,
  startDate: string,
  tasks: ScheduleTaskEdit[],
  milestones: ScheduleMilestoneEdit[],
  periods: NonWorkingPeriod[] = [],
) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  const gen: GeneratedSchedule = {
    scheduleName,
    startDate,
    tasks: tasks.map((t) => ({
      taskKey: t.taskKey,
      taskName: t.taskName,
      phase: t.phase,
      durationDays: Math.max(1, Math.round(t.durationDays)),
      assigneeRole: t.assigneeRole ?? "",
      dependencies: t.dependencyTaskKeys,
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    milestones: milestones.map((m) => ({
      title: m.title,
      afterTaskKey: m.afterTaskKey,
      type: m.type,
      isClientVisible: m.isClientVisible ?? true,
    })),
  };
  try {
    await db.schedules.saveVersion(
      user.orgId,
      projectId,
      toScheduleInput(gen, user.userId, periods),
    );
    revalidatePath(`/projects/${projectId}/schedule`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function generateSchedule(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  try {
    const gen = await getProvider().generateSchedule(ctx);
    await db.schedules.saveVersion(
      user.orgId,
      projectId,
      toScheduleInput(gen, user.userId),
    );
    revalidatePath(`/projects/${projectId}/schedule`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function adjustSchedule(projectId: string, instruction: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  const current = await latestAsGenerated(user.orgId, projectId);
  if (!ctx || !current) {
    return { ok: false as const, error: "先にスケジュールを生成してください" };
  }
  const latest = await db.schedules.getLatest(user.orgId, projectId);
  const periods = (latest?.schedule.nonWorkingPeriods ?? []) as NonWorkingPeriod[];
  try {
    const gen = await getProvider().adjustSchedule(ctx, current, instruction);
    await db.schedules.saveVersion(
      user.orgId,
      projectId,
      toScheduleInput(gen, user.userId, periods),
    );
    revalidatePath(`/projects/${projectId}/schedule`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
