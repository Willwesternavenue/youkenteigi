"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProjectMeta } from "@/app/_actions/projects";
import {
  RECOMMENDED_PLATFORMS,
  PLATFORM_LABELS,
  RECOMMENDED_DEPLOYMENTS,
  DEPLOYMENT_LABELS,
  type RecommendedPlatform,
  type RecommendedDeployment,
} from "@/types/domain";

/**
 * 形態（Web/native/PWA）と 導入（クラウド/オンプレ…）。AI整理で推奨が入り、
 * ここで人が確認・上書きできる。要件定義/RFP/提案の生成にも反映される。
 */
export function RecommendationsCard({
  projectId,
  platform,
  deployment,
}: {
  projectId: string;
  platform: string | null;
  deployment: string | null;
}) {
  const [pending, start] = useTransition();

  function save(patch: {
    recommendedPlatform?: RecommendedPlatform;
    recommendedDeployment?: RecommendedDeployment;
  }) {
    start(async () => {
      const res = await updateProjectMeta(projectId, patch);
      if (res.ok) toast.success("更新しました");
      else toast.error("更新できませんでした");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">形態・導入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">形態</Label>
          <Select
            value={platform ?? ""}
            onValueChange={(v) =>
              v && save({ recommendedPlatform: v as RecommendedPlatform })
            }
            disabled={pending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="未設定（AI整理で推奨）">
                {(v: string | null) =>
                  v ? PLATFORM_LABELS[v as RecommendedPlatform] : "未設定（AI整理で推奨）"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RECOMMENDED_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">導入</Label>
          <Select
            value={deployment ?? ""}
            onValueChange={(v) =>
              v && save({ recommendedDeployment: v as RecommendedDeployment })
            }
            disabled={pending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="未設定（AI整理で推奨）">
                {(v: string | null) =>
                  v
                    ? DEPLOYMENT_LABELS[v as RecommendedDeployment]
                    : "未設定（AI整理で推奨）"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RECOMMENDED_DEPLOYMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {DEPLOYMENT_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
