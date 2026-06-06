"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UploadCloud,
  AudioLines,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  File as FileIcon,
  Download,
  Play,
  Trash2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { deleteProjectFile } from "@/app/_actions/projects";

export interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string | null;
  createdAt: string;
  uploaderName: string | null;
}

const ACCEPT =
  ".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.md,.mp3,.m4a,.wav,.png,.jpg,.jpeg,audio/*";

function isAudio(f: UploadedFile): boolean {
  return (
    (f.fileType ?? "").startsWith("audio/") ||
    /\.(mp3|m4a|wav)$/i.test(f.fileName)
  );
}

function fileIcon(f: UploadedFile): LucideIcon {
  const s = `${f.fileName} ${f.fileType ?? ""}`.toLowerCase();
  if (isAudio(f)) return AudioLines;
  if (/\.(xlsx?|csv)|spreadsheet/.test(s)) return FileSpreadsheet;
  if (/\.(png|jpe?g|gif|webp)|image\//.test(s)) return FileImage;
  if (/\.(pptx?|key)|presentation/.test(s)) return Presentation;
  if (/\.(pdf|docx?|txt|md)|pdf|word|text/.test(s)) return FileText;
  return FileIcon;
}

export function FileUploadCard({
  projectId,
  files,
}: {
  projectId: string;
  files: UploadedFile[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, startDelete] = useTransition();

  async function uploadOne(file: File) {
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("file", file);
    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: form,
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: boolean; error?: string }
      | null;
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? "アップロードに失敗しました");
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(list)) {
      try {
        await uploadOne(f);
        ok++;
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${ok}件アップロードしました`);
      router.refresh();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    startDelete(async () => {
      const res = await deleteProjectFile(projectId, id);
      if (res.ok) {
        toast.success("削除しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UploadCloud className="size-4 text-primary" />
          アップロード資料（録音・議事録など）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/40",
          )}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-primary" />
          ) : (
            <UploadCloud className="size-6 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {busy
              ? "アップロード中…"
              : "ここにドラッグ＆ドロップ、またはクリックして選択"}
          </p>
          <p className="text-xs text-muted-foreground">
            MP3 / M4A / WAV（録音）・PDF / DOCX / XLSX / 画像 など（上限300MB）
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* file list */}
        {files.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {files.map((f) => {
              const Icon = fileIcon(f);
              const audio = isAudio(f);
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      audio ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.uploaderName ?? "—"} · {formatDate(f.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/files/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {audio ? (
                      <Play className="size-3.5" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    {audio ? "再生" : "開く"}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={deleting}
                    onClick={() => remove(f.id, f.fileName)}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            会議の録音音声（MP3 等）や議事録データをアップロードして保存できます。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
