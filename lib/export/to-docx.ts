import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { parseBlocks, type Block, type Inline } from "./markdown-ast";

/** A generated/edited document, as stored in `documents.content_json`. */
export interface ExportDoc {
  title: string;
  sections: { key: string; heading: string; markdown: string }[];
}

// Japanese body font. Meiryo (メイリオ) renders proper Japanese glyph shapes and
// is widely available; explicitly NOT Yu Gothic (which can fall back to Chinese
// glyph forms). `eastAsia` is what actually controls CJK glyph selection in Word.
const JP_FONT = { ascii: "Meiryo", eastAsia: "Meiryo", hAnsi: "Meiryo", cs: "Meiryo" };

function runs(inlines: Inline[]): TextRun[] {
  return inlines.map(
    (i) =>
      new TextRun({
        text: i.text,
        bold: i.bold,
        italics: i.italic,
        font: i.code ? "Consolas" : JP_FONT,
      }),
  );
}

const CELL_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "CBD5E1",
};
const CELL_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
};

function tableToDocx(block: Extract<Block, { type: "table" }>): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: block.header.map(
      (cell) =>
        new TableCell({
          borders: CELL_BORDERS,
          shading: { fill: "EEF2F7" },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [
            new Paragraph({
              children: cell.map(
                (inl) =>
                  new TextRun({ text: inl.text, bold: true, font: JP_FONT }),
              ),
            }),
          ],
        }),
    ),
  });
  const bodyRows = block.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders: CELL_BORDERS,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [new Paragraph({ children: runs(cell) })],
            }),
        ),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function blockToParagraphs(block: Block): (Paragraph | Table)[] {
  switch (block.type) {
    case "table":
      return [tableToDocx(block)];
    case "heading":
      return [
        new Paragraph({
          children: runs(block.inlines),
          heading:
            block.level <= 2
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4,
          spacing: { before: 160, after: 80 },
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({ children: runs(block.inlines), spacing: { after: 120 } }),
      ];
    case "list":
      return block.items.map((item, idx) => {
        if (block.ordered) {
          return new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. `, bold: true }),
              ...runs(item),
            ],
            spacing: { after: 60 },
          });
        }
        return new Paragraph({
          children: runs(item),
          bullet: { level: 0 },
          spacing: { after: 60 },
        });
      });
    case "blockquote":
      return [
        new Paragraph({
          children: runs(block.inlines).map(
            (r) => r,
          ),
          indent: { left: 360 },
          spacing: { after: 120 },
        }),
      ];
    case "code":
      return block.text.split("\n").map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: "Consolas" })],
          }),
      );
  }
}

/** Heading text duplicated as the first markdown line (`## 同じ見出し`) is
 *  redundant once we render section.heading — drop it for cleaner structure. */
function sectionBlocks(section: ExportDoc["sections"][number]): Block[] {
  const blocks = parseBlocks(section.markdown);
  const first = blocks[0];
  if (
    first?.type === "heading" &&
    first.inlines.map((i) => i.text).join("").trim() === section.heading.trim()
  ) {
    return blocks.slice(1);
  }
  return blocks;
}

export async function toDocx(doc: ExportDoc): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: doc.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    }),
  ];

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      }),
    );
    for (const block of sectionBlocks(section)) {
      children.push(...blockToParagraphs(block));
    }
  }

  const document = new Document({
    // Default every run (incl. headings/title) to the Japanese font so Word
    // never falls back to a Chinese-leaning CJK substitute.
    styles: {
      default: {
        document: { run: { font: JP_FONT } },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(document);
}
