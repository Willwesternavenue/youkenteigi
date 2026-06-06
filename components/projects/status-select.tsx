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
import { updateProjectStatus } from "@/app/_actions/projects";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/types/domain";

export function StatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      const res = await updateProjectStatus(projectId, value as ProjectStatus);
      if (res.ok) toast.success("ステータスを更新しました");
      else toast.error("更新できませんでした");
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-36" size="sm">
        <SelectValue>
          {(v: string | null) =>
            v ? PROJECT_STATUS_LABELS[v as ProjectStatus] : ""
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {PROJECT_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
