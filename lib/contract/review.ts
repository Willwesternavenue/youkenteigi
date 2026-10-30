import type { ContractIssue, ContractSuggestion } from "@/lib/ai/providers";
import { CONTRACT_FIELDS, type ContractValues } from "./render";

/**
 * 契約書の AI レビュー・提案の安全装置と、決定論的な整合性チェック（純関数）。
 *
 * 本文（弁護士レビュー済み）はどの経路でも変更しない。AI が提案してよいのは
 * 下の記述系の空欄だけで、AI の出力はサーバ側でもこのホワイトリストで必ず絞る。
 * 委託者名・日付・委託料・責任者など事実や条件そのものの項目は、人の入力か
 * 案件情報からの決定論的なプリフィルに限る。
 */
export const SUGGESTABLE_FIELDS = [
  "dev_target",
  "deliverables",
  "usage_env",
  "prerequisites",
  "data_overview",
  "data_items",
  "data_volume",
  "data_format",
  "contractor_members",
  "client_members",
  "contractor_tasks",
  "client_tasks",
  "meeting_frequency",
  "meeting_place",
  "dataset_delivery",
  "program_delivery",
  "model_delivery",
  "review_period",
  "payment_terms",
] as const;

const SUGGESTABLE = new Set<string>(SUGGESTABLE_FIELDS);
const KNOWN_FIELDS = new Set(CONTRACT_FIELDS.map((f) => f.id));
const MAX_SUGGESTION_LENGTH = 1000;
const MAX_ISSUES = 20;

const v = (values: ContractValues, id: string) => (values[id] ?? "").trim();

/** 提案対象: 記述系かつ、いま空欄の差し込み口。 */
export function suggestTargets(values: ContractValues): string[] {
  return SUGGESTABLE_FIELDS.filter((id) => v(values, id) === "");
}

/** AI の提案を安全側に絞る（対象外の項目・入力済みの項目・空の提案は捨てる）。 */
export function filterSuggestions(
  suggestions: ContractSuggestion[],
  values: ContractValues,
): ContractSuggestion[] {
  const seen = new Set<string>();
  const out: ContractSuggestion[] = [];
  for (const s of suggestions) {
    const value = s.value.trim();
    if (!SUGGESTABLE.has(s.field) || v(values, s.field) !== "" || !value) continue;
    if (seen.has(s.field)) continue;
    seen.add(s.field);
    out.push({
      field: s.field,
      value: value.slice(0, MAX_SUGGESTION_LENGTH),
      reason: s.reason.trim(),
    });
  }
  return out;
}

export function filterIssues(issues: ContractIssue[]): ContractIssue[] {
  return issues.slice(0, MAX_ISSUES).map((i) => ({
    ...i,
    field: i.field && KNOWN_FIELDS.has(i.field) ? i.field : undefined,
  }));
}

// ---------- 決定論的チェック（AI を使わず常に正確な食い違い） ----------

/** "26年7月1日" / "2026年7月1日" / "2026-07-01" / "2026/7/1" → UTC 日付。 */
export function parseContractDate(text: string): Date | null {
  const t = text.trim();
  const m =
    /^(\d{2}|\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(t) ??
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (!m) return null;
  const year = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  // 13月や2月30日のような繰り上がりは不正な日付として扱う
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d : null;
}

/** "9,506,475円" → 9506475、"950万円" → 9500000。読めなければ null。 */
export function parseYen(text: string): number | null {
  const t = text.replace(/[,，\s]/g, "").replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const man = /^(\d+(?:\.\d+)?)万円?/.exec(t);
  if (man) return Math.round(Number(man[1]) * 10000);
  const yen = /^[¥￥]?(\d+)円?/.exec(t);
  return yen ? Number(yen[1]) : null;
}

const fmtYen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export function deterministicIssues(
  values: ContractValues,
  ctx: { developmentForm?: string | null; estimateTotal?: number | null },
): ContractIssue[] {
  const issues: ContractIssue[] = [];

  // 契約形態: このひな形は準委任型（第7条2項で完成義務を負わない）
  if (ctx.developmentForm === "waterfall") {
    issues.push({
      severity: "high",
      title: "案件の開発形態（請負）とひな形（準委任型）が食い違っています",
      detail:
        "案件の開発形態は「ウォーターフォール（請負）」ですが、この契約書ひな形は準委任型です（第7条2項：受託者は本件成果物の完成義務を負わない）。",
      suggestion:
        "本文は弁護士レビュー済みのため変更しません。この案件にこのひな形を使ってよいか、弁護士にご確認ください。",
    });
  }

  const start = parseContractDate(v(values, "work_period_start"));
  const end = parseContractDate(v(values, "work_period_end"));
  const deadline = parseContractDate(v(values, "delivery_deadline"));
  if (start && end && start > end) {
    issues.push({
      severity: "high",
      field: "work_period_start",
      title: "作業期間の開始日が終了日より後になっています",
      detail: `作業期間：${v(values, "work_period_start")}～${v(values, "work_period_end")}`,
      suggestion: "開始日と終了日を見直してください。",
    });
  }
  if (deadline && start && deadline < start) {
    issues.push({
      severity: "high",
      field: "delivery_deadline",
      title: "成果物提供期限が作業期間の開始より前です",
      detail: `成果物提供期限：${v(values, "delivery_deadline")}／作業開始：${v(values, "work_period_start")}`,
    });
  } else if (deadline && end && deadline > end) {
    issues.push({
      severity: "medium",
      field: "delivery_deadline",
      title: "成果物提供期限が作業期間の終了日より後です",
      detail: `成果物提供期限：${v(values, "delivery_deadline")}／作業期間の終了：${v(values, "work_period_end")}`,
      suggestion: "作業期間内に提供する想定であれば、期限か作業期間を揃えてください。",
    });
  }

  const y = v(values, "contract_year");
  const contractDate =
    y && v(values, "contract_month") && v(values, "contract_day")
      ? parseContractDate(`${y}年${v(values, "contract_month")}月${v(values, "contract_day")}日`)
      : null;
  if (contractDate && start && contractDate > start) {
    issues.push({
      severity: "low",
      field: "contract_day",
      title: "契約締結日が作業開始日より後です",
      detail: `締結日：20${y}年${v(values, "contract_month")}月${v(values, "contract_day")}日／作業開始：${v(values, "work_period_start")}`,
      suggestion: "締結前に作業を始める（遡及する）扱いでよいかご確認ください。",
    });
  }

  const fee = parseYen(v(values, "contract_fee"));
  if (fee && ctx.estimateTotal && fee !== ctx.estimateTotal) {
    issues.push({
      severity: "medium",
      field: "contract_fee",
      title: "委託料が最新の見積（税込合計）と異なります",
      detail: `委託料：${fmtYen(fee)}／最新見積の税込合計：${fmtYen(ctx.estimateTotal)}`,
      suggestion: "見積を更新した場合は委託料も見直してください。値引き等で意図的に変えているなら問題ありません。",
    });
  }

  const review = v(values, "review_period");
  if (review && !/^[0-9０-９]+$/.test(review)) {
    issues.push({
      severity: "medium",
      field: "review_period",
      title: "確認期間が日数（数字）になっていません",
      detail: `別紙では「成果物提供日から${review}日間」と表示されます。`,
      suggestion: "日数を数字だけで入力してください（例：14）。",
    });
  }

  return issues;
}

