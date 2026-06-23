"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Pencil, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProjectMeta } from "@/app/_actions/projects";

/** Normalize a bare domain or URL into an https:// link. */
function toUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * クライアント名の行。公式HPのリンクを付与・編集でき、設定済みなら
 * 地球アイコンのリンクで「公式HPあり」と見た目で分かるようにする。
 */
export function ClientNameRow({
  projectId,
  clientName,
  domain,
}: {
  projectId: string;
  clientName: string;
  domain: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(domain ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateProjectMeta(projectId, {
        clientDomain: value.trim(),
      });
      if (res.ok) {
        setEditing(false);
        toast.success("公式HPを更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <dt className="text-sm text-muted-foreground">クライアント</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-medium">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="example.co.jp"
              className="h-7 w-44"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) save();
                if (e.key === "Escape") {
                  setValue(domain ?? "");
                  setEditing(false);
                }
              }}
              autoFocus
            />
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
              onClick={() => {
                setValue(domain ?? "");
                setEditing(false);
              }}
            >
              <X className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <>
            <span className="truncate">{clientName}</span>
            {domain ? (
              <a
                href={toUrl(domain)}
                target="_blank"
                rel="noopener noreferrer"
                title={`公式HP: ${toUrl(domain)}`}
                className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
              >
                <Globe className="size-3.5" />
                <span className="text-xs">公式HP</span>
              </a>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3" />
                公式HP
              </button>
            )}
            {domain && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="公式HPを編集"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </>
        )}
      </dd>
    </div>
  );
}
