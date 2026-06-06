import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { migrationDbUrl } from "./env";
import { ROLES } from "../types/domain";

/**
 * Seeds a single organization (aidealab.com), one user per role, and a sample
 * project with a realistic Japanese hearing, so the dashboard and generation
 * flow have data to work with on first run. Idempotent: clears tables first.
 */
async function main() {
  const url = migrationDbUrl();
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL (or the Vercel/Supabase POSTGRES_URL_NON_POOLING / POSTGRES_URL) before seeding.",
    );
  }
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  // Clear (order respects FKs)
  await db.delete(schema.comments);
  await db.delete(schema.approvals);
  await db.delete(schema.files);
  await db.delete(schema.documents);
  await db.delete(schema.hearings);
  await db.delete(schema.auditLogs);
  await db.delete(schema.projects);
  await db.delete(schema.profiles);
  await db.delete(schema.organizations);

  const orgId = "00000000-0000-4000-8000-000000000001";
  await db.insert(schema.organizations).values({
    id: orgId,
    name: "AIdeaLab",
    emailDomain: "aidealab.com",
  });

  const NAMES: Record<string, string> = {
    admin: "立入",
    manager: "田中 花子",
    sales: "佐藤 健",
    pm: "鈴木 一郎",
    engineer: "高橋 修",
    designer: "伊藤 彩",
    viewer: "渡辺 学",
  };
  // Per-role login email. Defaults to `${role}@aidealab.com`; override here for
  // real accounts.
  const EMAILS: Partial<Record<string, string>> = {
    admin: "tachiiri@aidealab.com",
  };
  const emailFor = (role: string) => EMAILS[role] ?? `${role}@aidealab.com`;
  const userIds: Record<string, string> = {};
  let i = 1;
  for (const role of ROLES) {
    const id = `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
    userIds[role] = id;
    await db.insert(schema.profiles).values({
      id,
      organizationId: orgId,
      email: emailFor(role),
      name: NAMES[role] ?? role,
      role,
    });
    i++;
  }

  const projectId = "00000000-0000-4000-8000-000000000201";
  await db.insert(schema.projects).values({
    id: projectId,
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
      {
        date: "2026-05-26",
        name: "製品マニュアル一式（Driveフォルダ）",
        url: "https://drive.google.com/drive/sample-manuals",
      },
    ],
    referenceLinks: [
      {
        title: "競合: Zendesk AI エージェント",
        url: "https://www.zendesk.co.jp/service/ai/",
        note: "先方が既存利用中のチケット管理。AI回答機能あり。差別化ポイントを整理する。",
      },
      {
        title: "参考事例: 製造業の問い合わせ自動化",
        url: "https://www.notion.so/sample-case-study",
        note: "社内ナレッジ根拠の一次回答ドラフト生成の類似事例。",
      },
    ],
    note: "初回商談済み。社内ナレッジを使った問い合わせ自動応答を希望。",
    ownerId: userIds["sales"],
    createdBy: userIds["sales"],
  });

  await db.insert(schema.hearings).values({
    id: "00000000-0000-4000-8000-000000000301",
    organizationId: orgId,
    projectId,
    sourceType: "text",
    meetingDate: "2026-06-02",
    meetingTime: "14:00",
    meetingFormat: "online",
    clientParticipants: "情報システム部 田中様、カスタマーサポート部 佐藤様",
    rawText:
      "カスタマーサポート部（オペレーター12名、シフト制）で、製品の使い方や保証に関する問い合わせを月に約3,000件受けている。" +
      "チャネルはメールが約6割、電話が約3割、Webチャットが約1割。問い合わせの約半数は社内マニュアルやFAQを見れば回答できる定型的な内容で、" +
      "ベテランと新人で回答品質・スピードに差が出ている。現在は Zendesk でチケット管理しているが、FAQ・製品マニュアルは部署フォルダ内の PDF と Excel に散在しており横断検索ができない。" +
      "繁忙期は一次回答までに平均6時間ほどかかっており、半分以下に短縮したい。まずはメール・チャットの一次回答ドラフトをAIが自動生成し、" +
      "オペレーターが確認・送信する運用を想定。回答は必ず社内ドキュメントを根拠に提示してほしい（誤回答・ハルシネーションは避けたい）。" +
      "顧客の氏名・注文番号など個人情報を含む問い合わせがあるためセキュリティは重視。クラウド利用は情報システム部の承認が必要で、データの国内保管が条件になりそう。" +
      "予算は700万〜1,200万円、今期中（10月末）にまず1チームで試験導入し、効果を見て全社展開したい。提案は6月20日まで。" +
      "将来的には電話の音声文字起こしからの自動応答や、英語・中国語の多言語対応も視野に入れている。先方の窓口は情報システム部の田中様。",
    createdBy: userIds["sales"],
  });

  // --- demo peer review: comments + approvals ---
  await db.insert(schema.comments).values([
    {
      id: "00000000-0000-4000-8000-000000000401",
      organizationId: orgId,
      projectId,
      targetType: "project",
      commenterId: userIds["engineer"],
      commentType: "tech_note",
      body: "AIモデルは Claude Sonnet ＋ 日本語埋め込みで妥当。RAGの根拠提示を必須要件に明記済み。データは学習不可・国内保管で要件化したい。",
      status: "open",
      createdAt: "2026-06-03T10:12:00.000Z",
      updatedAt: "2026-06-03T10:12:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000402",
      organizationId: orgId,
      projectId,
      targetType: "project",
      commenterId: userIds["designer"],
      commentType: "change_request",
      body: "ダッシュボードのKPIは初期表示で「対応件数推移」を優先したい。オペレーター画面は1次回答ドラフトの編集導線をもう一段わかりやすく。",
      status: "open",
      createdAt: "2026-06-03T11:30:00.000Z",
      updatedAt: "2026-06-03T11:30:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000403",
      organizationId: orgId,
      projectId,
      targetType: "project",
      commenterId: userIds["sales"],
      commentType: "client_confirm",
      body: "クラウド利用の社内承認とデータ国内保管の可否を、次回までに田中様へ確認。",
      status: "open",
      createdAt: "2026-06-03T13:05:00.000Z",
      updatedAt: "2026-06-03T13:05:00.000Z",
    },
  ]);
  await db.insert(schema.approvals).values([
    {
      id: "00000000-0000-4000-8000-000000000411",
      organizationId: orgId,
      projectId,
      targetType: "project",
      approverId: userIds["manager"],
      status: "approved",
      comment:
        "提案方針・体制・見積ともに問題なし。予算感とも整合。技術指摘の反映を前提にクライアント提出を承認します。",
      approvedAt: "2026-06-04T09:00:00.000Z",
      createdAt: "2026-06-04T09:00:00.000Z",
      updatedAt: "2026-06-04T09:00:00.000Z",
    },
  ]);

  console.log("✓ seeded org + 7 users + 1 sample project + review");
  console.log("  login with any of:");
  for (const role of ROLES) console.log(`    ${role}@aidealab.com  (${role})`);
  await client.end();
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
