import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatYen, formatDate } from "@/lib/format";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/types/domain";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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

// Whole-day difference between today and an ISO date (YYYY-MM-DD), today = 0.
function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(isoDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(days: number): { text: string; className: string } {
  if (days < 0) return { text: `${Math.abs(days)}日超過`, className: "text-destructive" };
  if (days === 0) return { text: "本日", className: "text-destructive font-medium" };
  if (days <= 3) return { text: `あと${days}日`, className: "text-amber-600 font-medium" };
  return { text: `あと${days}日`, className: "text-muted-foreground" };
}

export default async function AdminDashboardPage() {
  const user = await requireUser();
  const d = await db.admin.dashboard(user.orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">管理ダッシュボード</h2>
        <p className="text-sm text-muted-foreground">
          組織全体の案件・レビュー・運用状況を横断で把握できます。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="案件数（全体）" value={`${d.totalProjects}`} hint={`ユーザー ${d.userCount}名`} />
        <Stat
          label="レビュー中"
          value={`${d.byStatus.in_review ?? 0}`}
          hint={`承認待ち ${d.pendingApprovals}件`}
        />
        <Stat label="未対応コメント" value={`${d.openComments}`} hint="ステータス: 未対応" />
        <Stat
          label="今月のAI利用・コスト"
          value="—"
          hint="利用状況スライスで対応（§3.6-4）"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ステータス別 案件数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PROJECT_STATUSES.map((s) => (
              <div
                key={s}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <StatusBadge status={s} />
                </span>
                <span className="font-semibold tabular-nums">
                  {d.byStatus[s] ?? 0}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 pt-1 text-sm">
              <span className="text-muted-foreground">想定金額合計（上限ベース）</span>
              <span className="font-semibold">{formatYen(d.budgetTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">提案期限が近い案件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.upcoming.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                期限が設定された進行中の案件はありません。
              </p>
            )}
            {d.upcoming.map((p) => {
              const days = daysUntil(p.proposalDueDate);
              const due = dueLabel(days);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {p.projectName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.clientName} · {formatDate(p.proposalDueDate)}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs ${due.className}`}>
                    {due.text}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {PROJECT_STATUS_LABELS.in_review}・承認待ち・未対応コメントが多い場合は、レビュー体制の見直しを検討してください。
      </p>
    </div>
  );
}
