import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportSlidesPptx, exportSlidesPdf } from "@/lib/export";
import { loadEditableDeck } from "@/lib/slides/build";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await params;
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "pptx" && format !== "pdf") {
    return new Response("invalid format", { status: 400 });
  }

  const deck = await loadEditableDeck(user.orgId, projectId);
  if (!deck || !deck.hasRequirements) {
    return new Response("requirements not found", { status: 404 });
  }

  const project = await db.projects.getById(user.orgId, projectId);
  const base = `${project?.projectName ?? "提案資料"}_提案スライド`;

  try {
    const result =
      format === "pptx"
        ? await exportSlidesPptx(deck.slides)
        : await exportSlidesPdf(deck.slides);

    const filename = `${base}.${result.extension}`;
    return new Response(new Uint8Array(result.data), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="slides.${result.extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(result.data.length),
      },
    });
  } catch (e) {
    // a hand-edited deck could contain malformed slide data
    console.error("slides export failed", e);
    return new Response("export failed", { status: 500 });
  }
}
