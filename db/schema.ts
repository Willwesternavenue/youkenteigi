import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Database schema — mirrors the spec §17 DDL.
 *
 * Design rules that make the Supabase / Google Cloud swap a low-effort change:
 *  - Every tenant-scoped table carries `organizationId` (SaaS-readiness).
 *  - Column names match the spec's Postgres DDL 1:1 (snake_case in SQL).
 *  - JSON columns use SQLite TEXT with `{ mode: "json" }`; in Postgres these
 *    become `jsonb` with the same Drizzle TS types.
 *  - Timestamps are ISO strings (text) defaulting to CURRENT_TIMESTAMP.
 *
 * This file ships the "core generation slice" tables. The remaining spec §17
 * tables (estimates, schedules, screens, reviews, comments, approvals, …) are
 * the documented target and get appended here as later slices land.
 */

const now = sql`(CURRENT_TIMESTAMP)`;

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emailDomain: text("email_domain"),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name"),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("viewer"),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  clientName: text("client_name").notNull(),
  clientDomain: text("client_domain"),
  projectName: text("project_name").notNull(),
  industry: text("industry"),
  department: text("department"),
  clientContact: text("client_contact"),
  salesOwner: text("sales_owner"),
  pmOwner: text("pm_owner"),
  // プロジェクト責任者（P責）
  projectLead: text("project_lead"),
  status: text("status").notNull().default("draft"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  // 準委任の月額見積: 月単価(円) × 月数
  monthlyRate: integer("monthly_rate"),
  contractMonths: integer("contract_months"),
  expectedStartDate: text("expected_start_date"),
  expectedDeliveryDate: text("expected_delivery_date"),
  proposalDueDate: text("proposal_due_date"),
  recommendedPhase: text("recommended_phase"),
  recommendedPlatform: text("recommended_platform"),
  recommendedDeployment: text("recommended_deployment"),
  developmentForm: text("development_form").default("quasi_mandate"),
  // explicit, user-set stage (PoC / MVP / 本開発…) shown prominently
  projectStage: text("project_stage"),
  // short description of what we're building (overview)
  description: text("description"),
  // external resource links (Canva 資料 等)
  links: text("links", { mode: "json" }).$type<
    { label: string; url: string }[]
  >(),
  // meeting log — grows per 打ち合わせ; shown as a tab under ヒアリング
  meetingNotes: text("meeting_notes", { mode: "json" }).$type<
    { date: string; title: string; url: string }[]
  >(),
  // client-provided materials (link-based shared drive) — ヒアリング/資料
  receivedMaterials: text("received_materials", { mode: "json" }).$type<
    { date: string; name: string; url: string }[]
  >(),
  // similar products / reference links gathered by us — ヒアリング/資料
  // (column name avoids the PG reserved word "references")
  referenceLinks: text("reference_links", { mode: "json" }).$type<
    { title: string; url: string; note: string }[]
  >(),
  note: text("note"),
  ownerId: text("owner_id").references(() => profiles.id),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const hearings = sqliteTable("hearings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  meetingDate: text("meeting_date"),
  meetingTime: text("meeting_time"),
  // 商談形式: online / offline
  meetingFormat: text("meeting_format"),
  // 先方の参加者名（自由記述）
  clientParticipants: text("client_participants"),
  sourceType: text("source_type").default("text"),
  rawText: text("raw_text"),
  summary: text("summary"),
  // JSON payloads (see OrganizedHearing in lib/ai/providers.ts)
  confirmedFacts: text("confirmed_facts", { mode: "json" }).$type<string[]>(),
  assumptions: text("assumptions", { mode: "json" }).$type<string[]>(),
  openQuestions: text("open_questions", { mode: "json" }).$type<
    { category: string; question: string }[]
  >(),
  risks: text("risks", { mode: "json" }).$type<
    { type: string; description: string }[]
  >(),
  recommendedAiModel: text("recommended_ai_model"),
  organizedAt: text("organized_at"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

// spec §17.5 — uploaded files (録音音声 MP3 / 議事録 / 資料 等)
export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  storagePath: text("storage_path").notNull(),
  // reserved for a later slice (文字起こし / AI要約)
  extractedText: text("extracted_text"),
  summary: text("summary"),
  uploadedBy: text("uploaded_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
});

// スコープ・WBS（開発形態に応じた内容）— append version, plan as json
export const scopePlans = sqliteTable("scope_plans", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  developmentForm: text("development_form"),
  plan: text("plan", { mode: "json" }).$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
});

// 提案スライド（編集済みデック）— append version, slides as json
export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  slides: text("slides", { mode: "json" }).$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
});

// 要件定義書の品質レビュー（文書内）— append version, report as json
export const qualityReports = sqliteTable("quality_reports", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  report: text("report", { mode: "json" }).$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
});

// AI整合性レビュー（成果物横断）— append version, report as json
export const consistencyReports = sqliteTable("consistency_reports", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  report: text("report", { mode: "json" }).$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
});

// spec §17.16 — review comments (ピアレビューのコメント)
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  commenterId: text("commenter_id").references(() => profiles.id),
  commentType: text("comment_type"),
  body: text("body").notNull(),
  status: text("status").default("open"),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

// spec §17.17 — approvals (承認・差し戻し)
export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  approverId: text("approver_id").references(() => profiles.id),
  status: text("status").default("pending"),
  comment: text("comment"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  documentType: text("document_type").notNull(), // rfp | requirements | client_questions ...
  title: text("title").notNull(),
  contentMarkdown: text("content_markdown"),
  // Structured section list: { key, heading, markdown }[]
  contentJson: text("content_json", { mode: "json" }).$type<
    { key: string; heading: string; markdown: string }[]
  >(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id),
  projectId: text("project_id").references(() => projects.id),
  userId: text("user_id").references(() => profiles.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").default(now).notNull(),
});

// ---------- estimates (spec §17.7 / §17.8) ----------

export const estimates = sqliteTable("estimates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  estimateName: text("estimate_name").notNull(),
  defaultUnitPrice: integer("default_unit_price").notNull().default(20000),
  bufferRate: real("buffer_rate").notNull().default(0.15),
  taxRate: real("tax_rate").notNull().default(0.1),
  subtotal: integer("subtotal").default(0),
  buffer: integer("buffer").default(0),
  tax: integer("tax").default(0),
  total: integer("total").default(0),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const estimateItems = sqliteTable("estimate_items", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  estimateId: text("estimate_id")
    .references(() => estimates.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  // 3-level hierarchy (大項目 → 中項目 → 小項目=task_name)
  category: text("category"), // 大項目 (grouping)
  subCategory: text("sub_category"), // 中項目
  phase: text("phase"),
  role: text("role"),
  taskName: text("task_name").notNull(),
  approach: text("approach"), // 実装方針
  purpose: text("purpose"), // 開発目的
  // effort broken down by activity, in HOURS (8h = 1 person-day)
  hoursDesign: real("hours_design").notNull().default(0),
  hoursImpl: real("hours_impl").notNull().default(0),
  hoursTest: real("hours_test").notNull().default(0),
  hoursCoord: real("hours_coord").notNull().default(0),
  hoursMgmt: real("hours_mgmt").notNull().default(0),
  personDays: real("person_days").notNull().default(0),
  unitPrice: integer("unit_price").notNull().default(20000),
  amount: integer("amount").notNull().default(0),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(now).notNull(),
});

// ---------- schedules (spec §17.10 / §17.11 / §17.12) ----------

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  scheduleName: text("schedule_name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("draft"),
  // custom non-working periods (お盆/年末年始 等). jp public holidays are auto.
  nonWorkingPeriods: text("non_working_periods", { mode: "json" }).$type<
    { name: string; start: string; end: string }[]
  >(),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const scheduleTasks = sqliteTable("schedule_tasks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  scheduleId: text("schedule_id")
    .references(() => schedules.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  taskName: text("task_name").notNull(),
  phase: text("phase"),
  description: text("description"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  durationDays: integer("duration_days"),
  assigneeRole: text("assignee_role"),
  dependencyTaskKeys: text("dependency_task_keys", { mode: "json" }).$type<
    string[]
  >(),
  taskKey: text("task_key"),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  isClientVisible: integer("is_client_visible", { mode: "boolean" }).default(
    true,
  ),
  isCriticalPath: integer("is_critical_path", { mode: "boolean" }).default(
    false,
  ),
  needsClientReview: integer("needs_client_review", {
    mode: "boolean",
  }).default(false),
  risk: text("risk"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(now).notNull(),
});

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  scheduleId: text("schedule_id").references(() => schedules.id),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  milestoneDate: text("milestone_date"),
  milestoneType: text("milestone_type"),
  isClientVisible: integer("is_client_visible", { mode: "boolean" }).default(
    true,
  ),
  createdAt: text("created_at").default(now).notNull(),
});

// ---------- screen design (spec §13 / §17.13 / §17.14) ----------

export const screenDesigns = sqliteTable("screen_designs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  // Architecture diagram model (tiered layers + edges) and the Claude Design prompt.
  architecture: text("architecture", { mode: "json" }).$type<{
    layers: { name: string; components: { name: string; note?: string }[] }[];
    edges: { from: string; to: string; label?: string }[];
  }>(),
  designPrompt: text("design_prompt"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: text("created_at").default(now).notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});

export const screens = sqliteTable("screens", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  screenDesignId: text("screen_design_id")
    .references(() => screenDesigns.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  screenKey: text("screen_key").notNull(),
  screenName: text("screen_name").notNull(),
  userRole: text("user_role"),
  purpose: text("purpose"),
  description: text("description"),
  uiElements: text("ui_elements", { mode: "json" }).$type<string[]>(),
  states: text("states", { mode: "json" }).$type<string[]>(),
  // Low-fi wireframe: an ordered list of main-content UI blocks.
  wireframe: text("wireframe", { mode: "json" }).$type<
    { kind: string; label?: string }[]
  >(),
  priority: text("priority"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(now).notNull(),
});

export const screenTransitions = sqliteTable("screen_transitions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  screenDesignId: text("screen_design_id")
    .references(() => screenDesigns.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  fromScreenId: text("from_screen_id").references(() => screens.id),
  toScreenId: text("to_screen_id").references(() => screens.id),
  triggerAction: text("trigger_action"),
  description: text("description"),
  createdAt: text("created_at").default(now).notNull(),
});

export type OrganizationRow = typeof organizations.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type HearingRow = typeof hearings.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type ScopePlanRow = typeof scopePlans.$inferSelect;
export type DeckRow = typeof decks.$inferSelect;
export type QualityReportRow = typeof qualityReports.$inferSelect;
export type ConsistencyReportRow = typeof consistencyReports.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type ApprovalRow = typeof approvals.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type EstimateRow = typeof estimates.$inferSelect;
export type EstimateItemRow = typeof estimateItems.$inferSelect;
export type ScheduleRow = typeof schedules.$inferSelect;
export type ScheduleTaskRow = typeof scheduleTasks.$inferSelect;
export type MilestoneRow = typeof milestones.$inferSelect;
export type ScreenDesignRow = typeof screenDesigns.$inferSelect;
export type ScreenRow = typeof screens.$inferSelect;
export type ScreenTransitionRow = typeof screenTransitions.$inferSelect;
