import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrganizeButton } from "@/components/ai/organize-button";
import { CheckCircle2, HelpCircle, Lightbulb, AlertTriangle } from "lucide-react";

// AI生成は最長~120秒。Server Actionのタイムアウト既定値をページ単位で
// 引き上げる（Vercel Pro: 最大300秒）。
export const maxDuration = 300;


function ListCard({
  title,
  icon,
  items,
  empty,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  empty: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {items.map((it, i) => (
              <li key={i} className={tone}>
                {it}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function OrganizePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const hearing = await db.hearings.getByProject(user.orgId, projectId);
  const organized = !!hearing?.organizedAt;
  const hasText = !!hearing?.rawText;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">AI整理</h2>
          <p className="text-sm text-muted-foreground">
            ヒアリング内容を「確認済み / 推定 / 未確認」に整理し、推奨方針を提示します。
          </p>
        </div>
        {hasText ? (
          <OrganizeButton projectId={projectId} hasResult={organized} />
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            先に
            <Link href={`/projects/${projectId}/hearing`} className="mx-1 underline">
              ヒアリング
            </Link>
            を入力
          </Badge>
        )}
      </div>

      {!organized ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            まだ整理されていません。「整理する」を押すと AI が内容を構造化します。
          </CardContent>
        </Card>
      ) : (
        <>
          {hearing?.summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">要約</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{hearing.summary}</p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard
              title="確認済み事項"
              icon={<CheckCircle2 className="size-4 text-emerald-600" />}
              items={hearing?.confirmedFacts ?? []}
              empty="—"
            />
            <ListCard
              title="推定（要確認）"
              icon={<Lightbulb className="size-4 text-amber-500" />}
              items={hearing?.assumptions ?? []}
              empty="—"
              tone="text-amber-700"
            />
            <ListCard
              title="未確認事項 / 追加質問"
              icon={<HelpCircle className="size-4 text-sky-600" />}
              items={(hearing?.openQuestions ?? []).map(
                (q) => `[${q.category}] ${q.question}`,
              )}
              empty="—"
            />
            <ListCard
              title="リスク"
              icon={<AlertTriangle className="size-4 text-rose-500" />}
              items={(hearing?.risks ?? []).map(
                (r) => `[${r.type}] ${r.description}`,
              )}
              empty="—"
              tone="text-rose-700"
            />
          </div>
        </>
      )}
    </div>
  );
}
