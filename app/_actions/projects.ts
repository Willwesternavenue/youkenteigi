"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { ProjectStatus } from "@/types/domain";

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  });

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const projectSchema = z.object({
  clientName: z.string().min(1, "クライアント名は必須です"),
  projectName: z.string().min(1, "案件名は必須です"),
  clientDomain: optionalString,
  industry: optionalString,
  department: optionalString,
  clientContact: optionalString,
  salesOwner: optionalString,
  pmOwner: optionalString,
  budgetMin: optionalNumber,
  budgetMax: optionalNumber,
  expectedStartDate: optionalString,
  expectedDeliveryDate: optionalString,
  proposalDueDate: optionalString,
  developmentForm: z
    .enum(["quasi_mandate", "consulting", "waterfall"])
    .default("quasi_mandate"),
  projectStage: z
    .enum(["requirements_consult", "poc", "mvp", "full_dev", "enterprise"])
    .optional(),
  description: optionalString,
  links: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .optional(),
  note: optionalString,
});

export type ProjectInput = z.input<typeof projectSchema>;

export async function createProject(input: ProjectInput) {
  const user = await requireUser();
  requireRole(user, "project.create");
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  const project = await db.projects.create(user.orgId, parsed.data, user.userId);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
) {
  const user = await requireUser();
  requireRole(user, "project.status");
  await db.projects.setStatus(user.orgId, projectId, status);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

const metaSchema = z.object({
  description: z.string().optional(),
  clientDomain: z.string().optional(),
  salesOwner: z.string().optional(),
  pmOwner: z.string().optional(),
  projectLead: z.string().optional(),
  monthlyRate: z.number().int().nonnegative().optional(),
  contractMonths: z.number().int().nonnegative().optional(),
  projectStage: z
    .enum(["requirements_consult", "poc", "mvp", "full_dev", "enterprise"])
    .optional(),
  recommendedPlatform: z.enum(["web", "native", "pwa"]).optional(),
  recommendedDeployment: z
    .enum(["cloud", "on_prem", "closed_network", "hybrid"])
    .optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  meetingNotes: z
    .array(
      z.object({
        date: z.string(),
        title: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  receivedMaterials: z
    .array(
      z.object({
        date: z.string(),
        name: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  referenceLinks: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        note: z.string(),
      }),
    )
    .optional(),
});

/** Update overview meta: description / stage / links / meeting notes. */
export async function updateProjectMeta(
  projectId: string,
  patch: z.infer<typeof metaSchema>,
) {
  const user = await requireUser();
  requireRole(user, "project.edit");
  const parsed = metaSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  await db.projects.update(user.orgId, projectId, parsed.data);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/slides`);
  return { ok: true as const };
}

/** Delete an uploaded file (録音/議事録/資料) and its stored object. */
export async function deleteProjectFile(projectId: string, fileId: string) {
  const user = await requireUser();
  requireRole(user, "project.edit");
  const file = await db.files.getById(user.orgId, fileId);
  if (!file) return { ok: false as const, error: "ファイルが見つかりません" };
  await storage.delete(file.storagePath);
  await db.files.delete(user.orgId, fileId);
  revalidatePath(`/projects/${projectId}/resources`);
  return { ok: true as const };
}
