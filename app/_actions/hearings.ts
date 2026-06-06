"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export interface HearingInput {
  rawText: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingFormat?: string;
  clientParticipants?: string;
  ourParticipants?: string;
}

const MAX_RAW = 200_000; // ~ヒアリング本文の上限（暴走入力対策）

export async function saveHearing(projectId: string, input: HearingInput) {
  const user = await requireUser();
  requireRole(user, "hearing.edit");
  if (!(await db.projects.getById(user.orgId, projectId))) {
    return { ok: false as const, error: "案件が見つかりません" };
  }
  if (typeof input.rawText !== "string" || input.rawText.length > MAX_RAW) {
    return { ok: false as const, error: "入力が不正、または長すぎます" };
  }
  try {
    await db.hearings.upsert(
      user.orgId,
      projectId,
      {
        rawText: input.rawText,
        meetingDate: input.meetingDate,
        meetingTime: input.meetingTime,
        meetingFormat: input.meetingFormat,
        clientParticipants: input.clientParticipants,
        ourParticipants: input.ourParticipants,
        sourceType: "text",
      },
      user.userId,
    );
    revalidatePath(`/projects/${projectId}/hearing`);
    revalidatePath(`/projects/${projectId}/organize`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
