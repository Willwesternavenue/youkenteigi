import "server-only";
import { db } from "@/lib/db";

/**
 * Records one AI generation event for the admin 利用状況/コスト view.
 * Fire-and-safe: never throws into the calling action. Token/cost are 0 for the
 * Mock provider; wire real counts when ClaudeProvider reports usage.
 */
export async function recordAiUsage(
  ctx: { orgId: string; userId: string },
  feature: string,
  projectId?: string,
  model?: string,
): Promise<void> {
  try {
    await db.aiUsage.record({
      orgId: ctx.orgId,
      userId: ctx.userId,
      projectId: projectId ?? null,
      feature,
      model: model ?? null,
    });
  } catch {
    // usage logging must not break generation
  }
}
