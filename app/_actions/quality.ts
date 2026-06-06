"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/providers";

/** Run an internal quality review on the latest requirements document. */
export async function runQualityReview(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const doc = await db.documents.getLatest(user.orgId, projectId, "requirements");
  if (!doc?.contentJson) {
    return { ok: false as const, error: "先に要件定義書を生成してください" };
  }
  try {
    const report = await getProvider().reviewRequirementsQuality({
      sections: doc.contentJson.map((s) => ({
        key: s.key,
        heading: s.heading,
        markdown: s.markdown,
      })),
    });
    await db.quality.saveVersion(user.orgId, projectId, report, user.userId);
    revalidatePath(`/projects/${projectId}/quality`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** Mark a quality finding 対応済み / 未対応 on the latest report. */
export async function toggleQualityResolved(
  projectId: string,
  index: number,
  resolved: boolean,
) {
  const user = await requireUser();
  requireRole(user, "review.comment");
  const latest = await db.quality.getLatest(user.orgId, projectId);
  if (!latest) return { ok: false as const, error: "チェック結果がありません" };
  if (!Number.isInteger(index) || index < 0 || index >= latest.report.findings.length) {
    return { ok: false as const, error: "指摘が見つかりません" };
  }
  const findings = latest.report.findings.map((f, i) =>
    i === index ? { ...f, resolved } : f,
  );
  await db.quality.updateLatest(user.orgId, projectId, {
    ...latest.report,
    findings,
  });
  revalidatePath(`/projects/${projectId}/quality`);
  return { ok: true as const };
}
