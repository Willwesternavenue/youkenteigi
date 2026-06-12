import path from "node:path";
import fs from "node:fs";
import PdfPrinter from "pdfmake/js/Printer";
import vfs from "pdfmake/js/virtual-fs";
import URLResolver from "pdfmake/js/URLResolver";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { parseBlocks, type Block, type Inline } from "./markdown-ast";
import type { ExportDoc } from "./to-docx";

/**
 * Pure-JS PDF generation via pdfmake (no headless browser). A bundled Noto Sans
 * JP font is embedded so Japanese text renders correctly. All weights map to the
 * single Regular face we ship.
 *
 * pdfmake 0.3 reads fonts from its in-memory virtual filesystem, so we load the
 * TTF buffer into the VFS under a key and reference that key in the descriptor.
 */

const FONT_KEY = "NotoSansJP-Regular.ttf";

// The font is traced into the serverless bundle, but its location at runtime can
// differ between local (process.cwd() === project root) and Vercel. Try the
// likely anchors (cwd + the compiled module dir) and report what we tried so a
// failure is actionable rather than opaque.
function resolveFontPath(): string {
  const rel = ["lib", "export", "fonts", FONT_KEY];
  const candidates: string[] = [path.join(process.cwd(), ...rel)];
  // __dirname is defined in the Node server bundle; guard so a missing binding
  // never throws a ReferenceError.
  if (typeof __dirname !== "undefined") {
    candidates.push(path.join(__dirname, "fonts", FONT_KEY));
    candidates.push(path.join(__dirname, ...rel));
    candidates.push(path.join(__dirname, "..", "fonts", FONT_KEY));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `日本語フォントが見つかりません。試したパス: ${candidates.join(" | ")}`,
  );
}

let printer: PdfPrinter | null = null;

function getPrinter(): PdfPrinter {
  if (printer) return printer;
  vfs.writeFileSync(FONT_KEY, fs.readFileSync(resolveFontPath()));
  printer = new PdfPrinter(
    {
      NotoJP: {
        normal: FONT_KEY,
        bold: FONT_KEY,
        italics: FONT_KEY,
        bolditalics: FONT_KEY,
      },
    },
    vfs,
    new URLResolver(vfs),
  );
  return printer;
}

function inlineRuns(inlines: Inline[]): { text: { text: string; bold?: boolean; italics?: boolean }[] } {
  return {
    text: inlines.map((i) => ({
      text: i.text,
      bold: i.bold,
      italics: i.italic,
    })),
  };
}

function blockToContent(block: Block): Content | Content[] {
  switch (block.type) {
    case "heading":
      return {
        ...inlineRuns(block.inlines),
        style: block.level <= 2 ? "h3" : "h4",
        margin: [0, 8, 0, 4],
      };
    case "paragraph":
      return { ...inlineRuns(block.inlines), margin: [0, 0, 0, 6] };
    case "list": {
      const items = block.items.map((it) => inlineRuns(it));
      return block.ordered
        ? { ol: items, margin: [0, 0, 0, 6] }
        : { ul: items, margin: [0, 0, 0, 6] };
    }
    case "blockquote":
      return {
        ...inlineRuns(block.inlines),
        italics: true,
        margin: [12, 0, 0, 6],
        color: "#475569",
      };
    case "code":
      return {
        text: block.text,
        margin: [0, 0, 0, 6],
        fontSize: 9,
        color: "#334155",
      };
  }
}

export async function toPdf(doc: ExportDoc): Promise<Buffer> {
  const content: Content[] = [
    { text: doc.title, style: "title", margin: [0, 0, 0, 16] },
  ];

  for (const section of doc.sections) {
    content.push({ text: section.heading, style: "h2", margin: [0, 12, 0, 6] });
    for (const block of parseBlocks(section.markdown)) {
      const c = blockToContent(block);
      if (Array.isArray(c)) content.push(...c);
      else content.push(c);
    }
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    styles: {
      title: { fontSize: 20, bold: true },
      h2: { fontSize: 14, bold: true, color: "#1e3a5f" },
      h3: { fontSize: 12, bold: true },
      h4: { fontSize: 11, bold: true },
    },
    pageMargins: [48, 56, 48, 56],
  };

  return renderDocDefinition(docDefinition);
}

/**
 * Render any pdfmake doc definition to a Buffer with the embedded CJK font as
 * default. Shared by the document and schedule exporters.
 */
export async function renderDocDefinition(
  docDefinition: TDocumentDefinitions,
): Promise<Buffer> {
  const withFont: TDocumentDefinitions = {
    defaultStyle: { font: "NotoJP", fontSize: 10, lineHeight: 1.4 },
    ...docDefinition,
  };
  const pdfDoc = await getPrinter().createPdfKitDocument(withFont);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (c: Buffer) => chunks.push(c));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
