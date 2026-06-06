"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Trash2,
  ExternalLink,
  CalendarDays,
  MessagesSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProjectMeta } from "@/app/_actions/projects";
import { formatDate } from "@/lib/format";

export interface MeetingNote {
  date: string;
  title: string;
  url: string;
}

/** 打ち合わせごとに増える議事録の履歴。日付・タイトル・Notion等のリンクを記録。 */
export function MeetingNotesView({
  projectId,
  notes,
}: {
  projectId: string;
  notes: MeetingNote[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<MeetingNote[]>(notes);
  const [pending, start] = useTransition();

  // newest first for display
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));

  function save() {
    const cleaned = items
      .filter((m) => m.title.trim() !== "" || m.url.trim() !== "")
      .sort((a, b) => b.date.localeCompare(a.date));
    start(async () => {
      const res = await updateProjectMeta(projectId, { meetingNotes: cleaned });
      if (res.ok) {
        setItems(cleaned);
        setEditing(false);
        toast.success("議事録を更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function addRow() {
    setItems((x) => [...x, { date: "", title: "", url: "" }]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquare className="size-4 text-primary" />
          議事録（打ち合わせ履歴）
        </CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            編集
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
                  value={m.title}
                  onChange={(e) =>
                    setItems((x) =>
                      x.map((y, i) =>
                        i === idx ? { ...y, title: e.target.value } : y,
                      ),
                    )
                  }
                  placeholder="例: キックオフMTG"
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
                  placeholder="Notion 等の URL"
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
            ))}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3" />
              打ち合わせを追加
            </Button>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems(notes);
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
          <ol className="space-y-2">
            {sorted.map((m, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 border-b pb-2 last:border-0 last:pb-0"
              >
                <span className="inline-flex w-28 shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {formatDate(m.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {m.title || "（無題）"}
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
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            打ち合わせごとに議事録（Notion 等のリンク）を追加して履歴を残せます（「編集」）。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
