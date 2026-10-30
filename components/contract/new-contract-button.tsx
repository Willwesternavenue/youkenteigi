"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createContract } from "@/app/_actions/contracts";

/** projectId を渡すと案件に紐づけ、案件情報からプリフィルして作成する。 */
export function NewContractButton({
  projectId = null,
  label,
  variant = "default",
}: {
  projectId?: string | null;
  label: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const res = await createContract(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (projectId) router.refresh();
      else router.push(`/contract/${res.id}`);
    });
  }

  return (
    <Button variant={variant} onClick={create} disabled={pending}>
      <FilePlus2 className="size-4" />
      {pending ? "作成中..." : label}
    </Button>
  );
}
