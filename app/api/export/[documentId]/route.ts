import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportDocument, type ExportFormat } from "@/lib/export";

export const runtime = "nodejs";

const VALID: ExportFormat[] = ["md", "docx", "pdf"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await requireUser();
  const { documentId } = await params;
  const format = req.nextUrl.searchParams.get("format") as ExportFormat;

  if (!VALID.includes(format)) {
    return new Response("invalid format", { status: 400 });
  }

  const doc = await db.documents.getById(user.orgId, documentId);
  if (!doc) return new Response("not found", { status: 404 });

  try {
    const result = await exportDocument(
      { title: doc.title, sections: doc.contentJson ?? [] },
      format,
    );

    const filename = `${doc.title}_v${doc.version}.${result.extension}`;
    const encoded = encodeURIComponent(filename);

    return new Response(new Uint8Array(result.data), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="document.${result.extension}"; filename*=UTF-8''${encoded}`,
        "Content-Length": String(result.data.length),
      },
    });
  } catch (e) {
    // Surface the real cause instead of letting Next return an opaque 500 that
    // the browser's <a download> saves as a broken file.
    const err = e as Error;
    console.error("[export] failed", {
      documentId,
      format,
      message: err.message,
      stack: err.stack,
    });
    return new Response(`エクスポートに失敗しました: ${err.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
