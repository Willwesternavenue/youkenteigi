"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/providers";
import { runAi } from "@/lib/ai/run";
import { buildConsistencyInput } from "@/lib/ai/consistency-input";

/** Mark a consistency finding as 対応済み / 未対応 (in place on the latest report). */
export async function toggleFindingResolved(
  projectId: string,
  index: number,
  resolved: boolean,
) {
  const user = await requireUser();
  requireRole(user, "review.comment");
  const latest = await db.consistency.getLatest(user.orgId, projectId);
  if (!latest) return { ok: false as const, error: "チェック結果がありません" };
  if (!Number.isInteger(index) || index < 0 || index >= latest.report.findings.length) {
    return { ok: false as const, error: "指摘が見つかりません" };
  }
  const findings = latest.report.findings.map((f, i) =>
    i === index ? { ...f, resolved } : f,
  );
  await db.consistency.updateLatest(user.orgId, projectId, {
    ...latest.report,
    findings,
  });
  revalidatePath(`/projects/${projectId}/consistency`);
  return { ok: true as const };
}

/** Run a cross-artifact consistency / coherence review and save it. */
export async function runConsistencyReview(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const input = await buildConsistencyInput(user.orgId, projectId);
  if (!input) return { ok: false as const, error: "案件が見つかりません" };
  try {
    const report = await runAi(
      user,
      "consistency_review",
      () => getProvider().reviewConsistency(input),
      projectId,
    );
    await db.consistency.saveVersion(user.orgId, projectId, report, user.userId);
    revalidatePath(`/projects/${projectId}/consistency`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
