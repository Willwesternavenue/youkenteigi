import type {
  RecommendedDeployment,
  RecommendedPhase,
  RecommendedPlatform,
  DocumentType,
} from "@/types/domain";
import { MockProvider } from "./mock-provider";
import { ClaudeProvider } from "./claude-provider";

/**
 * AI provider abstraction (spec §8.1).
 *
 * The app never branches on which model is used. `getProvider()` returns a
 * MockProvider by default (deterministic, zero API key) or a ClaudeProvider
 * when AI_PROVIDER=claude and ANTHROPIC_API_KEY is set. Both produce the same
 * validated shapes, so the UI and persistence layers are identical either way.
 */

export interface ProjectSummary {
  projectName: string;
  clientName: string;
  industry?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  expectedDeliveryDate?: string | null;
  developmentForm?: string | null; // contract type key (準委任 etc.)
  projectStage?: string | null; // poc / mvp / full_dev …
  description?: string | null; // what we're building
  note?: string | null;
}

export interface HearingContext {
  project: ProjectSummary;
  rawText: string;
}

export interface OrganizedHearing {
  summary: string;
  confirmedFacts: string[];
  assumptions: string[]; // each explicitly an assumption, never asserted as fact
  openQuestions: { category: string; question: string }[];
  recommendedPhase: RecommendedPhase;
  recommendedPlatform: RecommendedPlatform;
  recommendedDeployment: RecommendedDeployment;
  risks: { type: "technical" | "budget" | "schedule"; description: string }[];
  recommendedAiModel?: string;
}

export type OpenQuestionSet = { category: string; questions: string[] }[];

export interface DocSection {
  key: string;
  heading: string;
  markdown: string;
}

export interface GeneratedDoc {
  title: string;
  sections: DocSection[];
}

export interface GenerationContext {
  project: ProjectSummary;
  hearingText: string;
  organized?: OrganizedHearing | null;
  design?: GeneratedDesign | null; // current screen design (for cross-consistency)
  // Org default templates (標準文言/章立て) to use as a base, by document type.
  templates?: { rfp?: string; requirements?: string };
}

// ---------- estimate ----------

export interface EstimateLine {
  category: string; // 大項目 (grouping)
  subCategory?: string; // 中項目
  taskName: string; // 小項目
  approach?: string; // 実装方針
  purpose?: string; // 開発目的
  role?: string;
  // effort in HOURS (8h = 1 person-day)
  design: number;
  implementation: number;
  test: number;
  coordination: number;
  management: number;
}

export interface GeneratedEstimate {
  estimateName: string;
  defaultUnitPrice: number;
  bufferRate: number;
  lines: EstimateLine[];
}

// ---------- schedule ----------

export interface ScheduleTaskGen {
  taskKey: string;
  taskName: string;
  phase: string;
  durationDays: number;
  assigneeRole: string;
  dependencies: string[]; // taskKeys of predecessor tasks
  needsClientReview?: boolean;
  risk?: string;
}

export interface MilestoneGen {
  title: string;
  afterTaskKey?: string; // milestone placed at the end of this task
  type?: string;
  isClientVisible?: boolean;
}

export interface GeneratedSchedule {
  scheduleName: string;
  startDate: string; // ISO yyyy-mm-dd
  tasks: ScheduleTaskGen[];
  milestones: MilestoneGen[];
}

// ---------- screen design ----------

export type WireframeKind =
  | "kpi"
  | "toolbar"
  | "search"
  | "table"
  | "cards"
  | "form"
  | "detail"
  | "chart"
  | "list"
  | "buttons"
  | "upload"
  | "auth"
  | "text";

export interface WireframeBlock {
  kind: WireframeKind;
  label?: string;
}

export interface GeneratedScreen {
  key: string;
  name: string;
  role?: string;
  purpose: string;
  uiElements: string[];
  states?: string[];
  priority?: string;
  /** Low-fi wireframe: ordered main-content blocks for a mockup preview. */
  wireframe?: WireframeBlock[];
}

export interface GeneratedTransition {
  from: string; // screen key
  to: string; // screen key
  trigger: string;
  description?: string;
}

export interface ArchLayer {
  name: string;
  components: { name: string; note?: string }[];
}

export interface ArchEdge {
  from: string; // component name
  to: string; // component name
  label?: string;
}

export interface GeneratedArchitecture {
  layers: ArchLayer[];
  edges: ArchEdge[];
}

export interface GeneratedDesign {
  screens: GeneratedScreen[];
  transitions: GeneratedTransition[];
  architecture: GeneratedArchitecture;
  designPrompt: string; // Claude Design 向けプロンプト
}

// ---------- scope & WBS (engagement-type aware) ----------

export interface WbsTask {
  name: string;
  deliverable?: string; // 成果物
  role?: string; // 主担当
  weeks?: number; // 目安期間（週）
}
export interface WbsPhase {
  name: string;
  objective?: string;
  tasks: WbsTask[];
}
export interface ScopeWbsPlan {
  formLabel: string; // 開発形態のラベル（準委任 / コンサル / 請負）
  approach: string; // 進め方の要約（案件種別に応じて変える）
  inScope: string[]; // 対象範囲
  outOfScope: string[]; // 対象外
  assumptions: string[]; // 前提・制約
  deliverables: { name: string; description: string }[];
  wbs: WbsPhase[];
}

// ---------- consistency review (cross-artifact) ----------

export interface ConsistencyInput {
  project: {
    projectName: string;
    clientName: string;
    budgetMin?: number | null;
    budgetMax?: number | null;
    expectedDeliveryDate?: string | null;
    proposalDueDate?: string | null;
    developmentForm?: string | null;
    projectStage?: string | null;
    monthlyRate?: number | null;
    contractMonths?: number | null;
    description?: string | null;
  };
  openQuestions: { category: string; question: string }[];
  requirements: { key: string; heading: string; markdown: string }[] | null;
  screens: { key: string; name: string }[] | null;
  transitions: { from: string; to: string; trigger: string }[] | null;
  estimate: {
    total: number;
    personDays: number;
    categories: { key: string; amount: number }[];
  } | null;
  schedule: { start: string; end: string; businessDays: number } | null;
  scope: ScopeWbsPlan | null;
}

export interface ConsistencyFinding {
  severity: "high" | "medium" | "low";
  area: string; // e.g. "見積 × 予算"
  title: string;
  detail: string;
  suggestion?: string;
  resolved?: boolean; // 対応済みマーク（人が手動で設定）
}

export interface ConsistencyReport {
  summary: string;
  okPoints: string[];
  findings: ConsistencyFinding[];
}

// ---------- requirements document quality review (doc-internal) ----------

export type QualityCategory =
  | "ambiguity" // あいまいさ
  | "contradiction" // 矛盾
  | "omission" // 抜け漏れ
  | "consideration" // 考慮漏れ
  | "proofreading"; // 校正・読みやすさ

export interface QualityFinding {
  category: QualityCategory;
  severity: "high" | "medium" | "low";
  section?: string; // 該当セクション見出し
  quote?: string; // 問題箇所の引用
  issue: string; // 何が問題か
  suggestion: string; // 改善案
  resolved?: boolean; // 対応済みマーク
}

export interface QualityInput {
  sections: { key: string; heading: string; markdown: string }[];
}

export interface QualityReport {
  summary: string;
  score: number; // 0-100 の完成度目安
  findings: QualityFinding[];
}

export interface AIProvider {
  readonly name: string;
  generateHearingSummary(ctx: HearingContext): Promise<OrganizedHearing>;
  generateOpenQuestions(ctx: HearingContext): Promise<OpenQuestionSet>;
  generateRfp(ctx: GenerationContext): Promise<GeneratedDoc>;
  generateRequirements(ctx: GenerationContext): Promise<GeneratedDoc>;
  regenerateSection(
    docType: DocumentType,
    sectionKey: string,
    ctx: GenerationContext,
    instruction?: string,
  ): Promise<DocSection>;
  generateEstimate(ctx: GenerationContext): Promise<GeneratedEstimate>;
  adjustEstimate(
    ctx: GenerationContext,
    current: GeneratedEstimate,
    instruction: string,
  ): Promise<GeneratedEstimate>;
  generateSchedule(ctx: GenerationContext): Promise<GeneratedSchedule>;
  adjustSchedule(
    ctx: GenerationContext,
    current: GeneratedSchedule,
    instruction: string,
  ): Promise<GeneratedSchedule>;
  generateScreenDesign(ctx: GenerationContext): Promise<GeneratedDesign>;
  adjustScreenDesign(
    ctx: GenerationContext,
    current: GeneratedDesign,
    instruction: string,
  ): Promise<GeneratedDesign>;
  generateScopeWbs(ctx: GenerationContext): Promise<ScopeWbsPlan>;
  reviewConsistency(input: ConsistencyInput): Promise<ConsistencyReport>;
  /** Review the requirements document text itself for ambiguity/contradiction/omission/etc. */
  reviewRequirementsQuality(input: QualityInput): Promise<QualityReport>;
  /** Fill a proposal slide's bullets from its title/topic, grounded in context. */
  generateSlideBullets(
    ctx: GenerationContext,
    topic: string,
  ): Promise<string[]>;
}

let cached: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cached) return cached;
  const useClaude =
    process.env.AI_PROVIDER === "claude" && !!process.env.ANTHROPIC_API_KEY;
  // The Claude provider only constructs the SDK client lazily (in its methods),
  // so importing the class is cheap even when running with the mock.
  cached = useClaude ? new ClaudeProvider() : new MockProvider();
  return cached;
}

export function providerName(): string {
  return process.env.AI_PROVIDER === "claude" && process.env.ANTHROPIC_API_KEY
    ? "Claude Sonnet"
    : "Mock (ローカル)";
}
