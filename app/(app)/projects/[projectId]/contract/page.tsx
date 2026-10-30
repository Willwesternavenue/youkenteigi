import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { ContractEditor } from "@/components/contract/contract-editor";
import { NewContractButton } from "@/components/contract/new-contract-button";

// AIレビューは最長~120秒。Server Action のタイムアウト既定値をページ単位で引き上げる。
export const maxDuration = 300;

export default async function ProjectContractPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const p = await db.projects.getById(user.orgId, projectId);
  if (!p) notFound();
  const canEdit = can(user.role, "document.edit");

  const list = await db.contracts.list(user.orgId, { projectId });
  // 直近に更新した契約書を編集対象にする（通常は案件ごとに1通）
  const current = list[0] ? await db.contracts.get(user.orgId, list[0].id) : null;

  if (!current) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">契約書</h2>
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            この案件の契約書はまだありません。
            <br />
            委託者名・作業期間・責任者・委託料（最新見積の税込合計）などを案件情報から自動入力して作成します。
          </p>
          {canEdit && (
            <div className="mt-4">
              <NewContractButton projectId={projectId} label="案件情報から契約書を作成" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ContractEditor
        key={current.id}
        contractId={current.id}
        projectId={projectId}
        projectName={p.projectName}
        showProjectLink={false}
        initialValues={current.values}
        initialVersion={current.latestVersion}
        canEdit={canEdit}
        canUseAi={can(user.role, "ai.generate")}
      />
      {(list.length > 1 || canEdit) && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
          {list.length > 1 && (
            <span className="text-muted-foreground">
              この案件の他の契約書：
              {list.slice(1).map((c) => (
                <Link key={c.id} href={`/contract/${c.id}`} className="ml-2 underline">
                  {c.clientName || "（委託者未入力）"} v{c.latestVersion}（{formatDate(c.updatedAt)}）
                </Link>
              ))}
            </span>
          )}
          {canEdit && (
            <NewContractButton projectId={projectId} label="別の契約書を作成" variant="outline" />
          )}
        </div>
      )}
    </div>
  );
}
