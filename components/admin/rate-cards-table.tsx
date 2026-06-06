"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatYen, formatDate } from "@/lib/format";
import { ROLES, ROLE_LABELS, type Role } from "@/types/domain";
import {
  createRateCard,
  updateRateCard,
  deleteRateCard,
} from "@/app/_actions/admin";

export interface RateCard {
  id: string;
  name: string;
  role: Role;
  dailyRate: number;
  monthlyRate: number | null;
  validFrom: string | null;
  validTo: string | null;
}

function RateCardDialog({
  existing,
  trigger,
}: {
  existing?: RateCard;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "標準レート");
  const [role, setRole] = useState<Role>(existing?.role ?? "pm");
  const [dailyRate, setDailyRate] = useState(String(existing?.dailyRate ?? ""));
  const [monthlyRate, setMonthlyRate] = useState(
    existing?.monthlyRate != null ? String(existing.monthlyRate) : "",
  );
  const [validFrom, setValidFrom] = useState(existing?.validFrom ?? "");
  const [validTo, setValidTo] = useState(existing?.validTo ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const payload = {
        name,
        role,
        dailyRate,
        monthlyRate: monthlyRate || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      };
      const res = existing
        ? await updateRateCard(existing.id, payload)
        : await createRateCard(payload);
      if (res.ok) {
        toast.success(existing ? "更新しました" : "追加しました");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {existing ? "レートを編集" : "レートを追加"}
          </DialogTitle>
          <DialogDescription>
            役割別の人日／月額単価。見積の参考単価として管理します。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rc-name">名称</Label>
            <Input
              id="rc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="標準レート2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label>役割</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue>
                  {(v: string | null) => (v ? ROLE_LABELS[v as Role] : "")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-daily">人日単価（円）</Label>
              <Input
                id="rc-daily"
                type="number"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="80000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-monthly">月額単価（円・任意）</Label>
              <Input
                id="rc-monthly"
                type="number"
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                placeholder="1500000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-from">有効開始（任意）</Label>
              <Input
                id="rc-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-to">有効終了（任意）</Label>
              <Input
                id="rc-to"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={pending || !name || !dailyRate}>
            {existing ? "保存" : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("このレートを削除しますか？")) return;
        startTransition(async () => {
          const res = await deleteRateCard(id);
          if (res.ok) toast.success("削除しました");
          else toast.error("削除できませんでした");
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function RateCardsTable({ rows }: { rows: RateCard[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} 件</p>
        <RateCardDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              レートを追加
            </Button>
          }
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>役割</TableHead>
              <TableHead className="text-right">人日単価</TableHead>
              <TableHead className="text-right">月額単価</TableHead>
              <TableHead>有効期間</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  レートが未登録です。「レートを追加」から登録してください。
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{ROLE_LABELS[r.role]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatYen(r.dailyRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.monthlyRate != null ? formatYen(r.monthlyRate) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.validFrom || r.validTo
                    ? `${formatDate(r.validFrom)} 〜 ${formatDate(r.validTo)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <RateCardDialog
                    existing={r}
                    trigger={
                      <Button size="sm" variant="ghost">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteButton id={r.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
