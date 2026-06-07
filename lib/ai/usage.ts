import "server-only";
import { db } from "@/lib/db";
import { estimateCostYen } from "./cost";
import type { UsageSink } from "./usage-context";

/**
 * Records one AI generation event for the admin 利用状況/コスト view.
 * Fire-and-safe: never throws into the calling action. Token counts come from
 * the per-request capture (UsageSink); cost is an estimate in JPY.
 */
export async function recordAiUsage(
  ctx: { orgId: string; userId: string },
  feature: string,
  projectId?: string,
  model?: string,
  usage?: UsageSink,
): Promise<void> {
  try {
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    await db.aiUsage.record({
      orgId: ctx.orgId,
      userId: ctx.userId,
      projectId: projectId ?? null,
      feature,
      model: model ?? null,
      inputTokens,
      outputTokens,
      cost: estimateCostYen(inputTokens, outputTokens),
    });
  } catch {
    // usage logging must not break generation
  }
}
