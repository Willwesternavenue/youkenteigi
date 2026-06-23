"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider, type GeneratedEstimate } from "@/lib/ai/providers";
import { runAi } from "@/lib/ai/run";
import { buildGenerationContext } from "@/lib/ai/context";
import { DEFAULT_TAX_RATE } from "@/lib/ai/prompts";
import { computeTotals, parseTargetYen } from "@/lib/estimate-calc";

/** Grand total (税込) of a GeneratedEstimate, using role-based unit prices. */
function grandTotal(
  gen: GeneratedEstimate,
  rateByRole: Record<string, number>,
): number {
  const items = gen.lines.map((l) => ({
    taskName: l.taskName,
    hoursDesign: l.design,
    hoursImpl: l.implementation,
    hoursTest: l.test,
    hoursCoord: l.coordination,
    hoursMgmt: l.management,
    unitPrice: (l.role && rateByRole[l.role]) || gen.defaultUnitPrice,
  }));
  return computeTotals(items, gen.bufferRate, DEFAULT_TAX_RATE).total;
}

// A change is "large" when the target is >1.5x or <0.67x the current total — at
// that point a uniform scale looks unnatural, so we ask the AI to restructure.
const LARGE_HI = 1.5;
const LARGE_LO = 0.67;

/**
 * For a *large* budget change, augment the instruction so the AI rebuilds the
 * 工程 (adds/removes/rebalances scope) instead of just inflating every line.
 * Small changes / non-amount instructions pass through unchanged.
 */
function aiInstructionFor(
  instruction: string,
  current: GeneratedEstimate,
  rateByRole: Record<string, number>,
): string {
  const tgt = parseTargetYen(instruction);
  if (!tgt) return instruction;
  const cur = grandTotal(current, rateByRole);
  if (cur <= 0) return instruction;
  const f = tgt.amount / cur;
  const large =
    (tgt.mode !== "max" && f >= LARGE_HI) ||
    (tgt.mode !== "min" && f <= LARGE_LO);
  if (!large) return instruction;
  const man = Math.round(tgt.amount / 10_000);
  const dir = f >= 1 ? "増額" : "減額";
  const scopeNote =
    f >= 1
      ? "スコープ拡大に伴い、画面・機能・テスト/品質・基盤/インフラ・PM工数などの工程を妥当に追加してください。"
      : "スコープ縮小に伴い、優先度の低い工程を削減・統合してください。";
  return `${instruction}

【重要】予算を約${man}万円（税込・現在の約${f.toFixed(1)}倍の${dir}）に大きく${dir}します。単なる工数の一律増減ではなく、工程（大項目/中項目/小項目）の追加・削除・再配分まで含めて現実的に見直してください。${scopeNote}`;
}

/**
 * Deterministic final correction: scale line hours so the grand total (税込)
 * lands on the named target exactly. After a large-change restructure the AI is
 * already close, so this is a light nudge; for small changes it does the work.
 * Honors 以内/以上 (cap/floor) vs にして (set exactly). No-op without an amount.
 */
function applyTargetTotal(
  gen: GeneratedEstimate,
  instruction: string,
  rateByRole: Record<string, number>,
) {
  const tgt = parseTargetYen(instruction);
  if (!tgt) return;
  const current = grandTotal(gen, rateByRole);
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
    const rateByRole = await db.rateCards.effectiveByRole(user.orgId);
    // For a large budget change, ask the AI to restructure 工程 (add/remove/
    // rebalance), not just inflate every line. Small/non-amount: unchanged.
    const aiInstruction = aiInstructionFor(instruction, current, rateByRole);
    const gen = await runAi(
      user,
      "estimate_adjust",
      () => getProvider().adjustEstimate(ctx, current, aiInstruction),
      projectId,
    );
    // Then land the named budget exactly (light nudge after a restructure).
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
