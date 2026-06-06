import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTION_LABELS: Record<string, string> = {
  "user.invite": "ユーザー招待",
  "user.role_change": "ロール変更",
  "user.disable": "ユーザー無効化",
  "user.enable": "ユーザー再有効化",
  "ai_settings.update": "AI設定の更新",
};
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;

function fmt(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminAuditPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.audit")) redirect("/admin");

  const entries = await db.audit.list(user.orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">監査ログ</h2>
        <p className="text-sm text-muted-foreground">
          誰が・いつ・何をしたかの記録（直近{entries.length}件）。現在はユーザー管理・AI設定の操作を記録しています。
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>操作者</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  まだ監査ログがありません。
                </TableCell>
              </TableRow>
            )}
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {fmt(e.createdAt)}
                </TableCell>
                <TableCell className="text-sm">{e.actorName ?? "—"}</TableCell>
                <TableCell className="text-sm font-medium">
                  {actionLabel(e.action)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.targetType ?? "—"}
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {e.metadata ? JSON.stringify(e.metadata) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
