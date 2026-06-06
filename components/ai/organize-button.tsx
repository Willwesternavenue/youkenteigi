"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { organizeHearing } from "@/app/_actions/ai";

export function OrganizeButton({
  projectId,
  hasResult,
}: {
  projectId: string;
  hasResult: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const res = await organizeHearing(projectId);
      if (res.ok) {
        toast.success("ヒアリング内容を整理しました");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button onClick={run} disabled={pending} variant={hasResult ? "outline" : "default"}>
      <Sparkles className="size-4" />
      {pending ? "整理中…" : hasResult ? "再整理する" : "整理する"}
    </Button>
  );
}
