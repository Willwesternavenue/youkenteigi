/**
 * Shared domain types used across server and client code.
 * Pure types only — no runtime imports — so they are safe everywhere.
 */

export type Role =
  | "admin"
  | "manager"
  | "sales"
  | "pm"
  | "engineer"
  | "designer"
  | "viewer";

export const ROLES: Role[] = [
  "admin",
  "manager",
  "sales",
  "pm",
  "engineer",
  "designer",
  "viewer",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理者",
  manager: "マネージャー",
  sales: "営業",
  pm: "PM",
  engineer: "エンジニア",
  designer: "デザイナー",
  viewer: "閲覧のみ",
};

export type ProjectStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "submitted"
  | "won"
  | "lost";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "draft",
  "in_review",
  "approved",
  "submitted",
  "won",
  "lost",
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "下書き",
  in_review: "レビュー中",
  approved: "承認済み",
  submitted: "提出済み",
  won: "受注",
  lost: "失注",
};

export type DocumentType =
  | "rfp"
  | "requirements"
  | "client_questions";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  rfp: "RFP",
  requirements: "要件定義書",
  client_questions: "追加質問",
};

export type RecommendedPhase =
  | "requirements_consult"
  | "poc"
  | "mvp"
  | "full_dev"
  | "enterprise";

export const PHASE_LABELS: Record<RecommendedPhase, string> = {
  requirements_consult: "要件定義コンサル",
  poc: "PoC",
  mvp: "MVP開発",
  full_dev: "本開発",
  enterprise: "エンタープライズ開発",
};

/** Explicit, user-set project stage (PoC / MVP / 本開発…). Same set as phases. */
export type ProjectStage = RecommendedPhase;

export const PROJECT_STAGES: ProjectStage[] = [
  "requirements_consult",
  "poc",
  "mvp",
  "full_dev",
  "enterprise",
];

export const STAGE_BADGE_CLASS: Record<ProjectStage, string> = {
  requirements_consult: "bg-slate-100 text-slate-700 border-slate-200",
  poc: "bg-sky-100 text-sky-800 border-sky-200",
  mvp: "bg-primary/10 text-primary border-primary/20",
  full_dev: "bg-violet-100 text-violet-800 border-violet-200",
  enterprise: "bg-amber-100 text-amber-800 border-amber-200",
};

export type RecommendedPlatform = "web" | "native" | "pwa";
export const RECOMMENDED_PLATFORMS: RecommendedPlatform[] = ["web", "native", "pwa"];
export const PLATFORM_LABELS: Record<RecommendedPlatform, string> = {
  web: "Webアプリ",
  native: "ネイティブアプリ",
  pwa: "PWA",
};

export type RecommendedDeployment =
  | "cloud"
  | "on_prem"
  | "closed_network"
  | "hybrid";
export const RECOMMENDED_DEPLOYMENTS: RecommendedDeployment[] = [
  "cloud",
  "on_prem",
  "closed_network",
  "hybrid",
];
export const DEPLOYMENT_LABELS: Record<RecommendedDeployment, string> = {
  cloud: "クラウド",
  on_prem: "オンプレミス",
  closed_network: "閉域網",
  hybrid: "ハイブリッド",
};

/** Review comment kinds (spec §7.19). */
export type CommentType =
  | "question"
  | "change_request"
  | "risk"
  | "tech_note"
  | "estimate_note"
  | "client_confirm";

export const COMMENT_TYPES: CommentType[] = [
  "question",
  "change_request",
  "risk",
  "tech_note",
  "estimate_note",
  "client_confirm",
];

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  question: "質問",
  change_request: "修正依頼",
  risk: "リスク指摘",
  tech_note: "技術補足",
  estimate_note: "見積指摘",
  client_confirm: "クライアント確認事項",
};

/** Approval decision (spec §7.20 — 承認 / 差し戻し). */
export type ApprovalDecision = "approved" | "rejected";

export const APPROVAL_DECISION_LABELS: Record<ApprovalDecision, string> = {
  approved: "承認",
  rejected: "差し戻し",
};

/** テンプレート種別（標準文言・章立てライブラリ。spec §17.18） */
export type TemplateType = "rfp" | "requirements" | "proposal" | "other";

export const TEMPLATE_TYPES: TemplateType[] = [
  "rfp",
  "requirements",
  "proposal",
  "other",
];

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  rfp: "RFP",
  requirements: "要件定義",
  proposal: "提案",
  other: "その他",
};

/** 開発形態（契約形態）. Default for new projects = quasi_mandate (準委任契約). */
export type DevelopmentForm = "quasi_mandate" | "consulting" | "waterfall";

export const DEVELOPMENT_FORMS: DevelopmentForm[] = [
  "quasi_mandate",
  "consulting",
  "waterfall",
];

export const DEFAULT_DEVELOPMENT_FORM: DevelopmentForm = "quasi_mandate";

export const DEVELOPMENT_FORM_LABELS: Record<DevelopmentForm, string> = {
  quasi_mandate: "準委任契約",
  consulting: "コンサル契約（準委任）",
  waterfall: "ウォーターフォール（請負）",
};
