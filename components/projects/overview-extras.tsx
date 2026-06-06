"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, ExternalLink, Link2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProjectMeta } from "@/app/_actions/projects";

export interface ProjectLink {
  label: string;
  url: string;
}

export function DescriptionCard({
  projectId,
  description,
}: {
  projectId: string;
  description: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(description);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateProjectMeta(projectId, { description: text });
      if (res.ok) {
        setEditing(false);
        toast.success("概要を更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" />
          概要（つくるもの）
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
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="例: 社内FAQ・マニュアルを根拠に、問い合わせの一次回答ドラフトをAIが生成し、オペレーターが確認・送信できるWebアプリ"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setText(description); setEditing(false); }}>
                キャンセル
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        ) : description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            どういうものを作るかの概要を入力してください（「編集」）。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const PRESETS = [
  { label: "Canva 資料", url: "" },
  { label: "Figma", url: "" },
];

export function LinksCard({
  projectId,
  links,
}: {
  projectId: string;
  links: ProjectLink[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<ProjectLink[]>(links);
  const [pending, start] = useTransition();

  function save() {
    const cleaned = items.filter((l) => l.url.trim() !== "");
    start(async () => {
      const res = await updateProjectMeta(projectId, { links: cleaned });
      if (res.ok) {
        setItems(cleaned);
        setEditing(false);
        toast.success("リンクを更新しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-primary" />
          関連リンク
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
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((x) => [...x, { ...p }])}
                >
                  <Plus className="size-3" />
                  {p.label}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setItems((x) => [...x, { label: "リンク", url: "" }])}>
                <Plus className="size-3" />
                その他
              </Button>
            </div>
            {items.map((l, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <Input
                  value={l.label}
                  onChange={(e) =>
                    setItems((x) => x.map((y, i) => (i === idx ? { ...y, label: e.target.value } : y)))
                  }
                  placeholder="名称"
                  className="h-8 w-40"
                />
                <Input
                  value={l.url}
                  onChange={(e) =>
                    setItems((x) => x.map((y, i) => (i === idx ? { ...y, url: e.target.value } : y)))
                  }
                  placeholder="https://..."
                  className="h-8 flex-1"
                />
                <Button variant="ghost" size="icon-sm" onClick={() => setItems((x) => x.filter((_, i) => i !== idx))}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setItems(links); setEditing(false); }}>
                キャンセル
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        ) : items.length > 0 ? (
          <ul className="space-y-1.5">
            {items.map((l, idx) => (
              <li key={idx}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Canva（資料）・Figma などのリンクを追加できます（議事録はヒアリングの「議事録」タブへ）。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
