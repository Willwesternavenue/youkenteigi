import {
  pgTable,
  text,
  integer,
  real,
  jsonb,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Database schema — mirrors the spec §17 Postgres DDL.
 *
 * Design rules that make this a SaaS-ready, swappable data layer:
 *  - Every tenant-scoped table carries `organizationId` (tenant isolation is
 *    enforced in the repo facade in lib/db.ts, which filters by it).
 *  - Column names match the spec's Postgres DDL 1:1 (snake_case in SQL).
 *  - JSON payloads use `jsonb` with explicit Drizzle TS types.
 *  - Row metadata timestamps (`created_at` / `updated_at` / …) are
 *    `timestamptz`. We read them as strings (`mode: "string"`) so the app
 *    layer stays on ISO-ish strings; Postgres normalizes the format on read,
 *    which keeps cross-row string sorts consistent.
 *  - Business *date* fields (start_date, meeting_date, expected_*_date, …) stay
 *    `text` — they hold user-/AI-chosen "YYYY-MM-DD" strings consumed verbatim
 *    by schedule-calc and friends.
 *  - `id` columns are app-generated UUID strings (crypto.randomUUID()).
 */

// Row-metadata timestamp helper: timestamptz, read/written as a string.
const ts = (name: string) =>
  timestamp(name, { mode: "string", withTimezone: true });

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emailDomain: text("email_domain"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name"),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("viewer"),
  // 管理: 無効化されたユーザーはログイン不可（招待は profile 事前作成で表現）
  disabled: boolean("disabled").notNull().default(false),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
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
  links: jsonb("links").$type<{ label: string; url: string }[]>(),
  // meeting log — grows per 打ち合わせ; shown as a tab under ヒアリング
  meetingNotes: jsonb("meeting_notes").$type<
    { date: string; title: string; url: string }[]
  >(),
  // client-provided materials (link-based shared drive) — ヒアリング/資料
  receivedMaterials: jsonb("received_materials").$type<
    { date: string; name: string; url: string }[]
  >(),
  // similar products / reference links gathered by us — ヒアリング/資料
  // (column name avoids the PG reserved word "references")
  referenceLinks: jsonb("reference_links").$type<
    { title: string; url: string; note: string }[]
  >(),
  note: text("note"),
  ownerId: text("owner_id").references(() => profiles.id),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const hearings = pgTable("hearings", {
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
  // 弊社側の参加者名（自由記述）
  ourParticipants: text("our_participants"),
  sourceType: text("source_type").default("text"),
  rawText: text("raw_text"),
  summary: text("summary"),
  // JSON payloads (see OrganizedHearing in lib/ai/providers.ts)
  confirmedFacts: jsonb("confirmed_facts").$type<string[]>(),
  assumptions: jsonb("assumptions").$type<string[]>(),
  openQuestions: jsonb("open_questions").$type<
    { category: string; question: string }[]
  >(),
  risks: jsonb("risks").$type<{ type: string; description: string }[]>(),
  recommendedAiModel: text("recommended_ai_model"),
  organizedAt: ts("organized_at"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

// spec §17.5 — uploaded files (録音音声 MP3 / 議事録 / 資料 等)
export const files = pgTable("files", {
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
  createdAt: ts("created_at").defaultNow().notNull(),
});

// スコープ・WBS（開発形態に応じた内容）— append version, plan as json
export const scopePlans = pgTable("scope_plans", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  developmentForm: text("development_form"),
  plan: jsonb("plan").$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
});

// 提案スライド（編集済みデック）— append version, slides as json
export const decks = pgTable("decks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  slides: jsonb("slides").$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
});

// 要件定義書の品質レビュー（文書内）— append version, report as json
export const qualityReports = pgTable("quality_reports", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  report: jsonb("report").$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
});

// AI整合性レビュー（成果物横断）— append version, report as json
export const consistencyReports = pgTable("consistency_reports", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  report: jsonb("report").$type<unknown>(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
});

// spec §17.16 — review comments (ピアレビューのコメント)
export const comments = pgTable("comments", {
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
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

// spec §17.17 — approvals (承認・差し戻し)
export const approvals = pgTable("approvals", {
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
  approvedAt: ts("approved_at"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
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
  contentJson: jsonb("content_json").$type<
    { key: string; heading: string; markdown: string }[]
  >(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id),
  projectId: text("project_id").references(() => projects.id),
  userId: text("user_id").references(() => profiles.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata"),
  createdAt: ts("created_at").defaultNow().notNull(),
});

// ---------- estimates (spec §17.7 / §17.8) ----------

export const estimates = pgTable("estimates", {
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
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const estimateItems = pgTable("estimate_items", {
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
  createdAt: ts("created_at").defaultNow().notNull(),
});

// ---------- schedules (spec §17.10 / §17.11 / §17.12) ----------

export const schedules = pgTable("schedules", {
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
  nonWorkingPeriods: jsonb("non_working_periods").$type<
    { name: string; start: string; end: string }[]
  >(),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const scheduleTasks = pgTable("schedule_tasks", {
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
  dependencyTaskKeys: jsonb("dependency_task_keys").$type<string[]>(),
  taskKey: text("task_key"),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  isClientVisible: boolean("is_client_visible").default(true),
  isCriticalPath: boolean("is_critical_path").default(false),
  needsClientReview: boolean("needs_client_review").default(false),
  risk: text("risk"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const milestones = pgTable("milestones", {
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
  isClientVisible: boolean("is_client_visible").default(true),
  createdAt: ts("created_at").defaultNow().notNull(),
});

// ---------- screen design (spec §13 / §17.13 / §17.14) ----------

export const screenDesigns = pgTable("screen_designs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  version: integer("version").notNull().default(1),
  // Architecture diagram model (tiered layers + edges) and the Claude Design prompt.
  architecture: jsonb("architecture").$type<{
    layers: { name: string; components: { name: string; note?: string }[] }[];
    edges: { from: string; to: string; label?: string }[];
  }>(),
  designPrompt: text("design_prompt"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const screens = pgTable("screens", {
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
  uiElements: jsonb("ui_elements").$type<string[]>(),
  states: jsonb("states").$type<string[]>(),
  // Low-fi wireframe: an ordered list of main-content UI blocks.
  wireframe: jsonb("wireframe").$type<{ kind: string; label?: string }[]>(),
  priority: text("priority"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const screenTransitions = pgTable("screen_transitions", {
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
  createdAt: ts("created_at").defaultNow().notNull(),
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
