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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  type TemplateType,
} from "@/types/domain";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/app/_actions/admin";

export interface Template {
  id: string;
  type: TemplateType;
  name: string;
  body: string;
  isDefault: boolean;
}

function TemplateDialog({
  existing,
  trigger,
}: {
  existing?: Template;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TemplateType>(existing?.type ?? "rfp");
  const [name, setName] = useState(existing?.name ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const payload = { type, name, body, isDefault };
      const res = existing
        ? await updateTemplate(existing.id, payload)
        : await createTemplate(payload);
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
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {existing ? "テンプレートを編集" : "テンプレートを追加"}
          </DialogTitle>
          <DialogDescription>
            RFP／要件／提案の標準文言・章立て。案件作成時の生成ベースに使えます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>種別</Label>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as TemplateType)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) =>
                      v ? TEMPLATE_TYPE_LABELS[v as TemplateType] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TEMPLATE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input
                id="tpl-default"
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="size-4 accent-primary"
              />
              <Label htmlFor="tpl-default" className="font-normal">
                この種別の既定にする
              </Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">名称</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 標準RFP雛形（製造業向け）"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">本文 / 章立て（Markdown）</Label>
            <Textarea
              id="tpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder={"# 1. 背景・目的\n# 2. 対象範囲\n# 3. 機能要件\n..."}
              className="font-sans"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={pending || !name}>
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
        if (!confirm("このテンプレートを削除しますか？")) return;
        startTransition(async () => {
          const res = await deleteTemplate(id);
          if (res.ok) toast.success("削除しました");
          else toast.error("削除できませんでした");
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function TemplatesTable({ rows }: { rows: Template[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} 件</p>
        <TemplateDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              テンプレートを追加
            </Button>
          }
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>種別</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>本文</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  テンプレートが未登録です。「テンプレートを追加」から登録してください。
                </TableCell>
              </TableRow>
            )}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {TEMPLATE_TYPE_LABELS[t.type]}
                    {t.isDefault && <Badge variant="secondary">既定</Badge>}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                  {t.body.split("\n").find((l) => l.trim()) ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <TemplateDialog
                    existing={t}
                    trigger={
                      <Button size="sm" variant="ghost">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteButton id={t.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
