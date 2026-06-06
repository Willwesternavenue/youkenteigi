import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportSchedulePdf } from "@/lib/export";
import { buildScheduleView } from "@/lib/schedule-view";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const user = await requireUser();
  const { scheduleId } = await params;
  const data = await db.schedules.getById(user.orgId, scheduleId);
  if (!data) return new Response("not found", { status: 404 });

  const { schedule, tasks, milestones } = data;
  const view = buildScheduleView(
    tasks,
    schedule.startDate ?? new Date().toISOString().slice(0, 10),
    { periods: (schedule.nonWorkingPeriods ?? []) as { name: string; start: string; end: string }[] },
  );

  const result = await exportSchedulePdf({
    title: schedule.scheduleName,
    projectStart: view.projectStart,
    projectEnd: view.projectEnd,
    tasks: view.tasks.map((t) => ({
      taskName: t.taskName,
      phase: t.phase,
      startDate: t.startDate,
      endDate: t.endDate,
      durationDays: t.durationDays,
      assigneeRole: t.assigneeRole,
      progress: t.progress,
      isCriticalPath: t.isCriticalPath,
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    phases: view.phases,
    milestones: milestones.map((m) => ({
      title: m.title,
      milestoneDate: m.milestoneDate ?? "",
      isClientVisible: m.isClientVisible,
    })),
  });

  const filename = `${schedule.scheduleName}_v${schedule.version}.pdf`;
  return new Response(new Uint8Array(result.data), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="schedule.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(result.data.length),
    },
  });
}
