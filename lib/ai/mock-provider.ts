import type { DocumentType } from "@/types/domain";
import type {
  AIProvider,
  DocSection,
  GeneratedDesign,
  GeneratedDoc,
  GeneratedEstimate,
  GeneratedSchedule,
  GenerationContext,
  HearingContext,
  OpenQuestionSet,
  OrganizedHearing,
  ProjectSummary,
  ScopeWbsPlan,
  ConsistencyInput,
  ConsistencyReport,
  ConsistencyFinding,
  QualityInput,
  QualityReport,
  QualityFinding,
} from "./providers";
import {
  docTitle,
  sectionsFor,
  DEFAULT_UNIT_PRICE,
  DEFAULT_BUFFER_RATE,
  DEFAULT_TAX_RATE,
  HOURS_PER_DAY,
  type SectionDef,
} from "./prompts";
import { DEVELOPMENT_FORM_LABELS, type DevelopmentForm } from "@/types/domain";

/** Parse a yen target like "700万円", "1,200万", "3000000円" from free text. */
function parseYen(text: string): number | null {
  const man = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*万/);
  if (man) return Math.round(parseFloat(man[1].replace(/,/g, "")) * 10000);
  const yen = text.match(/([0-9,]+)\s*円/);
  if (yen) return parseInt(yen[1].replace(/,/g, ""), 10);
  return null;
}

function parseWeeks(text: string): number | null {
  const w = text.match(/([0-9]+)\s*週/);
  return w ? parseInt(w[1], 10) : null;
}

/**
 * Deterministic, key-free provider. Produces realistic structured Japanese
 * content derived from the project + hearing input so the entire flow is
 * testable offline. Same output shapes as ClaudeProvider.
 */

function sentences(text: string): string[] {
  return text
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
}

function pickPhase(p: ProjectSummary): OrganizedHearing["recommendedPhase"] {
  const max = p.budgetMax ?? p.budgetMin ?? 0;
  if (max && max <= 5_000_000) return "requirements_consult";
  if (max && max <= 7_000_000) return "poc";
  if (max && max <= 15_000_000) return "mvp";
  if (max && max <= 30_000_000) return "full_dev";
  if (max) return "enterprise";
  return "mvp";
}

const QUESTION_CATEGORIES = [
  "事業目的",
  "利用者",
  "対象業務",
  "データ",
  "AIモデル",
  "セキュリティ",
  "クラウド利用可否",
  "開発形態",
  "予算",
  "納期",
];

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateHearingSummary(
    ctx: HearingContext,
  ): Promise<OrganizedHearing> {
    const s = sentences(ctx.rawText);
    const facts = s.slice(0, Math.min(4, s.length));
    const summary =
      s.length > 0
        ? `${ctx.project.clientName}様の案件「${ctx.project.projectName}」について、ヒアリング内容を整理しました。${facts[0] ?? ""}`
        : `${ctx.project.projectName} に関するヒアリングはまだ入力されていません。`;

    return {
      summary,
      confirmedFacts:
        facts.length > 0
          ? facts
          : ["ヒアリング本文から確認できる確定事項はまだありません。"],
      assumptions: [
        "（推測）既存システムからの段階的な移行が前提と思われる。",
        "（推測）社内ユーザーがまず利用し、その後対象を拡大する想定。",
      ],
      openQuestions: QUESTION_CATEGORIES.slice(0, 6).map((category) => ({
        category,
        question: `${category}について、現時点で確定している前提を確認したい。`,
      })),
      recommendedPhase: pickPhase(ctx.project),
      recommendedPlatform: "web",
      recommendedDeployment: "cloud",
      risks: [
        {
          type: "budget",
          description: "スコープが広がると想定予算を超過する可能性がある。",
        },
        {
          type: "schedule",
          description: "クライアント確認の往復回数次第で納期に影響が出る。",
        },
      ],
      recommendedAiModel: "Claude Sonnet",
    };
  }

  async generateOpenQuestions(
    ctx: HearingContext,
  ): Promise<OpenQuestionSet> {
    return QUESTION_CATEGORIES.map((category) => ({
      category,
      questions: [
        `${category}に関する現状の前提を教えてください。`,
        `${category}について、制約や要望はありますか?`,
      ],
    }));
  }

  private sectionMarkdown(
    def: SectionDef,
    ctx: GenerationContext,
    idx: number,
  ): string {
    const p = ctx.project;
    const o = ctx.organized;
    const facts = o?.confirmedFacts ?? [];
    const assume = o?.assumptions ?? [];
    const qs = o?.openQuestions ?? [];
    const risks = o?.risks ?? [];
    const yen = (v?: number | null) =>
      v ? `${Math.round(v / 10000).toLocaleString()}万円` : null;
    const budget =
      p.budgetMin && p.budgetMax
        ? `${yen(p.budgetMin)}〜${yen(p.budgetMax)}`
        : yen(p.budgetMax) ?? "別途協議";
    // rotate facts so sections don't all repeat the same items
    const rot = <T,>(arr: T[], n: number): T[] =>
      arr.length ? arr.map((_, i) => arr[(i + idx) % arr.length]).slice(0, n) : [];
    const bullets = (arr: string[]) => arr.map((b) => `- ${b}`);

    const lead: Record<string, string> = {
      overview: `${p.clientName}における「${p.projectName}」の全体像を整理する。`,
      background: `本プロジェクトに至った背景・経緯を整理する。`,
      issues: `現状の主要な課題は以下のとおり。`,
      objectives: `本プロジェクトで達成する目的を定義する。`,
      target_work: `対象となる業務範囲は以下のとおり。`,
      background_purpose: `${p.clientName}が本件を検討する背景と目的を整理する。`,
      success_metrics: `導入効果を測る成功指標（KPI）を定義する。`,
      target_users: `主な対象ユーザーと利用部門を整理する。`,
      use_scenes: `想定される主要な利用シーンは以下のとおり。`,
      business_flow: `現状業務とAI導入後の業務フローを整理する。`,
      system_overview: `システム全体の構成イメージを示す（詳細は「画面設計」タブのシステム構成図を参照）。`,
      feature_list: `想定される機能を一覧化する。`,
      must_option: `機能を必須(Must)とオプション(Could)に切り分ける。`,
      functional: `想定される機能要件は以下のとおり。`,
      nonfunctional: `性能・可用性・運用に関わる非機能要件を定義する。`,
      ai: `AI活用方針・適用範囲・前提条件を整理する。`,
      ai_model: `本システムで採用するAIモデルを用途別に選定する。`,
      data: `取り扱うデータと連携データの要件を整理する。`,
      integration: `外部システムとの連携要件を整理する。`,
      permission: `ロール別の権限要件を定義する。`,
      security: `セキュリティ・コンプライアンス要件を定義する。`,
      log_audit: `ログ取得・監査要件を定義する。`,
      operation: `運用フェーズの要件を整理する。`,
      maintenance: `保守範囲とSLAの方針を整理する。`,
      dev_form: `推奨する開発形態を提案する。`,
      deployment: `推奨する導入形態を提案する。`,
      deliverables: `主要な成果物は以下のとおり。`,
      estimate: `概算見積の前提を示す（詳細は「見積」タブを参照）。`,
      estimate_terms: `見積の前提条件を整理する。`,
      schedule: `概略スケジュールを示す（詳細は「スケジュール」タブを参照）。`,
      evaluation: `提案評価の観点を示す。`,
    };

    const lines: string[] = [];
    lines.push(lead[def.key] ?? def.guide, "");

    switch (def.key) {
      case "overview":
      case "background":
      case "background_purpose":
        lines.push(...bullets(rot(facts, 3)));
        break;
      case "issues":
        lines.push(...bullets(rot(facts, 4).map((f) => `課題: ${f}`)));
        break;
      case "objectives":
        lines.push(
          `- ${p.projectName}により、現状課題を解消し業務効率と品質を高める。`,
          ...bullets(rot(facts, 2)),
        );
        break;
      case "success_metrics":
        lines.push(
          "- 一次回答自動化率（目標値はクライアントと合意のうえ設定）",
          "- 平均一次応答時間の短縮率",
          "- 担当者の対応工数削減率",
          "- 利用者満足度（CSAT）",
        );
        break;
      case "feature_list":
      case "functional":
        lines.push(
          "- ナレッジ検索・参照",
          "- AIによる一次回答生成",
          "- 有人エスカレーション",
          "- 回答テンプレート管理",
          "- 利用状況ダッシュボード",
        );
        break;
      case "must_option":
        lines.push(
          "**Must（必須）**",
          "- AI一次回答 / ナレッジ検索 / 有人エスカレーション",
          "",
          "**Could（オプション）**",
          "- 音声（電話）文字起こし対応 / 多言語対応 / 高度な分析レポート",
        );
        break;
      case "screen_list":
        if (ctx.design?.screens?.length) {
          lines.push(
            ...ctx.design.screens.map(
              (s) => `- ${s.name}${s.role ? `（${s.role}）` : ""}: ${s.purpose}`,
            ),
          );
        } else {
          lines.push("- 「画面設計」タブで画面一覧を生成してください。");
        }
        break;
      case "screen_transition":
        if (ctx.design?.transitions?.length) {
          const nameByKey = new Map(
            ctx.design.screens.map((s) => [s.key, s.name]),
          );
          lines.push(
            ...ctx.design.transitions.map(
              (t) =>
                `- ${nameByKey.get(t.from) ?? t.from} → ${nameByKey.get(t.to) ?? t.to}（${t.trigger}）`,
            ),
          );
        } else {
          lines.push("- 「画面設計」タブで画面遷移を生成してください。");
        }
        break;
      case "system_overview":
        if (ctx.design?.architecture?.layers?.length) {
          lines.push(
            ...ctx.design.architecture.layers.map(
              (l) => `- ${l.name}: ${l.components.map((c) => c.name).join(" / ")}`,
            ),
          );
        } else {
          lines.push(
            "- 利用者 → フロントエンド → バックエンド/API → AI → データ → 外部連携（詳細は「画面設計」タブのシステム構成図）",
          );
        }
        break;
      case "ai":
        lines.push(
          "- AIの役割: 社内ナレッジを根拠とした一次回答ドラフトの自動生成・要約",
          "- RAG（社内FAQ・マニュアルを根拠とした回答生成）を採用",
          "- ハルシネーション抑制のため、根拠ドキュメントの提示を必須化",
          "- 人間が最終確認・送信する Human-in-the-loop を前提",
          ...bullets(rot(assume, 1)),
        );
        break;
      case "ai_model": {
        const main = o?.recommendedAiModel ?? "Claude Sonnet";
        const dep = o?.recommendedDeployment;
        const residency =
          !dep || dep === "cloud" || dep === "hybrid"
            ? "データ学習に使用しない設定・国内/指定リージョン保管を要件化"
            : "閉域網/オンプレ要件に合わせ、利用可能なモデル・基盤を別途精査";
        lines.push(
          "用途別に最適なAIモデルを選定する（AI開発会社として精度・コスト・データ取り扱いを総合評価）。",
          "",
          "**用途別の推奨モデル**",
          `- 生成（一次回答・要約）: ${main} — 日本語性能・長文コンテキスト・指示追従性を重視`,
          "- 埋め込み（RAG検索）: 高精度な日本語埋め込みモデルで社内文書をベクトル化",
          "- 軽量処理（分類・ルーティング）: 小型・低コストモデルでコスト最適化",
          "- （将来）音声: 文字起こしモデルで電話・会議録音に対応",
          "",
          "**選定理由**",
          "- 日本語の品質・コンテキスト長・ハルシネーション耐性",
          `- データの取り扱い: ${residency}`,
          "- コストと精度のバランス（用途ごとにモデルを使い分け）",
          "",
          "**比較した代替モデル**",
          "- GPT系 / Gemini系 を精度・コスト・データ保管要件で比較検討",
          "",
          "**評価・運用方針**",
          "- 回答精度を定期評価（正答率・根拠提示率）し、プロンプト/モデルを改善",
          "- モデルのバージョン更新方針とフォールバックを定義",
        );
        break;
      }
      case "data":
        lines.push(
          "- 社内FAQ・マニュアル（PDF / Excel）を取り込み、検索可能化",
          "- 問い合わせ履歴を学習・改善のために蓄積",
          "- 個人情報を含むデータの取り扱いに留意",
        );
        break;
      case "permission":
        lines.push(
          "- 管理者 / オペレーター / 閲覧者のロールを想定",
          "- ロール別に操作・閲覧範囲を制御",
        );
        break;
      case "security":
        lines.push(
          "- 通信・保存データの暗号化",
          "- アクセス制御と監査ログ",
          "- 個人情報・機密情報の取り扱いポリシー遵守",
          ...bullets(rot(qs.map((q) => `要確認: [${q.category}] ${q.question}`), 1)),
        );
        break;
      case "dev_form":
        lines.push(
          `- 契約形態: ${DEVELOPMENT_FORM_LABELS[(p.developmentForm ?? "quasi_mandate") as DevelopmentForm]}`,
          `- 推奨フェーズ: ${o?.recommendedPhase ?? "MVP"}（段階的に拡張）`,
          "- まず試験導入し、効果検証後に対象を拡大",
        );
        break;
      case "deployment":
        lines.push(
          `- 推奨導入形態: ${o?.recommendedDeployment ?? "クラウド"}`,
          "- クラウド利用可否は社内承認状況を踏まえて決定",
        );
        break;
      case "estimate":
      case "estimate_terms":
        lines.push(
          `- 想定予算レンジ: ${budget}`,
          "- 人日単価・バッファ・税は「見積」タブの設定に準拠",
        );
        break;
      case "schedule":
        lines.push(
          p.expectedDeliveryDate
            ? `- 希望納期: ${p.expectedDeliveryDate}`
            : "- 納期は協議のうえ決定",
          "- フェーズ: 要件定義 → 設計 → 開発 → テスト → リリース",
        );
        break;
      case "risk":
        lines.push(
          ...(risks.length
            ? risks.map((r) => `- [${r.type}] ${r.description}`)
            : ["- スコープ拡大による予算・納期への影響"]),
        );
        break;
      case "open_items":
      case "next_confirm":
        lines.push("> クライアント確認事項:");
        lines.push(
          ...(qs.length
            ? qs.map((q) => `> - [${q.category}] ${q.question}`)
            : ["> - 主要な前提条件の確認が必要です。"]),
        );
        break;
      default:
        lines.push(...bullets(rot(facts, 2)));
        if (lines.length <= 2) lines.push(`- 対象: ${p.clientName} / ${p.projectName}`);
    }
    return lines.filter((l) => l !== undefined).join("\n");
  }

  private build(type: DocumentType, ctx: GenerationContext): GeneratedDoc {
    const defs = sectionsFor(type);
    return {
      title: docTitle(type, ctx.project),
      sections: defs.map((def, i) => ({
        key: def.key,
        heading: def.heading,
        markdown: this.sectionMarkdown(def, ctx, i),
      })),
    };
  }

  async generateRfp(ctx: GenerationContext): Promise<GeneratedDoc> {
    return this.build("rfp", ctx);
  }

  async generateRequirements(
    ctx: GenerationContext,
  ): Promise<GeneratedDoc> {
    return this.build("requirements", ctx);
  }

  async regenerateSection(
    docType: DocumentType,
    sectionKey: string,
    ctx: GenerationContext,
    instruction?: string,
  ): Promise<DocSection> {
    const defs = sectionsFor(docType);
    const di = defs.findIndex((d) => d.key === sectionKey);
    const def =
      defs[di] ?? ({ key: sectionKey, heading: sectionKey, guide: "" } as SectionDef);
    const base = this.sectionMarkdown(def, ctx, di < 0 ? 0 : di);
    const md = instruction
      ? `${base}\n\n_（再生成指示: ${instruction}）_`
      : `${base}\n\n_（再生成済み）_`;
    return { key: def.key, heading: def.heading, markdown: md };
  }

  // ---------- estimate ----------

  async generateEstimate(ctx: GenerationContext): Promise<GeneratedEstimate> {
    // base template in HOURS per activity [design, impl, test, coord, mgmt]
    type B = {
      category: string;
      subCategory: string;
      taskName: string;
      approach: string;
      purpose: string;
      role: string;
      h: [number, number, number, number, number];
    };
    const base: B[] = [
      { category: "0. プロジェクト運営", subCategory: "0.1 立上げ/前提固定", taskName: "前提・除外事項の確定", approach: "要件・前提・除外を実装前提として固定", purpose: "手戻りを防ぎ見積前提を固める", role: "PM", h: [4, 0, 1, 1, 2] },
      { category: "1. 基盤構築", subCategory: "1.1 構成設計", taskName: "全体アーキテクチャ設計", approach: "MVP→拡張可能なクラウド構成設計", purpose: "安定運用と将来拡張を両立", role: "Backend Engineer", h: [6, 0, 0, 0, 2] },
      { category: "1. 基盤構築", subCategory: "1.2 実行基盤", taskName: "コンテナ/サーバ構築・デプロイ", approach: "コンテナ＋スケール/環境変数/ログ", role: "DevOps", purpose: "実行基盤を用意", h: [4, 10, 4, 2, 2] },
      { category: "1. 基盤構築", subCategory: "1.3 データベース", taskName: "DB設計・構築・マイグレーション", approach: "PostgreSQL＋バックアップ/マイグレーション", purpose: "データの永続化", role: "Backend Engineer", h: [4, 10, 6, 2, 2] },
      { category: "1. 基盤構築", subCategory: "1.4 認証", taskName: "ログイン認証/SSO", approach: "OIDC＋RBAC", purpose: "本番運用レベルの認証", role: "Backend Engineer", h: [3, 6, 4, 1, 1] },
      { category: "2. 管理画面", subCategory: "2.1 ログイン/権限", taskName: "ログイン・ロール別UI制御", approach: "権限でメニュー/操作制御", purpose: "安全に運用できる管理画面", role: "Frontend Engineer", h: [4, 8, 4, 2, 2] },
      { category: "2. 管理画面", subCategory: "2.2 一覧/検索", taskName: "一覧・検索・絞り込み画面", approach: "一覧テーブル＋検索/フィルタ", purpose: "状況を一覧で把握", role: "Frontend Engineer", h: [3, 12, 3, 1, 1] },
      { category: "2. 管理画面", subCategory: "2.3 詳細/入力", taskName: "詳細・入力画面", approach: "詳細カード＋バリデーション＋保存", purpose: "例外運用を吸収", role: "Frontend Engineer", h: [6, 22, 5, 3, 2] },
      { category: "2. 管理画面", subCategory: "2.4 設定", taskName: "各種設定画面", approach: "ユーザー/権限/連携設定UI", purpose: "運用設定を可能に", role: "Frontend Engineer", h: [4, 10, 3, 2, 1] },
      { category: "3. AI機能", subCategory: "3.1 LLM連携", taskName: "LLM連携・回答生成（RAG）", approach: "根拠提示＋ハルシネーション抑制", purpose: "自然で正確な回答を成立", role: "AI Engineer", h: [6, 14, 8, 4, 3] },
      { category: "3. AI機能", subCategory: "3.2 プロンプト運用", taskName: "プロンプト管理・版管理", approach: "draft/published＋複製/有効化", purpose: "運用しながら改善できる", role: "AI Engineer", h: [4, 10, 6, 3, 2] },
      { category: "4. データ・連携", subCategory: "4.1 外部連携", taskName: "外部システムAPI連携", approach: "差分同期＋冪等性＋リトライ", purpose: "取込を安定化", role: "Backend Engineer", h: [6, 12, 8, 4, 3] },
      { category: "4. データ・連携", subCategory: "4.2 データモデル", taskName: "データモデル/状態管理", approach: "状態遷移を含むスキーマ設計", purpose: "保存/検索の基盤", role: "Backend Engineer", h: [6, 10, 8, 3, 3] },
      { category: "5. テスト・UAT", subCategory: "5.1 E2E試験", taskName: "通し試験（取込→処理→出力）", approach: "模擬データ/失敗注入", purpose: "本番で壊れない確認", role: "QA", h: [6, 10, 14, 5, 3] },
      { category: "5. テスト・UAT", subCategory: "5.2 運用受入", taskName: "手順書＋UAT支援＋FB反映", approach: "チェックリスト＋教育＋改善反映", purpose: "導入を成功させる", role: "QA", h: [4, 10, 6, 4, 2] },
    ];

    const baseHours = base.reduce((a, b) => a + b.h.reduce((x, y) => x + y, 0), 0);
    const mid =
      ctx.project.budgetMin && ctx.project.budgetMax
        ? (ctx.project.budgetMin + ctx.project.budgetMax) / 2
        : ctx.project.budgetMax ?? ctx.project.budgetMin ?? 0;
    const targetSubtotal = mid
      ? mid / (1 + DEFAULT_BUFFER_RATE) / (1 + DEFAULT_TAX_RATE)
      : 200 * DEFAULT_UNIT_PRICE;
    const targetHours = (targetSubtotal / DEFAULT_UNIT_PRICE) * HOURS_PER_DAY;
    const factor = baseHours > 0 ? targetHours / baseHours : 1;
    const s = (n: number) => Math.round(n * factor);

    return {
      estimateName: `${ctx.project.projectName} 見積`,
      defaultUnitPrice: DEFAULT_UNIT_PRICE,
      bufferRate: DEFAULT_BUFFER_RATE,
      lines: base.map((b) => ({
        category: b.category,
        subCategory: b.subCategory,
        taskName: b.taskName,
        approach: b.approach,
        purpose: b.purpose,
        role: b.role,
        design: s(b.h[0]),
        implementation: s(b.h[1]),
        test: s(b.h[2]),
        coordination: s(b.h[3]),
        management: s(b.h[4]),
      })),
    };
  }

  async adjustEstimate(
    _ctx: GenerationContext,
    current: GeneratedEstimate,
    instruction: string,
  ): Promise<GeneratedEstimate> {
    const lineHours = (l: GeneratedEstimate["lines"][number]) =>
      l.design + l.implementation + l.test + l.coordination + l.management;
    const currentSubtotal =
      (current.lines.reduce((a, l) => a + lineHours(l), 0) / HOURS_PER_DAY) *
      current.defaultUnitPrice;
    const targetYen = parseYen(instruction);
    let scale = 0.9; // default: trim ~10%
    if (targetYen && currentSubtotal > 0) {
      const targetSubtotal =
        targetYen / (1 + current.bufferRate) / (1 + DEFAULT_TAX_RATE);
      scale = targetSubtotal / currentSubtotal;
    }
    const sc = (n: number) => Math.max(0, Math.round(n * scale));
    return {
      ...current,
      lines: current.lines.map((l) => ({
        ...l,
        design: sc(l.design),
        implementation: sc(l.implementation),
        test: sc(l.test),
        coordination: sc(l.coordination),
        management: sc(l.management),
      })),
    };
  }

  // ---------- schedule ----------

  async generateSchedule(ctx: GenerationContext): Promise<GeneratedSchedule> {
    // longer for full/enterprise, shorter for poc
    const phase = ctx.organized?.recommendedPhase;
    const factor =
      phase === "poc"
        ? 0.6
        : phase === "full_dev"
          ? 1.2
          : phase === "enterprise"
            ? 1.6
            : 1;
    const d = (days: number) => Math.max(1, Math.round(days * factor));

    const tasks = [
      { taskKey: "t1", taskName: "要件定義", phase: "要件定義", durationDays: d(10), assigneeRole: "PM", dependencies: [] as string[], needsClientReview: true },
      { taskKey: "t2", taskName: "基本設計", phase: "設計", durationDays: d(10), assigneeRole: "Backend Engineer", dependencies: ["t1"], needsClientReview: true },
      { taskKey: "t3", taskName: "UI/UX・画面設計", phase: "設計", durationDays: d(10), assigneeRole: "Designer", dependencies: ["t1"] },
      { taskKey: "t4", taskName: "フロント/バック開発", phase: "開発", durationDays: d(30), assigneeRole: "Frontend Engineer", dependencies: ["t2", "t3"], risk: "スコープ拡大時に遅延リスク" },
      { taskKey: "t5", taskName: "AI機能実装", phase: "開発", durationDays: d(15), assigneeRole: "AI Engineer", dependencies: ["t2"] },
      { taskKey: "t6", taskName: "テスト", phase: "テスト", durationDays: d(10), assigneeRole: "QA", dependencies: ["t4", "t5"] },
      { taskKey: "t7", taskName: "リリース準備", phase: "リリース", durationDays: d(5), assigneeRole: "DevOps", dependencies: ["t6"], needsClientReview: true },
    ];

    const startDate = new Date().toISOString().slice(0, 10);

    return {
      scheduleName: `${ctx.project.projectName} スケジュール`,
      startDate,
      tasks,
      milestones: [
        { title: "要件定義完了", afterTaskKey: "t1", type: "review", isClientVisible: true },
        { title: "設計完了", afterTaskKey: "t3", type: "review", isClientVisible: true },
        { title: "開発完了", afterTaskKey: "t4", type: "internal", isClientVisible: false },
        { title: "リリース", afterTaskKey: "t7", type: "release", isClientVisible: true },
      ],
    };
  }

  async adjustSchedule(
    ctx: GenerationContext,
    current: GeneratedSchedule,
    instruction: string,
  ): Promise<GeneratedSchedule> {
    const weeks = parseWeeks(instruction);
    const tasks = current.tasks.map((t) => {
      // if instruction names a phase keyword + weeks, set that task's duration
      if (weeks && instruction.includes(t.phase)) {
        return { ...t, durationDays: weeks * 5, risk: `${instruction} に合わせ調整` };
      }
      if (weeks && (instruction.includes(t.taskName) || instruction.includes("PoC"))) {
        if (instruction.includes("PoC") && t.phase === "開発") {
          return { ...t, durationDays: weeks * 5 };
        }
      }
      return t;
    });
    return { ...current, tasks };
  }

  // ---------- screen design ----------

  async generateScreenDesign(
    ctx: GenerationContext,
  ): Promise<GeneratedDesign> {
    const app = ctx.project.projectName;
    return {
      screens: [
        { key: "login", name: "ログイン", role: "全ユーザー", purpose: "認証してアプリに入る", uiElements: ["メールアドレス入力", "ログインボタン", "エラー表示"], states: ["未入力", "認証エラー", "ロード中"], priority: "must", wireframe: [{ kind: "auth", label: "ログインフォーム" }] },
        { key: "dashboard", name: "ダッシュボード", role: "全ユーザー", purpose: "対応状況とKPIを俯瞰する", uiElements: ["未対応件数", "一次応答時間", "自動化率", "最近の問い合わせ"], states: ["データなし", "通常"], priority: "must", wireframe: [{ kind: "kpi", label: "未対応 / 応答時間 / 自動化率" }, { kind: "chart", label: "対応件数の推移" }, { kind: "list", label: "最近の問い合わせ" }] },
        { key: "inquiries", name: "問い合わせ一覧", role: "オペレーター", purpose: "問い合わせを検索・絞り込み対応する", uiElements: ["検索", "ステータスフィルタ", "一覧テーブル", "新規対応ボタン"], states: ["0件", "通常", "絞り込み中"], priority: "must", wireframe: [{ kind: "toolbar", label: "検索・ステータスフィルタ" }, { kind: "table", label: "問い合わせ一覧" }] },
        { key: "inquiry_detail", name: "問い合わせ詳細・回答", role: "オペレーター", purpose: "AI一次回答を確認・編集して送信する", uiElements: ["問い合わせ本文", "AI回答ドラフト", "根拠ドキュメント", "編集エリア", "送信/エスカレーションボタン"], states: ["AI生成中", "下書き", "送信済み", "エスカレーション"], priority: "must", wireframe: [{ kind: "detail", label: "問い合わせ本文 / AI回答ドラフト・根拠" }, { kind: "buttons", label: "送信 / エスカレーション" }] },
        { key: "knowledge_search", name: "ナレッジ検索", role: "オペレーター", purpose: "FAQ・マニュアルを横断検索する", uiElements: ["検索ボックス", "検索結果", "ドキュメントプレビュー"], states: ["0件", "通常"], priority: "must", wireframe: [{ kind: "search", label: "横断検索" }, { kind: "list", label: "検索結果" }] },
        { key: "knowledge_admin", name: "ナレッジ管理", role: "管理者", purpose: "FAQ・マニュアルを取り込み・更新する", uiElements: ["アップロード", "取込状況", "ドキュメント一覧"], states: ["取込中", "エラー", "通常"], priority: "should", wireframe: [{ kind: "upload", label: "PDF / Excel 取込" }, { kind: "table", label: "ドキュメント一覧" }] },
        { key: "reports", name: "レポート・分析", role: "管理者", purpose: "対応品質と効果を可視化する", uiElements: ["期間選択", "KPIグラフ", "CSVエクスポート"], states: ["通常"], priority: "could", wireframe: [{ kind: "toolbar", label: "期間選択 / CSV出力" }, { kind: "chart", label: "KPI推移" }, { kind: "table", label: "内訳" }] },
        { key: "settings", name: "設定", role: "管理者", purpose: "権限・AIモデル・連携を設定する", uiElements: ["ユーザー/権限", "AIモデル設定", "外部連携設定"], states: ["通常"], priority: "should", wireframe: [{ kind: "form", label: "ユーザー・権限" }, { kind: "form", label: "AIモデル・外部連携" }] },
      ],
      transitions: [
        { from: "login", to: "dashboard", trigger: "ログイン成功" },
        { from: "dashboard", to: "inquiries", trigger: "問い合わせを見る" },
        { from: "dashboard", to: "reports", trigger: "レポートを見る" },
        { from: "inquiries", to: "inquiry_detail", trigger: "問い合わせを選択" },
        { from: "inquiry_detail", to: "knowledge_search", trigger: "根拠を探す" },
        { from: "inquiry_detail", to: "inquiries", trigger: "送信して一覧へ戻る" },
        { from: "dashboard", to: "knowledge_admin", trigger: "ナレッジ管理" },
        { from: "dashboard", to: "settings", trigger: "設定" },
      ],
      architecture: {
        layers: [
          { name: "利用者", components: [{ name: "オペレーター" }, { name: "管理者" }] },
          { name: "フロントエンド", components: [{ name: "Web UI", note: "Next.js / React" }] },
          { name: "バックエンド", components: [{ name: "アプリAPI", note: "認証・業務ロジック" }, { name: "RAG検索", note: "ベクトル検索" }] },
          { name: "AI", components: [{ name: "Claude Sonnet", note: "回答生成" }] },
          { name: "データ", components: [{ name: "DB", note: "問い合わせ・履歴" }, { name: "ベクトルDB", note: "FAQ/マニュアル" }, { name: "ストレージ", note: "PDF/Excel" }] },
          { name: "外部連携", components: [{ name: "Zendesk" }, { name: "メール/チャット" }] },
        ],
        edges: [
          { from: "オペレーター", to: "Web UI" },
          { from: "管理者", to: "Web UI" },
          { from: "Web UI", to: "アプリAPI" },
          { from: "アプリAPI", to: "RAG検索" },
          { from: "アプリAPI", to: "Claude Sonnet", label: "回答生成" },
          { from: "RAG検索", to: "ベクトルDB" },
          { from: "アプリAPI", to: "DB" },
          { from: "アプリAPI", to: "Zendesk", label: "連携" },
          { from: "ストレージ", to: "ベクトルDB", label: "取込" },
        ],
      },
      designPrompt: [
        `B2B SaaS 管理画面のUI/UXを設計してください。アプリ名: ${app}。`,
        `対象ユーザー: カスタマーサポートのオペレーターと管理者。`,
        `主要画面: ログイン / ダッシュボード / 問い合わせ一覧 / 問い合わせ詳細・回答 / ナレッジ検索 / ナレッジ管理 / レポート / 設定。`,
        `デザイン方針: B2B SaaSらしい信頼感、NotionやLinearに近い軽快さ、情報量は多いが迷わない。`,
        `重要: 「問い合わせ詳細・回答」画面では、AIの回答ドラフトと根拠ドキュメントを並べて表示し、オペレーターが確認・編集して送信できる導線を最優先で。`,
        `アクセントカラーは Vivid Blue (#264bf1)。`,
      ].join("\n"),
    };
  }

  async adjustScreenDesign(
    _ctx: GenerationContext,
    current: GeneratedDesign,
    instruction: string,
  ): Promise<GeneratedDesign> {
    const screens = [...current.screens];
    const transitions = [...current.transitions];
    const core = new Set(["login", "dashboard"]);

    if (/(追加|足し|入れ|新設|加え)/.test(instruction)) {
      const key = `screen_${screens.length + 1}`;
      let name = instruction
        .replace(/[。、].*$/, "")
        .replace(/(を)?(追加|新設|足し|入れ|加え)(して|て)?.*$/, "")
        .trim();
      if (!name) name = instruction.slice(0, 10);
      if (!name.endsWith("画面")) name = `${name}画面`;
      screens.push({
        key,
        name,
        role: "全ユーザー",
        purpose: instruction,
        uiElements: ["（コメントに基づき要設計）"],
        states: ["通常"],
        priority: "should",
        wireframe: [{ kind: "form", label: "（コメントに基づき要設計）" }],
      });
      transitions.push({
        from: "dashboard",
        to: key,
        trigger: name.replace(/画面$/, ""),
      });
    } else if (/(削除|消し|不要|除外|減らし)/.test(instruction)) {
      // remove the last non-core screen and its transitions
      for (let i = screens.length - 1; i >= 0; i--) {
        if (!core.has(screens[i].key)) {
          const removed = screens.splice(i, 1)[0].key;
          for (let j = transitions.length - 1; j >= 0; j--) {
            if (transitions[j].from === removed || transitions[j].to === removed) {
              transitions.splice(j, 1);
            }
          }
          break;
        }
      }
    }

    return {
      ...current,
      screens,
      transitions,
      designPrompt: `${current.designPrompt}\n（修正指示を反映: ${instruction}）`,
    };
  }

  async generateScopeWbs(ctx: GenerationContext): Promise<ScopeWbsPlan> {
    const p = ctx.project;
    const form = (p.developmentForm ?? "quasi_mandate") as DevelopmentForm;
    const formLabel = DEVELOPMENT_FORM_LABELS[form] ?? "準委任契約";
    const what = p.description?.trim() || `${p.projectName}`;

    if (form === "consulting") {
      // プロのコンサル観点: 調査→分析→提言→ロードマップ→PoC計画
      return {
        formLabel,
        approach: `${p.clientName}の「${what}」について、現状の業務・データを調査し、課題を構造化したうえで、AI活用方針と実行ロードマップを策定する伴走型コンサルティング。まずPoCで効果を検証し、投資対効果を見極めてから本開発フェーズへ移行する前提で、意思決定を支援する。`,
        inScope: [
          "現状業務・体制・データのヒアリングと可視化（As-Is）",
          "課題の構造化と優先順位付け、定量効果の試算",
          "AI活用方針・対象ユースケースの定義（To-Be）",
          "AIモデル・アーキテクチャの技術選定方針",
          "PoCのスコープ・評価指標・実施計画の策定",
          "実行ロードマップ・推進体制・概算費用の提示",
        ],
        outOfScope: [
          "本番システムの実装・本格運用（後続フェーズ）",
          "既存システムの改修・データ移行の実作業",
          "インフラ・ライセンスの調達代行",
        ],
        assumptions: [
          "関係部門へのヒアリング・資料提供にご協力いただけること",
          "意思決定者がレビュー・合意形成に参加されること",
          "PoC用に少量のサンプルデータをご提供いただけること",
        ],
        deliverables: [
          { name: "現状分析レポート", description: "As-Is業務・課題・データ現状の可視化と定量分析" },
          { name: "AI活用方針書", description: "対象ユースケース・期待効果・技術方針（モデル選定含む）" },
          { name: "PoC計画書", description: "検証範囲・評価指標・体制・スケジュール" },
          { name: "実行ロードマップ＆概算費用", description: "フェーズ計画・体制・投資対効果の見立て" },
          { name: "最終報告書（経営提言）", description: "結論と意思決定に必要な提言サマリー" },
        ],
        wbs: [
          {
            name: "Phase 1: キックオフ・計画",
            objective: "目的・進め方・体制・スケジュールの合意",
            tasks: [
              { name: "キックオフ・ゴール合意", deliverable: "プロジェクト計画書", role: "コンサル/PM", weeks: 1 },
              { name: "情報収集計画・ヒアリング設計", role: "コンサル", weeks: 1 },
            ],
          },
          {
            name: "Phase 2: 現状調査・分析",
            objective: "As-Isの可視化と課題の構造化",
            tasks: [
              { name: "業務・体制ヒアリング", deliverable: "ヒアリング議事録", role: "コンサル", weeks: 2 },
              { name: "データ・システム現状調査", deliverable: "現状分析レポート", role: "コンサル/エンジニア", weeks: 2 },
              { name: "課題構造化・効果試算", role: "コンサル", weeks: 1 },
            ],
          },
          {
            name: "Phase 3: AI活用方針の策定",
            objective: "To-Beとユースケース・技術方針の定義",
            tasks: [
              { name: "ユースケース定義・優先度付け", deliverable: "AI活用方針書", role: "コンサル", weeks: 1 },
              { name: "AIモデル・アーキ技術選定", deliverable: "技術選定メモ", role: "エンジニア", weeks: 1 },
            ],
          },
          {
            name: "Phase 4: PoC設計・検証計画",
            objective: "効果検証の設計",
            tasks: [
              { name: "PoCスコープ・評価指標設計", deliverable: "PoC計画書", role: "コンサル/エンジニア", weeks: 1 },
              { name: "（任意）小規模PoC実施・評価", deliverable: "PoC評価結果", role: "エンジニア", weeks: 2 },
            ],
          },
          {
            name: "Phase 5: ロードマップ・提言",
            objective: "実行計画と意思決定支援",
            tasks: [
              { name: "ロードマップ・体制・概算費用", deliverable: "実行ロードマップ＆概算費用", role: "コンサル/PM", weeks: 1 },
              { name: "最終報告・経営提言", deliverable: "最終報告書", role: "コンサル", weeks: 1 },
            ],
          },
        ],
      };
    }

    if (form === "waterfall") {
      // 請負: 成果物と検収基準を明確化したWBS
      return {
        formLabel,
        approach: `${p.clientName}の「${what}」を、要件定義→設計→実装→テスト→検収・納品の工程で構築する請負開発。成果物と完了（検収）基準を工程ごとに明確化し、変更は変更管理プロセスで統制する。`,
        inScope: [
          "要件定義の確定（凍結）",
          "基本設計・詳細設計",
          "実装・単体/結合テスト",
          "総合テスト・ユーザー受入支援",
          "本番移行・納品・操作マニュアル整備",
        ],
        outOfScope: [
          "凍結後に発生した追加要件（変更管理で別途見積）",
          "本番運用・保守（別契約）",
          "クライアント側で行うデータ整備・現行業務調整",
        ],
        assumptions: [
          "要件はフェーズ初期に凍結し、以降の変更は変更管理に従う",
          "検証・本番環境はクライアントが提供すること",
          "受入テスト・検収にご対応いただけること",
        ],
        deliverables: [
          { name: "要件定義書", description: "確定要件・スコープ・受入基準" },
          { name: "基本設計書", description: "画面・機能・データ・外部連携の設計" },
          { name: "詳細設計書", description: "実装に必要なモジュール詳細" },
          { name: "テスト報告書", description: "テスト計画・結果・品質エビデンス" },
          { name: "納品物一式・操作マニュアル", description: "ソース・ビルド・手順書" },
        ],
        wbs: [
          {
            name: "Phase 1: 要件定義",
            objective: "要件の確定と凍結",
            tasks: [
              { name: "要件ヒアリング・整理", deliverable: "要件定義書", role: "PM/コンサル", weeks: 2 },
              { name: "受入基準・スコープ合意", role: "PM", weeks: 1 },
            ],
          },
          {
            name: "Phase 2: 設計",
            objective: "基本・詳細設計",
            tasks: [
              { name: "基本設計", deliverable: "基本設計書", role: "エンジニア/デザイナー", weeks: 3 },
              { name: "詳細設計", deliverable: "詳細設計書", role: "エンジニア", weeks: 2 },
            ],
          },
          {
            name: "Phase 3: 実装",
            objective: "機能の実装",
            tasks: [
              { name: "実装・単体テスト", deliverable: "ソースコード", role: "エンジニア", weeks: 6 },
              { name: "結合テスト", role: "エンジニア", weeks: 2 },
            ],
          },
          {
            name: "Phase 4: テスト・検収",
            objective: "品質確認と受入",
            tasks: [
              { name: "総合テスト", deliverable: "テスト報告書", role: "エンジニア/PM", weeks: 2 },
              { name: "受入テスト支援・是正", role: "PM", weeks: 1 },
            ],
          },
          {
            name: "Phase 5: 移行・納品",
            objective: "本番移行と検収完了",
            tasks: [
              { name: "本番移行・データ移行", role: "エンジニア", weeks: 1 },
              { name: "納品・操作マニュアル・検収", deliverable: "納品物一式", role: "PM", weeks: 1 },
            ],
          },
        ],
      };
    }

    // quasi_mandate（準委任・伴走）
    return {
      formLabel,
      approach: `${p.clientName}の「${what}」を、稼働ベースの準委任で伴走開発する。優先度の高い機能からスプリント単位で価値提供し、スコープは状況に応じて柔軟に見直す。成果物の完成責任は負わない一方、稼働の透明性（進捗・稼働報告）を担保する。`,
      inScope: [
        "プロダクトバックログの整備・優先度付け",
        "スプリント単位の設計・実装・レビュー",
        "継続的な改善・技術的負債への対応",
        "進捗・稼働状況の定例共有",
      ],
      outOfScope: [
        "固定スコープの完成・納品の保証（請負ではない）",
        "事前に合意した稼働を超える作業",
        "運用・監視の常時対応（別途合意）",
      ],
      assumptions: [
        "プロダクトオーナーが優先度判断・受け入れに関与されること",
        "稼働は人月（例: 月X人月）ベースで精算すること",
        "開発・検証環境を利用できること",
      ],
      deliverables: [
        { name: "スプリント成果物", description: "各スプリントで動作する機能インクリメント" },
        { name: "プロダクトバックログ", description: "優先度付きの要求一覧（随時更新）" },
        { name: "リリースビルド", description: "検証/本番向けの成果物" },
        { name: "進捗・稼働報告", description: "スプリントレビュー資料・稼働サマリー" },
      ],
      wbs: [
        {
          name: "Phase 0: 立ち上げ",
          objective: "体制・環境・バックログの準備",
          tasks: [
            { name: "キックオフ・体制/環境準備", deliverable: "開発環境・体制", role: "PM/エンジニア", weeks: 1 },
            { name: "初期バックログ整備", deliverable: "プロダクトバックログ", role: "PM", weeks: 1 },
          ],
        },
        {
          name: "Phase 1: スプリント（反復）",
          objective: "優先度順に価値提供",
          tasks: [
            { name: "スプリント計画・設計・実装", deliverable: "スプリント成果物", role: "エンジニア", weeks: 2 },
            { name: "スプリントレビュー・改善", deliverable: "レビュー資料", role: "PM/エンジニア", weeks: 1 },
          ],
        },
        {
          name: "Phase 2: 安定化・引き継ぎ",
          objective: "品質確保と運用移行",
          tasks: [
            { name: "リファクタ・テスト整備", role: "エンジニア", weeks: 2 },
            { name: "ドキュメント・引き継ぎ", deliverable: "引き継ぎ資料", role: "PM", weeks: 1 },
          ],
        },
      ],
    };
  }

  async reviewConsistency(
    input: ConsistencyInput,
  ): Promise<ConsistencyReport> {
    const p = input.project;
    const man = (yen?: number | null) =>
      yen ? `${Math.round(yen / 10000).toLocaleString()}万円` : "—";
    const findings: ConsistencyFinding[] = [];
    const ok: string[] = [];

    // 要件定義の有無（基盤）
    if (!input.requirements) {
      findings.push({
        severity: "high",
        area: "要件定義",
        title: "要件定義書が未作成",
        detail:
          "整合性チェックの基準となる要件定義書がありません。先に作成してください。",
        suggestion: "「要件定義」タブで生成。",
      });
    }

    // 見積 × 予算
    if (input.estimate) {
      const total = input.estimate.total;
      if (p.budgetMax && total > p.budgetMax) {
        findings.push({
          severity: "high",
          area: "見積 × 予算",
          title: "見積が想定予算の上限を超過",
          detail: `見積合計 ${man(total)} が想定予算上限 ${man(p.budgetMax)} を上回っています。`,
          suggestion:
            "Must/Could を切り分けてスコープ調整、またはPoC→本開発のフェーズ分割で初期費用を抑える。",
        });
      } else if (p.budgetMin && total < p.budgetMin * 0.6) {
        findings.push({
          severity: "low",
          area: "見積 × 予算",
          title: "見積が想定予算を大きく下回る",
          detail: `見積 ${man(total)} が想定予算下限 ${man(p.budgetMin)} を大きく下回ります。スコープ不足の可能性があります。`,
          suggestion: "要件の取りこぼしがないか確認。",
        });
      } else if (p.budgetMin || p.budgetMax) {
        ok.push(`見積（${man(total)}）は想定予算レンジ内に収まっています。`);
      }
    } else {
      findings.push({
        severity: "medium",
        area: "見積",
        title: "見積が未作成",
        detail: "見積が作成されていないため予算整合を確認できません。",
        suggestion: "「見積」タブで生成。",
      });
    }

    // スケジュール × 納期
    if (input.schedule) {
      if (p.expectedDeliveryDate && input.schedule.end > p.expectedDeliveryDate) {
        findings.push({
          severity: "high",
          area: "スケジュール × 納期",
          title: "スケジュールが希望納期を超過",
          detail: `完了予定 ${input.schedule.end} が希望納期 ${p.expectedDeliveryDate} を超えています。`,
          suggestion: "並行作業・スコープ調整・フェーズ分割で短縮を検討。",
        });
      } else if (p.expectedDeliveryDate) {
        ok.push(
          `スケジュール完了（${input.schedule.end}）は希望納期（${p.expectedDeliveryDate}）に収まっています。`,
        );
      }
    } else {
      findings.push({
        severity: "low",
        area: "スケジュール",
        title: "スケジュールが未作成",
        detail: "スケジュールが未作成です。",
        suggestion: "「スケジュール」タブで生成。",
      });
    }

    // 画面一覧/遷移 × 要件定義
    if (input.requirements && input.screens) {
      const sec = input.requirements.find((s) => s.key === "screen_list");
      const reqLines = sec
        ? sec.markdown.split("\n").filter((l) => l.trim().startsWith("-")).length
        : 0;
      if (reqLines > 0 && Math.abs(reqLines - input.screens.length) > 1) {
        findings.push({
          severity: "medium",
          area: "画面一覧 × 要件定義",
          title: "画面数が要件定義と画面設計で不一致",
          detail: `要件定義の画面一覧は約${reqLines}件、画面設計は${input.screens.length}件です。`,
          suggestion: "「画面設計（システム構成図）」の「要件定義に反映」で同期。",
        });
      } else if (input.screens.length) {
        ok.push(
          `画面一覧（${input.screens.length}画面）と要件定義の記述は概ね整合しています。`,
        );
      }
      const keys = new Set(input.screens.map((s) => s.key));
      const dangling = (input.transitions ?? []).filter(
        (t) => !keys.has(t.from) || !keys.has(t.to),
      );
      if (dangling.length) {
        findings.push({
          severity: "medium",
          area: "画面遷移",
          title: "存在しない画面への遷移",
          detail: `${dangling.length}件の遷移が画面一覧にない画面を参照しています。`,
          suggestion: "画面遷移を再生成して整合を取る。",
        });
      }
      if (input.transitions && input.transitions.length) {
        const connected = new Set<string>();
        input.transitions.forEach((t) => {
          connected.add(t.from);
          connected.add(t.to);
        });
        const orphans = input.screens.filter(
          (s) => !connected.has(s.key) && s.key !== "login",
        );
        if (orphans.length) {
          findings.push({
            severity: "low",
            area: "画面遷移",
            title: "遷移のない画面",
            detail: `${orphans.map((o) => o.name).join("、")} は画面遷移上どこからも到達しません。`,
            suggestion: "導線を追加するか、画面の要否を確認。",
          });
        }
      }
    } else if (input.requirements && !input.screens) {
      findings.push({
        severity: "low",
        area: "画面設計",
        title: "画面設計が未作成",
        detail: "要件定義はありますが画面一覧・遷移が未作成です。",
        suggestion: "「画面設計」タブで生成。",
      });
    }

    // 未確認事項
    if (input.openQuestions.length) {
      findings.push({
        severity: "medium",
        area: "未確認事項",
        title: `未確認事項が${input.openQuestions.length}件残存`,
        detail: input.openQuestions
          .slice(0, 3)
          .map((q) => `[${q.category}] ${q.question}`)
          .join(" / "),
        suggestion: "「追加質問」でクライアントに確認し、確定後に各成果物へ反映。",
      });
    } else {
      ok.push("未確認事項は整理されています。");
    }

    // AIモデル選定（AI開発会社として必須）
    if (input.requirements) {
      if (input.requirements.some((s) => s.key === "ai_model")) {
        ok.push("AIモデル選定が要件定義に含まれています。");
      } else {
        findings.push({
          severity: "low",
          area: "AI要件",
          title: "AIモデル選定が要件定義に見当たらない",
          detail: "AI開発案件ではAIモデル選定の明記が望まれます。",
          suggestion: "要件定義を再生成すると「AIモデル選定」節が入ります。",
        });
      }
    }

    // 開発形態 × スコープ
    if (p.developmentForm === "consulting" && !input.scope) {
      findings.push({
        severity: "medium",
        area: "開発形態 × スコープ",
        title: "コンサル案件だがスコープ・WBSが未作成",
        detail: "コンサル契約では対象範囲・WBSの明確化が重要です。",
        suggestion: "「スコープ・WBS」タブで生成。",
      });
    }
    // 月額（準委任）× 見積
    if (p.monthlyRate && p.contractMonths && input.estimate) {
      const monthly = p.monthlyRate * p.contractMonths;
      if (
        Math.abs(monthly - input.estimate.total) >
        input.estimate.total * 0.3
      ) {
        findings.push({
          severity: "low",
          area: "見積 × 月額",
          title: "月単価×月数と見積合計に乖離",
          detail: `月額試算 ${man(monthly)} と見積合計 ${man(input.estimate.total)} に差があります。`,
          suggestion: "準委任の月額前提と工数見積の整合を確認。",
        });
      }
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
    const high = findings.filter((f) => f.severity === "high").length;
    const summary =
      findings.length === 0
        ? "主要な不整合は検出されませんでした。各成果物（要件定義・画面設計・見積・スケジュール）は概ね整合しています。"
        : `${findings.length}件の確認事項（重大 ${high}件）を検出しました。重大なものから対応を推奨します。`;

    return { summary, okPoints: ok, findings };
  }

  async reviewRequirementsQuality(
    input: QualityInput,
  ): Promise<QualityReport> {
    const findings: QualityFinding[] = [];
    const sections = input.sections;
    const byKey = new Map(sections.map((s) => [s.key, s]));
    const allText = sections.map((s) => s.markdown).join("\n");

    // 1) あいまいさ — 曖昧な表現を検出
    const VAGUE = [
      "適切に", "柔軟に", "必要に応じて", "可能な限り", "なるべく",
      "基本的に", "等を考慮", "適宜", "随時", "おおむね", "ある程度",
      "高速に", "使いやすく", "わかりやすく",
    ];
    for (const s of sections) {
      for (const line of s.markdown.split("\n")) {
        const hit = VAGUE.find((v) => line.includes(v));
        if (hit && findings.filter((f) => f.category === "ambiguity").length < 4) {
          findings.push({
            category: "ambiguity",
            severity: "medium",
            section: s.heading,
            quote: line.replace(/^[-\s>]+/, "").slice(0, 48),
            issue: `「${hit}」が曖昧で、受け取り方により仕様が変わります。`,
            suggestion: "定量条件・対象・基準値を明記する（例: 「3秒以内」「対象=メール/チャット」）。",
          });
        }
      }
    }

    // 2) 抜け漏れ — 主要セクションの空/プレースホルダ
    const REQUIRED: { key: string; label: string }[] = [
      { key: "nonfunctional", label: "非機能要件" },
      { key: "security", label: "セキュリティ要件" },
      { key: "data", label: "データ要件" },
      { key: "operation", label: "運用要件" },
      { key: "ai_model", label: "AIモデル選定" },
    ];
    for (const r of REQUIRED) {
      const sec = byKey.get(r.key);
      const empty = !sec || (sec.markdown.replace(/[-\s—>]/g, "").length < 20);
      if (empty) {
        findings.push({
          category: "omission",
          severity: r.key === "security" || r.key === "ai_model" ? "high" : "medium",
          section: sec?.heading ?? r.label,
          issue: `「${r.label}」の記述が不足、またはプレースホルダのままです。`,
          suggestion: "具体的な要件を追記する（再生成または手動編集）。",
        });
      }
    }

    // 3) 考慮漏れ — 標準的観点の不足
    if (!/エラー|失敗|例外|フォールバック|誤回答|ハルシネ/.test(allText)) {
      findings.push({
        category: "consideration",
        severity: "medium",
        issue: "エラー時・AIが回答できない場合の挙動（フォールバック）の記載が見当たりません。",
        suggestion: "回答不能時の有人エスカレーション・例外処理を明記する。",
      });
    }
    if (!/性能|応答時間|レスポンス|同時|スループット/.test(allText)) {
      findings.push({
        category: "consideration",
        severity: "low",
        section: byKey.get("nonfunctional")?.heading,
        issue: "性能・同時利用などの定量目標が見当たりません。",
        suggestion: "応答時間や同時接続数などの非機能目標を定義する。",
      });
    }
    if (!/個人情報|PII|匿名|マスキング/.test(allText)) {
      findings.push({
        category: "consideration",
        severity: "medium",
        section: byKey.get("security")?.heading,
        issue: "個人情報の取り扱い（マスキング/保管/権限）の具体記載が不足しています。",
        suggestion: "対象データと保護方法（暗号化・アクセス制御・保管場所）を明記。",
      });
    }

    // 4) 矛盾 — 導入形態の食い違い（簡易）
    const cloud = /クラウド/.test(allText);
    const onprem = /オンプレ|閉域/.test(allText);
    if (cloud && onprem && !/ハイブリッド/.test(allText)) {
      findings.push({
        category: "contradiction",
        severity: "medium",
        issue: "「クラウド」と「オンプレ/閉域」の両方の記述があり、導入形態が矛盾している可能性があります。",
        suggestion: "導入形態を一つに確定するか、ハイブリッド構成として明記する。",
      });
    }

    // 5) 校正・読みやすさ — 長すぎる箇条書き
    let longCount = 0;
    for (const s of sections) {
      for (const line of s.markdown.split("\n")) {
        const t = line.replace(/^[-\s>]+/, "");
        if (line.trim().startsWith("-") && t.length > 80) longCount++;
      }
    }
    if (longCount > 0) {
      findings.push({
        category: "proofreading",
        severity: "low",
        issue: `1文が長い箇条書きが${longCount}件あり、読みにくくなっています。`,
        suggestion: "1項目=1論点に分割し、各40〜60字程度に整える。",
      });
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    const catRank = {
      contradiction: 0, omission: 1, ambiguity: 2, consideration: 3, proofreading: 4,
    } as const;
    findings.sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        catRank[a.category] - catRank[b.category],
    );

    const penalty = findings.reduce(
      (n, f) => n + (f.severity === "high" ? 12 : f.severity === "medium" ? 6 : 2),
      0,
    );
    const score = Math.max(40, 100 - penalty);
    const high = findings.filter((f) => f.severity === "high").length;
    const summary =
      findings.length === 0
        ? "大きな品質上の問題は見つかりませんでした。要件定義書は概ね明確です。"
        : `${findings.length}件の改善点（重大 ${high}件）を検出しました。完成度の目安は${score}点です。`;

    return { summary, score, findings };
  }

  async generateSlideBullets(
    ctx: GenerationContext,
    topic: string,
  ): Promise<string[]> {
    const p = ctx.project;
    const facts = ctx.organized?.confirmedFacts ?? [];
    const t = topic.trim();
    // topic-aware concrete bullets (no placeholders)
    if (/効果|メリット|価値|ROI|導入効果/.test(t)) {
      return [
        "一次回答の自動ドラフト生成により応答時間を短縮",
        "社内ナレッジを根拠に回答品質を平準化（ベテラン依存を低減）",
        "対応工数の削減と、繁忙期のピーク吸収",
        "蓄積データによる継続的な改善",
      ];
    }
    if (/課題|背景|現状/.test(t)) {
      return facts.length
        ? facts.slice(0, 4).map((f) => f)
        : [
            "問い合わせ対応の品質・スピードが担当者により不均一",
            "FAQ・マニュアルが散在し横断検索ができない",
            "繁忙期に一次回答までの時間が長い",
          ];
    }
    if (/体制|進め方|プロセス|アプローチ/.test(t)) {
      return [
        "少人数のアジャイル体制で伴走（PM＋エンジニア＋デザイナー）",
        "2週間スプリントで優先度の高い機能から提供",
        "各フェーズにクライアントレビューを設定",
        "PoCで効果検証 → 本開発へ段階的に拡大",
      ];
    }
    if (/AI|モデル|技術/.test(t)) {
      return [
        `生成モデル: ${ctx.organized?.recommendedAiModel ?? "Claude Sonnet"}（日本語性能・長文対応）`,
        "RAGで社内ドキュメントを根拠化し、ハルシネーションを抑制",
        "データは学習不可設定・国内/指定リージョン保管を要件化",
        "用途別にモデルを使い分けコスト最適化",
      ];
    }
    if (/セキュリティ|個人情報|コンプライアンス/.test(t)) {
      return [
        "通信・保存データの暗号化とアクセス制御",
        "監査ログの取得と権限管理",
        "個人情報・機密情報の取り扱いポリシー遵守",
      ];
    }
    // generic: derive from context
    const base = [
      p.description
        ? `${t}: ${p.description}`
        : `${t}について、${p.clientName}の状況を踏まえて整理`,
      ...facts.slice(0, 2),
    ].filter(Boolean) as string[];
    if (base.length < 3) base.push(`${p.projectName} の目的に沿って具体化する`);
    return base.slice(0, 4);
  }
}
