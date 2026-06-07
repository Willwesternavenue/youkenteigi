import { NextRequest } from "next/server";
import { requireUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// 録音(MP3/M4A/WAV) ＋ 議事録/資料(PDF/DOCX/...) — spec §7.7
const ALLOWED_EXT = new Set([
  "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "xls", "csv", "txt", "md",
  "mp3", "m4a", "wav", "png", "jpg", "jpeg",
]);
const MAX_BYTES = 300 * 1024 * 1024; // 300MB (会議録音を想定)

const EXT_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function sanitize(name: string): string {
  return name.replace(/[/\\]/g, "_").replace(/[^\w.\-（）()ぁ-んァ-ヶー一-龠　 ]/g, "").slice(0, 120) || "file";
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  try {
    requireRole(user, "project.edit");
  } catch {
    return Response.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }

  const form = await req.formData();
  const projectId = form.get("projectId");
  const file = form.get("file");

  if (typeof projectId !== "string" || !(file instanceof File)) {
    return Response.json({ ok: false, error: "不正なリクエストです" }, { status: 400 });
  }

  // tenant check — the project must belong to the caller's org
  const project = await db.projects.getById(user.orgId, projectId);
  if (!project) {
    return Response.json({ ok: false, error: "案件が見つかりません" }, { status: 404 });
  }

  const safeName = sanitize(file.name);
  const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_EXT.has(ext)) {
    return Response.json(
      { ok: false, error: `対応していない形式です（.${ext || "?"}）` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { ok: false, error: "ファイルが大きすぎます（上限300MB）" },
      { status: 400 },
    );
  }

  const contentType = file.type || EXT_MIME[ext] || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${user.orgId}/${projectId}/${crypto.randomUUID()}-${safeName}`;
  await storage.put(key, buffer, contentType);

  const row = await db.files.create(user.orgId, {
    projectId,
    fileName: file.name,
    fileType: contentType,
    storagePath: key,
    uploadedBy: user.userId,
  });

  return Response.json({ ok: true, id: row.id, fileName: row.fileName });
}
