import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatBudgetRange,
  formatDate,
  formatYen,
  withHonorific,
} from "@/lib/format";
import { PROJECT_STATUS_LABELS } from "@/types/domain";
import { FilePlus2, FolderKanban } from "lucide-react";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const counts = await db.projects.dashboardCounts(user.orgId, user.userId);
  const projects = await db.projects.list(user.orgId);
  const recent = projects.slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">
            ようこそ、{withHonorific(user.name)}
          </p>
        </div>
        <Button render={<Link href="/projects/new" />} nativeButton={false}>
          <FilePlus2 className="size-4" />
          新規案件
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="案件数" value={`${counts.total}`} hint={`自分の担当: ${counts.mine}`} />
        <Stat
          label="レビュー中"
          value={`${counts.byStatus.in_review ?? 0}`}
          hint={PROJECT_STATUS_LABELS.in_review}
        />
        <Stat
          label="承認済み"
          value={`${counts.byStatus.approved ?? 0}`}
          hint={PROJECT_STATUS_LABELS.approved}
        />
        <Stat label="想定金額合計" value={formatYen(counts.budgetTotal)} hint="上限ベース" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="size-4" />
            最近更新された案件
          </CardTitle>
          <Button render={<Link href="/projects" />} nativeButton={false} variant="ghost" size="sm">
            すべて見る
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              案件がまだありません。「新規案件」から作成してください。
            </p>
          )}
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{p.projectName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {p.clientName} · {formatBudgetRange(p.budgetMin, p.budgetMax)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-4">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {formatDate(p.proposalDueDate)}
                </span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
