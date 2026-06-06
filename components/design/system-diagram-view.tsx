"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Copy, Network, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArchitectureView } from "@/components/design/architecture-view";
import {
  generateScreenDesign,
  applyDesignToRequirements,
} from "@/app/_actions/screen-design";
import type { GeneratedArchitecture } from "@/lib/ai/providers";

/** 画面設計 / システム構成図タブ: システム構成図 ＋ Claude Design 向けプロンプト。 */
export function SystemDiagramView({
  projectId,
  hasDesign,
  version,
  architecture,
  designPrompt,
}: {
  projectId: string;
  hasDesign: boolean;
  version: number;
  architecture: GeneratedArchitecture | null;
  designPrompt: string;
}) {
  const router = useRouter();
  const [pending, startGen] = useTransition();
  const [applyPending, startApply] = useTransition();

  function generate() {
    startGen(async () => {
      const res = await generateScreenDesign(projectId);
      if (res.ok) {
        toast.success("画面設計を生成しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function applyToRequirements() {
    startApply(async () => {
      const res = await applyDesignToRequirements(projectId);
      if (res.ok) {
        toast.success("要件定義書の画面関連セクションを更新しました");
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
              現状の案件情報・要件定義をもとに、システム構成図・画面一覧・画面遷移・Claude Design向けプロンプトを生成します。
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heading />
          <Badge variant="secondary">v{version}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={applyToRequirements}
            variant="outline"
            size="sm"
            disabled={applyPending}
          >
            <FileText className="size-3.5" />
            {applyPending ? "反映中…" : "要件定義に反映"}
          </Button>
          <Button onClick={generate} variant="outline" size="sm" disabled={pending}>
            <Sparkles className="size-3.5" />
            {pending ? "再生成中…" : "再生成"}
          </Button>
        </div>
      </div>

      {architecture && architecture.layers?.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network className="size-4 text-primary" />
              システム構成図
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ArchitectureView architecture={architecture} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          システム構成図がありません。「再生成」で作成できます。
        </p>
      )}

      {designPrompt && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Claude Design 向けプロンプト</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(designPrompt);
                toast.success("コピーしました");
              }}
            >
              <Copy className="size-3.5" />
              コピー
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
              {designPrompt}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h2 className="text-base font-semibold">システム構成図</h2>
      <p className="text-sm text-muted-foreground">
        システム全体構成と、Claude Design向けプロンプト（画面一覧・画面遷移は各タブへ）
      </p>
    </div>
  );
}
