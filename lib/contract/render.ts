import {
  APPENDIX_FIELDS,
  APPENDIX_TEMPLATE,
  CONTRACT_TEMPLATE,
  TEMPLATE_FIELDS,
  type ContractField,
} from "./template";

/**
 * 契約書の描画・出力・プリフィルの純関数（client/server 共用）。
 * 本文テンプレートは不変で、ここでは {{変数}} への差し込みだけを扱う。
 * 行の判定ルールは AgreementWriter の preview.js / google-docs.js と同じ。
 */

export type ContractValues = Record<string, string>;
export type ContractTab = "contract" | "appendix";

export const CONTRACT_FIELDS: ContractField[] = [
  ...TEMPLATE_FIELDS,
  ...APPENDIX_FIELDS,
];

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  CONTRACT_FIELDS.map((f) => [f.id, f.label]),
);

const SLOT = /\{\{(\w+)\}\}/g;

function valueOf(values: ContractValues, key: string): string {
  return (values[key] ?? "").trim();
}

/** 差し込み値で埋めたプレーンテキスト。未入力は【未入力】（元 generatePlainText と同じ）。 */
export function contractTexts(values: ContractValues) {
  const fill = (template: string) =>
    template.replace(SLOT, (_, key: string) => valueOf(values, key) || "【未入力】");
  return {
    contractText: fill(CONTRACT_TEMPLATE),
    appendixText: fill(APPENDIX_TEMPLATE),
  };
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "slot"; key: string; label: string; value: string };

/** 1行を本文テキストと差し込み口に分解する（プレビュー・差分表示用）。 */
export function splitSlots(line: string, values: ContractValues): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of line.matchAll(SLOT)) {
    if (m.index > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    const key = m[1];
    out.push({
      kind: "slot",
      key,
      label: FIELD_LABELS[key] ?? key,
      value: valueOf(values, key),
    });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

export type ContractLineKind =
  | "blank"
  | "title"
  | "section"
  | "numbered"
  | "indent1"
  | "indent2"
  | "plain";

export type AppendixLineKind = "blank" | "title" | "major" | "sub" | "note" | "body";

const TITLES = new Set(["開発委託契約書", "【別紙】本件業務の詳細"]);

export function classifyContractLine(line: string): {
  kind: ContractLineKind;
  text: string;
} {
  const trimmed = line.trim();
  if (trimmed === "") return { kind: "blank", text: "" };
  if (TITLES.has(trimmed)) return { kind: "title", text: trimmed };
  if (/^第\d+条/.test(trimmed)) return { kind: "section", text: line };
  if (/^[１-９]|^\d+[．.]|^（\d+）/.test(trimmed)) return { kind: "numbered", text: line };
  if (line.startsWith("　　")) return { kind: "indent2", text: trimmed };
  if (line.startsWith("　")) return { kind: "indent1", text: trimmed };
  return { kind: "plain", text: line };
}

export function classifyAppendixLine(line: string): {
  kind: AppendixLineKind;
  text: string;
} {
  const trimmed = line.trim();
  if (trimmed === "") return { kind: "blank", text: "" };
  if (trimmed === "【別紙】本件業務の詳細") return { kind: "title", text: trimmed };
  if (/^(１０|１１|１２|１３|１４|[１-９])[．.].+/.test(trimmed))
    return { kind: "major", text: line };
  if (/^（[１２３４５６７８９１０]+）/.test(trimmed)) return { kind: "sub", text: line };
  if (trimmed.startsWith("※")) return { kind: "note", text: line };
  return { kind: "body", text: line };
}

export function templateLines(tab: ContractTab): string[] {
  return (tab === "contract" ? CONTRACT_TEMPLATE : APPENDIX_TEMPLATE).split("\n");
}

export function requiredProgress(values: ContractValues) {
  const required = CONTRACT_FIELDS.filter((f) => f.required);
  const filled = required.filter((f) => valueOf(values, f.id) !== "").length;
  return { filled, total: required.length };
}

/** 例: 開発委託契約書_株式会社サンプル（元ツールの Docs タイトルと同じ命名）。 */
export function contractTitle(values: ContractValues): string {
  return `開発委託契約書_${valueOf(values, "client_name") || "ドラフト"}`;
}

// ---------- 案件からのプリフィル（決定論的。本文には触れず差し込み値だけ） ----------

export interface ContractPrefillSource {
  clientName?: string | null;
  projectName?: string | null;
  description?: string | null;
  expectedStartDate?: string | null;
  expectedDeliveryDate?: string | null;
  pmOwner?: string | null;
  clientContact?: string | null;
  /** 最新見積の税込合計（円） */
  estimateTotal?: number | null;
}

/** "2026-07-01" → "26年7月1日"（テンプレートの記入例と同じ書式）。 */
function formatContractDate(date?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!m) return "";
  return `${m[1].slice(2)}年${Number(m[2])}月${Number(m[3])}日`;
}

export function prefillFromProject(src: ContractPrefillSource): ContractValues {
  const deliveryDate = formatContractDate(src.expectedDeliveryDate);
  const values: ContractValues = {
    client_name: src.clientName ?? "",
    client_signatory: src.clientName ?? "",
    dev_target: src.description || src.projectName || "",
    contractor_manager: src.pmOwner ?? "",
    // 「情報システム部 田中様」のような敬称は契約書の氏名欄から外す
    client_manager: (src.clientContact ?? "").replace(/様$/, ""),
    work_period_start: formatContractDate(src.expectedStartDate),
    work_period_end: deliveryDate,
    delivery_deadline: deliveryDate,
    contract_fee:
      src.estimateTotal && src.estimateTotal > 0
        ? `${src.estimateTotal.toLocaleString("ja-JP")}円`
        : "",
  };
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.trim() !== ""),
  );
}

/** 空欄だけをプリフィル値で埋める（入力済みの値は上書きしない）。 */
export function fillEmpty(current: ContractValues, prefill: ContractValues) {
  const next = { ...current };
  const filledKeys: string[] = [];
  for (const [key, value] of Object.entries(prefill)) {
    if (valueOf(current, key) === "") {
      next[key] = value;
      filledKeys.push(key);
    }
  }
  return { values: next, filledKeys };
}
