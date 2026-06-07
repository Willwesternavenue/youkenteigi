# 要件定義かけるくん Internal

AI開発会社の社内向けプリセールス支援ツール。初回商談のヒアリング内容をもとに、**RFP** と **要件定義書** を生成し、編集・バージョン管理し、**Markdown / Word(DOCX) / PDF** で出力できます。

> 本リポジトリは仕様書（[`docs/yokenteigi_kakerukun_internal_spec_v1.md`](docs/yokenteigi_kakerukun_internal_spec_v1.md)）の **コア生成スライス** を実装したものです。見積・スケジュール・ガント・画面設計・提案PPT・レビュー承認は今後のスライスで追加します。

## クイックスタート

```bash
npm install
cp .env.example .env.local   # DATABASE_URL に Supabase Postgres を設定
npm run setup     # Postgres にマイグレーション適用・初期データ投入
npm run dev       # http://localhost:3000
```

DB は Supabase Postgres が必要です（`DATABASE_URL`）。AI は既定で決定論的なモック（APIキー不要）。

### ログイン（ローカル開発）

パスワード不要。`@aidealab.com` のメールアドレスでログインします。初期データに以下のユーザーが登録されています（ロール別）:

```
admin@aidealab.com / manager@ / sales@ / pm@ / engineer@ / designer@ / viewer@
```

`@aidealab.com` 以外のアドレスは拒否されます。未登録の社内アドレスは初回ログイン時に `viewer` として自動作成されます。

## 実Claude Sonnetを使う

`.env.local` を作成し（`.env.example` 参照）:

```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

未設定ならモックプロバイダで動作します。アプリ側のコードは一切変わりません。

## 主な機能

| 機能 | 説明 |
|---|---|
| 認証 | dev cookie セッション + `@aidealab.com` ドメイン制限 + ロール (RBAC) |
| 案件管理 | 作成 / 一覧（検索・絞り込み）/ 詳細タブ / ステータス変更 / ダッシュボード |
| ヒアリング | 商談内容・議事録のテキスト入力 |
| AI整理 | 確認済み / 推定 / 未確認 / リスク / 推奨フェーズ・形態・導入形態 |
| 追加質問 | カテゴリ別のクライアント確認事項 |
| RFP生成 | 18セクション（仕様 §9.2）。セクション編集・再生成 |
| 要件定義書生成 | 26セクション（仕様 §10.2）。セクション編集・再生成 |
| 見積 | **大項目→中項目→小項目**の3階層＋**設計/実装/テスト/調整/管理（時間）**の工数分解。高レベル（大項目小計）の**折りたたみツリー**でクリック展開・全展開/全折りたたみ・行ごと編集・自動集計（バッファ/税）・アクティビティ別/大項目別集計・プラン別・自然言語調整・XLSX出力（仕様 §11） |
| スケジュール | タスク/依存/期間/担当・クリティカルパス・ビジュアルガントチャート・社内詳細/クライアント共有の2ビュー・マイルストーン・自然言語調整（「PoCを8週間にして」）・PDF出力（仕様 §12） |
| 画面設計 | 案件情報・要件定義から **画面一覧**（目的/UI要素/状態/優先度）・**画面遷移図**・**システム構成図**・**Claude Design向けプロンプト**を生成。図はAIが構造化データを生成し自前描画（アプリ内SVG＋編集可能PPTX図形＋PDF、ブラウザ不要）（仕様 §13） |
| 提案スライド | 要件定義書＋見積＋スケジュール＋画面設計（構成図・画面遷移）から提案デックを自動構成・アプリ内スライドプレビュー（16:9・サムネイル一覧）・**編集可能な PowerPoint(.pptx) / PDF** に書き出し。スライド基調色 #264bf1（仕様 §13・§14） |
| バージョン管理 | 保存ごとに新バージョンを追記（履歴は不変） |
| 出力 | Markdown / DOCX / PDF / XLSX / PPTX（日本語フォント埋め込み済み） |

## アーキテクチャ（差し替え可能な抽象化レイヤー）

仕様の要求どおり、Supabase / Google Cloud SDK をアプリ全体に散らさず、すべて facade 経由でアクセスします。**アプリ・ルート・コンポーネントのコードは facade だけを import** します。

| Facade | ローカル実装 | 将来の差し替え先 |
|---|---|---|
| [`lib/auth.ts`](lib/auth.ts) | iron-session (暗号化cookie) | Supabase Auth / Google Identity Platform |
| [`lib/db.ts`](lib/db.ts) | Drizzle + Supabase Postgres (postgres-js) | Cloud SQL for PostgreSQL |
| [`lib/storage.ts`](lib/storage.ts) | ローカルファイルシステム | Supabase Storage / Cloud Storage |
| [`lib/ai/providers.ts`](lib/ai/providers.ts) | Mock / Claude Sonnet | GPT / Gemini 追加 |
| [`lib/export/`](lib/export) | docx / pdfmake (ブラウザ不要) | — |

DB ドライバは [`db/client.ts`](db/client.ts) に隔離（postgres-js）、スキーマは [`db/schema.ts`](db/schema.ts)（`drizzle-orm/pg-core`、カラム名は仕様 §17 の Postgres DDL と1:1）、repo は [`lib/db.ts`](lib/db.ts)。全テーブルに `organization_id` を持たせ、将来のSaaS化（マルチテナント）に対応しています。

## スクリプト

```bash
npm run dev          # 開発サーバ
npm run build        # 本番ビルド
npm run setup        # マイグレーション + 初期データ
npm run db:reset     # DBを初期化して作り直す
npm run db:generate  # スキーマ変更からマイグレーションSQLを生成
npm run typecheck    # 型チェック
```

## 技術スタック

Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / shadcn(base-ui) / Drizzle ORM + Supabase Postgres (postgres-js) / iron-session / zod / @anthropic-ai/sdk / docx / pdfmake / exceljs / pptxgenjs / marked
