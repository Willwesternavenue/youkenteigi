<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 要件定義かけるくん Internal

社内向けプリセールス支援ツール。仕様: `docs/yokenteigi_kakerukun_internal_spec_v1.md`。実装済み: **コア生成スライス**（認証〜RFP/要件定義書生成〜MD/DOCX/PDF出力）＋ **見積**（行項目・自動集計・プラン別・自然言語調整・XLSX出力）＋ **スケジュール**（タスク/依存/クリティカルパス・ガントチャート・社内/クライアント2ビュー・自然言語調整・PDF出力）＋ **提案スライド**（提案デック自動構成・アプリ内プレビュー・編集可能PPTX/PDF出力、ブランド色 #264bf1）＋ **画面設計**（画面一覧・画面遷移図・システム構成図・Claude Design向けプロンプト生成）。

## 起動・確認

```bash
npm run setup && npm run dev   # http://localhost:3000
npm run build                  # 本番ビルド（検証ゲート。型チェック込み）
npm run db:reset               # DB を作り直す（data/app.db は gitignore）
```

DB は Supabase Postgres（`DATABASE_URL` 必須）。認証は **Supabase Auth のマジックリンク**（`@aidealab.com` のメールにログインリンク送信→クリック→`/auth/callback`、パスワード無し）。要 env: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`。シードユーザー: admin=`tachiiri@aidealab.com` ほかロール別。`profiles` が org/role の source of truth（email で照合）。`proxy.ts`（旧 middleware）がセッションcookieを毎リクエスト更新。

## アーキテクチャの絶対ルール（差し替え可能性を守る）

仕様が要求する「Supabase/GCP SDK をアプリ全体に散らさない」を厳守する。

- **アプリ/ルート/コンポーネント/サーバアクションは facade だけを import する**: `lib/auth.ts` `lib/db.ts` `lib/storage.ts` `lib/ai/providers.ts` `lib/export`。
- ドライバを直接 import してよいのは facade の中だけ:
  - `postgres` (postgres-js) → `db/client.ts` / `db/migrate.ts` / `db/seed.ts` のみ
  - `@supabase/ssr` (auth) → `lib/auth.ts` / `lib/supabase/*` / `app/auth/callback` / `proxy.ts` のみ
  - `@anthropic-ai/sdk` → `lib/ai/claude-provider.ts` のみ
  - `node:fs` (storage) → `lib/storage.ts` のみ
- DB の全テーブルに `organizationId`。repo メソッドは必ず `orgId` を先頭引数で受け、それで絞り込む（テナント分離は repo で担保）。
- DB は Supabase Postgres（`db/schema.ts` は `drizzle-orm/pg-core`）。json列は `jsonb`、行メタの時刻列は `timestamptz`（`mode: "string"` で読む）、業務日付（start_date 等）は `text`。アプリ実行は **transaction pooler**（:6543, `prepare:false`）、マイグレーション/seed は **direct接続/session pooler**（:5432）。
- カラム名は仕様 §17 の Postgres DDL と1:1。
- `documents` は追記専用。編集も「新バージョンの INSERT」（`getLatest` は version desc）。

## AIプロバイダ

`getProvider()` が `AI_PROVIDER=claude` かつ `ANTHROPIC_API_KEY` ありで `ClaudeProvider`、それ以外は `MockProvider`。両者は `lib/ai/prompts.ts` の同じ zod スキーマで出力検証するので UI/永続化はプロバイダ非依存。生成機能を足すときは ① `prompts.ts` にセクション定義/スキーマ ② `AIProvider` IF にメソッド ③ Mock と Claude 両方に実装。

## 出力（PDF/DOCX）

- ブラウザ不要。`marked` で Markdown→共通AST（`lib/export/markdown-ast.ts`）→ `to-docx.ts` / `to-pdf.ts`。
- PDF は日本語フォント `lib/export/fonts/NotoSansJP-Regular.ttf` を pdfmake の仮想FSに読み込んで埋め込む（無いと文字化け）。
- pdfmake は **コンパイル済みCJS** の `pdfmake/js/Printer` 等を使う（`pdfmake/src/*` は生ESMで bundler が解決できない）。`next.config.ts` の `serverExternalPackages` に `pdfmake`/`docx`/`exceljs`/`pptxgenjs`。
- バイナリ DL はサーバアクション不可。`app/api/export/[documentId]/route.ts`（runtime=nodejs）で `Content-Disposition` 付き Response を返す。

## UIの注意（shadcn = base-ui 版）

- `Button`/`Select` は `@base-ui/react`。`asChild` は無い → **`render` プロップ**。リンク/アンカーに render する時は `nativeButton={false}` を付ける。
- `Select` の `onValueChange` は `(value: string | null)`。null を考慮。`SelectValue` はデフォルトで**生の value**を表示する（ラベルにならない）。ラベル表示は関数 children を渡す: `<SelectValue>{(v) => LABELS[v]}</SelectValue>`。
- 新規案件の **開発形態（契約形態）** = `projects.development_form`（domain.ts の `DevelopmentForm`: quasi_mandate=準委任契約[既定] / consulting=コンサル契約（準委任） / waterfall=ウォーターフォール（請負））。`serializeContext` と Mock の `dev_form` セクションに反映。
- ページ＝RSC（`lib/db` を直接呼ぶ）。操作系＝client + `app/_actions/*` のサーバアクション（`app/_actions` はルーティング対象外）。
- **案件詳細のナビは2階層**: 左に縦の大分類メニュー＋各分類内は横タブ（`components/projects/project-nav.tsx` の `SECTIONS` と `ProjectNav`/`ProjectSubTabs`、`layout.tsx` で左 aside + 右コンテンツ）。フラットなルート（/hearing,/estimate 等）はそのままで、`SECTIONS` のグルーピングだけで2階層化している。タブ追加時は `SECTIONS` に seg/label を足す。
- **概要の項目**: `projects` に `description`（つくるもの）/ `project_stage`（PoC/MVP/本開発…= `ProjectStage`= `RecommendedPhase`、ヘッダーで `StageSelect` の色付きバッジ）/ `links`（json [{label,url}]、Notion議事録・Canva資料等）。編集は overview の `DescriptionCard`/`LinksCard` と `StageSelect` → `updateProjectMeta`。`serializeContext` にも description/stage を含める。
- **統一AIアシスタント**（`components/ai/assistant-panel.tsx`、layout の左 aside 下部）: 右スライドパネル。現在のタブを文脈に `見積/スケジュール/画面設計` の対象へ自動追従（手動変更可）し、`adjustEstimate`/`adjustSchedule`/`adjustScreenDesign` にルーティング＋会話ログ。layout 配下なのでタブ移動しても会話が残る。個別タブの調整ボックスも併存（併用方式）。

## 見積・スケジュールの要点

- 見積/スケジュールも documents と同じ **追記バージョン**（saveVersion で新 version + 子行を INSERT）。
- **見積の粒度**: estimate_items は **大項目(category)→中項目(subCategory)→小項目(taskName)** ＋各項目を **設計/実装/テスト/調整/管理(時間, 8h=1人日)** に分解（`hours*` 列）。金額=Σ(時間/8×単価)。計算は `lib/estimate-calc.ts`（`itemHours`/`itemAmount`/`hoursToDays`/`computeTotals`/`aggregateByCategory`/`aggregateByActivity`）。UIは `components/estimates/estimate-editor.tsx` で **大項目の折りたたみツリー**（高レベル小計→クリックで明細）＋全展開/全折りたたみ＋アクティビティ列の数値編集＋ⓘで実装方針/開発目的。XLSXは大項目グループ＋アクティビティ列。
- 日付・クリティカルパス・フェーズ集約・週/月グリッド線は `lib/schedule-calc.ts`（純関数、`gridLines()` は営業日軸上の月曜=週・1日=月）。ガント幾何/フェーズ集約/グリッドは `lib/schedule-view.ts` の `buildScheduleView` でページ/エクスポート/クライアント再計算を共通化。
- **ガントは双方向編集**: `components/schedule/gantt-chart.tsx` の棒の右端ドラッグ（pointer events, px→営業日換算）または表の日数入力 → `schedule-editor` が `buildScheduleView` でクライアント再計算（日程/CP/グリッド）→ `saveScheduleEdit`（durations を `toScheduleInput` で再計算し新 version）。
- **暦・祝日**: `lib/holidays.ts` の `japaneseHolidays(year)`（祝日法に基づき算出: 固定/ハッピーマンデー/春秋分点/振替休日/国民の休日。2000-2099 有効）。`buildNonWorking(start, span, periods)` で祝日＋カスタム休業期間を合成 → `computeSchedule(tasks, start, holidaySet)` が営業日から除外。`gridLines(start,end,{granularity,holidays})` が **週ベース=週/祝日線・月ベース=月のみ**。カスタム休業期間（お盆/年末年始）は `schedules.non_working_periods` json に保存し、generate/adjust/save/export/deck の全 `buildScheduleView`/`toScheduleInput` 呼び出しで periods を渡す（渡し忘れると日程がズレる）。
- AI は `generateEstimate`/`adjustEstimate`/`generateSchedule`/`adjustSchedule`（Mock+Claude）。自然言語調整は instruction を渡して全体を再生成 → saveVersion。
- 出力: 見積=XLSX（`exceljs`, `lib/export/to-xlsx.ts`）, スケジュール=PDF（pdfmake, `lib/export/to-schedule-pdf.ts` は `renderDocDefinition` を共有）。専用ルート `app/api/export/estimate/[id]` `…/schedule/[id]`。`exceljs` も `serverExternalPackages` に登録済み。

## 提案スライドの要点

- スライドは **AI生成せず**、要件定義書(documents)＋見積＋スケジュールから決定論的に構成（`lib/slides/deck.ts` の `buildDeck`、サーバ側ロードは `lib/slides/build.ts` の `loadDeck`）。1つの `Slide[]` モデルを **3レンダラ**が共有: HTMLプレビュー(`components/slides/slide-view.tsx`、container-query単位 `cqw` で main/サムネ兼用)、PPTX(`lib/export/to-pptx.ts`、pptxgenjs・編集可能)、PDF(`lib/export/to-slide-pdf.ts`、pdfmake 16:9)。
- ブランド色は **スライド限定**: `lib/slides/theme.ts`（#264bf1 / 補色#ff3131 / 本文#00032a）。アプリ本体UIは従来の紺のまま。
- **pdfmake スライドの z-order 落とし穴**: フロー canvas は absolutePosition テキストの**上**に描画される。図形は per-page `background`（canvas のみ）、テキストは `content`（absolutePosition）に分離して重ねる（白抜き文字が消えないように）。座標は 0–960×0–540 の点グリッド（PDFは恒等、PPTは `/96` でinch、フォントは cqw*7.2pt）。ページ外の canvas 矩形は `otherArray.forEach` エラーになるので必ず収める（アジェンダは項目数で 2/3 列・行高を可変に）。
- 専用ルート `app/api/export/slides/[projectId]?format=pptx|pdf`（projectId 基点。複数ソースを束ねるため document 単位ではない）。`pptxgenjs` も `serverExternalPackages`。

## 図（画面遷移・アーキ）の要点

- **方式: 構造化＋自前描画**。AIが構造化データ（screens/transitions、architecture の layers/edges）を生成 → `lib/diagram/scene.ts` の `layoutScreenFlow`/`layoutArchitecture` が **1つの `DiagramScene`**（boxes+arrows、論理座標）を作る → 3レンダラが共有: SVG(`components/diagram/diagram-svg.tsx`、in-app)、PDF/PPTX はスライドの `diagram` 種別として `lib/diagram/place.ts` の `placeScene` でスライド座標へスケール。**PPTでは図形が編集可能**。Mermaid不採用（ブラウザ無しで画像化できずエクスポート不整合・非編集）。
- 箱のタイトルは **幅に応じてフォント自動縮小**（`(w*0.86)/title.length`）で溢れ防止。PDFは白抜き文字のため図形=背景canvas／テキスト=content の z-order 分離を踏襲（[提案スライドの要点]参照）。
- 画面設計は append バージョン: `screen_designs`(親=architecture/designPrompt) + `screens`(各画面に `wireframe` json=UIブロック列) + `screen_transitions`（spec §17.13/§17.14）。生成は `generateScreenDesign`（Mock+Claude、screens/transitions/architecture/designPrompt/wireframe を1回で）。提案デックに「システム構成案」「画面遷移」スライドとして自動挿入（`buildDeck` が `design` あれば追加）。
- **タブは2つに分割**: `画面設計`(/design = システム構成図＋画面一覧＋Claude Designプロンプト) と `画面遷移`(/transition = 画面遷移図＋各画面の**ワイヤーフレーム**)。ワイヤーフレームは `components/design/wireframe-view.tsx` が `WireframeBlock[]`(kind: kpi/toolbar/search/table/cards/form/detail/chart/list/buttons/upload/auth/text)を低忠実度モックに決定論的描画（ブランド色 #264bf1）。コメント修正(`adjustScreenDesign`)はどちらのタブからも可。
- **図のコメント修正**: `adjustScreenDesign(ctx,current,instruction)`（Mock+Claude）で整合性を保ったまま全体を再生成→新 version。**要件定義への波及**: `applyDesignToRequirements` が `regenerateSection` で `screen_list`/`screen_transition`/`system_overview` を再生成し要件定義書を新 version 保存。これを効かせるため `GenerationContext.design` を追加し、`buildGenerationContext` が最新設計をロード、`serializeContext`（Claude用）と Mock の該当セクションが設計から導出する。
- Mockは具体的内容を出す（プレースホルダ排除）。サンプル案件のヒアリングは `db/seed.ts` に詳細記述（具体数値・固有名）。

## 次のスライス候補（仕様の未実装分）

機能優先度（feature_priorities, Must/Should/Could/Later/OoS）、レビュー・コメント・承認（reviews/comments/approvals）、ファイルアップロード（storage facade は実装済み）、過去案件RAG。`db/schema.ts` 追記 → `npm run db:generate` → `lib/db.ts` に repo 追加、の順。
