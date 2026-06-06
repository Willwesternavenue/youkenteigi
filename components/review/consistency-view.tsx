"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  ShieldCheck,
  CircleAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Circle,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  runConsistencyReview,
  toggleFindingResolved,
} from "@/app/_actions/consistency";
import type { ConsistencyReport } from "@/lib/ai/providers";

const SEV: Record<
  string,
  { label: string; cls: string; Icon: typeof CircleAlert }
> = {
  high: {
    label: "重大",
    cls: "border-rose-200 bg-rose-50 text-rose-700",
    Icon: CircleAlert,
  },
  medium: {
    label: "注意",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
    Icon: AlertTriangle,
  },
  low: {
    label: "軽微",
    cls: "border-slate-200 bg-slate-50 text-slate-600",
    Icon: Info,
  },
};

export function ConsistencyView({
  projectId,
  report,
  version,
  createdAt,
}: {
  projectId: string;
  report: ConsistencyReport | null;
  version: number;
  createdAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [togglePending, startToggle] = useTransition();

  function run() {
    start(async () => {
      const res = await runConsistencyReview(projectId);
      if (res.ok) {
        toast.success("整合性チェックを実行しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function toggle(index: number, resolved: boolean) {
    startToggle(async () => {
      const res = await toggleFindingResolved(projectId, index, resolved);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  // unresolved counts for the summary badges
  const open = report ? report.findings.filter((f) => !f.resolved) : [];
  const resolvedCount = report
    ? report.findings.filter((f) => f.resolved).length
    : 0;
  const counts = report
    ? {
        high: open.filter((f) => f.severity === "high").length,
        medium: open.filter((f) => f.severity === "medium").length,
        low: open.filter((f) => f.severity === "low").length,
      }
    : null;
  // unresolved first, resolved at the bottom (keep original index for toggling)
  const ordered = report
    ? report.findings
        .map((f, index) => ({ f, index }))
        .sort((a, b) => Number(!!a.f.resolved) - Number(!!b.f.resolved))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            整合性チェック
          </h2>
          <p className="text-sm text-muted-foreground">
            要件定義・画面遷移・見積・スケジュール等の間の整合性・一貫性をAIがレビューします。
          </p>
        </div>
        <Button onClick={run} disabled={pending} size="sm" variant={report ? "outline" : "default"}>
          <Sparkles className="size-3.5" />
          {pending ? "チェック中…" : report ? "再チェック" : "整合性をチェック"}
        </Button>
      </div>

      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">
              各成果物を横断して、予算と見積、納期とスケジュール、要件定義と画面一覧・遷移、未確認事項の残存などの整合性をチェックします。
            </p>
            <Button onClick={run} disabled={pending}>
              <Sparkles className="size-4" />
              {pending ? "チェック中…" : "整合性をチェック"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>サマリー</span>
                <span className="flex items-center gap-1.5">
                  {counts!.high > 0 && (
                    <Badge className="bg-rose-100 text-rose-700">
                      重大 {counts!.high}
                    </Badge>
                  )}
                  {counts!.medium > 0 && (
                    <Badge className="bg-amber-100 text-amber-700">
                      注意 {counts!.medium}
                    </Badge>
                  )}
                  {counts!.low > 0 && (
                    <Badge variant="secondary">軽微 {counts!.low}</Badge>
                  )}
                  {resolvedCount > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      対応済み {resolvedCount}
                    </Badge>
                  )}
                  <Badge variant="outline">v{version}</Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{report.summary}</p>
            </CardContent>
          </Card>

          {report.findings.length > 0 ? (
            <div className="space-y-2">
              {ordered.map(({ f, index }) => {
                const s = SEV[f.severity] ?? SEV.low;
                const done = !!f.resolved;
                return (
                  <Card
                    key={index}
                    className={cn(
                      "border-l-4",
                      done ? "border-l-emerald-300 opacity-70" : s.cls,
                    )}
                  >
                    <CardContent className="space-y-1.5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="size-3" />
                            対応済み
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                              s.cls,
                            )}
                          >
                            <s.Icon className="size-3" />
                            {s.label}
                          </span>
                        )}
                        <Badge variant="outline" className="font-normal">
                          {f.area}
                        </Badge>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {f.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7"
                          disabled={togglePending}
                          onClick={() => toggle(index, !done)}
                        >
                          {done ? (
                            <>
                              <Undo2 className="size-3.5" />
                              未対応に戻す
                            </>
                          ) : (
                            <>
                              <Circle className="size-3.5" />
                              対応済みにする
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{f.detail}</p>
                      {f.suggestion && !done && (
                        <p className="text-sm">
                          <span className="font-medium text-primary">対応案: </span>
                          {f.suggestion}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-emerald-700">
                <CheckCircle2 className="size-5" />
                主要な不整合は検出されませんでした。
              </CardContent>
            </Card>
          )}

          {report.okPoints.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  整合している点
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {report.okPoints.map((o, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {createdAt && (
            <p className="text-xs text-muted-foreground">
              最終チェック: {new Date(createdAt).toLocaleString("ja-JP")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
