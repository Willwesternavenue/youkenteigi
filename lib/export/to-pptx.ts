import PptxGenJS from "pptxgenjs";
import type { Slide } from "@/lib/slides/deck";
import { SLIDE_THEME as T, bare } from "@/lib/slides/theme";
import { placeScene } from "@/lib/diagram/place";

/**
 * Editable PowerPoint export. Mirrors the HTML slide layouts using real text
 * runs and shapes (so everything is editable in PowerPoint). 16:9, brand
 * palette. Japanese renders via the viewer's font (set as a sensible default).
 */

const JP = "Yu Gothic";
const BLUE = bare(T.blue);
const BLUE_DARK = bare(T.blueDark);
const TEXT = bare(T.text);
const MUTED = bare(T.textMuted);
const SOFT = bare(T.bgSoft);
const BORDER = bare(T.border);
const RED = bare(T.red);

// Layout coordinates are in the 0–960 × 0–540 grid → inches over a 10in width.
const i = (u: number) => u / 96;
// Font sizes are authored in the small "cqw" scale → points.
const pt = (cqw: number) => Math.round(cqw * 7.2);

export async function toPptx(slides: Slide[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE16x9", width: 10, height: 5.625 });
  pptx.layout = "WIDE16x9";

  slides.forEach((slide, idx) => renderSlide(pptx, slide, idx + 1));

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

function header(s: PptxGenJS.Slide, index: number | undefined, heading: string) {
  s.addShape("rect", { x: i(70), y: i(55), w: i(7), h: i(42), fill: { color: BLUE } });
  let x = i(80);
  if (index !== undefined) {
    s.addShape("roundRect", {
      x,
      y: i(52),
      w: i(34),
      h: i(34),
      fill: { color: BLUE },
      rectRadius: 0.05,
    });
    s.addText(String(index).padStart(2, "0"), {
      x,
      y: i(52),
      w: i(34),
      h: i(34),
      fontSize: pt(2.2),
      color: "FFFFFF",
      bold: true,
      align: "center",
      valign: "middle",
      fontFace: JP,
    });
    x += i(44);
  }
  s.addText(heading, {
    x,
    y: i(50),
    w: i(820),
    h: i(40),
    fontSize: pt(3.6),
    color: TEXT,
    bold: true,
    valign: "middle",
    fontFace: JP,
  });
}

function pageNum(s: PptxGenJS.Slide, n: number) {
  s.addText(String(n), {
    x: i(900),
    y: i(500),
    w: i(50),
    h: i(30),
    fontSize: pt(1.8),
    color: MUTED,
    align: "right",
    fontFace: JP,
  });
}

function renderSlide(pptx: PptxGenJS, slide: Slide, n: number) {
  const s = pptx.addSlide();
  s.background = { color: "FFFFFF" };

  switch (slide.type) {
    case "cover": {
      s.background = { color: BLUE_DARK };
      // AIdeaLab logo
      s.addShape("roundRect", {
        x: i(80), y: i(96), w: i(40), h: i(40),
        fill: { color: "FFFFFF" }, rotate: 45, rectRadius: 0.18,
      });
      s.addText("AIdeaLab", {
        x: i(132), y: i(96), w: i(420), h: i(40), fontSize: pt(3.4),
        bold: true, color: "FFFFFF", valign: "middle", fontFace: JP,
      });
      s.addText(slide.title, {
        x: i(80), y: i(190), w: i(840), h: i(120), fontSize: pt(6.4), color: "FFFFFF",
        bold: true, fontFace: JP, valign: "top",
      });
      if (slide.subtitle)
        s.addText(slide.subtitle, { x: i(80), y: i(320), w: i(800), h: i(30), fontSize: pt(3), color: "FFFFFF", fontFace: JP });
      if (slide.client)
        s.addText(slide.client, { x: i(80), y: i(400), w: i(800), h: i(30), fontSize: pt(2.6), color: "FFFFFF", bold: true, fontFace: JP });
      if (slide.footer)
        s.addText(slide.footer, { x: i(80), y: i(435), w: i(800), h: i(24), fontSize: pt(2), color: "FFFFFF", fontFace: JP, transparency: 20 });
      break;
    }
    case "agenda": {
      header(s, undefined, "アジェンダ");
      const nCols = slide.items.length > 14 ? 3 : 2;
      const per = Math.ceil(slide.items.length / nCols);
      const colW = nCols === 3 ? 300 : 440;
      const rowH = Math.min(46, 380 / per);
      const chip = Math.min(34, rowH - 6);
      slide.items.forEach((item, idx) => {
        const col = Math.floor(idx / per);
        const row = idx % per;
        const x = i(70) + col * i(colW);
        const y = i(120) + row * i(rowH);
        s.addShape("roundRect", { x, y, w: i(chip), h: i(chip), fill: { color: BLUE }, rectRadius: 0.04 });
        s.addText(String(idx + 1).padStart(2, "0"), { x, y, w: i(chip), h: i(chip), fontSize: pt(1.6), color: "FFFFFF", bold: true, align: "center", valign: "middle", fontFace: JP });
        s.addText(item, { x: x + i(chip + 8), y, w: i(colW - chip - 16), h: i(chip), fontSize: pt(nCols === 3 ? 1.9 : 2.4), color: TEXT, valign: "middle", fontFace: JP });
      });
      pageNum(s, n);
      break;
    }
    case "section": {
      header(s, slide.index, slide.heading + (slide.cont ? "（続き）" : ""));
      s.addText(
        slide.bullets.map((b) => ({ text: b, options: { bullet: { code: "25B8", indent: 16 }, color: TEXT } })),
        { x: i(80), y: i(130), w: i(800), h: i(360), fontSize: pt(2.5), lineSpacingMultiple: 1.4, fontFace: JP, valign: "top" },
      );
      pageNum(s, n);
      break;
    }
    case "cards": {
      header(s, slide.index, slide.heading);
      const cols = slide.cards.length <= 4 ? 2 : 3;
      const cw = (i(820) - (cols - 1) * i(24)) / cols;
      const ch = i(70);
      slide.cards.forEach((c, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = i(70) + col * (cw + i(24));
        const y = i(130) + row * (ch + i(20));
        s.addShape("roundRect", { x, y, w: cw, h: ch, fill: { color: SOFT }, line: { color: BORDER, width: 1 }, rectRadius: 0.04 });
        s.addShape("rect", { x, y, w: cw, h: i(7), fill: { color: BLUE } });
        s.addText(c.title, { x: x + i(20), y: y + i(12), w: cw - i(40), h: ch - i(20), fontSize: pt(2.1), bold: true, color: TEXT, valign: "middle", fontFace: JP });
      });
      pageNum(s, n);
      break;
    }
    case "estimate": {
      header(s, undefined, slide.heading);
      // total panel
      s.addShape("roundRect", { x: i(70), y: i(140), w: i(400), h: i(220), fill: { color: BLUE }, rectRadius: 0.04 });
      s.addText("概算合計（税込）", { x: i(95), y: i(165), w: i(350), h: i(30), fontSize: pt(2.2), color: "FFFFFF", fontFace: JP });
      s.addText(slide.total, { x: i(95), y: i(195), w: i(350), h: i(80), fontSize: pt(6), color: "FFFFFF", bold: true, fontFace: JP });
      s.addText(`プラン: ${slide.plan} ・ ${slide.personDays}`, { x: i(95), y: i(295), w: i(350), h: i(30), fontSize: pt(2.2), color: "FFFFFF", fontFace: JP });
      // phase rows
      slide.phases.slice(0, 8).forEach((p, idx) => {
        const y = i(140) + idx * i(28);
        s.addText(p.label, { x: i(500), y, w: i(260), h: i(26), fontSize: pt(2), color: MUTED, fontFace: JP });
        s.addText(p.value, { x: i(760), y, w: i(160), h: i(26), fontSize: pt(2), color: TEXT, bold: true, align: "right", fontFace: JP });
      });
      pageNum(s, n);
      break;
    }
    case "schedule": {
      header(s, undefined, `${slide.heading}（${slide.start} 〜 ${slide.end}）`);
      const maxW = Math.max(1, ...slide.phases.map((p) => p.weeks));
      slide.phases.forEach((p, idx) => {
        const y = i(140) + idx * i(40);
        s.addText(p.phase, { x: i(70), y, w: i(180), h: i(30), fontSize: pt(2.1), color: TEXT, valign: "middle", fontFace: JP });
        s.addShape("roundRect", { x: i(260), y: y + i(3), w: i(640), h: i(26), fill: { color: SOFT }, rectRadius: 0.06 });
        const bw = (p.weeks / maxW) * 640;
        s.addShape("roundRect", { x: i(260), y: y + i(3), w: i(Math.max(40, bw)), h: i(26), fill: { color: BLUE }, rectRadius: 0.06 });
        s.addText(`${p.weeks}週間`, { x: i(268), y: y + i(3), w: i(120), h: i(26), fontSize: pt(1.7), color: "FFFFFF", bold: true, valign: "middle", fontFace: JP });
      });
      if (slide.milestones.length) {
        const my = i(140) + slide.phases.length * i(40) + i(20);
        s.addText(
          slide.milestones.map((m) => `◆ ${m.date} ${m.title}`).join("    "),
          { x: i(70), y: my, w: i(830), h: i(40), fontSize: pt(1.8), color: TEXT, fontFace: JP },
        );
      }
      pageNum(s, n);
      break;
    }
    case "diagram": {
      header(s, undefined, slide.heading);
      const placed = placeScene(slide.scene, 70, 128, 820, 380);
      for (const a of placed.arrows) {
        s.addShape("line", {
          x: i(Math.min(a.x1, a.x2)),
          y: i(Math.min(a.y1, a.y2)),
          w: i(Math.abs(a.x2 - a.x1)),
          h: i(Math.abs(a.y2 - a.y1)),
          line: { color: MUTED, width: 1, endArrowType: "triangle", beginArrowType: "none" },
          flipH: a.x2 < a.x1,
          flipV: a.y2 < a.y1,
        });
        if (a.label)
          s.addText(a.label, { x: i(a.lx - 40), y: i(a.ly - 8), w: i(80), h: i(12), fontSize: 7, color: MUTED, align: "center", fontFace: JP });
      }
      for (const b of placed.boxes) {
        const titlePt = Math.max(6, Math.min(13, b.h * 0.34, (b.w * 0.86) / Math.max(1, b.title.length)));
        s.addShape("roundRect", {
          x: i(b.x), y: i(b.y), w: i(b.w), h: i(b.h),
          fill: { color: b.emphasis ? BLUE : SOFT },
          line: { color: b.emphasis ? BLUE : BORDER, width: 1 },
          rectRadius: 0.03,
        });
        if (!b.emphasis)
          s.addShape("rect", { x: i(b.x), y: i(b.y), w: i(b.w), h: i(4), fill: { color: BLUE } });
        s.addText(
          [
            { text: b.title, options: { fontSize: titlePt, bold: true, color: b.emphasis ? "FFFFFF" : TEXT, breakLine: true } },
            ...(b.subtitle ? [{ text: b.subtitle, options: { fontSize: Math.max(6, titlePt - 4), color: b.emphasis ? "DBE2FF" : MUTED } }] : []),
          ],
          { x: i(b.x), y: i(b.y), w: i(b.w), h: i(b.h), align: "center", valign: "middle", fontFace: JP },
        );
      }
      pageNum(s, n);
      break;
    }
    case "closing": {
      header(s, undefined, slide.title);
      slide.bullets.forEach((b, idx) => {
        const y = i(140) + idx * i(56);
        s.addShape("ellipse", { x: i(80), y, w: i(40), h: i(40), fill: { color: BLUE } });
        s.addText(String(idx + 1), { x: i(80), y, w: i(40), h: i(40), fontSize: pt(2.1), color: "FFFFFF", bold: true, align: "center", valign: "middle", fontFace: JP });
        s.addText(b, { x: i(135), y, w: i(760), h: i(40), fontSize: pt(2.6), color: TEXT, valign: "middle", fontFace: JP });
      });
      if (slide.contact)
        s.addText(slide.contact, { x: i(70), y: i(470), w: i(600), h: i(30), fontSize: pt(2), color: MUTED, fontFace: JP });
      // AIdeaLab logo (bottom-right)
      s.addShape("roundRect", {
        x: i(745), y: i(478), w: i(26), h: i(26),
        fill: { color: BLUE }, rotate: 45, rectRadius: 0.2,
      });
      s.addText("AIdeaLab", {
        x: i(778), y: i(474), w: i(170), h: i(34), fontSize: pt(2.4),
        bold: true, color: BLUE, valign: "middle", fontFace: JP,
      });
      break;
    }
    case "endcard": {
      s.background = { color: "3D5AFE" };
      // oversized translucent brand shapes (bottom-right)
      s.addShape("roundRect", {
        x: i(660), y: i(30), w: i(300), h: i(300),
        fill: { color: "FFFFFF", transparency: 88 }, rotate: 45, rectRadius: 0.12,
      });
      s.addShape("roundRect", {
        x: i(730), y: i(360), w: i(340), h: i(150),
        fill: { color: "FFFFFF", transparency: 90 }, rotate: 45, rectRadius: 0.5,
      });
      // logo (white) center-left
      s.addShape("roundRect", {
        x: i(80), y: i(232), w: i(44), h: i(44),
        fill: { color: "FFFFFF" }, rotate: 45, rectRadius: 0.18,
      });
      s.addText("AIdeaLab", {
        x: i(138), y: i(228), w: i(520), h: i(52), fontSize: pt(5),
        bold: true, color: "FFFFFF", valign: "middle", fontFace: JP,
      });
      // tagline bottom-left
      s.addText(slide.tagline, {
        x: i(80), y: i(450), w: i(760), h: i(40), fontSize: pt(2.6),
        bold: true, color: "FFFFFF", fontFace: JP,
      });
      break;
    }
  }
}
