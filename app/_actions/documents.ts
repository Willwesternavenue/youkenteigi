"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/providers";
import { buildGenerationContext as buildContext } from "@/lib/ai/context";
import type { DocumentType } from "@/types/domain";

export async function generateDocument(
  projectId: string,
  type: DocumentType,
) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };

  try {
    const provider = getProvider();
    const doc =
      type === "rfp"
        ? await provider.generateRfp(ctx)
        : await provider.generateRequirements(ctx);
    await db.documents.saveVersion(user.orgId, projectId, type, {
      title: doc.title,
      sections: doc.sections,
      createdBy: user.userId,
    });
    revalidatePath(`/projects/${projectId}/${type}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function saveDocumentEdit(
  projectId: string,
  type: DocumentType,
  sections: { key: string; heading: string; markdown: string }[],
  title: string,
) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  try {
    await db.documents.saveVersion(user.orgId, projectId, type, {
      title,
      sections,
      createdBy: user.userId,
    });
    revalidatePath(`/projects/${projectId}/${type}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function regenerateSection(
  projectId: string,
  type: DocumentType,
  sectionKey: string,
  instruction?: string,
) {
  const user = await requireUser();
  requireRole(user, "ai.generate");
  const ctx = await buildContext(user.orgId, projectId);
  if (!ctx) return { ok: false as const, error: "案件が見つかりません" };
  try {
    const section = await getProvider().regenerateSection(
      type,
      sectionKey,
      ctx,
      instruction,
    );
    return { ok: true as const, section };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
