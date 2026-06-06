"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Trash2,
  ExternalLink,
  FolderOpen,
  Lightbulb,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProjectMeta } from "@/app/_actions/projects";
import { formatDate } from "@/lib/format";

export interface ReceivedMaterial {
  date: string;
  name: string;
  url: string;
}
export interface ReferenceLink {
  title: string;
  url: string;
  note: string;
}

/** Pick a file-ish icon from the material name / url. */
function materialIcon(name: string, url: string): LucideIcon {
  const s = `${name} ${url}`.toLowerCase();
  if (/\.(xlsx?|csv|numbers)/.test(s)) return FileSpreadsheet;
  if (/\.(png|jpe?g|gif|webp|svg|heic)/.test(s)) return FileImage;
  if (/\.(pptx?|key)|canva|slides/.test(s)) return Presentation;
  if (/\.(pdf|docx?|pages|txt|md)/.test(s)) return FileText;
  return Link2;
}

/* ------------------------------------------------------------------ */
/* 受領資料（共有ドライブ風）— client-provided materials as links       */
/* ------------------------------------------------------------------ */

export function ReceivedMaterialsCard({
  projectId,
  materials,
}: {
  projectId: string;
  materials: ReceivedMaterial[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<ReceivedMaterial[]>(materials);
  const [pending, start] = useTransition();

  const sorted = [...materials].sort((a, b) => b.date.localeCompare(a.date));

  function save() {
    const cleaned = items
      .filter((m) => m.name.trim() !== "" || m.url.trim() !== "")
      .sort((a, b) => b.date.localeCompare(a.date));
    start(async () => {
      const res = await updateProjectMeta(projectId, {
        receivedMaterials: cleaned,
      });
      if (res.ok) {
        setItems(cleaned);
        setEditing(false);
        toast.success("受領資料を更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="size-4 text-primary" />
          受領資料（共有ドライブ）
        </CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            追加・編集
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            {items.map((m, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={m.date}
                  onChange={(e) =>
                    setItems((x) =>
                      x.map((y, i) =>
                        i === idx ? { ...y, date: e.target.value } : y,
                      ),
                    )
                  }
                  className="h-8 w-40"
                />
                <Input
                  value={m.name}
                  onChange={(e) =>
                    setItems((x) =>
                      x.map((y, i) =>
                        i === idx ? { ...y, name: e.target.value } : y,
                      ),
                    )
                  }
                  placeholder="例: RFP原本.pdf"
                  className="h-8 w-48"
                />
                <Input
                  value={m.url}
                  onChange={(e) =>
                    setItems((x) =>
                      x.map((y, i) =>
                        i === idx ? { ...y, url: e.target.value } : y,
                      ),
                    )
                  }
                  placeholder="Drive / Notion 等の URL"
                  className="h-8 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setItems((x) => x.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((x) => [...x, { date: "", name: "", url: "" }])
              }
            >
              <Plus className="size-3" />
              資料を追加
            </Button>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems(materials);
                  setEditing(false);
                }}
              >
                キャンセル
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        ) : sorted.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {sorted.map((m, idx) => {
              const Icon = materialIcon(m.name, m.url);
              return (
                <li
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {m.name || "（無題）"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.date ? formatDate(m.date) : ""}
                  </span>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      開く
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            先方からもらった資料（RFP・業務フロー・マニュアル等）のリンクを共有ドライブのように集約できます（「追加・編集」）。実ファイルは Drive/Notion 等に置いたままで構いません。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 参考情報・類似製品 — references gathered by us                       */
/* ------------------------------------------------------------------ */

export function ReferenceLinksCard({
  projectId,
  references,
}: {
  projectId: string;
  references: ReferenceLink[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<ReferenceLink[]>(references);
  const [pending, start] = useTransition();

  function save() {
    const cleaned = items.filter(
      (r) => r.title.trim() !== "" || r.url.trim() !== "",
    );
    start(async () => {
      const res = await updateProjectMeta(projectId, {
        referenceLinks: cleaned,
      });
      if (res.ok) {
        setItems(cleaned);
        setEditing(false);
        toast.success("参考情報を更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-primary" />
          参考情報・類似製品
        </CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            追加・編集
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            {items.map((r, idx) => (
              <div key={idx} className="space-y-1.5 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={r.title}
                    onChange={(e) =>
                      setItems((x) =>
                        x.map((y, i) =>
                          i === idx ? { ...y, title: e.target.value } : y,
                        ),
                      )
                    }
                    placeholder="例: 競合 Zendesk AI"
                    className="h-8 w-56"
                  />
                  <Input
                    value={r.url}
                    onChange={(e) =>
                      setItems((x) =>
                        x.map((y, i) =>
                          i === idx ? { ...y, url: e.target.value } : y,
                        ),
                      )
                    }
                    placeholder="https://..."
                    className="h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setItems((x) => x.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <Input
                  value={r.note}
                  onChange={(e) =>
                    setItems((x) =>
                      x.map((y, i) =>
                        i === idx ? { ...y, note: e.target.value } : y,
                      ),
                    )
                  }
                  placeholder="メモ（例: 既存利用中。AI回答機能あり）"
                  className="h-8"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((x) => [...x, { title: "", url: "", note: "" }])
              }
            >
              <Plus className="size-3" />
              参考情報を追加
            </Button>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems(references);
                  setEditing(false);
                }}
              >
                キャンセル
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        ) : items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((r, idx) => (
              <li
                key={idx}
                className="border-b pb-2 last:border-0 last:pb-0"
              >
                <a
                  href={r.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {r.title || r.url}
                </a>
                {r.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            類似製品・競合・参考事例などのリンクとメモを残せます（「追加・編集」）。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
