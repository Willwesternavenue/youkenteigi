import { requireUser } from "@/lib/auth";

export const metadata = { title: "契約書ジェネレーター | 要件定義かけるくん" };

/**
 * Phase 1: 同梱（AgreementWriter を静的そのまま埋め込み）。
 * 弁護士レビュー済みの契約書本文・差分表示・Google Docs 出力は
 * public/contract/ 配下の実績コードをそのまま利用する。
 * ログイン必須の app シェル内に iframe で載せることで認証の内側に置く。
 * Phase 2 でネイティブ移植（案件連携・DB 保存）に置き換える予定。
 */
export default async function ContractPage() {
  await requireUser();
  return (
    <div className="-mx-5 -my-6 h-[calc(100vh-3.5rem)] lg:-mx-8">
      <iframe
        src="/contract/index.html"
        title="開発委託契約書ジェネレーター"
        className="h-full w-full border-0"
      />
    </div>
  );
}
