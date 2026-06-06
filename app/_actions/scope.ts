"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/providers";
import { buildGenerationContext } from "@/lib/ai/context";

/** Generate (or regenerate) a scope & WBS plan tailored to the contract type. */
export async function generateScopeWbs(projectId: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  try {
    const plan = await getProvider().generateScopeWbs(ctx);
    await db.scope.saveVersion(
      user.orgId,
      projectId,
      plan,
      ctx.project.developmentForm ?? null,
      user.userId,
    );
    revalidatePath(`/projects/${projectId}/scope`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
