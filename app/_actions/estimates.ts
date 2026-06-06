"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider, type GeneratedEstimate } from "@/lib/ai/providers";
import { recordAiUsage } from "@/lib/ai/usage";
import { buildGenerationContext } from "@/lib/ai/context";
import { DEFAULT_TAX_RATE } from "@/lib/ai/prompts";

export interface EstimateItemEdit {
  category?: string;
  subCategory?: string;
  role?: string;
  taskName: string;
  approach?: string;
  purpose?: string;
  hoursDesign: number;
  hoursImpl: number;
  hoursTest: number;
  hoursCoord: number;
  hoursMgmt: number;
  unitPrice: number;
}

/** Reconstruct a GeneratedEstimate from the latest saved version (for adjust). */
async function latestAsGenerated(
  orgId: string,
  projectId: string,
): Promise<GeneratedEstimate | null> {
  const latest = await db.estimates.getLatest(orgId, projectId);
  if (!latest) return null;
  return {
    estimateName: latest.estimate.estimateName,
    defaultUnitPrice: latest.estimate.defaultUnitPrice,
    bufferRate: latest.estimate.bufferRate,
    lines: latest.items.map((i) => ({
      category: i.category ?? i.phase ?? "その他",
      subCategory: i.subCategory ?? undefined,
      taskName: i.taskName,
      approach: i.approach ?? undefined,
      purpose: i.purpose ?? undefined,
      role: i.role ?? undefined,
      design: i.hoursDesign,
      implementation: i.hoursImpl,
      test: i.hoursTest,
      coordination: i.hoursCoord,
      management: i.hoursMgmt,
    })),
  };
}

async function persist(
  orgId: string,
  projectId: string,
  gen: GeneratedEstimate,
  userId: string,
) {
  await db.estimates.saveVersion(orgId, projectId, {
    estimateName: gen.estimateName,
    defaultUnitPrice: gen.defaultUnitPrice,
    bufferRate: gen.bufferRate,
    taxRate: DEFAULT_TAX_RATE,
    items: gen.lines.map((l) => ({
      category: l.category,
      subCategory: l.subCategory,
      role: l.role,
      taskName: l.taskName,
      approach: l.approach,
      purpose: l.purpose,
      hoursDesign: l.design,
      hoursImpl: l.implementation,
      hoursTest: l.test,
      hoursCoord: l.coordination,
      hoursMgmt: l.management,
      unitPrice: gen.defaultUnitPrice,
    })),
    createdBy: userId,
  });
}

export async function generateEstimate(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  try {
    const gen = await getProvider().generateEstimate(ctx);
    await persist(user.orgId, projectId, gen, user.userId);
    await recordAiUsage(user, "estimate", projectId);
    revalidatePath(`/projects/${projectId}/estimate`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function adjustEstimate(projectId: string, instruction: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  const current = await latestAsGenerated(user.orgId, projectId);
  if (!ctx || !current) {
    return { ok: false as const, error: "先に見積を生成してください" };
  }
  try {
    const gen = await getProvider().adjustEstimate(ctx, current, instruction);
    await persist(user.orgId, projectId, gen, user.userId);
    await recordAiUsage(user, "estimate_adjust", projectId);
    revalidatePath(`/projects/${projectId}/estimate`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function saveEstimateEdit(
  projectId: string,
  estimateName: string,
  defaultUnitPrice: number,
  bufferRate: number,
  items: EstimateItemEdit[],
) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  try {
    await db.estimates.saveVersion(user.orgId, projectId, {
      estimateName,
      defaultUnitPrice,
      bufferRate,
      taxRate: DEFAULT_TAX_RATE,
      items: items.map((i) => ({
        category: i.category,
        subCategory: i.subCategory,
        role: i.role,
        taskName: i.taskName,
        approach: i.approach,
        purpose: i.purpose,
        hoursDesign: i.hoursDesign,
        hoursImpl: i.hoursImpl,
        hoursTest: i.hoursTest,
        hoursCoord: i.hoursCoord,
        hoursMgmt: i.hoursMgmt,
        unitPrice: i.unitPrice,
      })),
      createdBy: user.userId,
    });
    revalidatePath(`/projects/${projectId}/estimate`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
