# 要件定義書けるくん Internal 仕様書 v1.0

最終更新日: 2026-06-04  
アプリ名: 要件定義書けるくん Internal  
利用ドメイン: aidealab.com  
初期用途: 自社用社内Webアプリ  
初期ログイン許可: `@aidealab.com` のGoogleアカウント  
初期構成: Next.js + Supabase  
将来方針: 社内利用で磨いた後、Google Cloud移行およびSaaS化を検討

---

## 0. この仕様書の目的

この仕様書は、Claude Code / Claude Design にそのまま渡して、最速でMVP開発を開始できるように整理した開発仕様である。

本アプリは、AI開発会社がクライアントとの初回商談・ヒアリング・録音音声・議事録・参考資料をもとに、RFP、要件定義書、見積、開発スケジュール、ガントチャート、画面一覧、画面遷移、提案PPT/PDFを生成し、社内レビュー・コメント・承認まで行える社内向けWebアプリである。

---

## 1. プロダクト概要

### 1.1 一言での定義

AI開発会社の社内メンバーが、初回商談の音声・議事録・参考資料から、RFP、要件定義書、提案PPT、PDF、見積、開発スケジュール、ガントチャート、画面一覧、画面遷移を自動生成し、必須機能とオプション機能を自然言語で切り分けながら、同僚・上司によるレビュー・承認まで完結できる、プリセールス特化型AI要件定義支援システム。

### 1.2 初期利用シーン

AI開発会社の営業、PM、プリセールス、エンジニア、デザイナー、上司が、初回商談後に以下を素早く作成する。

- ヒアリング内容整理
- クライアントへの追加質問
- RFPドラフト
- 要件定義書
- 提案用PPT
- 提案用PDF
- 工数見積
- 開発スケジュール
- ガントチャート
- クライアント共有用スケジュール
- 画面一覧
- 画面遷移
- Claude Design向けUI設計依頼プロンプト

### 1.3 想定案件規模

主な対象案件は、AI開発案件のうち以下の規模をボリュームゾーンとする。

- 700万円〜3,000万円程度

ただし、以下のレンジにも対応する。

| 案件タイプ | 想定金額 |
|---|---:|
| 要件定義コンサル | 100万円〜500万円 |
| 小規模PoC | 300万円〜700万円 |
| 標準PoC | 500万円〜1,200万円 |
| MVP開発 | 700万円〜1,500万円 |
| 本開発 | 1,500万円〜3,000万円 |
| エンタープライズ開発 | 3,000万円以上 |

---

## 2. 初期開発方針

### 2.1 最初は社内Webアプリ

最初からSaaSとして作らない。  
まずは `aidealab.com` ドメイン内の社内ユーザーが使えるWebアプリとして構築する。

社内利用で以下を磨く。

- 業務フロー
- UI/UX
- ヒアリング整理ロジック
- RFPテンプレート
- 要件定義書テンプレート
- 見積ロジック
- スケジュール生成ロジック
- PPT出力テンプレート
- レビュー・承認フロー

うまく機能すれば、将来的に外販・SaaS化を検討する。

### 2.2 初期はSupabaseで高速開発

初期MVPはSupabaseを使う。

理由:

- 認証が早い
- PostgreSQLがすぐ使える
- Storageがすぐ使える
- Next.jsとの相性がよい
- Claude Codeで実装しやすい
- 社内フィードバックを早く回収できる

### 2.3 将来的なGoogle Cloud移行を想定

将来的にはGoogle Cloudへ移行する可能性がある。

| 初期MVP | 将来 |
|---|---|
| Supabase PostgreSQL | Cloud SQL for PostgreSQL |
| Supabase Auth | Google Identity Platform |
| Supabase Storage | Cloud Storage |
| Vercel / Cloud Run | Cloud Run |
| 環境変数 | Secret Manager |
| Vercel Logs | Cloud Logging |
| API Routes | Cloud Run / Cloud Tasks / Pub/Sub |

そのため、Supabase SDKへの依存をアプリ全体に散らさない。

必ず以下の抽象化レイヤーを作る。

```text
lib/auth.ts
lib/db.ts
lib/storage.ts
lib/ai/providers.ts
```

---

## 3. 技術スタック

### 3.1 MVP推奨構成

| 領域 | 技術 |
|---|---|
| フロントエンド | Next.js |
| 言語 | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| 認証 | Supabase Auth |
| DB | Supabase PostgreSQL |
| Storage | Supabase Storage |
| AI | Claude Sonnet API |
| 将来AI候補 | GPT / Gemini |
| PPT生成 | pptxgenjs |
| PDF生成 | Playwright or Puppeteer |
| DOCX生成 | docx |
| XLSX生成 | xlsx |
| ガントチャート | React Gantt系ライブラリ |
| デプロイ | Vercel または Cloud Run |

### 3.2 初期デプロイ

最速開発なら以下。

```text
Next.js
Vercel
Supabase
Claude Sonnet API
```

Google Cloud移行を意識するなら以下。

```text
Next.js on Cloud Run
Supabase
Claude Sonnet API
```

MVPではどちらでもよいが、コードはNext.js標準構成で作る。

---

## 4. 認証・組織設計

### 4.1 初期ログイン制限

初期MVPでは、以下のドメインのユーザーのみログイン可能とする。

```text
aidealab.com
```

許可条件:

- メールアドレスが `@aidealab.com` で終わること
- Supabase Authでログインできること
- 初回ログイン時に `profiles` にユーザー情報を作成すること
- 未承認ユーザーは必要に応じて `viewer` とする

### 4.2 将来SaaS化を見据えた設計

社内用でも、すべての主要テーブルに `organization_id` を持たせる。

これにより、将来的に複数企業で利用可能なSaaSへ拡張できる。

### 4.3 ロール

```text
admin
manager
sales
pm
engineer
designer
viewer
```

### 4.4 ロール別の主な権限

| ロール | 主な権限 |
|---|---|
| admin | 全体管理、ユーザー管理、ロール管理、テンプレート管理、AI設定 |
| manager | レビュー、承認、差し戻し、見積確認 |
| sales | 案件作成、ヒアリング入力、資料生成、レビュー依頼 |
| pm | 要件定義編集、見積編集、スケジュール編集、コメント対応 |
| engineer | 技術構成レビュー、AIモデル選定レビュー、工数コメント |
| designer | 画面一覧・画面遷移レビュー、UI/UXコメント |
| viewer | 閲覧のみ |

---

## 5. MVP必須機能

MVPで必ず作る機能。

1. ログイン
2. 案件管理
3. ヒアリング入力
4. ファイルアップロード
5. AI要件整理
6. 追加質問生成
7. RFP生成
8. 要件定義書生成
9. 見積生成
10. 必須 / オプション切り分け
11. 開発スケジュール生成
12. ガントチャート生成
13. クライアント共有用スケジュール生成
14. 画面一覧生成
15. 画面遷移生成
16. Claude Design向けプロンプト生成
17. PPTX出力
18. PDF出力
19. DOCX出力
20. XLSX見積出力
21. コメント
22. レビュー依頼
23. 承認・差し戻し
24. バージョン管理
25. 監査ログ
26. 設定画面

---

## 6. MVPでは後回しにする機能

初期MVPでは作らない。

- SaaS課金
- Stripe連携
- 外部企業向けマルチテナント管理UI
- 契約書ドラフト生成
- CRM連携
- Slack連携
- Teams連携
- Google Docs連携
- Google Slides連携
- 過去案件RAG
- 高度な利益率分析
- 電子契約連携

ただし、契約書ドラフト連携のために必要なデータ項目はDBに持たせる。

---

## 7. 主要画面

### 7.1 ログイン画面

機能:

- Googleログイン
- メールログイン
- `@aidealab.com` ドメイン制限
- 未許可ドメインの場合はアクセス不可表示
- 未承認ユーザーの場合は管理者承認待ち表示

### 7.2 ダッシュボード

表示内容:

- 自分の案件
- レビュー待ち案件
- 承認待ち案件
- 提案期限が近い案件
- 最近更新された案件
- ステータス別件数
- 想定金額合計
- 未対応コメント数

CTA:

- 新規案件作成
- レビュー待ちを見る
- 承認待ちを見る

### 7.3 案件一覧

表示項目:

- 案件名
- クライアント名
- ステータス
- 担当者
- 想定予算
- 提案期限
- レビュー状況
- 承認状況
- 最終更新日

検索・フィルター:

- クライアント名
- 案件名
- ステータス
- 担当者
- 提案期限
- 金額レンジ

### 7.4 案件作成画面

入力項目:

- 案件名
- クライアント名
- クライアントドメイン
- 業界
- 部署
- 先方担当者
- 自社営業担当
- 自社PM
- 想定予算下限
- 想定予算上限
- 希望開始時期
- 希望納期
- 提案期限
- 案件メモ

### 7.5 案件詳細画面

タブ構成:

```text
概要
ヒアリング
資料
AI整理
追加質問
RFP
要件定義
見積
機能優先度
スケジュール
ガントチャート
画面設計
PPT/PDF
レビュー
承認
履歴
設定
```

### 7.6 ヒアリング入力画面

入力方法:

- テキスト貼り付け
- 議事録ファイルアップロード
- 録音音声アップロード
- メール本文貼り付け
- 参考URLメモ
- 類似製品メモ

AI処理ボタン:

- ヒアリング内容を整理する
- 不足情報を抽出する
- クライアントへの質問を作る
- 要件定義に反映する

### 7.7 資料アップロード画面

対応ファイル:

```text
PDF
DOCX
PPTX
XLSX
CSV
TXT
MD
MP3
M4A
WAV
PNG
JPEG
```

各ファイルに対して保存する情報:

- ファイル名
- ファイル種別
- アップロード者
- アップロード日時
- 抽出テキスト
- AI要約
- 関連する要件
- 関連する未確認事項

### 7.8 AI整理画面

AIが以下を出力する。

- 確認済み事項
- AIによる推定
- 未確認事項
- クライアントに聞くべき質問
- 技術的リスク
- 予算上のリスク
- スケジュール上のリスク
- 推奨開発フェーズ
- 推奨開発形態
- 推奨導入形態
- 推奨AIモデル

重要ルール:

- 入力にないことは断定しない
- 推定は推定と明示する
- 未確認事項は必ず分ける
- クライアント向け表現と社内向け表現を切り替えられるようにする

### 7.9 追加質問画面

カテゴリ別に表示する。

- 事業目的
- 利用者
- 対象業務
- データ
- AIモデル
- セキュリティ
- クラウド利用可否
- 開発形態
- 導入形態
- 予算
- 納期
- 運用
- 契約条件

各質問に対してステータスを持つ。

```text
未確認
確認中
確認済み
不要
```

### 7.10 RFP編集画面

AI生成されたRFPを編集できる。

機能:

- セクション単位編集
- セクション単位再生成
- コメント
- バージョン保存
- DOCX出力
- PDF出力

RFP構成:

1. 案件概要
2. 背景
3. 課題
4. 目的
5. 対象業務
6. 提案依頼範囲
7. 機能要件
8. 非機能要件
9. AI要件
10. データ要件
11. セキュリティ要件
12. 開発形態
13. 導入形態
14. 成果物
15. スケジュール
16. 見積条件
17. 評価基準
18. 未確認事項

### 7.11 要件定義編集画面

AI生成された要件定義書を編集できる。

構成:

1. プロジェクト概要
2. 背景・目的
3. 成功指標
4. 対象ユーザー
5. 利用シーン
6. 業務フロー
7. システム全体像
8. 開発形態
9. 導入形態
10. 機能一覧
11. 必須機能・オプション機能
12. 画面一覧
13. 画面遷移
14. AI要件
15. データ要件
16. 外部連携要件
17. 権限要件
18. セキュリティ要件
19. ログ・監査要件
20. 運用要件
21. 保守要件
22. 見積
23. スケジュール
24. リスク
25. 未決事項
26. 次回確認事項

### 7.12 見積画面

見積は以下の切り口で表示する。

- フェーズ別
- 役割別
- 機能別
- 画面別
- 成果物別
- プラン別

初期単価:

```text
人日単価: 20,000円
1人月: 20人日
1人月単価: 400,000円
```

ポジション別に単価変更可能。

- PM
- PdM
- AI Engineer
- Backend Engineer
- Frontend Engineer
- Designer
- QA
- DevOps
- Security
- Document Writer

見積に含める要素:

- 要件定義
- 基本設計
- UI/UX設計
- 画面設計
- フロントエンド開発
- バックエンド開発
- AI機能実装
- データ処理
- 外部連携
- テスト
- PM
- ドキュメント作成
- バッファ
- 保守費用オプション

### 7.13 必須 / オプション切り分け画面

各機能を以下に分類する。

```text
Must
Should
Could
Later
Out of Scope
```

画面上では以下を表示する。

- 機能名
- 分類
- 理由
- 見積影響
- スケジュール影響
- リスク
- クライアント向け説明
- 社内向けメモ

自然言語で調整できる。

例:

```text
700万円以内に収める構成にして
1,500万円の標準案にして
3,000万円の本開発案にして
初期リリースは必須機能だけにして
オプション機能を別見積にして
```

### 7.14 スケジュール画面

開発スケジュールを生成・編集する。

スケジュールは2種類持つ。

```text
社内向け詳細スケジュール
クライアント共有用スケジュール
```

#### 社内向け詳細スケジュール

粒度:

- タスク単位
- 担当ロール単位
- 依存関係あり
- 進捗あり
- クリティカルパスあり

項目:

- タスク名
- フェーズ
- 開始日
- 終了日
- 期間
- 担当ロール
- 依存タスク
- ステータス
- 進捗率
- クライアント確認待ちか
- 遅延リスク
- 社内メモ

#### クライアント共有用スケジュール

粒度:

- フェーズ単位
- わかりやすい表現
- 内部タスクは見せない

項目:

- フェーズ名
- 期間
- 主な作業内容
- 成果物
- クライアント確認事項
- マイルストーン

例:

```text
要件定義: 2週間
設計: 2週間
開発: 6週間
テスト: 2週間
リリース準備: 1週間
```

### 7.15 ガントチャート画面

ガントチャートを表示・編集できる。

機能:

- タスク表示
- 期間変更
- ドラッグで日程変更
- 依存関係表示
- クリティカルパス表示
- クライアント確認期間の表示
- 遅延リスク表示
- 社内向け / クライアント向け切替
- PDF出力
- PPT貼り付け用画像出力

自然言語で調整可能。

例:

```text
PoCを8週間にして
デザインを先行させて
クライアントレビューを各フェーズに1週間入れて
年末年始は作業しない前提にして
9月末リリースに間に合うように再調整して
```

### 7.16 画面設計画面

AIが以下を生成する。

- 画面一覧
- 画面ごとの目的
- 主要UI要素
- 入力項目
- 表示項目
- CTA
- 権限別表示
- 空状態
- エラー状態
- 画面遷移

出力はデザイナーに渡しやすくする。

画面一覧の例:

```text
ログイン
ダッシュボード
案件一覧
案件作成
案件詳細
ヒアリング入力
資料アップロード
AI整理
追加質問
RFP編集
要件定義編集
見積編集
スケジュール編集
ガントチャート
画面一覧・画面遷移
PPT/PDF出力
レビュー
承認
設定
```

### 7.17 Claude Design向けプロンプト生成画面

画面設計情報をもとに、Claude Designへ渡すプロンプトを生成する。

出力内容:

- アプリ概要
- 対象ユーザー
- 主要業務フロー
- 必要画面
- 画面ごとの目的
- UI要素
- デザイントーン
- 参考UI
- コンポーネント方針
- 必須機能 / オプション機能の見せ方
- レビュー・承認UX
- スケジュール・ガントチャートUX

デザイン方針:

```text
B2B SaaSらしい信頼感
NotionやLinearに近い軽快さ
情報量は多いが迷わない
提案資料作成ツールとして上品
必須機能とオプション機能が分かりやすい
社内レビューしやすい
```

### 7.18 PPT/PDF出力画面

出力できるもの。

- 提案PPTX
- 提案PDF
- RFP DOCX
- RFP PDF
- 要件定義書 DOCX
- 要件定義書 PDF
- 見積 XLSX
- スケジュール PDF
- ガントチャート PDF

PPT構成:

1. 表紙
2. ご相談内容の理解
3. 現状課題
4. AI活用方針
5. 解決アプローチ
6. 想定ユースケース
7. 開発形態の提案
8. 導入形態の提案
9. システム構成案
10. 画面イメージ
11. 画面遷移
12. 機能一覧
13. 必須機能・オプション機能
14. PoC / MVP / 本開発の進め方
15. AIモデル選定方針
16. セキュリティ方針
17. 開発スケジュール
18. 概算見積
19. リスクと前提条件
20. 次の進め方

### 7.19 レビュー画面

レビュー対象:

- RFP
- 要件定義書
- 見積
- スケジュール
- ガントチャート
- PPT
- 画面遷移
- 技術構成
- セキュリティ方針

機能:

- レビュー依頼
- レビュー担当者指定
- 期限指定
- コメント
- コメントステータス
- 修正済み管理
- 再レビュー依頼

コメント対象:

- 文書全体
- セクション
- 見積行
- スケジュールタスク
- スライド
- 画面
- 画面遷移

コメント種別:

```text
質問
修正依頼
リスク指摘
技術補足
見積指摘
承認コメント
クライアント確認事項
```

### 7.20 承認画面

承認ステータス:

```text
下書き
レビュー依頼中
コメント対応中
再レビュー待ち
承認待ち
承認済み
差し戻し
クライアント提出済み
```

承認前AIチェック:

- 未確認事項が残っていないか
- 見積に抜けがないか
- スケジュールが現実的か
- 予算とスコープが合っているか
- クライアント確認事項が整理されているか
- セキュリティ条件が曖昧でないか
- AIモデル利用可否が確認されているか
- 提案資料として表現が適切か
- レビュー未対応コメントがないか

---

## 8. AI機能

### 8.1 AI Provider抽象化

以下のようにAI処理を用途別に分ける。

```text
generateHearingSummary()
generateOpenQuestions()
generateRfp()
generateRequirements()
generateEstimate()
generateFeaturePriorities()
generateSchedule()
generateGanttTasks()
generateClientSchedule()
generateScreenList()
generateScreenTransitions()
generateDesignPrompt()
generateProposalSlides()
reviewBeforeApproval()
```

### 8.2 初期AIモデル

MVPではClaude Sonnetをメインにする。

```text
メイン生成: Claude Sonnet
```

将来的な推奨:

```text
長文議事録・大量資料: Gemini
要件定義・RFP: Claude Sonnet
見積・構造化データ: GPT
PPT構成: Claude Sonnet
リスクレビュー: Claude Sonnet
```

### 8.3 AI出力の基本ルール

AIは以下を守る。

- 入力にないことを断定しない
- 推測は推測と明示する
- 未確認事項を必ず分ける
- クライアント向けと社内向けの表現を切り替える
- 予算とスコープのズレを指摘する
- PoC / MVP / 本開発のどれが適切か提案する
- クラウド / 社内システム / 閉域 / オンプレの確認事項を出す
- Webアプリ / ネイティブアプリ / PWA の判断理由を出す
- スケジュールへの影響を出す
- 見積への影響を出す

---

## 9. RFP生成仕様

### 9.1 入力

- 案件情報
- ヒアリング内容
- 資料要約
- 未確認事項
- 推奨フェーズ
- 推奨開発形態
- 推奨導入形態
- 機能一覧
- 見積
- スケジュール

### 9.2 出力構成

1. 案件概要
2. 背景
3. 課題
4. 目的
5. 対象業務
6. 提案依頼範囲
7. 機能要件
8. 非機能要件
9. AI要件
10. データ要件
11. セキュリティ要件
12. 開発形態
13. 導入形態
14. 成果物
15. スケジュール
16. 見積条件
17. 評価基準
18. 未確認事項

---

## 10. 要件定義書生成仕様

### 10.1 入力

- 案件情報
- ヒアリング内容
- 資料要約
- 追加質問と回答
- 機能優先度
- 画面一覧
- 画面遷移
- 見積
- スケジュール
- リスク

### 10.2 出力構成

1. プロジェクト概要
2. 背景・目的
3. 成功指標
4. 対象ユーザー
5. 利用シーン
6. 業務フロー
7. システム全体像
8. 開発形態
9. 導入形態
10. 機能一覧
11. 必須機能・オプション機能
12. 画面一覧
13. 画面遷移
14. AI要件
15. データ要件
16. 外部連携要件
17. 権限要件
18. セキュリティ要件
19. ログ・監査要件
20. 運用要件
21. 保守要件
22. 見積
23. スケジュール
24. リスク
25. 未決事項
26. 次回確認事項

---

## 11. 見積生成仕様

### 11.1 初期単価

```text
人日単価: 20,000円
1人月: 20人日
1人月単価: 400,000円
```

### 11.2 初期バッファ

```text
バッファ率: 15%
```

### 11.3 PM / QA 工数の目安

```text
PM工数: 総開発工数の15〜20%
QA工数: 総開発工数の10〜15%
```

### 11.4 保守費用目安

```text
月額保守費: 開発費の5〜10%
```

### 11.5 見積出力単位

- フェーズ別
- 役割別
- 機能別
- 画面別
- 成果物別
- プラン別

### 11.6 プラン別例

| プラン | 内容 | 想定金額 |
|---|---|---:|
| Light | 要件定義 + 小規模PoC | 300万円〜700万円 |
| Standard | MVP開発 | 700万円〜1,500万円 |
| Professional | 本番運用前提開発 | 1,500万円〜3,000万円 |
| Enterprise | 閉域・高セキュリティ・大規模連携 | 3,000万円以上 |

---

## 12. スケジュール生成仕様

### 12.1 出力タイプ

2種類のスケジュールを生成する。

1. 社内向け詳細スケジュール
2. クライアント共有用スケジュール

### 12.2 社内向け詳細スケジュール

含める項目:

- タスク名
- フェーズ
- 開始日
- 終了日
- 期間
- 担当ロール
- 依存タスク
- ステータス
- 進捗率
- クリティカルパス
- クライアント確認待ち
- 遅延リスク

### 12.3 クライアント共有用スケジュール

含める項目:

- フェーズ名
- 期間
- 主な作業内容
- 成果物
- クライアント確認事項
- マイルストーン

### 12.4 自然言語調整例

```text
PoCを8週間にして
デザインを先行させて
クライアントレビューを各フェーズに1週間入れて
年末年始は作業しない前提にして
9月末リリースに間に合うように再調整して
必須機能だけで先にMVPリリースする案にして
```

---

## 13. 画面設計生成仕様

### 13.1 生成対象

- 画面一覧
- 画面ごとの目的
- 主要UI要素
- 入力項目
- 表示項目
- CTA
- 権限別表示
- 空状態
- エラー状態
- 画面遷移

### 13.2 Claude Design向け出力

Claude Designに渡せるプロンプトを自動生成する。

含める内容:

- アプリ概要
- 対象ユーザー
- 主要業務フロー
- 必要画面
- 画面ごとの目的
- UI要素
- デザイントーン
- 参考UI
- コンポーネント方針
- 必須機能 / オプション機能の見せ方
- レビュー・承認UX
- スケジュール・ガントチャートUX

---

## 14. 提案PPTテンプレート仕様

### 14.1 デザイン方針

```text
白背景
濃紺アクセント
B2B SaaS風
タイトル + 本文 + 図表
20枚前後
```

### 14.2 デザイントーン

- B2B SaaSらしい信頼感
- 提案資料として上品
- 情報量は多いが見やすい
- 図表・表・アイコンを適度に使う
- 濃紺を見出しやアクセントに使う
- 背景は白を基本にする
- クライアント提出に耐える落ち着いたデザイン

### 14.3 基本構成

1. 表紙
2. アジェンダ
3. ご相談内容の理解
4. 現状課題
5. AI活用方針
6. 解決アプローチ
7. 想定ユースケース
8. 開発形態の提案
9. 導入形態の提案
10. システム構成案
11. 画面イメージ
12. 画面遷移
13. 機能一覧
14. 必須機能・オプション機能
15. PoC / MVP / 本開発の進め方
16. AIモデル選定方針
17. セキュリティ方針
18. 開発スケジュール
19. 概算見積
20. リスクと前提条件
21. 次の進め方

20枚前後を想定するため、案件によって19〜22枚程度に増減してよい。

---

## 15. レビュー・承認仕様

### 15.1 レビュー対象

- RFP
- 要件定義書
- 見積
- スケジュール
- ガントチャート
- PPT
- 画面遷移
- 技術構成
- セキュリティ方針

### 15.2 コメント対象

- 文書全体
- セクション
- 見積行
- スケジュールタスク
- スライド
- 画面
- 画面遷移

### 15.3 コメント種別

```text
質問
修正依頼
リスク指摘
技術補足
見積指摘
承認コメント
クライアント確認事項
```

### 15.4 承認ステータス

```text
下書き
レビュー依頼中
コメント対応中
再レビュー待ち
承認待ち
承認済み
差し戻し
クライアント提出済み
```

---

## 16. 契約書メーカー連携の将来仕様

初期MVPでは契約書生成はしない。

ただし、将来の契約書ドラフト生成に備え、以下の情報は保存する。

- 契約対象スコープ
- 対象外スコープ
- 成果物一覧
- 納品形式
- 検収条件
- 支払条件
- 保守範囲
- 仕様変更条件
- 前提条件
- 非保証事項
- AIモデル利用条件
- 知財帰属
- 再委託
- 秘密保持
- 損害賠償上限

将来的に生成する契約書:

- 業務委託契約書
- 準委任契約書
- 請負契約書
- PoC契約書
- 要件定義フェーズ契約書
- NDA
- 変更契約書
- 覚書
- 発注書 / 注文請書

---

## 17. DBスキーマ案

### 17.1 organizations

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email_domain text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.2 profiles

```sql
create table profiles (
  id uuid primary key,
  organization_id uuid references organizations(id),
  name text,
  email text not null,
  role text not null default 'viewer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.3 projects

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  client_name text not null,
  client_domain text,
  project_name text not null,
  industry text,
  status text default 'draft',
  budget_min integer,
  budget_max integer,
  expected_start_date date,
  expected_delivery_date date,
  proposal_due_date date,
  recommended_phase text,
  recommended_platform text,
  recommended_deployment text,
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.4 hearings

```sql
create table hearings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  meeting_date date,
  source_type text,
  raw_text text,
  summary text,
  confirmed_facts jsonb,
  assumptions jsonb,
  open_questions jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.5 files

```sql
create table files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  file_name text not null,
  file_type text,
  storage_path text not null,
  extracted_text text,
  summary text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

### 17.6 documents

```sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  document_type text not null,
  title text not null,
  content_markdown text,
  content_json jsonb,
  version integer default 1,
  status text default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

document_type:

```text
rfp
requirements
proposal
risk_analysis
client_questions
design_prompt
```

### 17.7 estimates

```sql
create table estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  estimate_name text not null,
  default_unit_price integer default 20000,
  buffer_rate numeric default 0.15,
  subtotal integer,
  tax integer,
  total integer,
  gross_margin numeric,
  version integer default 1,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.8 estimate_items

```sql
create table estimate_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  estimate_id uuid references estimates(id) not null,
  project_id uuid references projects(id) not null,
  phase text,
  role text,
  task_name text not null,
  person_days numeric default 0,
  unit_price integer default 20000,
  amount integer,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.9 feature_priorities

```sql
create table feature_priorities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  feature_name text not null,
  priority text not null,
  reason text,
  estimate_impact text,
  schedule_impact text,
  risk text,
  client_description text,
  internal_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

priority:

```text
must
should
could
later
out_of_scope
```

### 17.10 schedules

```sql
create table schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  schedule_name text not null,
  schedule_type text not null,
  start_date date,
  end_date date,
  status text default 'draft',
  version integer default 1,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

schedule_type:

```text
internal
client
```

### 17.11 schedule_tasks

```sql
create table schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  schedule_id uuid references schedules(id) not null,
  project_id uuid references projects(id) not null,
  task_name text not null,
  phase text,
  description text,
  start_date date,
  end_date date,
  duration_days integer,
  assignee_role text,
  dependency_task_ids jsonb,
  progress integer default 0,
  status text default 'not_started',
  is_client_visible boolean default false,
  is_critical_path boolean default false,
  risk text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.12 milestones

```sql
create table milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  title text not null,
  description text,
  milestone_date date,
  milestone_type text,
  is_client_visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.13 screens

```sql
create table screens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  screen_name text not null,
  user_role text,
  purpose text,
  description text,
  ui_elements jsonb,
  priority text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.14 screen_transitions

```sql
create table screen_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  from_screen_id uuid references screens(id),
  to_screen_id uuid references screens(id),
  trigger_action text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.15 reviews

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  target_type text not null,
  target_id uuid,
  reviewer_id uuid references profiles(id),
  status text default 'requested',
  due_date date,
  requested_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.16 comments

```sql
create table comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  target_type text not null,
  target_id uuid,
  commenter_id uuid references profiles(id),
  comment_type text,
  body text not null,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.17 approvals

```sql
create table approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  target_type text not null,
  target_id uuid,
  approver_id uuid references profiles(id),
  status text default 'pending',
  comment text,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.18 templates

```sql
create table templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  template_type text not null,
  name text not null,
  description text,
  content text,
  content_json jsonb,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 17.19 audit_logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  project_id uuid references projects(id),
  user_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
```

### 17.20 contract_inputs

```sql
create table contract_inputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id) not null,
  scope_summary text,
  deliverables text,
  out_of_scope text,
  acceptance_criteria text,
  payment_terms text,
  warranty_terms text,
  ip_terms text,
  ai_usage_terms text,
  change_request_terms text,
  support_terms text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## 18. 実装順序

Claude Codeにはこの順番で作らせる。

### Step 1: プロジェクト基盤

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase接続
- 環境変数
- 基本レイアウト
- サイドバー
- ヘッダー

### Step 2: 認証

- Supabase Auth
- ログイン画面
- ログアウト
- プロフィール作成
- organization作成
- `@aidealab.com` ドメイン制限
- ロール管理

### Step 3: 案件管理

- 案件一覧
- 案件作成
- 案件詳細
- 案件編集
- ステータス更新

### Step 4: ヒアリング・資料

- ヒアリング入力
- ファイルアップロード
- ファイル一覧
- 抽出テキスト保存
- 資料要約

### Step 5: AI整理

- ヒアリング整理
- 確認済み事項
- 推定事項
- 未確認事項
- 追加質問生成
- 推奨フェーズ判定
- 推奨開発形態判定
- 推奨導入形態判定

### Step 6: ドキュメント生成

- RFP生成
- 要件定義書生成
- セクション編集
- セクション再生成
- バージョン保存

### Step 7: 見積

- 見積生成
- 見積行編集
- 単価変更
- 合計再計算
- XLSX出力

### Step 8: 機能優先度

- Must / Should / Could / Later / Out of Scope分類
- 自然言語で再分類
- 見積影響表示
- スケジュール影響表示

### Step 9: スケジュール・ガント

- 社内向けスケジュール生成
- クライアント向けスケジュール生成
- schedule_tasks作成
- ガントチャート表示
- 自然言語で再調整

### Step 10: 画面設計

- 画面一覧生成
- 画面遷移生成
- 画面ごとのUI要素生成
- Claude Design向けプロンプト生成

### Step 11: 出力

- PDF出力
- PPTX出力
- DOCX出力
- XLSX出力

### Step 12: レビュー・承認

- コメント
- レビュー依頼
- 承認
- 差し戻し
- 承認前AIチェック
- 監査ログ

---

## 19. Claude Codeへの初期プロンプト

以下をClaude Codeに渡す。

```text
あなたは優秀なフルスタックエンジニアです。
Next.js / TypeScript / Supabase / Tailwind CSS / shadcn/ui を使って、社内向けWebアプリ「要件定義書けるくん Internal」を実装してください。

このアプリは、AI開発会社がクライアントとの初回商談・ヒアリング・録音・議事録・参考資料をもとに、RFP、要件定義書、見積、開発スケジュール、ガントチャート、画面一覧、画面遷移、提案PPT/PDFを生成し、社内レビュー・コメント・承認まで行うためのものです。

初期MVPではSupabaseを使います。
ただし将来的にGoogle Cloudへ移行する可能性があるため、Supabase SDKへの依存をアプリ全体に散らさず、以下の抽象化レイヤーを必ず作ってください。

- lib/auth.ts
- lib/db.ts
- lib/storage.ts
- lib/ai/providers.ts

DBはPostgreSQL前提で設計し、すべての主要テーブルに organization_id を持たせてください。
将来SaaS化できるように、organization_id、role-based access control、template管理、audit_logs、version管理を初期から含めてください。

ログインはSupabase Authを使用し、初期MVPでは @aidealab.com ドメインのメールアドレスのみログインを許可してください。
ログイン時にメールドメインを検証し、@aidealab.com 以外のユーザーはアクセス不可にしてください。

まずは以下を実装してください。

1. Next.jsプロジェクト初期化
2. Supabase接続
3. 認証
4. organization / profiles
5. 案件CRUD
6. 基本レイアウト
7. ダッシュボード
8. 案件詳細タブUI
9. ヒアリング入力
10. 資料アップロード
11. AI整理のAPIエンドポイントの雛形
12. RFP / 要件定義 / 見積 / スケジュール / 画面設計の生成ボタンと保存先

UIはB2B SaaSとして信頼感があり、NotionやLinearに近い軽快さを意識してください。
情報量は多いが迷わないUIにしてください。
```

---

## 20. Claude Designへの初期プロンプト

以下をClaude Designに渡す。

```text
AI開発会社向けの社内Webアプリ「要件定義書けるくん Internal」のUI/UXを設計してください。

このアプリは、クライアントとの初回商談・ヒアリング・録音・議事録・参考資料をもとに、RFP、要件定義書、見積、開発スケジュール、ガントチャート、画面一覧、画面遷移、提案PPT/PDFを生成し、社内レビュー・コメント・承認まで行うためのB2B業務アプリです。

対象ユーザー:
- 営業担当
- PM
- エンジニア
- デザイナー
- 上司・承認者
- 管理者

必要画面:
1. ログイン
2. ダッシュボード
3. 案件一覧
4. 案件作成
5. 案件詳細
6. ヒアリング入力
7. 資料アップロード
8. AI整理結果
9. 追加質問
10. RFP編集
11. 要件定義編集
12. 見積編集
13. 必須/オプション切り分け
14. スケジュール編集
15. ガントチャート
16. 画面一覧・画面遷移
17. Claude Design向けプロンプト生成
18. PPT/PDF出力
19. レビュー・コメント
20. 承認
21. 設定

デザイン方針:
- B2B SaaSらしい信頼感
- NotionやLinearに近い軽快さ
- 情報量は多いが迷わない
- 提案資料作成ツールとして上品
- 必須機能とオプション機能が視覚的に分かりやすい
- レビュー・承認がしやすい
- ガントチャートとクライアント共有用スケジュールが見やすい
- 営業、PM、上司が迷わず使える

PPTテンプレートは以下の方向性です。
- 白背景
- 濃紺アクセント
- B2B SaaS風
- タイトル + 本文 + 図表
- 20枚前後

まず、主要ユーザーフロー、情報設計、画面構成、主要コンポーネント、ワイヤーフレーム方針を作ってください。
```

---

## 21. 確定事項

- アプリ名: 要件定義書けるくん Internal
- 利用ドメイン: aidealab.com
- 初期ログイン許可: `@aidealab.com`
- 初期用途: 自社用社内Webアプリ
- 初期構成: Supabaseで高速開発
- 将来方針: Google Cloud移行およびSaaS化を検討
- Claude Codeで実装
- Claude DesignでUI/UX設計
- メインAIはClaude Sonnet
- 将来的にGPT / Geminiも併用
- MVPでRFP・要件定義・見積・スケジュール・ガント・画面遷移・PPT/PDFまで作る
- 社内レビュー・コメント・承認を入れる
- 契約書ドラフトは後回し
- 契約書連携用データは初期から保持する
