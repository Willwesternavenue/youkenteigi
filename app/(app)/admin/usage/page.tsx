import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatYen } from "@/lib/format";

const FEATURE_LABELS: Record<string, string> = {
  hearing_organize: "ヒアリングAI整理",
  rfp: "RFP生成",
  requirements: "要件定義生成",
  rfp_section: "RFP部分再生成",
  requirements_section: "要件定義 部分再生成",
  scope: "スコープ・WBS",
  estimate: "見積生成",
  estimate_adjust: "見積調整",
  schedule: "スケジュール生成",
  schedule_adjust: "スケジュール調整",
  screen_design: "画面設計生成",
  screen_design_adjust: "画面設計調整",
  design_to_requirements: "設計→要件反映",
  slide_bullets: "スライド本文生成",
};
const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminUsagePage() {
  const user = await requireUser();
  if (!can(user.role, "admin.usage")) redirect("/admin");

  const u = await db.aiUsage.summary(user.orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">利用状況・コスト</h2>
        <p className="text-sm text-muted-foreground">
          AI生成の利用回数を機能別・ユーザー別に集計します（コストは Claude 連携時に概算を記録）。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="今月の生成回数" value={`${u.monthEvents}`} hint={`累計 ${u.totalEvents} 回`} />
        <Stat label="今月の概算コスト" value={formatYen(u.monthCost)} hint="Mockは0円" />
        <Stat label="累計生成回数" value={`${u.totalEvents}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">機能別</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {u.byFeature.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                まだ利用記録がありません。AI生成を実行すると集計されます。
              </p>
            )}
            {u.byFeature.map((f) => (
              <div
                key={f.feature}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{featureLabel(f.feature)}</span>
                <span className="font-semibold tabular-nums">{f.events} 回</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ユーザー別</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {u.byUser.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">—</p>
            )}
            {u.byUser.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{row.name ?? "（不明）"}</span>
                <span className="font-semibold tabular-nums">{row.events} 回</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
