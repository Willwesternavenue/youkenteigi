"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/providers";
import { runAi } from "@/lib/ai/run";
import { buildGenerationContext } from "@/lib/ai/context";

const REQ_DESIGN_SECTIONS = [
  "screen_list",
  "screen_transition",
  "system_overview",
];

export async function generateScreenDesign(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  try {
    const design = await runAi(
      user,
      "screen_design",
      () => getProvider().generateScreenDesign(ctx),
      projectId,
    );
    await db.screenDesign.saveVersion(user.orgId, projectId, design, user.userId);
    revalidatePath(`/projects/${projectId}/design`);
    revalidatePath(`/projects/${projectId}/slides`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** Revise the screen design from a free-text comment, keeping it coherent. */
export async function adjustScreenDesign(
  projectId: string,
  instruction: string,
) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx?.design) {
    return { ok: false as const, error: "先に画面設計を生成してください" };
  }
  try {
    const revised = await runAi(
      user,
      "screen_design_adjust",
      () => getProvider().adjustScreenDesign(ctx, ctx.design!, instruction),
      projectId,
    );
    await db.screenDesign.saveVersion(
      user.orgId,
      projectId,
      revised,
      user.userId,
    );
    revalidatePath(`/projects/${projectId}/design`);
    revalidatePath(`/projects/${projectId}/slides`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** Reflect the current screen design into the requirements doc's screen sections. */
export async function applyDesignToRequirements(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  const latest = await db.documents.getLatest(
    user.orgId,
    projectId,
    "requirements",
  );
  if (!latest?.contentJson) {
    return { ok: false as const, error: "先に要件定義書を生成してください" };
  }
  try {
    const provider = getProvider();
    const updated = await runAi(
      user,
      "design_to_requirements",
      async () => {
        const m = new Map<
          string,
          { key: string; heading: string; markdown: string }
        >();
        for (const key of REQ_DESIGN_SECTIONS) {
          m.set(key, await provider.regenerateSection("requirements", key, ctx));
        }
        return m;
      },
      projectId,
    );
    const sections = latest.contentJson.map((s) =>
      updated.has(s.key) ? { ...s, ...updated.get(s.key)! } : s,
    );
    await db.documents.saveVersion(user.orgId, projectId, "requirements", {
      title: latest.title,
      sections,
      createdBy: user.userId,
    });
    revalidatePath(`/projects/${projectId}/requirements`);
    revalidatePath(`/projects/${projectId}/slides`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
