"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateScreenDesign } from "@/app/_actions/screen-design";

export interface ScreenItem {
  key: string;
  name: string;
  role?: string;
  purpose: string;
  uiElements: string[];
  states?: string[];
  priority?: string;
}

const PRIORITY: Record<string, { label: string; cls: string }> = {
  must: { label: "必須", cls: "bg-primary/10 text-primary border-primary/20" },
  should: { label: "推奨", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  could: { label: "オプション", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

/** 画面設計 / 画面一覧タブ: 想定画面の一覧。 */
export function ScreenListView({
  projectId,
  hasDesign,
  version,
  screens,
}: {
  projectId: string;
  hasDesign: boolean;
  version: number;
  screens: ScreenItem[];
}) {
  const router = useRouter();
  const [pending, startGen] = useTransition();

  function generate() {
    startGen(async () => {
      const res = await generateScreenDesign(projectId);
      if (res.ok) {
        toast.success("画面設計を生成しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!hasDesign) {
    return (
      <div className="space-y-4">
        <Heading />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              先に「システム構成図」タブで画面設計を生成すると、画面一覧が表示されます。
            </p>
            <Button onClick={generate} disabled={pending}>
              <Sparkles className="size-4" />
              {pending ? "生成中…" : "画面設計を生成"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heading />
          <Badge variant="secondary">v{version}</Badge>
        </div>
        <Button onClick={generate} variant="outline" size="sm" disabled={pending}>
          <Sparkles className="size-3.5" />
          {pending ? "再生成中…" : "再生成"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {screens.map((s) => {
          const pr = s.priority ? PRIORITY[s.priority] : undefined;
          return (
            <Card key={s.key}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">{s.name}</CardTitle>
                  {s.role && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.role}</p>
                  )}
                </div>
                {pr && (
                  <Badge variant="outline" className={pr.cls}>
                    {pr.label}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{s.purpose}</p>
                {s.uiElements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.uiElements.map((u, i) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {u}
                      </Badge>
                    ))}
                  </div>
                )}
                {s.states && s.states.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    状態: {s.states.join(" / ")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h2 className="text-base font-semibold">画面一覧</h2>
      <p className="text-sm text-muted-foreground">
        想定画面の一覧（各画面のUIと遷移は「画面遷移」タブ）
      </p>
    </div>
  );
}
