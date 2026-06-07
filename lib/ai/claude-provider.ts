import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { addUsage } from "./usage-context";
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
  ScopeWbsPlan,
  ConsistencyInput,
  ConsistencyReport,
  QualityInput,
  QualityReport,
} from "./providers";
import {
  BASE_RULES,
  docSectionSchema,
  docTitle,
  generatedDesignSchema,
  generatedDocSchema,
  generatedEstimateSchema,
  generatedScheduleSchema,
  openQuestionSetSchema,
  organizedHearingSchema,
  scopeWbsSchema,
  consistencyReportSchema,
  qualityReportSchema,
  slideBulletsSchema,
  sectionsFor,
  serializeContext,
  ESTIMATE_ROLES,
  DEFAULT_UNIT_PRICE,
  DEFAULT_BUFFER_RATE,
} from "./prompts";

/**
 * Claude Sonnet provider. Activated when AI_PROVIDER=claude and
 * ANTHROPIC_API_KEY is set. Validates every response with the same zod schemas
 * the mock uses, retrying once if the model returns non-JSON, then falls back
 * to a friendly error. Prompt caching is applied to the (reused) system rules.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  private _client: Anthropic | null = null;

  private get client(): Anthropic {
    if (!this._client) {
      this._client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this._client;
  }

  private async complete<T>(
    userPrompt: string,
    schema: ZodType<T>,
  ): Promise<T> {
    const run = async (extra?: string): Promise<string> => {
      const msg = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: BASE_RULES,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: extra ? `${userPrompt}\n\n${extra}` : userPrompt },
        ],
      });
      addUsage(msg.usage?.input_tokens ?? 0, msg.usage?.output_tokens ?? 0);
      const block = msg.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    };

    const parse = (raw: string): T | null => {
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      try {
        const result = schema.safeParse(JSON.parse(cleaned));
        return result.success ? result.data : null;
      } catch {
        return null;
      }
    };

    const first = parse(await run());
    if (first) return first;

    const second = parse(
      await run("有効なJSONのみを返してください。前後の説明は不要です。"),
    );
    if (second) return second;

    throw new Error("AIの出力を解析できませんでした。もう一度お試しください。");
  }

  async generateHearingSummary(
    ctx: HearingContext,
  ): Promise<OrganizedHearing> {
    const prompt = `次のヒアリング内容を整理し、以下のJSON形式で返してください。
案件名: ${ctx.project.projectName} / クライアント: ${ctx.project.clientName}
予算: ${ctx.project.budgetMin ?? "-"}〜${ctx.project.budgetMax ?? "-"}円

ヒアリング本文:
${ctx.rawText || "(未入力)"}

JSON形式:
{"summary": string, "confirmedFacts": string[], "assumptions": string[], "openQuestions": [{"category": string, "question": string}], "recommendedPhase": "requirements_consult"|"poc"|"mvp"|"full_dev"|"enterprise", "recommendedPlatform": "web"|"native"|"pwa", "recommendedDeployment": "cloud"|"on_prem"|"closed_network"|"hybrid", "risks": [{"type":"technical"|"budget"|"schedule","description": string}], "recommendedAiModel": string}`;
    return this.complete(prompt, organizedHearingSchema);
  }

  async generateOpenQuestions(
    ctx: HearingContext,
  ): Promise<OpenQuestionSet> {
    const prompt = `次のヒアリング内容から、クライアントへの追加質問をカテゴリ別に作成し、JSON配列で返してください。
ヒアリング本文:
${ctx.rawText || "(未入力)"}

JSON形式: [{"category": string, "questions": string[]}]`;
    return this.complete(prompt, openQuestionSetSchema);
  }

  private async buildDoc(
    type: DocumentType,
    ctx: GenerationContext,
  ): Promise<GeneratedDoc> {
    const defs = sectionsFor(type);
    const sectionList = defs
      .map((d) => `- ${d.key}: ${d.heading} — ${d.guide}`)
      .join("\n");
    const label = type === "rfp" ? "RFP" : "要件定義書";
    const tpl = type === "rfp" ? ctx.templates?.rfp : ctx.templates?.requirements;
    const tplBlock = tpl
      ? `\n\n## 標準テンプレート（章立て・標準文言。これをベースに、案件情報で具体化すること）\n${tpl}\n`
      : "";
    const prompt = `次の情報をもとに、${label}を作成してください。各セクションをMarkdownで記述します。

${serializeContext(ctx)}${tplBlock}

必要なセクション（この順序・このkeyで全て含めること）:
${sectionList}

JSON形式: {"title": string, "sections": [{"key": string, "heading": string, "markdown": string}]}`;
    const doc = await this.complete(prompt, generatedDocSchema);
    if (!doc.title) doc.title = docTitle(type, ctx.project);
    return doc;
  }

  async generateRfp(ctx: GenerationContext): Promise<GeneratedDoc> {
    return this.buildDoc("rfp", ctx);
  }

  async generateRequirements(
    ctx: GenerationContext,
  ): Promise<GeneratedDoc> {
    return this.buildDoc("requirements", ctx);
  }

  async regenerateSection(
    docType: DocumentType,
    sectionKey: string,
    ctx: GenerationContext,
    instruction?: string,
  ): Promise<DocSection> {
    const def = sectionsFor(docType).find((d) => d.key === sectionKey);
    const prompt = `次の情報をもとに、${docType === "rfp" ? "RFP" : "要件定義書"}の「${def?.heading ?? sectionKey}」セクションだけを書き直してください。
${instruction ? `指示: ${instruction}\n` : ""}
${serializeContext(ctx)}

JSON形式: {"key": "${sectionKey}", "heading": "${def?.heading ?? sectionKey}", "markdown": string}`;
    return this.complete(prompt, docSectionSchema);
  }

  async generateEstimate(ctx: GenerationContext): Promise<GeneratedEstimate> {
    const prompt = `次の情報をもとに、AI開発案件の工数見積（行項目）を作成してください。
人日単価は ${DEFAULT_UNIT_PRICE} 円、バッファ率は ${DEFAULT_BUFFER_RATE}、8時間=1人日。
各行は大項目(category)→中項目(subCategory)→小項目(taskName)の3階層で、approach(実装方針)とpurpose(開発目的)を付ける。
工数は activity ごとに「時間」で見積もる: design(設計) / implementation(実装) / test(テスト) / coordination(調整) / management(管理)。
役割(role)は次から選ぶ: ${ESTIMATE_ROLES.join(", ")}。
同じ大項目の行はまとめ、想定予算に概ね収まるよう時間を配分してください。

${serializeContext(ctx)}

JSON形式: {"estimateName": string, "defaultUnitPrice": number, "bufferRate": number, "lines": [{"category": string, "subCategory": string, "taskName": string, "approach": string, "purpose": string, "role": string, "design": number, "implementation": number, "test": number, "coordination": number, "management": number}]}`;
    const est = await this.complete(prompt, generatedEstimateSchema);
    if (!est.estimateName) est.estimateName = `${ctx.project.projectName} 見積`;
    return est;
  }

  async adjustEstimate(
    ctx: GenerationContext,
    current: GeneratedEstimate,
    instruction: string,
  ): Promise<GeneratedEstimate> {
    const prompt = `次の現行見積を、指示に従って調整してください。大項目・中項目・小項目の構成は保ちつつ、各activityの時間を見直します。
指示: ${instruction}

現行見積(JSON):
${JSON.stringify(current)}

${serializeContext(ctx)}

同じJSON形式で、調整後の見積全体を返してください:
{"estimateName": string, "defaultUnitPrice": number, "bufferRate": number, "lines": [{"category": string, "subCategory": string, "taskName": string, "approach": string, "purpose": string, "role": string, "design": number, "implementation": number, "test": number, "coordination": number, "management": number}]}`;
    return this.complete(prompt, generatedEstimateSchema);
  }

  async generateSchedule(ctx: GenerationContext): Promise<GeneratedSchedule> {
    const prompt = `次の情報をもとに、開発スケジュール（タスク + 依存関係 + マイルストーン）を作成してください。
各タスクに一意の taskKey (t1, t2, ...) を付け、dependencies には先行タスクの taskKey を入れます。
durationDays は営業日数。クライアント確認が必要なタスクは needsClientReview=true。
startDate は ${ctx.project.expectedDeliveryDate ? "希望納期から逆算した" : "本日以降の"} yyyy-mm-dd。

${serializeContext(ctx)}

JSON形式: {"scheduleName": string, "startDate": string, "tasks": [{"taskKey": string, "taskName": string, "phase": string, "durationDays": number, "assigneeRole": string, "dependencies": string[], "needsClientReview": boolean, "risk": string}], "milestones": [{"title": string, "afterTaskKey": string, "type": string, "isClientVisible": boolean}]}`;
    const sch = await this.complete(prompt, generatedScheduleSchema);
    if (!sch.scheduleName) sch.scheduleName = `${ctx.project.projectName} スケジュール`;
    if (!sch.startDate) sch.startDate = new Date().toISOString().slice(0, 10);
    return sch;
  }

  async adjustSchedule(
    ctx: GenerationContext,
    current: GeneratedSchedule,
    instruction: string,
  ): Promise<GeneratedSchedule> {
    const prompt = `次の現行スケジュールを、指示に従って調整してください。taskKey と依存関係の整合性は保ちます。
指示: ${instruction}

現行スケジュール(JSON):
${JSON.stringify(current)}

同じJSON形式で、調整後のスケジュール全体を返してください:
{"scheduleName": string, "startDate": string, "tasks": [{"taskKey": string, "taskName": string, "phase": string, "durationDays": number, "assigneeRole": string, "dependencies": string[], "needsClientReview": boolean, "risk": string}], "milestones": [{"title": string, "afterTaskKey": string, "type": string, "isClientVisible": boolean}]}`;
    return this.complete(prompt, generatedScheduleSchema);
  }

  async generateScreenDesign(
    ctx: GenerationContext,
  ): Promise<GeneratedDesign> {
    const prompt = `次の情報をもとに、画面設計（画面一覧 + 画面遷移 + システム構成図 + Claude Design向けプロンプト）を作成してください。
- screens: 各画面に一意の key（英小文字）、name、role、purpose、uiElements、states、priority(must/should/could)
- 各画面に wireframe（主要コンテンツのブロック構成、上から下の順）を付ける。kind は kpi/toolbar/search/table/cards/form/detail/chart/list/buttons/upload/auth/text から選び label に内容（例: 一覧画面=toolbar+table、詳細画面=detail+buttons、ログイン=auth、ダッシュボード=kpi+chart+list）
- transitions: from/to は screen の key、trigger は遷移のきっかけ
- architecture: layers は上位（利用者）から下位（データ/外部連携）への層。各層に components。edges は component名どうしの接続
- designPrompt: Claude Design に渡すUI/UX設計依頼プロンプト（アクセントカラー #264bf1）

${serializeContext(ctx)}

JSON形式: {"screens":[{"key":string,"name":string,"role":string,"purpose":string,"uiElements":string[],"states":string[],"priority":string,"wireframe":[{"kind":string,"label":string}]}],"transitions":[{"from":string,"to":string,"trigger":string,"description":string}],"architecture":{"layers":[{"name":string,"components":[{"name":string,"note":string}]}],"edges":[{"from":string,"to":string,"label":string}]},"designPrompt":string}`;
    return this.complete(prompt, generatedDesignSchema);
  }

  async adjustScreenDesign(
    ctx: GenerationContext,
    current: GeneratedDesign,
    instruction: string,
  ): Promise<GeneratedDesign> {
    const prompt = `次の現行の画面設計を、コメント（修正指示）に従って修正してください。画面・遷移・システム構成図の整合性を必ず保ってください（追加した画面には遷移を、削除した画面の遷移も削除、構成図も矛盾なく更新）。
コメント: ${instruction}

現行の画面設計(JSON):
${JSON.stringify(current)}

${serializeContext(ctx)}

同じJSON形式で、修正後の画面設計全体を返してください:
{"screens":[{"key":string,"name":string,"role":string,"purpose":string,"uiElements":string[],"states":string[],"priority":string,"wireframe":[{"kind":string,"label":string}]}],"transitions":[{"from":string,"to":string,"trigger":string,"description":string}],"architecture":{"layers":[{"name":string,"components":[{"name":string,"note":string}]}],"edges":[{"from":string,"to":string,"label":string}]},"designPrompt":string}`;
    return this.complete(prompt, generatedDesignSchema);
  }

  async generateScopeWbs(ctx: GenerationContext): Promise<ScopeWbsPlan> {
    const prompt = `あなたは経験豊富なITコンサルタント兼PMです。次の案件について、開発形態（契約形態）に最適化したスコープ定義とWBSをプロの観点で作成してください。
- 開発形態に応じて中身を変えること:
  - コンサル契約（準委任）: 調査→分析→AI活用方針→PoC計画→ロードマップ提言が中心。成果物は分析レポート/方針書/PoC計画/ロードマップ/最終報告など。
  - ウォーターフォール（請負）: 要件確定→設計→実装→テスト→検収・納品。成果物と検収基準を明確化。
  - 準委任契約（伴走）: スプリント単位の稼働ベース。完成保証はせず稼働の透明性を担保。
- formLabel: 開発形態の日本語ラベル
- approach: 進め方の要約（案件名・クライアント・つくるものを踏まえて具体的に）
- inScope / outOfScope / assumptions: 箇条書き
- deliverables: {name, description}
- wbs: フェーズ配列。各フェーズに name / objective / tasks[{name, deliverable, role, weeks}]

${serializeContext(ctx)}

JSON形式: {"formLabel":string,"approach":string,"inScope":string[],"outOfScope":string[],"assumptions":string[],"deliverables":[{"name":string,"description":string}],"wbs":[{"name":string,"objective":string,"tasks":[{"name":string,"deliverable":string,"role":string,"weeks":number}]}]}`;
    return this.complete(prompt, scopeWbsSchema);
  }

  async reviewConsistency(
    input: ConsistencyInput,
  ): Promise<ConsistencyReport> {
    const prompt = `あなたはAI開発会社の品質レビュアーです。次の案件の各成果物（要件定義 / 画面一覧・画面遷移 / 見積 / スケジュール / スコープ・WBS / 未確認事項 / 案件情報）の間の整合性・一貫性をプロの観点でレビューし、矛盾・不整合・抜け漏れを指摘してください。
重点観点:
- 見積 × 想定予算/月額（超過・乖離）
- スケジュール × 希望納期・提案期限
- 画面一覧/画面遷移 × 要件定義（画面の過不足、存在しない画面への遷移、孤立画面）
- 未確認事項の残存
- AIモデル選定の明記（AI開発として）
- 開発形態 × スコープ/WBS の整合
各指摘に severity(high/medium/low) / area(例「見積 × 予算」) / title / detail / suggestion を付与。整合している点は okPoints に列挙。

データ(JSON):
${JSON.stringify(input)}

JSON形式: {"summary":string,"okPoints":string[],"findings":[{"severity":"high"|"medium"|"low","area":string,"title":string,"detail":string,"suggestion":string}]}`;
    return this.complete(prompt, consistencyReportSchema);
  }

  async reviewRequirementsQuality(
    input: QualityInput,
  ): Promise<QualityReport> {
    const prompt = `あなたは要件定義のレビュー専門家です。次の要件定義書の本文そのものをレビューし、品質上の問題を指摘してください。
カテゴリ: ambiguity(あいまいさ) / contradiction(矛盾) / omission(抜け漏れ) / consideration(考慮漏れ) / proofreading(校正・読みやすさ)
- ambiguity: 「適切に」「柔軟に」等の曖昧表現や定量条件の欠如
- contradiction: 記述間の矛盾（導入形態・数値・前提など）
- omission: 必要な項目の不足（非機能/セキュリティ/データ/運用/AIモデル等）
- consideration: エラー時挙動・性能目標・個人情報など検討漏れ
- proofreading: 冗長/長文/用語不統一
各指摘に category / severity(high/medium/low) / section(該当見出し) / quote(問題箇所の引用) / issue(問題点) / suggestion(改善案) を付け、完成度の目安 score(0-100) と summary も返してください。

要件定義書(JSON):
${JSON.stringify(input.sections)}

JSON形式: {"summary":string,"score":number,"findings":[{"category":string,"severity":"high"|"medium"|"low","section":string,"quote":string,"issue":string,"suggestion":string}]}`;
    return this.complete(prompt, qualityReportSchema);
  }

  async generateSlideBullets(
    ctx: GenerationContext,
    topic: string,
  ): Promise<string[]> {
    const prompt = `提案スライドの1枚の本文を作成します。見出し「${topic}」に対する箇条書き（3〜5項目、各40字以内、提案資料として上品な日本語、具体的）を、次の案件情報に基づいて作成してください。プレースホルダは禁止。

${serializeContext(ctx)}

JSON形式: {"bullets": string[]}`;
    const res = await this.complete<{ bullets: string[] }>(
      prompt,
      slideBulletsSchema,
    );
    return res.bullets;
  }
}
