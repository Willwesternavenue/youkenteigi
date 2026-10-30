import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewContractButton } from "@/components/contract/new-contract-button";

export const metadata = { title: "契約書 | 要件定義かけるくん" };

export default async function ContractsPage() {
  const user = await requireUser();
  const contracts = await db.contracts.list(user.orgId);
  const canEdit = can(user.role, "document.edit");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">契約書</h1>
          <p className="text-sm text-muted-foreground">
            弁護士レビュー済みの開発委託契約書ひな形に差し込み値を入力して作成します。本文は変更できません。
            案件に紐づく契約書は、各案件の「契約書」タブから案件情報を自動入力して作成できます。
          </p>
        </div>
        {canEdit && <NewContractButton label="単体で新規作成" />}
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>委託者</TableHead>
              <TableHead>紐づく案件</TableHead>
              <TableHead>版</TableHead>
              <TableHead>更新日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  まだ契約書はありません
                </TableCell>
              </TableRow>
            )}
            {contracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/contract/${c.id}`} className="font-medium hover:underline">
                    {c.clientName || "（委託者未入力）"}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {c.projectId ? (
                    <Link href={`/projects/${c.projectId}/contract`} className="hover:underline">
                      {c.projectName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">単体</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">v{c.latestVersion}</TableCell>
                <TableCell className="text-sm">{formatDate(c.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
