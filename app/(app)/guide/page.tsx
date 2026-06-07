import { requireUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "使い方ガイド" };

/** Comprehensive, team-facing usage manual. Static content (RSC). */

function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block rounded px-2 py-1 text-sm text-foreground/70 hover:bg-muted hover:text-foreground"
    >
      {children}
    </a>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="border-b pb-2 text-lg font-bold">
        <span className="mr-2 text-primary">{n}</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export default async function GuidePage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">使い方ガイド</h1>
        <p className="text-sm text-muted-foreground">
          要件定義書けるくん Internal の使い方を、初めての方向けに一通りまとめています。
          上から順に読めばプリセールスの一連の流れが分かります。
        </p>
      </header>

      {/* TOC */}
      <Card>
        <CardContent className="grid gap-1 py-4 sm:grid-cols-2">
          <TocLink href="#overview">1. これは何をするツール？</TocLink>
          <TocLink href="#login">2. ログイン</TocLink>
          <TocLink href="#flow">3. 全体の流れ</TocLink>
          <TocLink href="#new">4. 案件をつくる</TocLink>
          <TocLink href="#hearing">5. 議事録・ヒアリング</TocLink>
          <TocLink href="#rfp">6. RFP</TocLink>
          <TocLink href="#scope">7. スコープ・WBS</TocLink>
          <TocLink href="#requirements">8. 要件定義・品質チェック</TocLink>
          <TocLink href="#design">9. 画面設計</TocLink>
          <TocLink href="#estimate">10. 見積</TocLink>
          <TocLink href="#schedule">11. スケジュール</TocLink>
          <TocLink href="#slides">12. 提案スライド（自動構成）</TocLink>
          <TocLink href="#review">13. レビュー・承認・整合性</TocLink>
          <TocLink href="#assistant">14. AIアシスタント</TocLink>
          <TocLink href="#export">15. 出力（Word/PDF/Excel/PPT）</TocLink>
          <TocLink href="#roles">16. ロールと権限</TocLink>
          <TocLink href="#admin">17. 管理コンソール（管理者向け）</TocLink>
          <TocLink href="#ai">18. AIについて・注意</TocLink>
          <TocLink href="#faq">19. よくある質問</TocLink>
        </CardContent>
      </Card>

      <Section id="overview" n="1." title="これは何をするツール？">
        <p>
          初回商談・ヒアリングの内容をもとに、<strong>RFP・要件定義書・見積・スケジュール・画面設計・提案スライド</strong>
          といったプリセールスの成果物をAIで素早く作成し、チームでレビュー・承認して、
          Word / PDF / Excel / PowerPoint で出力するための社内ツールです。
        </p>
        <p>
          案件ごとに「ヒアリング → 各成果物 → レビュー・承認」という流れで進めます。
          各案件ページの上部には<strong>進捗ステッパー</strong>と「次にやること」のボタンが出るので、
          迷ったらそれに従えばOKです。
        </p>
      </Section>

      <Section id="login" n="2." title="ログイン">
        <p>
          <code>@aidealab.com</code> のメールアドレスでログインします。<strong>パスワードはありません。</strong>
        </p>
        <Step label="手順">
          ログイン画面でメールアドレスを入力 →「ログインリンクを送信」→
          届いたメールのリンクをクリックすると自動でログインされます（マジックリンク方式）。
          リンクが届かない時は数分待つ＋迷惑メールを確認してください。
        </Step>
        <p className="text-muted-foreground">
          ※ 初めてログインした人は自動的に「閲覧のみ」権限で登録されます。権限の変更は管理者が行います。
        </p>
      </Section>

      <Section id="flow" n="3." title="全体の流れ">
        <p>標準的な進め方は次のとおりです（必要な工程だけ使ってもOK）。</p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>案件をつくる（クライアント名・予算・納期など）</li>
          <li>議事録／ヒアリング内容を入力 →「AI整理」で論点・前提・リスクを抽出</li>
          <li>RFP を生成</li>
          <li>スコープ・WBS を生成</li>
          <li>要件定義書を生成 → 品質チェック</li>
          <li>画面設計（構成図・画面一覧・画面遷移）を生成</li>
          <li>見積を生成・調整</li>
          <li>スケジュールを生成・調整</li>
          <li>提案スライドを確認・編集</li>
          <li>レビュー・承認、整合性チェック</li>
          <li>必要な成果物を出力（Word/PDF/Excel/PPT）</li>
        </ol>
      </Section>

      <Section id="new" n="4." title="案件をつくる">
        <p>
          左メニュー「<strong>新規案件</strong>」から作成します。クライアント名・案件名は必須、
          予算・希望納期・開発形態（準委任／コンサル／ウォーターフォール）などを入力します。
          後から「概要」タブでいつでも編集できます。
        </p>
        <p className="text-muted-foreground">
          ※ 案件の作成自体はAIを使いません。入力した情報が以降のAI生成の前提として使われます。
        </p>
      </Section>

      <Section id="hearing" n="5." title="議事録・ヒアリング">
        <Step label="初回ヒアリング">
          商談で聞いた内容・議事録・メール本文などをそのまま貼り付けて保存します。
          先方の参加者名・弊社側の参加者名・商談日時も入力できます。この本文が全成果物の元データになります。
        </Step>
        <Step label="AI整理">
          ヒアリング本文から、<strong>確定事項・前提・未確認の質問・リスク・推奨フェーズ／プラットフォーム</strong>
          をAIが整理します。ここを実行してから各成果物を作ると精度が上がります。
        </Step>
        <Step label="追加質問 / 打ち合わせ履歴 / 資料">
          クライアントへの追加質問の生成、複数回の打ち合わせメモ（Notion等のリンク）、
          受領資料・参考リンク・録音ファイルなどを管理できます。
        </Step>
      </Section>

      <Section id="rfp" n="6." title="RFP">
        <p>
          ヒアリング内容をもとに RFP（提案依頼書）を自動生成します。生成後は各セクションを直接編集でき、
          「この章だけ作り直す」も可能です。保存するたびに新しいバージョンとして履歴が残ります。
        </p>
      </Section>

      <Section id="scope" n="7." title="スコープ・WBS">
        <p>
          開発形態（準委任／請負など）に応じたスコープとWBS（作業分解）を生成します。
          見積・スケジュールの土台になります。
        </p>
      </Section>

      <Section id="requirements" n="8." title="要件定義・品質チェック">
        <Step label="要件定義">
          26節構成の要件定義書を生成します。各セクションは編集可能、章ごとの再生成もできます。
          画面設計を作ると、画面一覧・画面遷移・システム概要が要件定義にも反映されます。
        </Step>
        <Step label="品質チェック">
          曖昧な表現・矛盾・抜け漏れ・考慮漏れ・誤字などをAIが指摘します。提出前のセルフレビューに使ってください。
        </Step>
      </Section>

      <Section id="design" n="9." title="画面設計">
        <p>「画面設計」生成で、次の3つがまとめて作られます。</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>システム構成図</strong>：システムの構成（レイヤー・連携）</li>
          <li><strong>画面一覧</strong>：各画面の役割・UI要素・状態、低忠実度ワイヤーフレーム</li>
          <li><strong>画面遷移</strong>：画面間の遷移フロー（拡大表示・ズーム対応）</li>
        </ul>
        <p>
          コメントで修正指示を出すと、整合性を保ったまま全体を作り直します（Claude Design 用のプロンプトも生成）。
        </p>
      </Section>

      <Section id="estimate" n="10." title="見積">
        <p>
          大項目→中項目→小項目の3階層で、各項目を<strong>設計／実装／テスト／調整／管理</strong>の工数（時間）に分解し、
          単価から金額を自動計算します。プラン別の出し分け、
          「○○を追加して」「テストを厚めに」などの<strong>自然言語での調整</strong>に対応。Excel出力できます。
        </p>
      </Section>

      <Section id="schedule" n="11." title="スケジュール">
        <p>
          タスク・依存関係・クリティカルパスを含むガントチャートを生成します。日本の祝日・お盆・年末年始などの
          休業期間を考慮。<strong>社内ビュー／クライアント向けビュー</strong>を切り替えられ、棒のドラッグや日数入力で
          双方向に編集できます。自然言語調整・PDF/PNG出力に対応。
        </p>
      </Section>

      <Section id="slides" n="12." title="提案スライド（自動構成）">
        <p>
          提案スライドは<strong>AIで一から書くのではなく、要件定義・見積・スケジュール・画面設計から
          決定論的に自動構成</strong>されます。ご質問の「内容が変わるたびに自動生成されるか？」については
          以下のとおりです。
        </p>
        <Step label="まだ手編集していない場合（自動構成）">
          スライドを開くたびに<strong>最新の内容から自動で組み直されます</strong>。
          要件・見積・スケジュール等を更新すれば、次にスライドを開いた時に反映されます。
        </Step>
        <Step label="一度スライドを編集・保存した場合（保存版）">
          編集が消えないよう、以降は<strong>保存したバージョンが固定表示</strong>になり、
          自動更新は止まります。最新の内容を取り込みたいときは
          「<strong>自動構成に戻す</strong>」で組み直してください（※手編集は破棄されます）。
        </Step>
        <Step label="空ページ＋AIで埋める">
          スライドの追加・並べ替え・削除ができ、空ページに見出しを入れて「AIで埋める」と、
          その本文だけをAIが生成します。
        </Step>
        <p className="text-muted-foreground">
          出力は編集可能な PowerPoint（PPTX）と PDF。表紙・エンドカードは AIdeaLab ブランド。
        </p>
      </Section>

      <Section id="review" n="13." title="レビュー・承認・整合性">
        <Step label="レビュー・承認">
          成果物にコメント（質問・修正依頼・リスク指摘など）を付け、対応済みマークを付けられます。
          マネージャー／管理者が承認・差し戻しを行えます。
        </Step>
        <Step label="整合性チェック">
          要件・見積・スケジュール・画面設計など<strong>成果物をまたいだ矛盾</strong>をAIが横断チェックします。
        </Step>
      </Section>

      <Section id="assistant" n="14." title="AIアシスタント">
        <p>
          画面右側のパネルから呼び出せる統一アシスタントです。今見ているタブ（見積／スケジュール／画面設計）を
          文脈として自動で対象に切り替え、「○○して」と指示すると該当成果物を調整します。
          会話はタブを移動しても残ります。各タブの個別調整ボックスからも同じことができます。
        </p>
      </Section>

      <Section id="export" n="15." title="出力（Word / PDF / Excel / PowerPoint）">
        <ul className="ml-5 list-disc space-y-1">
          <li>RFP・要件定義書 … <strong>Markdown / Word(DOCX) / PDF</strong></li>
          <li>見積 … <strong>Excel(XLSX)</strong></li>
          <li>スケジュール … <strong>PDF / PNG</strong></li>
          <li>提案スライド … <strong>PowerPoint(PPTX) / PDF</strong></li>
        </ul>
        <p className="text-muted-foreground">
          各ページの出力ボタンからダウンロードできます。日本語フォント埋め込み済みなので文字化けしません。
        </p>
      </Section>

      <Section id="roles" n="16." title="ロールと権限">
        <p>権限はロールで決まります（主なもの）。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 font-medium">ロール</th>
                <th className="py-2 font-medium">できること（概略）</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top">
              <tr><td>管理者</td><td>すべて（ユーザー管理・組織設定・管理コンソール含む）</td></tr>
              <tr><td>マネージャー</td><td>案件・生成・編集に加え、承認／差し戻し、レート・テンプレ等の運用設定</td></tr>
              <tr><td>営業 / PM</td><td>案件作成・編集・AI生成・コメント</td></tr>
              <tr><td>エンジニア / デザイナー</td><td>AI生成・成果物の編集・コメント</td></tr>
              <tr><td>閲覧のみ</td><td>閲覧と成果物の出力</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          詳細な権限表は管理者が「管理コンソール → ユーザー・ロール」で確認できます。
        </p>
      </Section>

      <Section id="admin" n="17." title="管理コンソール（管理者向け）">
        <p>
          左メニュー「管理コンソール」（管理者・一部マネージャーのみ表示）から、組織全体の運用を管理します。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>管理ダッシュボード</strong>：全案件の横断状況（ステータス・レビュー待ち・未対応コメント・期限間近）</li>
          <li><strong>ユーザー・ロール</strong>：招待・ロール変更・無効化／再有効化、権限マトリクス</li>
          <li><strong>レートカード</strong>：役割別の人日／月額単価の管理</li>
          <li><strong>テンプレート</strong>：RFP・要件・提案の標準文言／章立てライブラリ</li>
          <li><strong>AI設定</strong>：プロバイダ・既定モデル・月次コスト上限</li>
          <li><strong>利用状況・コスト</strong>：AI生成回数の機能別・ユーザー別集計</li>
          <li><strong>監査ログ</strong>：ユーザー管理・AI設定などの操作履歴</li>
        </ul>
      </Section>

      <Section id="ai" n="18." title="AIについて・注意">
        <p>
          AI生成は本番環境で <strong>Claude</strong> を使用します（画面左上に「AI: Claude Sonnet」と表示）。
          生成にはAPI利用料が発生します。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>生成は数十秒かかることがあります。完了までお待ちください。</li>
          <li>生成結果は必ず人が確認・修正してから提出してください（AIは下書きの加速が目的です）。</li>
          <li>各成果物は保存のたびにバージョンが残るので、作り直しても前の版は失われません。</li>
        </ul>
      </Section>

      <Section id="faq" n="19." title="よくある質問">
        <Step label="生成し直すと前の内容は消える？">
          いいえ。保存のたびに新バージョンとして履歴が残ります（最新版が表示されます）。
        </Step>
        <Step label="提案スライドが古い内容のまま更新されない">
          一度手編集して保存すると自動更新が止まります。「自動構成に戻す」で最新内容から組み直してください。
        </Step>
        <Step label="ログインリンクが届かない">
          数分待つ＋迷惑メール／プロモーションタブを確認。それでも来ない場合は管理者へ。
        </Step>
        <Step label="操作ボタンが見当たらない／押せない">
          ロール権限の可能性があります。必要な権限を管理者に依頼してください。
        </Step>
      </Section>
    </div>
  );
}
