import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const user = await requireUser();
  const { fileId } = await params;

  const file = await db.files.getById(user.orgId, fileId);
  if (!file) return new Response("not found", { status: 404 });

  let data: Buffer;
  try {
    data = await storage.get(file.storagePath);
  } catch {
    return new Response("file missing", { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("dl") === "1";
  const disposition = download ? "attachment" : "inline";
  const encoded = encodeURIComponent(file.fileName);

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.fileType ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encoded}`,
      "Content-Length": String(data.length),
      // Prevent MIME sniffing of user-uploaded content (stored-XSS hardening).
      "X-Content-Type-Options": "nosniff",
    },
  });
}
