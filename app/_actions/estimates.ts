"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider, type GeneratedEstimate } from "@/lib/ai/providers";
import { runAi } from "@/lib/ai/run";
import { buildGenerationContext } from "@/lib/ai/context";
import { DEFAULT_TAX_RATE } from "@/lib/ai/prompts";
import { computeTotals, parseTargetYen } from "@/lib/estimate-calc";

/**
 * If the instruction names a target amount (e.g.「900万円にして」), deterministically
 * scale every line's hours so the computed grand total (税込) hits that target —
 * LLMs are unreliable at matching a precise budget, so we don't trust the model
 * for the number. Honors 以内/以上 (cap/floor) vs にして (set exactly).
 * Mutates `gen.lines` in place. No-op when no amount is present.
 */
function applyTargetTotal(
  gen: GeneratedEstimate,
  instruction: string,
  rateByRole: Record<string, number>,
) {
  const tgt = parseTargetYen(instruction);
  if (!tgt) return;
  const priceOf = (role?: string) =>
    (role && rateByRole[role]) || gen.defaultUnitPrice;
  const items = gen.lines.map((l) => ({
    taskName: l.taskName,
    hoursDesign: l.design,
    hoursImpl: l.implementation,
    hoursTest: l.test,
    hoursCoord: l.coordination,
    hoursMgmt: l.management,
    unitPrice: priceOf(l.role),
  }));
  const current = computeTotals(items, gen.bufferRate, DEFAULT_TAX_RATE).total;
  if (current <= 0) return;
  let f = tgt.amount / current;
  if (tgt.mode === "max") f = Math.min(1, f); // 以内: 下げるだけ
  if (tgt.mode === "min") f = Math.max(1, f); // 以上: 上げるだけ
  if (Math.abs(f - 1) < 0.005) return; // already within 0.5%
  const s = (n: number) => Math.max(0, Math.round(n * f * 10) / 10);
  gen.lines = gen.lines.map((l) => ({
    ...l,
    design: s(l.design),
    implementation: s(l.implementation),
    test: s(l.test),
    coordination: s(l.coordination),
    management: s(l.management),
  }));
}

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
  rateByRole: Record<string, number> = {},
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
      // Role-based rate card price (人日単価) if available, else the default.
      unitPrice: (l.role && rateByRole[l.role]) || gen.defaultUnitPrice,
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
    const gen = await runAi(
      user,
      "estimate",
      () => getProvider().generateEstimate(ctx),
      projectId,
    );
    const rateByRole = await db.rateCards.effectiveByRole(user.orgId);
    await persist(user.orgId, projectId, gen, user.userId, rateByRole);
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
    const gen = await runAi(
      user,
      "estimate_adjust",
      () => getProvider().adjustEstimate(ctx, current, instruction),
      projectId,
    );
    const rateByRole = await db.rateCards.effectiveByRole(user.orgId);
    // Guarantee a named budget is hit exactly, regardless of the AI provider.
    applyTargetTotal(gen, instruction, rateByRole);
    await persist(user.orgId, projectId, gen, user.userId, rateByRole);
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
