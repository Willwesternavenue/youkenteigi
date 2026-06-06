"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProjectMeta } from "@/app/_actions/projects";
import {
  PROJECT_STAGES,
  PHASE_LABELS,
  STAGE_BADGE_CLASS,
  type ProjectStage,
} from "@/types/domain";
import { cn } from "@/lib/utils";

/** Prominent, editable PoC / MVP / 本開発 badge. */
export function StageSelect({
  projectId,
  stage,
}: {
  projectId: string;
  stage: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const current = (stage as ProjectStage) || undefined;

  function onChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      const res = await updateProjectMeta(projectId, {
        projectStage: value as ProjectStage,
      });
      if (res.ok) toast.success("開発ステージを更新しました");
      else toast.error("更新できませんでした");
    });
  }

  return (
    <Select value={current ?? ""} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 gap-1 rounded-full border font-semibold",
          current
            ? STAGE_BADGE_CLASS[current]
            : "text-muted-foreground",
        )}
      >
        <SelectValue placeholder="ステージ未設定">
          {(v: string | null) =>
            v ? PHASE_LABELS[v as ProjectStage] : "ステージ未設定"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            {PHASE_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
