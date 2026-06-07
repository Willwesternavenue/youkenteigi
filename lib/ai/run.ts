import "server-only";
import { db } from "@/lib/db";
import { withUsageCapture } from "./usage-context";
import { recordAiUsage } from "./usage";

/**
 * Cost governance wrapper for AI generation. Wrap the provider call so every
 * generation goes through:
 *   1. per-user rate limit (per minute),
 *   2. monthly budget enforcement (org-level; budget = 0 → generation paused),
 *   3. token capture + usage/cost recording.
 *
 * On block it throws AiBlockedError — the calling action's try/catch turns the
 * message into a user-facing toast. Read settings from /admin/AI設定.
 */
const RATE_PER_MIN = 20;

export class AiBlockedError extends Error {}

function activeModel(): string {
  return process.env.AI_PROVIDER === "claude"
    ? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
    : "mock";
}

export async function runAi<T>(
  user: { orgId: string; userId: string },
  feature: string,
  fn: () => Promise<T>,
  projectId?: string,
): Promise<T> {
  // 1. Rate limit (per user / minute)
  const since = new Date(Date.now() - 60_000).toISOString();
  const recent = await db.aiUsage.countRecent(user.orgId, user.userId, since);
  if (recent >= RATE_PER_MIN) {
    throw new AiBlockedError(
      "AI生成のレート上限に達しました（1分あたり）。少し待ってから再度お試しください。",
    );
  }

  // 2. Monthly budget (org). 0 (or less) = paused / kill switch.
  const settings = await db.aiSettings.get(user.orgId);
  if (settings?.monthlyBudget != null) {
    if (settings.monthlyBudget <= 0) {
      throw new AiBlockedError(
        "AI生成は現在停止中です（管理者が月次上限を0に設定しています）。",
      );
    }
    const sum = await db.aiUsage.summary(user.orgId);
    if (sum.monthCost >= settings.monthlyBudget) {
      throw new AiBlockedError(
        "今月のAI利用が上限額（概算）に達しました。管理者にお問い合わせください。",
      );
    }
  }

  // 3. Capture tokens + record usage/cost.
  const { result, usage } = await withUsageCapture(fn);
  await recordAiUsage(user, feature, projectId, activeModel(), usage);
  return result;
}
