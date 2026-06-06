"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  SpellCheck,
  CheckCircle2,
  Circle,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  runQualityReview,
  toggleQualityResolved,
} from "@/app/_actions/quality";
import type { QualityReport, QualityCategory } from "@/lib/ai/providers";

const CAT: Record<QualityCategory, { label: string; cls: string }> = {
  contradiction: { label: "矛盾", cls: "bg-rose-100 text-rose-700" },
  omission: { label: "抜け漏れ", cls: "bg-amber-100 text-amber-700" },
  ambiguity: { label: "あいまい", cls: "bg-orange-100 text-orange-700" },
  consideration: { label: "考慮漏れ", cls: "bg-sky-100 text-sky-700" },
  proofreading: { label: "校正", cls: "bg-slate-100 text-slate-600" },
};
const SEV: Record<string, { label: string; cls: string }> = {
  high: { label: "重大", cls: "border-rose-300 text-rose-700" },
  medium: { label: "注意", cls: "border-amber-300 text-amber-700" },
  low: { label: "軽微", cls: "border-slate-300 text-slate-600" },
};

export function QualityView({
  projectId,
  report,
  version,
  createdAt,
}: {
  projectId: string;
  report: QualityReport | null;
  version: number;
  createdAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [togglePending, startToggle] = useTransition();

  function run() {
    start(async () => {
      const res = await runQualityReview(projectId);
      if (res.ok) {
        toast.success("品質チェックを実行しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function toggle(index: number, resolved: boolean) {
    startToggle(async () => {
      const res = await toggleQualityResolved(projectId, index, resolved);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  const open = report ? report.findings.filter((f) => !f.resolved) : [];
  const resolvedCount = report
    ? report.findings.filter((f) => f.resolved).length
    : 0;
  const ordered = report
    ? report.findings
        .map((f, index) => ({ f, index }))
        .sort((a, b) => Number(!!a.f.resolved) - Number(!!b.f.resolved))
    : [];
  const scoreColor = report
    ? report.score >= 80
      ? "text-emerald-600"
      : report.score >= 60
        ? "text-amber-600"
        : "text-rose-600"
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <SpellCheck className="size-4 text-primary" />
            品質チェック
          </h2>
          <p className="text-sm text-muted-foreground">
            要件定義書の本文をAIがレビューし、あいまいさ・矛盾・抜け漏れ・考慮漏れ・校正の観点で指摘します。
          </p>
        </div>
        <Button onClick={run} disabled={pending} size="sm" variant={report ? "outline" : "default"}>
          <Sparkles className="size-3.5" />
          {pending ? "チェック中…" : report ? "再チェック" : "品質をチェック"}
        </Button>
      </div>

      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <SpellCheck className="size-8 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">
              要件定義書の記述を精査し、曖昧表現・矛盾・必要項目の抜け・考慮漏れ・読みやすさを指摘します。完成度の目安スコアも算出します。
            </p>
            <Button onClick={run} disabled={pending}>
              <Sparkles className="size-4" />
              {pending ? "チェック中…" : "品質をチェック"}
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
                  {resolvedCount > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      対応済み {resolvedCount}
                    </Badge>
                  )}
                  <Badge variant="outline">v{version}</Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="text-center">
                <div className={cn("text-3xl font-bold tabular-nums", scoreColor)}>
                  {report.score}
                </div>
                <div className="text-[10px] text-muted-foreground">完成度</div>
              </div>
              <p className="flex-1 text-sm leading-relaxed">{report.summary}</p>
            </CardContent>
          </Card>

          {open.length === 0 && resolvedCount === report.findings.length && (
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-emerald-700">
                <CheckCircle2 className="size-5" />
                指摘はすべて対応済みです。
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {ordered.map(({ f, index }) => {
              const cat = CAT[f.category];
              const sev = SEV[f.severity] ?? SEV.low;
              const done = !!f.resolved;
              return (
                <Card
                  key={index}
                  className={cn(
                    "border-l-4",
                    done ? "border-l-emerald-300 opacity-70" : "border-l-primary/40",
                  )}
                >
                  <CardContent className="space-y-1.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {done ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          対応済み
                        </span>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              cat.cls,
                            )}
                          >
                            {cat.label}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                              sev.cls,
                            )}
                          >
                            {sev.label}
                          </span>
                        </>
                      )}
                      {f.section && (
                        <Badge variant="outline" className="font-normal">
                          {f.section}
                        </Badge>
                      )}
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
                    {f.quote && (
                      <p className="rounded bg-muted/60 px-2 py-1 text-xs italic text-muted-foreground">
                        「{f.quote}」
                      </p>
                    )}
                    <p className={cn("text-sm", done && "line-through text-muted-foreground")}>
                      {f.issue}
                    </p>
                    {!done && (
                      <p className="text-sm">
                        <span className="font-medium text-primary">改善案: </span>
                        {f.suggestion}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

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
