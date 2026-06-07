import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildScheduleView } from "@/lib/schedule-view";
import type { NonWorkingPeriod } from "@/lib/holidays";
import {
  ScheduleEditor,
  type ScheduleData,
  type RawTask,
} from "@/components/schedule/schedule-editor";

// AI生成は最長~120秒。Server Actionのタイムアウト既定値をページ単位で
// 引き上げる（Vercel Pro: 最大300秒）。
export const maxDuration = 300;


export default async function SchedulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const latest = await db.schedules.getLatest(user.orgId, projectId);

  let schedule: ScheduleData | null = null;
  if (latest) {
    const startDate =
      latest.schedule.startDate ?? new Date().toISOString().slice(0, 10);
    const tasks: RawTask[] = latest.tasks.map((t) => ({
      taskKey: t.taskKey ?? t.id,
      taskName: t.taskName,
      phase: t.phase ?? "未分類",
      durationDays: t.durationDays ?? 1,
      assigneeRole: t.assigneeRole,
      dependencyTaskKeys: t.dependencyTaskKeys ?? [],
      needsClientReview: t.needsClientReview,
      risk: t.risk,
      progress: t.progress ?? 0,
    }));

    const periods = (latest.schedule.nonWorkingPeriods ??
      []) as NonWorkingPeriod[];
    // resolve each milestone to the task it follows (match stored date → endDate)
    const view = buildScheduleView(tasks, startDate, { periods });
    const endToKey = new Map(view.tasks.map((t) => [t.endDate, t.taskKey]));

    schedule = {
      id: latest.schedule.id,
      version: latest.schedule.version,
      scheduleName: latest.schedule.scheduleName,
      startDate,
      tasks,
      nonWorkingPeriods: periods,
      milestones: latest.milestones.map((m) => ({
        title: m.title,
        afterTaskKey: endToKey.get(m.milestoneDate ?? "") || undefined,
        type: m.milestoneType ?? undefined,
        isClientVisible: m.isClientVisible ?? true,
      })),
    };
  }

  return (
    <ScheduleEditor
      key={latest ? latest.schedule.id : "empty"}
      projectId={projectId}
      schedule={schedule}
    />
  );
}
