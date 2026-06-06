import { toDocx, type ExportDoc } from "./to-docx";
import { toPdf } from "./to-pdf";
import { toXlsx, type EstimateExport } from "./to-xlsx";
import { toSchedulePdf, type ScheduleExport } from "./to-schedule-pdf";
import { toPptx } from "./to-pptx";
import { toSlidePdf } from "./to-slide-pdf";
import type { Slide } from "@/lib/slides/deck";

/**
 * Export facade. Given a stored document's title + sections, produce a file in
 * the requested format. Markdown is assembled directly; DOCX/PDF go through the
 * shared Markdown block model.
 */

export type ExportFormat = "md" | "docx" | "pdf";

export interface ExportResult {
  data: Buffer;
  contentType: string;
  extension: string;
}

function toMarkdown(doc: ExportDoc): Buffer {
  const body = doc.sections
    .map((s) => `## ${s.heading}\n\n${s.markdown}`)
    .join("\n\n");
  return Buffer.from(`# ${doc.title}\n\n${body}\n`, "utf-8");
}

export async function exportDocument(
  doc: ExportDoc,
  format: ExportFormat,
): Promise<ExportResult> {
  switch (format) {
    case "md":
      return {
        data: toMarkdown(doc),
        contentType: "text/markdown; charset=utf-8",
        extension: "md",
      };
    case "docx":
      return {
        data: await toDocx(doc),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: "docx",
      };
    case "pdf":
      return {
        data: await toPdf(doc),
        contentType: "application/pdf",
        extension: "pdf",
      };
  }
}

export async function exportEstimateXlsx(
  data: EstimateExport,
): Promise<ExportResult> {
  return {
    data: await toXlsx(data),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  };
}

export async function exportSchedulePdf(
  data: ScheduleExport,
): Promise<ExportResult> {
  return {
    data: await toSchedulePdf(data),
    contentType: "application/pdf",
    extension: "pdf",
  };
}

export async function exportSlidesPptx(slides: Slide[]): Promise<ExportResult> {
  return {
    data: await toPptx(slides),
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
  };
}

export async function exportSlidesPdf(slides: Slide[]): Promise<ExportResult> {
  return {
    data: await toSlidePdf(slides),
    contentType: "application/pdf",
    extension: "pdf",
  };
}

export type { ExportDoc, EstimateExport, ScheduleExport };
