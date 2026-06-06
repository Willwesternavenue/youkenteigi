# 引き継ぎメモ: Vercel + Supabase 移行 ＆ 管理画面設計

> このファイルは、コンテキストが満杯になった会話からの引き継ぎ用。新スレッドはこれと
> `AGENTS.md` / `CLAUDE.md` / `docs/yokenteigi_kakerukun_internal_spec_v1.md` を読めば再開できる。
> 作成: 2026-06-06。

---

## 0. 現状サマリー（何が出来ているか）

`要件定義書けるくん Internal`（社内プリセールス支援）。Next.js 16(App Router/RSC + server actions) + React 19 + TS strict + Tailwind v4 + shadcn(**base-ui版**)。

**実装済みスライス（すべてローカルで動作・未コミット・リモート無し）:**
- 認証（iron-session dev cookie、@aidealab.com のみ、パスワード無し、ロール別7名シード）
- 案件CRUD + ダッシュボード + **案件の進捗トラッキング**（`lib/project-progress.ts` + ヘッダーのステッパー/次アクションCTA）
- 議事録（初回ヒアリング入力 / AI整理 / 追加質問 / 打ち合わせ履歴 / 資料=ファイルアップロードMP3等＋受領資料リンク＋参考情報＋関連リンク）
- RFP（18節）/ スコープ・WBS（開発形態別）/ 要件定義（26節＋AIモデル選定）＋**品質チェック**（曖昧/矛盾/抜け漏れ/考慮漏れ/校正）
- 画面設計（システム構成図 / 画面一覧 / 画面遷移=Figma風フロー＋ワイヤー＋拡大モーダル＋ズーム）
- 見積（3階層・アクティビティ工数・プラン別・自然言語調整・XLSX）
- スケジュール（ガント=px基準ズーム/週(W1..)・月ビュー、CP、祝日、社内/クライアント2ビュー、PNG/PDF）
- 提案スライド（**編集可能デック**=空ページ追加/並替/AIで埋める、PPTX/PDF、AIdeaLabブランド表紙＆エンドカード）
- レビュー・承認（ピアレビューコメント＋承認/差し戻し＋**対応済みマーク**）＋**整合性チェック**（成果物横断）
- 統一AIアシスタント（右ドッキング）
- 出力: MD/DOCX/PDF/XLSX/PPTX/PNG。ロゴ `components/brand/logo.tsx`（AIdeaLab、#3D5AFE）。

**直近のコードレビュー（CodeRabbit + Superpowersサブエージェント）で修正済み:** storageパストラバーサル、place.tsゼロ除算、scene.ts BFS整理、schedules endToKey、save系アクションのtry/catch化＋projectId所有チェック、各種境界チェック。`tsc --noEmit` / `npm run build` 通過。

---

## 1. アーキテクチャの絶対ルール（移行で活きる設計）

**ドライバは facade の中だけで import**（差し替え前提）:
- `@libsql/client` → `db/client.ts` のみ
- `iron-session` → `lib/auth.ts` / `lib/session-cookie.ts` のみ
- `@anthropic-ai/sdk` → `lib/ai/claude-provider.ts` のみ
- `node:fs`(storage) → `lib/storage.ts` のみ
- アプリ/ルート/アクション/コンポーネントは facade だけ import: `lib/auth.ts` `lib/db.ts` `lib/storage.ts` `lib/ai/providers.ts` `lib/export`

**重要な不変条件:**
- 全テーブルに `organizationId`。repoメソッドは必ず `orgId` を先頭引数で受けて絞る（テナント分離は repo で担保）。
- カラム名は spec §17 の Postgres DDL と1:1（**PG移行で `db/schema.ts` を再利用するための設計**）。
- documents/estimates/schedules/screen_designs/decks/各reports は**追記バージョン**。

→ つまり **Supabase/Vercel 移行はfacade差し替えが中心**で、アプリ層・UIはほぼ触らない。

---

## 2. Vercel + Supabase 移行プラン

### 2.1 DB: libSQL(SQLite) → Supabase Postgres
- `db/client.ts` を `drizzle-orm/postgres-js`（または `@vercel/postgres`/`postgres`）に差し替え。`DATABASE_URL` を Supabaseのconnection string（**pooler / pgbouncer 経由**、Vercelサーバレス前提）に。
- `db/schema.ts`: 列名は既にPG互換。要調整点:
  - `text(... { mode: "json" })` → PGは `jsonb`（Drizzleの `jsonb(...)` に置換）。対象列: projects.links/meetingNotes/receivedMaterials/referenceLinks、hearings.confirmedFacts/assumptions/openQuestions/risks、documents.contentJson/metadata、screen_designs.architecture、screens.wireframe/uiElements/states、schedules.nonWorkingPeriods、scope_plans.plan、decks.slides、quality_reports.report、consistency_reports.report、files など。
  - `integer(... { mode: "boolean" })` → PGは `boolean`。
  - `text("created_at").default(now)` の `now`（現状ISO文字列）→ PGは `timestamptz default now()`。日付/時刻列の型を見直す（アプリはISO文字列前提なので、`timestamp({ mode: "string" })` 等で互換を取ると改修が最小）。
  - id: 現状 `text` + `crypto.randomUUID()`。PGでは `uuid default gen_random_uuid()` でも、**現行どおり text/uuidをアプリ生成のままでも可**（spec DDLは uuid）。最小改修なら text のままでよい。
- `drizzle.config.ts` を `dialect: "postgresql"` に変更し、`db/migrations` をPG用に再生成（既存のSQLite用 0001〜0017 は破棄して初回PGマイグレーションを作り直す想定）。
- `lib/db.ts` の repo 実装はDrizzleクエリなので**ほぼ無変更**で動くはず（`database.query.*` / `select().from()` はPGでも同API）。要確認: `desc()`/`and()`/`eq()` はそのまま。
- `next.config.ts` `serverExternalPackages` から `@libsql/client` を外す（pdfmake/docx/exceljs/pptxgenjs は残す）。

### 2.2 Auth: iron-session → Supabase Auth（Google Workspace SSO）
- 方針: **Supabase Auth + Google OAuth**（@aidealab.com ドメイン制限）。`@supabase/ssr` でサーバ側セッション。
- `lib/auth.ts` の `getSession()/requireUser()/signIn()/signOut()/requireRole()` の**シグネチャを維持**したまま中身をSupabaseに差し替え（呼び出し側は無変更）。
- `SessionUser { userId, orgId, email, name, role }` を維持。`orgId`/`role` は `profiles` から引く（初回ログイン時に profiles upsert＝既存ロジック踏襲、§spec 4.x）。
- ドメイン制限: `ALLOWED_DOMAIN`(@aidealab.com) を OAuth コールバックで検証。
- `lib/session-cookie.ts` は不要化 or Supabaseクッキーラッパに。
- **RLS**: Supabaseなら Row Level Security を `organization_id = auth.jwt()->>'org_id'` で張るのが理想だが、まずはアプリ層(repoのorgId絞り込み)で担保済みなので**段階導入可**。本番ではRLSも追加推奨。

### 2.3 Storage: local fs → Supabase Storage
- `lib/storage.ts` の `put/get/exists/delete` を Supabase Storage SDK に差し替え（バケット例: `project-files`）。`safePath` のパス検証は不要（Storage側のキー）。`STORAGE_ROOT` env は廃止。
- ダウンロードは現状 `/api/files/[fileId]`（org絞りでDB照合→ストリーム）。Supabaseでは **signed URL** を返す方式に変えると効率的（ただしorg認可はサーバ側で）。
- 大容量(MP3最大300MB): Vercelのリクエストボディ上限に注意。**クライアント→Supabase直アップロード（signed upload URL）**に切り替えるのが理想（現状はroute handler経由）。

### 2.4 AI: Mock/Claude
- `getProvider()` は `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` で Claude。本番は env をVercelに設定。
- 推奨: **Vercel AI Gateway** 経由（モデル切替・コスト可観測・データ非学習）。`lib/ai/claude-provider.ts` のクライアント初期化のみ差し替え（facade内）。
- 生成のストリーミング化は別タスク（現状は完了待ちブロッキング）。

### 2.5 Vercel デプロイ
- フレームワークNext.js。バイナリ生成ルートは `runtime = "nodejs"` 済み。`serverExternalPackages`（pdfmake/docx/exceljs/pptxgenjs）維持。
- 日本語フォント `lib/export/fonts/NotoSansJP-Regular.ttf` は同梱維持（pdfmakeに必要）。
- **env（Vercel + .env.local）**: `DATABASE_URL`(Supabase pooler) / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `AI_PROVIDER` / `ANTHROPIC_API_KEY`（or AI Gateway） / Google OAuth client id/secret / セッションsecret。
- Supabase は Vercel Marketplace 連携で provision するとenv自動注入。

### 2.6 移行の進め方（順序）
1. Supabase project 作成（Marketplace経由）。`drizzle.config.ts` をpg化 → 初回マイグレーション生成 → push。
2. `db/client.ts` をpg driverに差し替え、`db/schema.ts` の json/boolean/timestamp を調整。`npm run build` で型確認。
3. seed をPG向けに（`db/seed.ts` はDrizzle経由なのでほぼ流用可）。
4. `lib/storage.ts` を Supabase Storage に。
5. `lib/auth.ts` を Supabase Auth(Google)に（最後でよい。開発中はdev cookieのままでも可）。
6. Vercel デプロイ＋env。
7. （任意）RLS、signed URLアップロード、AI Gateway、ストリーミング。

---

## 3. 管理画面（/admin）設計 ★今回の主依頼

### 3.1 目的・対象
- 対象: `admin`（一部 `manager`）。`requireRole(user, "admin.*")` で保護。`/admin` 配下に専用レイアウト（左メニュー）。
- 目的: チーム導入の即戦力化（属人化解消・品質平準化・運用/コスト可視化・テナント管理）。

### 3.2 情報設計（メニュー＝サブ機能）
1. **ダッシュボード（管理）** — 全案件横断: ステータス別件数、レビュー待ち/承認待ち、未対応コメント数、今月のAI利用/コスト、期限間近の提案。
2. **ユーザー・ロール** — `profiles` 一覧、招待（メール）、ロール変更、無効化/再有効化、最終ログイン。RBACマトリクス表示。
3. **組織設定** — 組織名、`email_domain`、ブランド（ロゴ/カラー、提案スライドや出力に反映）、データ保管方針（リージョン/保持期間）。
4. **レートカード** — 役割別の人日/月単価（見積の単価ソース化）。複数バージョン/有効期間。→ **新テーブル `rate_cards`**。見積生成・`MonthlyBudgetRow`・estimate-calc が参照。
5. **テンプレート** — RFP/要件/提案の標準文言・章立て・契約条項のライブラリ。案件作成時に選択 → 生成のベース/挿入に。→ spec §17.18 `templates`（未実装）。RAG導入の足がかり。
6. **マスタ設定** — 開発形態(DevelopmentForm)・ステージ(ProjectStage)・コメント種別・承認ステータス等の表示/既定値。現状コードのenum/LABELSを設定化（最小はコードのままでも可）。
7. **AI設定** — provider/モデル、既定AIモデル推奨、プロンプト上書き（`lib/ai/prompts.ts`の章ガイド）、月次コスト上限・アラート。→ **新テーブル `ai_settings`**（org単位）。
8. **監査ログ** — `audit_logs`（既存テーブル・UI未実装）の閲覧/フィルタ（誰が・いつ・何を）。各server actionに記録を仕込む（現状未記録）。
9. **利用状況/コスト** — 案件別・ユーザー別のAI生成回数/トークン/費用。→ **新テーブル `ai_usage`**（生成毎に記録）。
10. **データ/エクスポート** — 案件の一括エクスポート、削除/アーカイブ、保持ポリシー。

### 3.3 データモデル追加（spec §17 と整合させる）
- `rate_cards`(id, organization_id, name, role, daily_rate, monthly_rate, valid_from, valid_to, created_by, created_at)
- `templates`(spec §17.18: id, organization_id, type, name, content jsonb, is_default, created_by, created_at)
- `ai_settings`(id, organization_id unique, provider, default_model, monthly_budget, prompt_overrides jsonb, updated_at)
- `ai_usage`(id, organization_id, project_id, user_id, feature, model, input_tokens, output_tokens, cost, created_at)
- `audit_logs` は**既存**（`auditLogs` in db/schema.ts、未使用）。UIと記録ロジックを足す。
- 招待: Supabase Auth invite を使うなら専用テーブル不要。独自なら `invitations`。
- 既存 `organizations` に branding/設定列追加（logo_url, brand_color, data_region, retention_days 等）。

### 3.4 RBAC 追加（`lib/rbac.ts`）
- 新permission: `admin.access`(admin), `admin.users`(admin), `admin.org`(admin), `admin.ratecard`(admin,manager), `admin.templates`(admin,manager), `admin.ai`(admin), `admin.audit`(admin)。
- `/admin/layout.tsx` で `requireRole(user, "admin.access")`、無権限はリダイレクト。

### 3.5 ルーティング/実装パターン（既存に倣う）
- `app/(app)/admin/{page,layout}.tsx` + サブ: `users/`, `org/`, `rate-cards/`, `templates/`, `ai/`, `audit/`, `usage/`。
- ページ=RSC（`lib/db`直）、操作=client + `app/_actions/admin.ts`。
- repo追加: `db/schema.ts` 追記 → `npm run db:generate` → `lib/db.ts` に `db.rateCards` `db.templates` `db.aiSettings` `db.aiUsage` `db.audit` repo（全て orgId 先頭）。
- UIは shadcn(base-ui) のTable/Select/Dialog（既存 `components/ui/*`）。base-ui 注意点は AGENTS.md 参照（`render`プロップ、`SelectValue` 関数children等）。

### 3.6 管理画面の優先順位（推奨ビルド順）
1. `/admin` レイアウト＋ガード＋管理ダッシュボード（既存 `db.review.summary` 等の集計で早く価値）
2. ユーザー・ロール管理（導入時に必須）
3. レートカード（見積に直結）＋テンプレート（品質平準化）
4. AI設定＋利用/コスト（運用・ROI）
5. 監査ログ（各actionに記録を仕込みつつ）

---

## 4. 主要ファイル地図
- 設計の絶対ルール: `AGENTS.md`（＝`CLAUDE.md`）。仕様: `docs/yokenteigi_kakerukun_internal_spec_v1.md`（§17 にPG DDL）。
- DB: `db/schema.ts` / `db/client.ts`(ドライバ) / `lib/db.ts`(repo facade) / `db/seed.ts` / `db/migrations/*`。
- 認証/権限: `lib/auth.ts` / `lib/session-cookie.ts` / `lib/rbac.ts` / `types/domain.ts`(Role/LABELS等)。
- ストレージ: `lib/storage.ts` / `app/api/files/*`。
- AI: `lib/ai/{providers,mock-provider,claude-provider,prompts,context,consistency-input}.ts`。
- 出力: `lib/export/*` / `app/api/export/*`（runtime=nodejs）。
- 画面: `app/(app)/projects/[projectId]/*`（タブ群）、`components/*`、ナビ `components/projects/project-nav.tsx`(SECTIONS)。
- 起動: `npm run setup && npm run dev` / 検証ゲート `npm run build` / `npm run db:reset`。

## 5. 既知の注意点（移行で踏みやすい）
- json列はPGで `jsonb` に。boolean/timestampの型差。日付はアプリ全体ISO文字列前提（schedule-calc等）。
- pdfmakeは `pdfmake/js/Printer`（コンパイル済CJS）。`serverExternalPackages` 維持。日本語フォント同梱。
- base-ui の Select/Button は `asChild`無し→`render`、`SelectValue`はデフォルト生value表示（関数childrenでラベル化）。
- 大容量アップロードはVercelボディ上限 → Supabase signed upload 推奨。
- 現状リモート無し・全未コミット。移行着手前に **git init的にコミット**しておくと差分が追える（ユーザー指示があれば実施）。

---

### 次スレッドへの最初の一言（例）
「`docs/HANDOFF-vercel-supabase-admin.md` を読んで。まず §2 のVercel+Supabase移行（DBドライバ＋schema json/boolean調整）から着手、その後 §3 の /admin をビルド順1→の通りに。facadeの外は触らない方針で。」
