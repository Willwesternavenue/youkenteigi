import { marked, type Token, type Tokens } from "marked";

/**
 * A small, normalized Markdown block model shared by the DOCX and PDF
 * exporters. Generated/edited document content uses a limited Markdown subset
 * (headings, paragraphs, bullet/ordered lists, blockquotes, bold/italic/code),
 * so we lower marked's token stream into these blocks and map them once per
 * output format.
 */

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type Block =
  | { type: "heading"; level: number; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "blockquote"; inlines: Inline[] }
  | { type: "code"; text: string };

function inlinesFrom(tokens: Token[] | undefined, fallback: string): Inline[] {
  if (!tokens || tokens.length === 0) {
    return fallback ? [{ text: fallback }] : [];
  }
  const out: Inline[] = [];
  const walk = (toks: Token[], style: Omit<Inline, "text">) => {
    for (const t of toks) {
      switch (t.type) {
        case "strong":
          walk((t as Tokens.Strong).tokens, { ...style, bold: true });
          break;
        case "em":
          walk((t as Tokens.Em).tokens, { ...style, italic: true });
          break;
        case "codespan":
          out.push({ text: (t as Tokens.Codespan).text, ...style, code: true });
          break;
        case "link":
          walk((t as Tokens.Link).tokens, style);
          break;
        case "br":
          out.push({ text: "\n", ...style });
          break;
        case "text": {
          const tt = t as Tokens.Text;
          if (tt.tokens && tt.tokens.length) walk(tt.tokens, style);
          else out.push({ text: tt.text, ...style });
          break;
        }
        default:
          if ("text" in t && typeof t.text === "string") {
            out.push({ text: t.text, ...style });
          }
      }
    }
  };
  walk(tokens, {});
  return out.length ? out : [{ text: fallback }];
}

export function parseBlocks(markdown: string): Block[] {
  const tokens = marked.lexer(markdown ?? "");
  const blocks: Block[] = [];

  for (const tok of tokens) {
    switch (tok.type) {
      case "heading": {
        const h = tok as Tokens.Heading;
        blocks.push({
          type: "heading",
          level: h.depth,
          inlines: inlinesFrom(h.tokens, h.text),
        });
        break;
      }
      case "paragraph": {
        const p = tok as Tokens.Paragraph;
        blocks.push({
          type: "paragraph",
          inlines: inlinesFrom(p.tokens, p.text),
        });
        break;
      }
      case "list": {
        const l = tok as Tokens.List;
        blocks.push({
          type: "list",
          ordered: l.ordered,
          items: l.items.map((it) => inlinesFrom(it.tokens, it.text)),
        });
        break;
      }
      case "blockquote": {
        const b = tok as Tokens.Blockquote;
        const text = b.tokens
          .map((t) => ("text" in t ? (t.text as string) : ""))
          .join(" ");
        blocks.push({ type: "blockquote", inlines: [{ text }] });
        break;
      }
      case "code": {
        blocks.push({ type: "code", text: (tok as Tokens.Code).text });
        break;
      }
      default:
        break;
    }
  }
  return blocks;
}

export function inlineToPlainText(inlines: Inline[]): string {
  return inlines.map((i) => i.text).join("");
}
