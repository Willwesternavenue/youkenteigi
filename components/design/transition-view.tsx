"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScreenFlow } from "@/components/design/screen-flow";
import type { WireframeBlock } from "@/lib/ai/providers";

export interface TransitionScreen {
  key: string;
  name: string;
  role?: string;
  wireframe: WireframeBlock[];
}
export interface TransitionEdge {
  from: string;
  to: string;
  label?: string;
}

export function TransitionView({
  projectId,
  hasDesign,
  version,
  screens,
  transitions,
}: {
  projectId: string;
  hasDesign: boolean;
  version: number;
  screens: TransitionScreen[];
  transitions: TransitionEdge[];
}) {
  if (!hasDesign) {
    return (
      <div className="space-y-4">
        <Heading />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              先に「画面設計」タブで画面設計を生成してください。
            </p>
            <Button
              render={<Link href={`/projects/${projectId}/design`} />}
              nativeButton={false}
            >
              画面設計へ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heading />
          <Badge variant="secondary">v{version}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="size-4 text-primary" />
            画面遷移フロー（各画面のUIと遷移）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScreenFlow screens={screens} transitions={transitions} />
        </CardContent>
      </Card>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h2 className="text-base font-semibold">画面遷移</h2>
      <p className="text-sm text-muted-foreground">
        各画面のUIイメージを、実際の遷移でつないだフロー（提案スライドにも反映されます）
      </p>
    </div>
  );
}
