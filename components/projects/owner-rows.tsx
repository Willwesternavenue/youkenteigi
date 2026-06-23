"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Check, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateProjectMeta } from "@/app/_actions/projects";

type OwnerField = "salesOwner" | "pmOwner" | "projectLead";

/** One assignable owner row (自社営業 / 自社PM / プロジェクト責任者) with an
 *  "自分を割当 (Assign me)" shortcut and a「あなた」badge when it's you. */
export function OwnerRow({
  projectId,
  label,
  field,
  value,
  me,
}: {
  projectId: string;
  label: string;
  field: OwnerField;
  value: string | null;
  me: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [pending, start] = useTransition();
  const isMe = !!value && value === me;

  function save(next: string) {
    start(async () => {
      const res = await updateProjectMeta(projectId, { [field]: next });
      if (res.ok) {
        setEditing(false);
        toast.success("更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-medium">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="氏名"
              className="h-7 w-40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) save(val.trim());
                if (e.key === "Escape") {
                  setVal(value ?? "");
                  setEditing(false);
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => save(val.trim())}
              disabled={pending}
            >
              <Check className="size-3.5 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setVal(value ?? "");
                setEditing(false);
              }}
            >
              <X className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <>
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || "未割当"}
            </span>
            {isMe && (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                あなた
              </span>
            )}
            {!isMe && (
              <button
                onClick={() => save(me)}
                disabled={pending}
                title="自分を割り当てる"
                className="inline-flex shrink-0 items-center gap-0.5 text-xs text-primary hover:underline"
              >
                <UserPlus className="size-3" />
                自分
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="編集"
            >
              <Pencil className="size-3" />
            </button>
          </>
        )}
      </dd>
    </div>
  );
}

const man = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

/** 準委任向けの月額見積行: 月単価 × 月数 ＝ 合計（編集可）。 */
export function MonthlyBudgetRow({
  projectId,
  monthlyRate,
  months,
}: {
  projectId: string;
  monthlyRate: number | null;
  months: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rateMan, setRateMan] = useState(
    monthlyRate ? String(Math.round(monthlyRate / 10000)) : "",
  );
  const [mo, setMo] = useState(months ? String(months) : "");
  const [pending, start] = useTransition();

  const hasValue = !!monthlyRate && !!months;
  const total = (monthlyRate ?? 0) * (months ?? 0);

  function save() {
    const rateYen = Math.max(0, Math.round(Number(rateMan) || 0)) * 10000;
    const m = Math.max(0, Math.round(Number(mo) || 0));
    start(async () => {
      const res = await updateProjectMeta(projectId, {
        monthlyRate: rateYen,
        contractMonths: m,
      });
      if (res.ok) {
        setEditing(false);
        toast.success("更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">月額（準委任）</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-medium">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={rateMan}
              onChange={(e) => setRateMan(e.target.value)}
              inputMode="numeric"
              className="h-7 w-16"
              placeholder="月単価"
            />
            <span className="text-xs text-muted-foreground">万円 ×</span>
            <Input
              value={mo}
              onChange={(e) => setMo(e.target.value)}
              inputMode="numeric"
              className="h-7 w-14"
              placeholder="月数"
            />
            <span className="text-xs text-muted-foreground">ヶ月</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={save}
              disabled={pending}
            >
              <Check className="size-3.5 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(false)}
            >
              <X className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <>
            {hasValue ? (
              <span>
                {man(monthlyRate!)}/月 × {months}ヶ月
                <span className="ml-1 font-bold text-primary">
                  ＝ {man(total)}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">未設定</span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="編集"
            >
              <Pencil className="size-3" />
            </button>
          </>
        )}
      </dd>
    </div>
  );
}
