"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/providers";
import { recordAiUsage } from "@/lib/ai/usage";
import { buildGenerationContext } from "@/lib/ai/context";
import { loadDeck } from "@/lib/slides/build";
import type { Slide } from "@/lib/slides/deck";

/** Persist the edited deck as a new version. */
export async function saveDeck(projectId: string, slides: Slide[]) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    return { ok: false as const, error: "スライドが空です" };
  }
  if (
    !slides.every(
      (s) => s && typeof s === "object" && typeof (s as Slide).type === "string",
    )
  ) {
    return { ok: false as const, error: "スライドの形式が不正です" };
  }
  try {
    await db.decks.saveVersion(user.orgId, projectId, slides, user.userId);
    revalidatePath(`/projects/${projectId}/slides`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** Rebuild the deck from the latest artifacts (requirements / estimate / …). */
export async function resetDeck(projectId: string) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  try {
    const auto = await loadDeck(user.orgId, projectId);
    if (!auto?.hasRequirements) {
      return { ok: false as const, error: "先に要件定義書を生成してください" };
    }
    await db.decks.saveVersion(user.orgId, projectId, auto.slides, user.userId);
    revalidatePath(`/projects/${projectId}/slides`);
    return { ok: true as const, slides: auto.slides };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** AI-fill a slide's bullets from its title/topic. Returns the bullets. */
export async function fillSlideBullets(projectId: string, topic: string) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildGenerationContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  if (!topic.trim()) {
    return { ok: false as const, error: "先に見出しを入力してください" };
  }
  try {
    const bullets = await getProvider().generateSlideBullets(ctx, topic);
    await recordAiUsage(user, "slide_bullets", projectId);
    return { ok: true as const, bullets };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
