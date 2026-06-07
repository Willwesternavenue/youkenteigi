import { z } from "zod";
import {
  DEVELOPMENT_FORM_LABELS,
  PHASE_LABELS,
  type DocumentType,
  type DevelopmentForm,
  type RecommendedPhase,
} from "@/types/domain";
import type { GenerationContext, ProjectSummary } from "./providers";

/**
 * Shared, provider-agnostic prompt material:
 *  - section catalogues for RFP (spec §9.2) and 要件定義書 (spec §10.2)
 *  - zod schemas both providers validate their output against
 *  - the system/base rules from spec §8.3
 *  - context serialisation used by every prompt
 */

export interface SectionDef {
  key: string;
  heading: string;
  /** A short instruction telling the model what this section should contain. */
  guide: string;
}

export const RFP_SECTIONS: SectionDef[] = [
  { key: "overview", heading: "案件概要", guide: "案件の全体像を3〜5文で要約する。" },
  { key: "background", heading: "背景", guide: "クライアントが相談に至った背景・経緯。" },
  { key: "issues", heading: "課題", guide: "現状の課題を箇条書きで整理する。" },
  { key: "objectives", heading: "目的", guide: "本プロジェクトで達成したい目的。" },
  { key: "target_work", heading: "対象業務", guide: "対象となる業務範囲。" },
  { key: "rfp_scope", heading: "提案依頼範囲", guide: "提案を依頼する範囲。" },
  { key: "functional", heading: "機能要件", guide: "想定される機能要件を箇条書きで。" },
  { key: "nonfunctional", heading: "非機能要件", guide: "性能・可用性・運用などの非機能要件。" },
  { key: "ai", heading: "AI要件", guide: "AI活用方針・利用モデル・前提。" },
  { key: "data", heading: "データ要件", guide: "扱うデータ・連携データの要件。" },
  { key: "security", heading: "セキュリティ要件", guide: "セキュリティ・コンプライアンス要件。" },
  { key: "dev_form", heading: "開発形態", guide: "PoC/MVP/本開発などの開発形態の提案。" },
  { key: "deployment", heading: "導入形態", guide: "クラウド/オンプレ/閉域などの導入形態。" },
  { key: "deliverables", heading: "成果物", guide: "想定される成果物の一覧。" },
  { key: "schedule", heading: "スケジュール", guide: "概略スケジュール（フェーズ単位）。" },
  { key: "estimate_terms", heading: "見積条件", guide: "見積の前提条件。" },
  { key: "evaluation", heading: "評価基準", guide: "提案評価の観点。" },
  { key: "open_items", heading: "未確認事項", guide: "未確認事項を必ず分けて明示する。" },
];

export const REQUIREMENTS_SECTIONS: SectionDef[] = [
  { key: "overview", heading: "プロジェクト概要", guide: "プロジェクトの概要。" },
  { key: "background_purpose", heading: "背景・目的", guide: "背景と目的。" },
  { key: "success_metrics", heading: "成功指標", guide: "成功を測る指標（KPI）。" },
  { key: "target_users", heading: "対象ユーザー", guide: "対象ユーザー・ペルソナ。" },
  { key: "use_scenes", heading: "利用シーン", guide: "主要な利用シーン。" },
  { key: "business_flow", heading: "業務フロー", guide: "現状/将来の業務フロー。" },
  { key: "system_overview", heading: "システム全体像", guide: "システム構成の全体像。" },
  { key: "dev_form", heading: "開発形態", guide: "開発形態。" },
  { key: "deployment", heading: "導入形態", guide: "導入形態。" },
  { key: "feature_list", heading: "機能一覧", guide: "機能を一覧で整理する。" },
  { key: "must_option", heading: "必須機能・オプション機能", guide: "Must/Optionを切り分ける。" },
  { key: "screen_list", heading: "画面一覧", guide: "想定画面の一覧。" },
  { key: "screen_transition", heading: "画面遷移", guide: "主要な画面遷移。" },
  { key: "ai", heading: "AI要件", guide: "AI活用方針・適用範囲・前提。" },
  {
    key: "ai_model",
    heading: "AIモデル選定",
    guide:
      "本システムで採用するAIモデルを具体的に選定する。用途別の推奨モデル（生成LLM・埋め込み・必要なら音声/OCR等）、選定理由（日本語性能・コンテキスト長・精度・コスト・データの学習不可/国内保管などの取り扱い）、比較した代替モデル、評価・更新の運用方針を、AI開発会社の視点で具体的に示す。",
  },
  { key: "data", heading: "データ要件", guide: "データ要件。" },
  { key: "integration", heading: "外部連携要件", guide: "外部連携要件。" },
  { key: "permission", heading: "権限要件", guide: "ロール・権限要件。" },
  { key: "security", heading: "セキュリティ要件", guide: "セキュリティ要件。" },
  { key: "log_audit", heading: "ログ・監査要件", guide: "ログ・監査要件。" },
  { key: "operation", heading: "運用要件", guide: "運用要件。" },
  { key: "maintenance", heading: "保守要件", guide: "保守要件。" },
  { key: "estimate", heading: "見積", guide: "概算見積の前提。" },
  { key: "schedule", heading: "スケジュール", guide: "スケジュール。" },
  { key: "risk", heading: "リスク", guide: "リスクと対策。" },
  { key: "open_items", heading: "未決事項", guide: "未決事項。" },
  { key: "next_confirm", heading: "次回確認事項", guide: "次回クライアントに確認する事項。" },
];

export function sectionsFor(type: DocumentType): SectionDef[] {
  if (type === "rfp") return RFP_SECTIONS;
  if (type === "requirements") return REQUIREMENTS_SECTIONS;
  return [];
}

export function docTitle(type: DocumentType, project: ProjectSummary): string {
  const base =
    type === "rfp" ? "RFP" : type === "requirements" ? "要件定義書" : "追加質問";
  return `${project.projectName} ${base}`;
}

/** Spec §8.3 — the rules every AI output must follow. */
export const BASE_RULES = `あなたはAI開発会社のプリセールス支援AIです。以下のルールを必ず守ってください。
- 入力にないことを断定しない
- 推測は「推測」と明示する
- 未確認事項は必ず分ける
- クライアント向けと社内向けの表現を切り替えられる、提案資料として上品な日本語で書く
- 予算とスコープのズレがあれば指摘する
出力は必ず指定されたJSON形式のみで返してください。前後に説明文を付けないでください。`;

export function serializeContext(ctx: GenerationContext): string {
  const p = ctx.project;
  const lines = [
    `# 案件情報`,
    `案件名: ${p.projectName}`,
    `クライアント: ${p.clientName}`,
    p.description ? `つくるもの: ${p.description}` : "",
    p.projectStage
      ? `開発ステージ: ${PHASE_LABELS[p.projectStage as RecommendedPhase] ?? p.projectStage}`
      : "",
    p.industry ? `業界: ${p.industry}` : "",
    p.budgetMin || p.budgetMax
      ? `想定予算: ${p.budgetMin ?? "-"}〜${p.budgetMax ?? "-"} 円`
      : "",
    p.expectedDeliveryDate ? `希望納期: ${p.expectedDeliveryDate}` : "",
    p.developmentForm
      ? `開発形態（契約形態）: ${DEVELOPMENT_FORM_LABELS[p.developmentForm as DevelopmentForm] ?? p.developmentForm}`
      : "",
    p.note ? `メモ: ${p.note}` : "",
    ``,
    `# ヒアリング内容`,
    ctx.hearingText || "(未入力)",
  ];
  if (ctx.organized) {
    lines.push(
      ``,
      `# AI整理済み情報`,
      `確認済み事項: ${ctx.organized.confirmedFacts.join(" / ")}`,
      `推定: ${ctx.organized.assumptions.join(" / ")}`,
      `未確認事項: ${ctx.organized.openQuestions
        .map((q) => `[${q.category}] ${q.question}`)
        .join(" / ")}`,
    );
  }
  if (ctx.design) {
    const nameByKey = new Map(ctx.design.screens.map((s) => [s.key, s.name]));
    lines.push(
      ``,
      `# 現在の画面設計（整合性を保つこと）`,
      `画面一覧: ${ctx.design.screens.map((s) => s.name).join(" / ")}`,
      `画面遷移: ${ctx.design.transitions
        .map(
          (t) =>
            `${nameByKey.get(t.from) ?? t.from}→${nameByKey.get(t.to) ?? t.to}`,
        )
        .join(" / ")}`,
      `システム構成: ${ctx.design.architecture.layers
        .map((l) => `${l.name}(${l.components.map((c) => c.name).join(",")})`)
        .join(" / ")}`,
    );
  }
  if (ctx.references && ctx.references.length > 0) {
    lines.push(
      ``,
      `# 参考: 類似の過去案件（自社の実績。表現・粒度・見積感の参考にする。内容はこの案件に合わせて具体化すること）`,
      ...ctx.references.map(
        (r, i) => `${i + 1}. ${r.projectName} — ${r.summary}`,
      ),
    );
  }
  return lines.filter(Boolean).join("\n");
}

// ---------- zod schemas (output validation) ----------

export const organizedHearingSchema = z.object({
  summary: z.string(),
  confirmedFacts: z.array(z.string()),
  assumptions: z.array(z.string()),
  openQuestions: z.array(
    z.object({ category: z.string(), question: z.string() }),
  ),
  recommendedPhase: z.enum([
    "requirements_consult",
    "poc",
    "mvp",
    "full_dev",
    "enterprise",
  ]),
  recommendedPlatform: z.enum(["web", "native", "pwa"]),
  recommendedDeployment: z.enum([
    "cloud",
    "on_prem",
    "closed_network",
    "hybrid",
  ]),
  risks: z.array(
    z.object({
      type: z.enum(["technical", "budget", "schedule"]),
      description: z.string(),
    }),
  ),
  recommendedAiModel: z.string().optional(),
});

export const generatedDocSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      key: z.string(),
      heading: z.string(),
      markdown: z.string(),
    }),
  ),
});

export const openQuestionSetSchema = z.array(
  z.object({ category: z.string(), questions: z.array(z.string()) }),
);

export const docSectionSchema = z.object({
  key: z.string(),
  heading: z.string(),
  markdown: z.string(),
});

// ---------- estimate (spec §11) ----------

export const DEFAULT_UNIT_PRICE = 20000; // 人日単価
export const DEFAULT_BUFFER_RATE = 0.15;
export const DEFAULT_TAX_RATE = 0.1;

export const ESTIMATE_ROLES = [
  "PM",
  "PdM",
  "AI Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Designer",
  "QA",
  "DevOps",
  "Security",
  "Document Writer",
];

export const HOURS_PER_DAY = 8;

export const generatedEstimateSchema = z.object({
  estimateName: z.string(),
  defaultUnitPrice: z.number(),
  bufferRate: z.number(),
  lines: z.array(
    z.object({
      category: z.string(),
      subCategory: z.string().optional(),
      taskName: z.string(),
      approach: z.string().optional(),
      purpose: z.string().optional(),
      role: z.string().optional(),
      design: z.number(),
      implementation: z.number(),
      test: z.number(),
      coordination: z.number(),
      management: z.number(),
    }),
  ),
});

// ---------- schedule (spec §12) ----------

export const generatedDesignSchema = z.object({
  screens: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      role: z.string().optional(),
      purpose: z.string(),
      uiElements: z.array(z.string()),
      states: z.array(z.string()).optional(),
      priority: z.string().optional(),
      wireframe: z
        .array(
          z.object({
            kind: z.enum([
              "kpi",
              "toolbar",
              "search",
              "table",
              "cards",
              "form",
              "detail",
              "chart",
              "list",
              "buttons",
              "upload",
              "auth",
              "text",
            ]),
            label: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
  transitions: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      trigger: z.string(),
      description: z.string().optional(),
    }),
  ),
  architecture: z.object({
    layers: z.array(
      z.object({
        name: z.string(),
        components: z.array(
          z.object({ name: z.string(), note: z.string().optional() }),
        ),
      }),
    ),
    edges: z.array(
      z.object({ from: z.string(), to: z.string(), label: z.string().optional() }),
    ),
  }),
  designPrompt: z.string(),
});

export const generatedScheduleSchema = z.object({
  scheduleName: z.string(),
  startDate: z.string(),
  tasks: z.array(
    z.object({
      taskKey: z.string(),
      taskName: z.string(),
      phase: z.string(),
      durationDays: z.number(),
      assigneeRole: z.string(),
      dependencies: z.array(z.string()),
      needsClientReview: z.boolean().optional(),
      risk: z.string().optional(),
    }),
  ),
  milestones: z.array(
    z.object({
      title: z.string(),
      afterTaskKey: z.string().optional(),
      type: z.string().optional(),
      isClientVisible: z.boolean().optional(),
    }),
  ),
});

export const slideBulletsSchema = z.object({
  bullets: z.array(z.string()),
});

export const qualityReportSchema = z.object({
  summary: z.string(),
  score: z.number(),
  findings: z.array(
    z.object({
      category: z.enum([
        "ambiguity",
        "contradiction",
        "omission",
        "consideration",
        "proofreading",
      ]),
      severity: z.enum(["high", "medium", "low"]),
      section: z.string().optional(),
      quote: z.string().optional(),
      issue: z.string(),
      suggestion: z.string(),
    }),
  ),
});

export const consistencyReportSchema = z.object({
  summary: z.string(),
  okPoints: z.array(z.string()),
  findings: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      area: z.string(),
      title: z.string(),
      detail: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
});

export const scopeWbsSchema = z.object({
  formLabel: z.string(),
  approach: z.string(),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  assumptions: z.array(z.string()),
  deliverables: z.array(
    z.object({ name: z.string(), description: z.string() }),
  ),
  wbs: z.array(
    z.object({
      name: z.string(),
      objective: z.string().optional(),
      tasks: z.array(
        z.object({
          name: z.string(),
          deliverable: z.string().optional(),
          role: z.string().optional(),
          weeks: z.number().optional(),
        }),
      ),
    }),
  ),
});
