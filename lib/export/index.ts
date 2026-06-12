import type { ExportDoc } from "./to-docx";
import type { EstimateExport } from "./to-xlsx";
import type { ScheduleExport } from "./to-schedule-pdf";
import type { Slide } from "@/lib/slides/deck";

/**
 * Export facade. Given a stored document's title + sections, produce a file in
 * the requested format. Markdown is assembled directly; DOCX/PDF go through the
 * shared Markdown block model.
 *
 * Each exporter's heavy dependency (docx / pdfmake / exceljs / pptxgenjs) is
 * loaded via a DYNAMIC import so importing this facade never eagerly evaluates
 * them. This matters in production: pptxgenjs ships an ESM entry that the
 * serverless external-module loader cannot parse, so a static import would
 * crash *document* (docx/pdf) export too — even though it never uses pptx.
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
    case "docx": {
      const { toDocx } = await import("./to-docx");
      return {
        data: await toDocx(doc),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: "docx",
      };
    }
    case "pdf": {
      const { toPdf } = await import("./to-pdf");
      return {
        data: await toPdf(doc),
        contentType: "application/pdf",
        extension: "pdf",
      };
    }
  }
}

export async function exportEstimateXlsx(
  data: EstimateExport,
): Promise<ExportResult> {
  const { toXlsx } = await import("./to-xlsx");
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
  const { toSchedulePdf } = await import("./to-schedule-pdf");
  return {
    data: await toSchedulePdf(data),
    contentType: "application/pdf",
    extension: "pdf",
  };
}

export async function exportSlidesPptx(slides: Slide[]): Promise<ExportResult> {
  const { toPptx } = await import("./to-pptx");
  return {
    data: await toPptx(slides),
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
  };
}

export async function exportSlidesPdf(slides: Slide[]): Promise<ExportResult> {
  const { toSlidePdf } = await import("./to-slide-pdf");
  return {
    data: await toSlidePdf(slides),
    contentType: "application/pdf",
    extension: "pdf",
  };
}

export type { ExportDoc, EstimateExport, ScheduleExport };
