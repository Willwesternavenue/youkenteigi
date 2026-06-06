"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Target,
  CircleSlash,
  Info,
  Package,
  ListTree,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateScopeWbs } from "@/app/_actions/scope";
import type { ScopeWbsPlan } from "@/lib/ai/providers";

export function ScopeWbsView({
  projectId,
  plan,
  version,
  currentFormLabel,
  stale,
}: {
  projectId: string;
  plan: ScopeWbsPlan | null;
  version: number;
  currentFormLabel: string;
  stale: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function generate() {
    start(async () => {
      const res = await generateScopeWbs(projectId);
      if (res.ok) {
        toast.success("スコープ・WBSを生成しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">スコープ・WBS</h2>
          <p className="text-sm text-muted-foreground">
            開発形態（
            <span className="font-medium text-foreground">
              {currentFormLabel}
            </span>
            ）に応じて、対象範囲・前提・成果物・作業分解（WBS）を整理します。
          </p>
        </div>
        {plan && (
          <Button onClick={generate} variant="outline" size="sm" disabled={pending}>
            <Sparkles className="size-3.5" />
            {pending ? "生成中…" : "再生成"}
          </Button>
        )}
      </div>

      {!plan ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Badge variant="secondary">開発形態: {currentFormLabel}</Badge>
            <p className="max-w-md text-sm text-muted-foreground">
              開発形態に最適化したスコープ定義とWBSをAIが作成します（コンサルなら調査・PoC・ロードマップ、請負なら設計〜検収のWBS、準委任ならスプリント中心）。
            </p>
            <Button onClick={generate} disabled={pending}>
              <Sparkles className="size-4" />
              {pending ? "生成中…" : "スコープ・WBSを生成"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {stale && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              現在の開発形態（{currentFormLabel}）と、生成時の内容が異なる可能性があります。「再生成」で最新の形態に合わせて作り直せます。
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span>進め方</span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{plan.formLabel}</Badge>
                  <Badge variant="outline">v{version}</Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{plan.approach}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="size-4 text-emerald-600" />
                  対象範囲（In Scope）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {plan.inScope.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CircleSlash className="size-4 text-rose-500" />
                  対象外（Out of Scope）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {plan.outOfScope.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-rose-400">×</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="size-4 text-primary" />
                前提・制約
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {plan.assumptions.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">・</span>
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="size-4 text-primary" />
                成果物一覧
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-md border">
                {plan.deliverables.map((d, i) => (
                  <li key={i} className="px-3 py-2">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.description}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTree className="size-4 text-primary" />
                WBS（作業分解構成）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.wbs.map((phase, pi) => (
                <div key={pi} className="rounded-lg border">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <span className="text-sm font-semibold">
                      {pi + 1}. {phase.name}
                    </span>
                    {phase.objective && (
                      <span className="text-xs text-muted-foreground">
                        {phase.objective}
                      </span>
                    )}
                  </div>
                  <ul className="divide-y">
                    {phase.tasks.map((t, ti) => (
                      <li
                        key={ti}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <CornerDownRight className="size-3 shrink-0 text-muted-foreground/50" />
                          {t.name}
                        </span>
                        {t.deliverable && (
                          <Badge variant="secondary" className="font-normal">
                            <Package className="mr-1 size-3" />
                            {t.deliverable}
                          </Badge>
                        )}
                        {t.role && (
                          <span className="text-xs text-muted-foreground">
                            {t.role}
                          </span>
                        )}
                        {t.weeks != null && (
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                            約{t.weeks}週
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
