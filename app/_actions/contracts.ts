"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeTotals } from "@/lib/estimate-calc";
import { TEMPLATE_REVISION } from "@/lib/contract/template";
import {
  CONTRACT_FIELDS,
  contractTitle,
  prefillFromProject,
  type ContractValues,
} from "@/lib/contract/render";

const FIELD_IDS = new Set(CONTRACT_FIELDS.map((f) => f.id));
const MAX_VALUE_LENGTH = 5000;

/** 既知の差し込み口だけを保存する（本文テンプレートは保存対象外で不変）。 */
function sanitize(values: Record<string, unknown>): ContractValues {
  const out: ContractValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (FIELD_IDS.has(key) && typeof value === "string") {
      out[key] = value.slice(0, MAX_VALUE_LENGTH);
    }
  }
  return out;
}

async function projectPrefill(
  orgId: string,
  projectId: string,
): Promise<ContractValues | null> {
  const p = await db.projects.getById(orgId, projectId);
  if (!p) return null;
  const est = await db.estimates.getLatest(orgId, projectId);
  const estimateTotal = est
    ? computeTotals(est.items, est.estimate.bufferRate, est.estimate.taxRate).total
    : null;
  return prefillFromProject({
    clientName: p.clientName,
    projectName: p.projectName,
    description: p.description,
    expectedStartDate: p.expectedStartDate,
    expectedDeliveryDate: p.expectedDeliveryDate,
    pmOwner: p.pmOwner,
    clientContact: p.clientContact,
    estimateTotal,
  });
}

function revalidate(projectId: string | null, contractId?: string) {
  revalidatePath("/contract");
  if (contractId) revalidatePath(`/contract/${contractId}`);
  if (projectId) revalidatePath(`/projects/${projectId}/contract`);
}

/** 新規作成。案件に紐づける場合は案件情報から差し込み値をプリフィルする。 */
export async function createContract(projectId: string | null) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  let values: ContractValues = {};
  if (projectId) {
    const prefill = await projectPrefill(user.orgId, projectId);
    if (!prefill) return { ok: false as const, error: "案件が見つかりません" };
    values = prefill;
  }
  const id = await db.contracts.create(user.orgId, projectId, {
    title: contractTitle(values),
    clientName: values.client_name || null,
    values,
    templateRevision: TEMPLATE_REVISION,
    userId: user.userId,
  });
  await db.audit.log({
    orgId: user.orgId,
    userId: user.userId,
    projectId,
    action: "contract.create",
    targetType: "contract",
    targetId: id,
  });
  revalidate(projectId, id);
  return { ok: true as const, id };
}

/** 差し込み値を新バージョンとして保存する（追記専用）。 */
export async function saveContract(contractId: string, values: Record<string, unknown>) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  const clean = sanitize(values);
  const existing = await db.contracts.get(user.orgId, contractId);
  if (!existing) return { ok: false as const, error: "契約書が見つかりません" };
  const version = await db.contracts.saveVersion(user.orgId, contractId, {
    title: contractTitle(clean),
    clientName: clean.client_name?.trim() || null,
    values: clean,
    templateRevision: TEMPLATE_REVISION,
    userId: user.userId,
  });
  if (version === null) return { ok: false as const, error: "契約書が見つかりません" };
  await db.audit.log({
    orgId: user.orgId,
    userId: user.userId,
    projectId: existing.projectId,
    action: "contract.save",
    targetType: "contract",
    targetId: contractId,
    metadata: { version },
  });
  revalidate(existing.projectId, contractId);
  return { ok: true as const, version };
}

/** 「案件情報から入力」用。紐づく案件の最新情報からプリフィル値を返す（保存はしない）。 */
export async function getContractPrefill(contractId: string) {
  const user = await requireUser();
  requireRole(user, "document.edit");
  const contract = await db.contracts.get(user.orgId, contractId);
  if (!contract?.projectId) return { ok: false as const, error: "案件に紐づいていません" };
  const values = await projectPrefill(user.orgId, contract.projectId);
  if (!values) return { ok: false as const, error: "案件が見つかりません" };
  return { ok: true as const, values };
}
