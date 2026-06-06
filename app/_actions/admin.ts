"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser, ALLOWED_DOMAIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES, type Role } from "@/types/domain";

const roleSchema = z.enum(ROLES as [Role, ...Role[]]);

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("メールアドレスの形式が正しくありません"),
  name: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  role: roleSchema,
});

export type InviteInput = z.input<typeof inviteSchema>;

/**
 * 招待 = profile を事前作成する。初回ログイン時に指定ロールが適用される。
 * （Supabase Auth 連携後はメール招待に差し替え予定。handoff §3.2/§3.3）
 */
export async function inviteUser(input: InviteInput) {
  const user = await requireUser();
  requireRole(user, "admin.users");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  const { email, name, role } = parsed.data;

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return {
      ok: false as const,
      error: `@${ALLOWED_DOMAIN} のメールアドレスのみ招待できます。`,
    };
  }
  const existing = await db.profiles.getByEmail(email);
  if (existing) {
    return { ok: false as const, error: "このメールアドレスは既に登録済みです。" };
  }

  await db.profiles.invite({ orgId: user.orgId, email, name, role });
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function setUserRole(userId: string, role: Role) {
  const user = await requireUser();
  requireRole(user, "admin.users");

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) {
    return { ok: false as const, error: "不正なロールです。" };
  }
  // 自分自身を管理者から降格してロック状態になるのを防ぐ。
  if (userId === user.userId && role !== "admin") {
    return {
      ok: false as const,
      error: "自分自身の管理者権限は変更できません。",
    };
  }

  await db.profiles.setRole(user.orgId, userId, parsed.data);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  const user = await requireUser();
  requireRole(user, "admin.users");

  // 自分自身は無効化できない（自己ロックアウト防止）。
  if (userId === user.userId) {
    return { ok: false as const, error: "自分自身は無効化できません。" };
  }

  await db.profiles.setDisabled(user.orgId, userId, disabled);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

// ---------- rate cards (CRUD only — not wired into estimate-calc) ----------

const rateCardSchema = z.object({
  name: z.string().trim().min(1, "名称は必須です"),
  role: roleSchema,
  dailyRate: z.coerce.number().int().nonnegative("人日単価は0以上の整数で"),
  monthlyRate: z.coerce
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform((v) => (v === undefined ? null : v)),
  validFrom: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
  validTo: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type RateCardFormInput = z.input<typeof rateCardSchema>;

export async function createRateCard(input: RateCardFormInput) {
  const user = await requireUser();
  requireRole(user, "admin.ratecard");
  const parsed = rateCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  await db.rateCards.create(user.orgId, parsed.data, user.userId);
  revalidatePath("/admin/rate-cards");
  return { ok: true as const };
}

export async function updateRateCard(id: string, input: RateCardFormInput) {
  const user = await requireUser();
  requireRole(user, "admin.ratecard");
  const parsed = rateCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  await db.rateCards.update(user.orgId, id, parsed.data);
  revalidatePath("/admin/rate-cards");
  return { ok: true as const };
}

export async function deleteRateCard(id: string) {
  const user = await requireUser();
  requireRole(user, "admin.ratecard");
  await db.rateCards.delete(user.orgId, id);
  revalidatePath("/admin/rate-cards");
  return { ok: true as const };
}
