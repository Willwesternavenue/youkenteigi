"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const commentSchema = z.object({
  commentType: z.enum([
    "question",
    "change_request",
    "risk",
    "tech_note",
    "estimate_note",
    "client_confirm",
  ]),
  body: z.string().min(1, "コメントを入力してください"),
});

export async function postReviewComment(
  projectId: string,
  input: z.infer<typeof commentSchema>,
) {
  const user = await requireUser();
  requireRole(user, "review.comment");
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  try {
    await db.review.addComment(user.orgId, {
      projectId,
      commenterId: user.userId,
      commentType: parsed.data.commentType,
      body: parsed.data.body,
    });
    revalidatePath(`/projects/${projectId}/review`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

const approvalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
});

export async function postApproval(
  projectId: string,
  input: z.infer<typeof approvalSchema>,
) {
  const user = await requireUser();
  requireRole(user, "review.approve");
  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  try {
    await db.review.addApproval(user.orgId, {
      projectId,
      approverId: user.userId,
      status: parsed.data.status,
      comment: parsed.data.comment?.trim() || undefined,
    });
    revalidatePath(`/projects/${projectId}/review`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** Mark a review comment as 対応済み (resolved) / 未対応 (open). */
export async function setCommentStatus(
  projectId: string,
  commentId: string,
  resolved: boolean,
) {
  const user = await requireUser();
  requireRole(user, "review.comment");
  try {
    await db.review.setCommentStatus(
      user.orgId,
      commentId,
      resolved ? "resolved" : "open",
    );
    revalidatePath(`/projects/${projectId}/review`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
