import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import { parseBlocks, type Block, type Inline } from "./markdown-ast";

/** A generated/edited document, as stored in `documents.content_json`. */
export interface ExportDoc {
  title: string;
  sections: { key: string; heading: string; markdown: string }[];
}

function runs(inlines: Inline[]): TextRun[] {
  return inlines.map(
    (i) =>
      new TextRun({
        text: i.text,
        bold: i.bold,
        italics: i.italic,
        font: i.code ? "Courier New" : undefined,
      }),
  );
}

function blockToParagraphs(block: Block): Paragraph[] {
  switch (block.type) {
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
            children: [new TextRun({ text: line, font: "Courier New" })],
          }),
      );
  }
}

export async function toDocx(doc: ExportDoc): Promise<Buffer> {
  const children: Paragraph[] = [
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
    for (const block of parseBlocks(section.markdown)) {
      children.push(...blockToParagraphs(block));
    }
  }

  const document = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(document);
}
