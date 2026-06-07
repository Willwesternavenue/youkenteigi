"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider, type ProjectSummary } from "@/lib/ai/providers";
import { runAi } from "@/lib/ai/run";
import type { ProjectRow } from "@/db/schema";

function summary(p: ProjectRow): ProjectSummary {
  return {
    projectName: p.projectName,
    clientName: p.clientName,
    industry: p.industry,
    budgetMin: p.budgetMin,
    budgetMax: p.budgetMax,
    expectedDeliveryDate: p.expectedDeliveryDate,
    note: p.note,
  };
}

export async function organizeHearing(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");

  const project = await db.projects.getById(user.orgId, projectId);
  if (!project) return { ok: false as const, error: "案件が見つかりません" };
  const hearing = await db.hearings.getByProject(user.orgId, projectId);
  if (!hearing?.rawText) {
    return { ok: false as const, error: "先にヒアリング内容を入力してください" };
  }
  const rawText = hearing.rawText;

  try {
    const organized = await runAi(
      user,
      "hearing_organize",
      () =>
        getProvider().generateHearingSummary({
          project: summary(project),
          rawText,
        }),
      projectId,
    );
    await db.hearings.saveOrganized(user.orgId, projectId, organized);
    await db.projects.setRecommendations(user.orgId, projectId, {
      recommendedPhase: organized.recommendedPhase,
      recommendedPlatform: organized.recommendedPlatform,
      recommendedDeployment: organized.recommendedDeployment,
    });
    revalidatePath(`/projects/${projectId}/organize`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
