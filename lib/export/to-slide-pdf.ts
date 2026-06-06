import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { renderDocDefinition } from "./to-pdf";
import type { Slide } from "@/lib/slides/deck";
import { SLIDE_THEME as T, SLIDE } from "@/lib/slides/theme";
import { placeScene } from "@/lib/diagram/place";

/**
 * Slide-style PDF (one 16:9 landscape page per slide), mirroring the HTML and
 * PPTX layouts with the brand palette. Each page is drawn via pdfmake's
 * per-page `background` (canvas rects + absolutely-positioned text), so the
 * flow content is just page breaks.
 */

const W = SLIDE.widthPt; // 960
const H = SLIDE.heightPt; // 540
// Layout coordinates are already in the 0–960 × 0–540 point grid → identity.
const p = (u: number) => u;
// Font sizes are authored in the small "cqw" scale → points.
const fs = (cqw: number) => Math.round(cqw * 7.2);

// canvas elements: rect | line | polyline (loose; pdfmake validates at render)
type CanvasEl = Record<string, unknown>;

type TextNode = Record<string, unknown>;

function header(canvas: CanvasEl[], out: TextNode[], index: number | undefined, heading: string) {
  canvas.push({ type: "rect", x: p(70), y: p(55), w: p(7), h: p(42), color: T.blue, r: 3 });
  let x = p(80);
  if (index !== undefined) {
    canvas.push({ type: "rect", x, y: p(52), w: p(34), h: p(34), color: T.blue, r: 4 });
    out.push({ text: String(index).padStart(2, "0"), absolutePosition: { x: x + 8, y: p(62) }, color: "#ffffff", bold: true, fontSize: fs(2) });
    x += p(44);
  }
  out.push({ text: heading, absolutePosition: { x, y: p(58) }, width: p(820), color: T.text, bold: true, fontSize: fs(3.6) });
}

function slideBackground(slide: Slide, n: number): { rects: CanvasEl[]; texts: TextNode[] } {
  const canvas: CanvasEl[] = [];
  const out: TextNode[] = [];

  switch (slide.type) {
    case "cover": {
      canvas.push({ type: "rect", x: 0, y: 0, w: W, h: H, color: T.blueDark });
      // AIdeaLab logo mark (diamond) + wordmark
      {
        const cx = p(96), cy = p(118), r = p(19);
        canvas.push({
          type: "polyline",
          closePath: true,
          color: "#ffffff",
          points: [
            { x: cx, y: cy - r }, { x: cx + r, y: cy },
            { x: cx, y: cy + r }, { x: cx - r, y: cy },
          ],
        });
      }
      out.push(
        { text: "AIdeaLab", absolutePosition: { x: p(128), y: p(104) }, color: "#ffffff", bold: true, fontSize: fs(3.4) },
        { text: slide.title, absolutePosition: { x: p(80), y: p(200) }, width: p(840), color: "#ffffff", bold: true, fontSize: fs(6) },
      );
      if (slide.subtitle) out.push({ text: slide.subtitle, absolutePosition: { x: p(80), y: p(325) }, color: "#ffffff", fontSize: fs(3) });
      if (slide.client) out.push({ text: slide.client, absolutePosition: { x: p(80), y: p(405) }, color: "#ffffff", bold: true, fontSize: fs(2.6) });
      if (slide.footer) out.push({ text: slide.footer, absolutePosition: { x: p(80), y: p(440) }, color: "#cdd5ff", fontSize: fs(2) });
      break;
    }
    case "agenda": {
      header(canvas, out, undefined, "アジェンダ");
      const nCols = slide.items.length > 14 ? 3 : 2;
      const per = Math.ceil(slide.items.length / nCols);
      const colW = nCols === 3 ? 300 : 440;
      const rowH = Math.min(46, 380 / per);
      const chip = Math.min(34, rowH - 6);
      slide.items.forEach((item, idx) => {
        const col = Math.floor(idx / per);
        const row = idx % per;
        const x = p(70) + col * colW;
        const y = p(120) + row * rowH;
        canvas.push({ type: "rect", x, y, w: chip, h: chip, color: T.blue, r: 4 });
        out.push({ text: String(idx + 1).padStart(2, "0"), absolutePosition: { x: x + chip / 2 - 7, y: y + chip / 4 }, color: "#ffffff", bold: true, fontSize: fs(1.5) });
        out.push({ text: item, absolutePosition: { x: x + chip + 8, y: y + chip / 5 }, width: colW - chip - 16, color: T.text, fontSize: fs(nCols === 3 ? 1.9 : 2.3) });
      });
      break;
    }
    case "section": {
      header(canvas, out, slide.index, slide.heading + (slide.cont ? "（続き）" : ""));
      slide.bullets.forEach((b, idx) => {
        const y = p(130) + idx * p(52);
        out.push({ text: "▸", absolutePosition: { x: p(80), y }, color: T.blue, bold: true, fontSize: fs(2.5) });
        out.push({ text: b, absolutePosition: { x: p(110), y }, width: p(780), color: T.text, fontSize: fs(2.4), lineHeight: 1.3 });
      });
      break;
    }
    case "cards": {
      header(canvas, out, slide.index, slide.heading);
      const cols = slide.cards.length <= 4 ? 2 : 3;
      const cw = (p(820) - (cols - 1) * p(24)) / cols;
      const ch = p(70);
      slide.cards.forEach((c, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = p(70) + col * (cw + p(24));
        const y = p(130) + row * (ch + p(20));
        canvas.push({ type: "rect", x, y, w: cw, h: ch, color: T.bgSoft, r: 6 });
        canvas.push({ type: "rect", x, y, w: cw, h: p(7), color: T.blue, r: 2 });
        out.push({ text: c.title, absolutePosition: { x: x + p(18), y: y + p(24) }, width: cw - p(36), color: T.text, bold: true, fontSize: fs(2.1) });
      });
      break;
    }
    case "estimate": {
      header(canvas, out, undefined, slide.heading);
      canvas.push({ type: "rect", x: p(70), y: p(140), w: p(400), h: p(220), color: T.blue, r: 8 });
      out.push(
        { text: "概算合計（税込）", absolutePosition: { x: p(95), y: p(165) }, color: "#ffffff", fontSize: fs(2.2) },
        { text: slide.total, absolutePosition: { x: p(95), y: p(200) }, color: "#ffffff", bold: true, fontSize: fs(5.4) },
        { text: `プラン: ${slide.plan} ・ ${slide.personDays}`, absolutePosition: { x: p(95), y: p(305) }, color: "#ffffff", fontSize: fs(2.2) },
      );
      slide.phases.slice(0, 8).forEach((ph, idx) => {
        const y = p(145) + idx * p(28);
        out.push({ text: ph.label, absolutePosition: { x: p(500), y }, color: T.textMuted, fontSize: fs(2) });
        out.push({ text: ph.value, absolutePosition: { x: p(760), y }, width: p(160), alignment: "right", color: T.text, bold: true, fontSize: fs(2) });
        canvas.push({ type: "rect", x: p(500), y: y + p(22), w: p(420), h: 0.6, color: T.border });
      });
      break;
    }
    case "schedule": {
      header(canvas, out, undefined, `${slide.heading}（${slide.start} 〜 ${slide.end}）`);
      const maxW = Math.max(1, ...slide.phases.map((ph) => ph.weeks));
      slide.phases.forEach((ph, idx) => {
        const y = p(140) + idx * p(40);
        out.push({ text: ph.phase, absolutePosition: { x: p(70), y: y + p(4) }, width: p(180), color: T.text, fontSize: fs(2.1) });
        canvas.push({ type: "rect", x: p(260), y, w: p(640), h: p(26), color: T.bgSoft, r: 6 });
        const bw = Math.max(p(40), (ph.weeks / maxW) * p(640));
        canvas.push({ type: "rect", x: p(260), y, w: bw, h: p(26), color: T.blue, r: 6 });
        out.push({ text: `${ph.weeks}週間`, absolutePosition: { x: p(268), y: y + p(5) }, color: "#ffffff", bold: true, fontSize: fs(1.7) });
      });
      if (slide.milestones.length) {
        const my = p(140) + slide.phases.length * p(40) + p(16);
        out.push({
          text: slide.milestones.map((m) => `◆ ${m.date} ${m.title}`).join("     "),
          absolutePosition: { x: p(70), y: my },
          width: p(840),
          color: T.text,
          fontSize: fs(1.8),
        });
      }
      break;
    }
    case "diagram": {
      header(canvas, out, undefined, slide.heading);
      const placed = placeScene(slide.scene, 70, 128, 820, 380);
      for (const a of placed.arrows) {
        canvas.push({ type: "line", x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, lineColor: T.textMuted, lineWidth: 1 });
        canvas.push({ type: "polyline", closePath: true, color: T.textMuted, points: a.head.map(([x, y]) => ({ x, y })) });
        if (a.label) {
          const f = 7;
          const tw = a.label.length * f * 0.95;
          out.push({ text: a.label, absolutePosition: { x: a.lx - tw / 2, y: a.ly - 9 }, color: T.textMuted, fontSize: f });
        }
      }
      for (const b of placed.boxes) {
        canvas.push({ type: "rect", x: b.x, y: b.y, w: b.w, h: b.h, color: b.emphasis ? T.blue : T.bgSoft, r: 6 });
        if (!b.emphasis) canvas.push({ type: "rect", x: b.x, y: b.y, w: b.w, h: 4, color: T.blue, r: 2 });
        const tf = Math.max(6, Math.min(13, b.h * 0.34, (b.w * 0.86) / Math.max(1, b.title.length)));
        const ttw = b.title.length * tf * 0.95;
        out.push({ text: b.title, absolutePosition: { x: b.x + b.w / 2 - ttw / 2, y: b.subtitle ? b.y + b.h / 2 - tf : b.y + b.h / 2 - tf * 0.65 }, color: b.emphasis ? "#ffffff" : T.text, bold: true, fontSize: tf });
        if (b.subtitle) {
          const sf = Math.max(5, Math.min(tf - 2, (b.w * 0.9) / Math.max(1, b.subtitle.length)));
          const stw = b.subtitle.length * sf * 0.9;
          out.push({ text: b.subtitle, absolutePosition: { x: b.x + b.w / 2 - stw / 2, y: b.y + b.h / 2 + 2 }, color: b.emphasis ? "#dbe2ff" : T.textMuted, fontSize: sf });
        }
      }
      break;
    }
    case "closing": {
      header(canvas, out, undefined, slide.title);
      slide.bullets.forEach((b, idx) => {
        const y = p(140) + idx * p(56);
        canvas.push({ type: "rect", x: p(80), y, w: p(40), h: p(40), color: T.blue, r: 20 });
        out.push({ text: String(idx + 1), absolutePosition: { x: p(80) + 16, y: y + p(11) }, color: "#ffffff", bold: true, fontSize: fs(2.1) });
        out.push({ text: b, absolutePosition: { x: p(135), y: y + p(8) }, width: p(760), color: T.text, fontSize: fs(2.6) });
      });
      if (slide.contact) out.push({ text: slide.contact, absolutePosition: { x: p(70), y: p(480) }, color: T.textMuted, fontSize: fs(2) });
      // AIdeaLab logo (bottom-right)
      {
        const cx = p(770), cy = p(492), r = p(12);
        canvas.push({
          type: "polyline",
          closePath: true,
          color: T.blue,
          points: [
            { x: cx, y: cy - r }, { x: cx + r, y: cy },
            { x: cx, y: cy + r }, { x: cx - r, y: cy },
          ],
        });
      }
      out.push({ text: "AIdeaLab", absolutePosition: { x: p(790), y: p(484) }, color: T.blue, bold: true, fontSize: fs(2.4) });
      break;
    }
    case "endcard": {
      canvas.push({ type: "rect", x: 0, y: 0, w: W, h: H, color: "#3D5AFE" });
      // oversized translucent brand shapes (lighter blue) bottom-right
      const dia = (cx: number, cy: number, r: number) =>
        canvas.push({
          type: "polyline", closePath: true, color: "#5a72ff",
          points: [
            { x: cx, y: cy - r }, { x: cx + r, y: cy },
            { x: cx, y: cy + r }, { x: cx - r, y: cy },
          ],
        });
      dia(p(800), p(185), p(150));
      dia(p(850), p(430), p(110));
      // logo mark (white diamond) + wordmark, center-left
      {
        const cx = p(104), cy = p(258), r = p(22);
        canvas.push({
          type: "polyline", closePath: true, color: "#ffffff",
          points: [
            { x: cx, y: cy - r }, { x: cx + r, y: cy },
            { x: cx, y: cy + r }, { x: cx - r, y: cy },
          ],
        });
      }
      out.push({ text: "AIdeaLab", absolutePosition: { x: p(140), y: p(238) }, color: "#ffffff", bold: true, fontSize: fs(5) });
      out.push({ text: slide.tagline, absolutePosition: { x: p(80), y: p(452) }, color: "#ffffff", bold: true, fontSize: fs(2.8) });
      break;
    }
  }

  if (slide.type !== "cover" && slide.type !== "endcard") {
    out.push({ text: String(n), absolutePosition: { x: p(900), y: p(505) }, width: p(40), alignment: "right", color: T.textMuted, fontSize: fs(1.8) });
  }

  return { rects: canvas, texts: out };
}

export async function toSlidePdf(slides: Slide[]): Promise<Buffer> {
  // Shapes go in the per-page background (always drawn behind); text goes in the
  // content flow (drawn on top), so white-on-blue labels render correctly.
  const content: Content[] = [];
  slides.forEach((slide, idx) => {
    const { texts } = slideBackground(slide, idx + 1);
    if (idx > 0) content.push({ text: "", pageBreak: "before" });
    content.push(...(texts as unknown as Content[]));
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: { width: W, height: H },
    pageMargins: [0, 0, 0, 0],
    background: (currentPage: number) => {
      const { rects } = slideBackground(slides[currentPage - 1], currentPage);
      return { canvas: rects } as unknown as Content;
    },
    content,
  };
  return renderDocDefinition(docDefinition);
}
