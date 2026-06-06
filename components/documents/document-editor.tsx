"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "./export-buttons";
import {
  generateDocument,
  saveDocumentEdit,
  regenerateSection,
} from "@/app/_actions/documents";
import type { DocumentType } from "@/types/domain";

export interface EditorSection {
  key: string;
  heading: string;
  markdown: string;
}

export interface EditorDocument {
  id: string;
  title: string;
  version: number;
  sections: EditorSection[];
}

export function DocumentEditor({
  projectId,
  type,
  label,
  document,
}: {
  projectId: string;
  type: DocumentType;
  label: string;
  document: EditorDocument | null;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<EditorSection[]>(
    document?.sections ?? [],
  );
  const [dirty, setDirty] = useState(false);
  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();
  const [regenKey, setRegenKey] = useState<string | null>(null);

  function generate() {
    startGen(async () => {
      const res = await generateDocument(projectId, type);
      if (res.ok) {
        toast.success(`${label}を生成しました`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function updateSection(key: string, markdown: string) {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, markdown } : s)),
    );
    setDirty(true);
  }

  function regenerate(key: string) {
    setRegenKey(key);
    regenerateSection(projectId, type, key).then((res) => {
      setRegenKey(null);
      if (res.ok && res.section) {
        updateSection(key, res.section.markdown);
        toast.success("セクションを再生成しました（保存で確定）");
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function save() {
    if (!document) return;
    startSave(async () => {
      const res = await saveDocumentEdit(projectId, type, sections, document.title);
      if (res.ok) {
        setDirty(false);
        toast.success("新しいバージョンとして保存しました");
        router.refresh();
      } else {
        toast.error("保存できませんでした");
      }
    });
  }

  if (!document) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{label}</h2>
          <p className="text-sm text-muted-foreground">
            ヒアリング内容とAI整理をもとに{label}を生成します。
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              まだ{label}が作成されていません。
            </p>
            <Button onClick={generate} disabled={genPending}>
              <Sparkles className="size-4" />
              {genPending ? "生成中…" : `${label}を生成`}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{label}</h2>
          <Badge variant="secondary">v{document.version}</Badge>
          {dirty && <Badge variant="outline" className="text-amber-600">未保存</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons documentId={document.id} />
          <Button onClick={generate} variant="outline" size="sm" disabled={genPending}>
            <Sparkles className="size-3.5" />
            {genPending ? "再生成中…" : "全体を再生成"}
          </Button>
          <Button onClick={save} size="sm" disabled={savePending || !dirty}>
            <Save className="size-3.5" />
            {savePending ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((s, i) => (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                {s.heading}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenerate(s.key)}
                disabled={regenKey === s.key}
              >
                <RefreshCw
                  className={`size-3.5 ${regenKey === s.key ? "animate-spin" : ""}`}
                />
                再生成
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={s.markdown}
                onChange={(e) => updateSection(s.key, e.target.value)}
                rows={Math.max(3, s.markdown.split("\n").length + 1)}
                className="font-mono text-xs leading-relaxed"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
