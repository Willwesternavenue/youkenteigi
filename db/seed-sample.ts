import { and, eq } from "drizzle-orm";
import { database } from "./client";
import * as schema from "./schema";
import { db, type ScheduleInput } from "../lib/db";
import { MockProvider } from "../lib/ai/mock-provider";
import { computeSchedule } from "../lib/schedule-calc";
import { buildNonWorking, type NonWorkingPeriod } from "../lib/holidays";
import { DEFAULT_TAX_RATE } from "../lib/ai/prompts";
import type {
  GenerationContext,
  GeneratedSchedule,
  ProjectSummary,
} from "../lib/ai/providers";
import type { ProjectRow } from "./schema";

/**
 * Idempotent SAMPLE project seeder — SAFE to run against production.
 *
 * Unlike db/seed.ts (which wipes EVERY table), this only ever touches the single
 * fixed showcase project (SAMPLE_PROJECT_ID). It rebuilds that one project and
 * ALL of its artifacts — hearing → AI整理 → RFP → 要件定義書 → スコープ/WBS →
 * 画面設計 → 見積 → スケジュール — deterministically via the **Mock provider**
 * (zero API tokens), so the team can see a fully-populated example end to end.
 *
 * The project is flagged `is_sample = true`, which the UI renders as a read-only
 * 「サンプル」badge. Re-run any time to regenerate: `npm run db:seed-sample`.
 *
 * Org/owner are looked up (never assumed) so it works the same locally and in
 * prod. Run it pointing DATABASE_URL at the target DB.
 */

const SAMPLE_PROJECT_ID = "00000000-0000-4000-8000-000000000999";

// Mirrors lib/ai/context.ts → summary(): the fields the Mock provider reads.
function summary(p: ProjectRow): ProjectSummary {
  return {
    projectName: p.projectName,
    clientName: p.clientName,
    industry: p.industry,
    budgetMin: p.budgetMin,
    budgetMax: p.budgetMax,
    expectedDeliveryDate: p.expectedDeliveryDate,
    developmentForm: p.developmentForm,
    projectStage: p.projectStage,
    description: p.description,
    note: p.note,
  };
}

// Mirrors app/_actions/schedules.ts → toScheduleInput().
function toScheduleInput(
  gen: GeneratedSchedule,
  userId: string,
  periods: NonWorkingPeriod[] = [],
): ScheduleInput {
  const holidays = buildNonWorking(gen.startDate, 2, periods).set;
  const computed = computeSchedule(
    gen.tasks.map((t) => ({
      taskKey: t.taskKey,
      taskName: t.taskName,
      phase: t.phase,
      durationDays: Math.max(1, Math.round(t.durationDays)),
      assigneeRole: t.assigneeRole,
      dependencies: t.dependencies,
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    gen.startDate,
    holidays,
  );
  const endByKey = new Map(computed.tasks.map((t) => [t.taskKey, t.endDate]));
  return {
    scheduleName: gen.scheduleName,
    startDate: computed.projectStart,
    endDate: computed.projectEnd,
    nonWorkingPeriods: periods,
    tasks: computed.tasks.map((t) => ({
      taskKey: t.taskKey,
      taskName: t.taskName,
      phase: t.phase,
      startDate: t.startDate,
      endDate: t.endDate,
      durationDays: t.durationDays,
      assigneeRole: t.assigneeRole,
      dependencyTaskKeys: t.dependencies,
      isCriticalPath: t.isCriticalPath,
      needsClientReview: t.needsClientReview,
      risk: t.risk,
    })),
    milestones: gen.milestones.map((m) => ({
      title: m.title,
      milestoneDate:
        (m.afterTaskKey && endByKey.get(m.afterTaskKey)) || computed.projectEnd,
      milestoneType: m.type,
      isClientVisible: m.isClientVisible ?? true,
    })),
    createdBy: userId,
  };
}

/** Delete only this sample project's rows (FK-safe order). Scoped — never global. */
async function clearSample(orgId: string) {
  const pid = SAMPLE_PROJECT_ID;
  const byProject = [
    schema.estimateItems,
    schema.estimates,
    schema.scheduleTasks,
    schema.milestones,
    schema.schedules,
    schema.screenTransitions,
    schema.screens,
    schema.screenDesigns,
    schema.documents,
    schema.scopePlans,
    schema.decks,
    schema.qualityReports,
    schema.consistencyReports,
    schema.comments,
    schema.approvals,
    schema.files,
    schema.hearings,
  ] as const;
  for (const table of byProject) {
    await database.delete(table).where(eq(table.projectId, pid));
  }
  await database
    .delete(schema.projects)
    .where(and(eq(schema.projects.organizationId, orgId), eq(schema.projects.id, pid)));
}

const RAW_TEXT =
  "カスタマーサポート部（オペレーター12名、シフト制）で、製品の使い方や保証に関する問い合わせを月に約3,000件受けている。" +
  "チャネルはメールが約6割、電話が約3割、Webチャットが約1割。問い合わせの約半数は社内マニュアルやFAQを見れば回答できる定型的な内容で、" +
  "ベテランと新人で回答品質・スピードに差が出ている。現在は Zendesk でチケット管理しているが、FAQ・製品マニュアルは部署フォルダ内の PDF と Excel に散在しており横断検索ができない。" +
  "繁忙期は一次回答までに平均6時間ほどかかっており、半分以下に短縮したい。まずはメール・チャットの一次回答ドラフトをAIが自動生成し、" +
  "オペレーターが確認・送信する運用を想定。回答は必ず社内ドキュメントを根拠に提示してほしい（誤回答・ハルシネーションは避けたい）。" +
  "顧客の氏名・注文番号など個人情報を含む問い合わせがあるためセキュリティは重視。クラウド利用は情報システム部の承認が必要で、データの国内保管が条件になりそう。" +
  "予算は700万〜1,200万円、今期中（10月末）にまず1チームで試験導入し、効果を見て全社展開したい。提案は6月20日まで。" +
  "将来的には電話の音声文字起こしからの自動応答や、英語・中国語の多言語対応も視野に入れている。先方の窓口は情報システム部の田中様。";

async function main() {
  // 1. Resolve org + owner (looked up — works locally and in prod alike).
  const org =
    (await database.query.organizations.findFirst({
      where: eq(schema.organizations.emailDomain, "aidealab.com"),
    })) ?? (await database.query.organizations.findFirst());
  if (!org) {
    throw new Error(
      "組織が見つかりません。先に `npm run db:seed`（初期データ投入）を実行してください。",
    );
  }
  const orgId = org.id;

  const owner =
    (await database.query.profiles.findFirst({
      where: and(
        eq(schema.profiles.organizationId, orgId),
        eq(schema.profiles.email, "tachiiri@aidealab.com"),
      ),
    })) ??
    (await database.query.profiles.findFirst({
      where: eq(schema.profiles.organizationId, orgId),
    }));
  if (!owner) {
    throw new Error("ユーザー(profiles)が見つかりません。先に招待/シードしてください。");
  }
  const userId = owner.id;

  // 2. Wipe ONLY this sample project (idempotent; scoped to SAMPLE_PROJECT_ID).
  await clearSample(orgId);

  // 3. Project row — fixed id + is_sample badge.
  await database.insert(schema.projects).values({
    id: SAMPLE_PROJECT_ID,
    organizationId: orgId,
    clientName: "株式会社サンプル製作所",
    clientDomain: "sample-mfg.co.jp",
    projectName: "問い合わせ対応AIアシスタント導入",
    industry: "製造業",
    department: "カスタマーサポート部",
    clientContact: "情報システム部 田中様",
    salesOwner: "佐藤 健",
    pmOwner: "鈴木 一郎",
    projectLead: "田中 花子",
    status: "draft",
    budgetMin: 7_000_000,
    budgetMax: 12_000_000,
    monthlyRate: 1_500_000,
    contractMonths: 6,
    expectedStartDate: "2026-07-01",
    expectedDeliveryDate: "2026-10-31",
    proposalDueDate: "2026-06-20",
    developmentForm: "quasi_mandate",
    projectStage: "mvp",
    description:
      "社内FAQ・製品マニュアルを根拠に、メール・チャットの問い合わせ一次回答ドラフトをAIが自動生成し、オペレーターが確認・編集して送信できる管理画面付きWebアプリ。まず1チームで試験導入し、効果を見て全社展開する。",
    links: [
      { label: "Canva 提案資料", url: "https://www.canva.com/design/sample-proposal" },
    ],
    meetingNotes: [
      {
        date: "2026-06-02",
        title: "キックオフ／初回ヒアリング",
        url: "https://www.notion.so/sample-kickoff-notes",
      },
      {
        date: "2026-05-26",
        title: "事前商談（課題ヒアリング）",
        url: "https://www.notion.so/sample-pre-sales-notes",
      },
    ],
    receivedMaterials: [
      {
        date: "2026-06-02",
        name: "RFP原本.pdf",
        url: "https://drive.google.com/file/sample-rfp",
      },
      {
        date: "2026-06-02",
        name: "現状の問い合わせ業務フロー.xlsx",
        url: "https://drive.google.com/file/sample-flow",
      },
    ],
    referenceLinks: [
      {
        title: "競合: Zendesk AI エージェント",
        url: "https://www.zendesk.co.jp/service/ai/",
        note: "先方が既存利用中のチケット管理。AI回答機能あり。差別化ポイントを整理する。",
      },
    ],
    note: "【サンプル案件】全機能のイメージ共有用。db:seed-sample でいつでも再生成できます。",
    isSample: true,
    ownerId: userId,
    createdBy: userId,
  });

  // 4. Hearing.
  await db.hearings.upsert(
    orgId,
    SAMPLE_PROJECT_ID,
    {
      rawText: RAW_TEXT,
      meetingDate: "2026-06-02",
      meetingTime: "14:00",
      meetingFormat: "online",
      clientParticipants: "情報システム部 田中様、カスタマーサポート部 佐藤様",
      ourParticipants: "営業 佐藤 健、PM 鈴木 一郎",
      sourceType: "text",
    },
    userId,
  );

  const projectRow = (await db.projects.getById(orgId, SAMPLE_PROJECT_ID))!;
  const mock = new MockProvider();

  // 5. AI整理（Mock）.
  const organized = await mock.generateHearingSummary({
    project: summary(projectRow),
    rawText: RAW_TEXT,
  });
  await db.hearings.saveOrganized(orgId, SAMPLE_PROJECT_ID, organized);
  await db.projects.setRecommendations(orgId, SAMPLE_PROJECT_ID, {
    recommendedPhase: organized.recommendedPhase,
    recommendedPlatform: organized.recommendedPlatform,
    recommendedDeployment: organized.recommendedDeployment,
  });

  // 6. Screen design first, so it can ground the requirements doc.
  const design = await mock.generateScreenDesign({
    project: summary(projectRow),
    hearingText: RAW_TEXT,
    organized,
    design: null,
    templates: {},
    references: [],
  });
  await db.screenDesign.saveVersion(orgId, SAMPLE_PROJECT_ID, design, userId);

  const ctx: GenerationContext = {
    project: summary(projectRow),
    hearingText: RAW_TEXT,
    organized,
    design,
    templates: {},
    references: [],
  };

  // 7. RFP + 要件定義書.
  const rfp = await mock.generateRfp(ctx);
  await db.documents.saveVersion(orgId, SAMPLE_PROJECT_ID, "rfp", {
    title: rfp.title,
    sections: rfp.sections,
    createdBy: userId,
  });
  const req = await mock.generateRequirements(ctx);
  await db.documents.saveVersion(orgId, SAMPLE_PROJECT_ID, "requirements", {
    title: req.title,
    sections: req.sections,
    createdBy: userId,
  });

  // 8. スコープ/WBS.
  const scope = await mock.generateScopeWbs(ctx);
  await db.scope.saveVersion(
    orgId,
    SAMPLE_PROJECT_ID,
    scope,
    projectRow.developmentForm ?? null,
    userId,
  );

  // 9. 見積（レートカードがあれば反映）.
  const est = await mock.generateEstimate(ctx);
  const rateByRole = await db.rateCards.effectiveByRole(orgId);
  await db.estimates.saveVersion(orgId, SAMPLE_PROJECT_ID, {
    estimateName: est.estimateName,
    defaultUnitPrice: est.defaultUnitPrice,
    bufferRate: est.bufferRate,
    taxRate: DEFAULT_TAX_RATE,
    items: est.lines.map((l) => ({
      category: l.category,
      subCategory: l.subCategory,
      role: l.role,
      taskName: l.taskName,
      approach: l.approach,
      purpose: l.purpose,
      hoursDesign: l.design,
      hoursImpl: l.implementation,
      hoursTest: l.test,
      hoursCoord: l.coordination,
      hoursMgmt: l.management,
      unitPrice: (l.role && rateByRole[l.role]) || est.defaultUnitPrice,
    })),
    createdBy: userId,
  });

  // 10. スケジュール.
  const sch = await mock.generateSchedule(ctx);
  await db.schedules.saveVersion(
    orgId,
    SAMPLE_PROJECT_ID,
    toScheduleInput(sch, userId),
  );

  console.log("✓ サンプル案件を再生成しました");
  console.log(`  project_id: ${SAMPLE_PROJECT_ID}`);
  console.log(`  org: ${org.name} (${orgId})`);
  console.log("  artifacts: hearing / organize / rfp / requirements / scope / design / estimate / schedule");
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-sample failed:", err);
  process.exit(1);
});
