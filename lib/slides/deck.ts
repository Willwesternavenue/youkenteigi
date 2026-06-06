import { parseBlocks, inlineToPlainText } from "@/lib/export/markdown-ast";
import {
  layoutArchitecture,
  layoutScreenFlow,
  type DiagramScene,
} from "@/lib/diagram/scene";
import type {
  GeneratedArchitecture,
  GeneratedScreen,
  GeneratedTransition,
} from "@/lib/ai/providers";

/**
 * Slide deck model. A requirements document (+ optional estimate / schedule) is
 * lowered into a typed deck that three renderers consume identically: the HTML
 * preview, the PPTX exporter, and the PDF exporter. Pure — no DB, no IO.
 */

export type Slide =
  | { type: "cover"; title: string; subtitle?: string; client?: string; footer?: string }
  | { type: "agenda"; items: string[] }
  | { type: "section"; index?: number; heading: string; bullets: string[]; cont?: boolean }
  | { type: "cards"; index: number; heading: string; cards: { title: string; body?: string }[] }
  | {
      type: "estimate";
      heading: string;
      total: string;
      plan: string;
      personDays: string;
      phases: { label: string; value: string }[];
    }
  | {
      type: "schedule";
      heading: string;
      start: string;
      end: string;
      phases: { phase: string; weeks: number; start: string; end: string }[];
      milestones: { title: string; date: string }[];
    }
  | { type: "diagram"; heading: string; scene: DiagramScene; note?: string }
  | { type: "closing"; title: string; bullets: string[]; contact?: string }
  | { type: "endcard"; tagline: string };

export interface DeckInput {
  project: {
    projectName: string;
    clientName: string;
    orgName?: string;
  };
  requirements: {
    sections: { key: string; heading: string; markdown: string }[];
  } | null;
  estimate: {
    total: string;
    plan: string;
    personDays: string;
    phases: { label: string; value: string }[];
  } | null;
  schedule: {
    start: string;
    end: string;
    phases: { phase: string; weeks: number; start: string; end: string }[];
    milestones: { title: string; date: string }[];
  } | null;
  design: {
    screens: GeneratedScreen[];
    transitions: GeneratedTransition[];
    architecture: GeneratedArchitecture;
  } | null;
}

const MAX_BULLETS = 6;

/** Flatten a section's markdown into short bullet lines for a slide. */
function bulletsFromMarkdown(markdown: string): string[] {
  const out: string[] = [];
  for (const block of parseBlocks(markdown)) {
    if (block.type === "list") {
      for (const item of block.items) out.push(inlineToPlainText(item));
    } else if (block.type === "paragraph") {
      const text = inlineToPlainText(block.inlines).trim();
      if (text) out.push(text);
    } else if (block.type === "blockquote") {
      out.push(inlineToPlainText(block.inlines));
    } else if (block.type === "heading") {
      out.push(inlineToPlainText(block.inlines));
    }
  }
  return out
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((b) => (b.length > 90 ? b.slice(0, 88) + "…" : b));
}

/** A section becomes a card grid when it's a list of several short items. */
function asCards(bullets: string[]): boolean {
  return (
    bullets.length >= 4 &&
    bullets.length <= 8 &&
    bullets.every((b) => b.length <= 34)
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function buildDeck(input: DeckInput): Slide[] {
  const slides: Slide[] = [];

  slides.push({
    type: "cover",
    title: input.project.projectName,
    subtitle: "要件定義書 / 提案資料",
    client: `${input.project.clientName} 御中`,
    footer: input.project.orgName ?? "AIdeaLab",
  });

  const sections = input.requirements?.sections ?? [];
  if (sections.length) {
    slides.push({
      type: "agenda",
      items: sections.map((s) => s.heading),
    });
  }

  let index = 1;
  for (const section of sections) {
    const bullets = bulletsFromMarkdown(section.markdown);
    if (bullets.length === 0) {
      slides.push({ type: "section", index, heading: section.heading, bullets: ["—"] });
      index++;
      continue;
    }
    if (asCards(bullets)) {
      slides.push({
        type: "cards",
        index,
        heading: section.heading,
        cards: bullets.map((b) => ({ title: b })),
      });
      index++;
      continue;
    }
    const parts = chunk(bullets, MAX_BULLETS);
    parts.forEach((part, i) => {
      slides.push({
        type: "section",
        index,
        heading: section.heading,
        bullets: part,
        cont: i > 0,
      });
    });
    index++;
  }

  if (input.design) {
    slides.push({
      type: "diagram",
      heading: "システム構成案",
      scene: layoutArchitecture(input.design.architecture),
    });
    slides.push({
      type: "diagram",
      heading: "画面遷移",
      scene: layoutScreenFlow(input.design.screens, input.design.transitions),
    });
  }

  if (input.estimate) {
    slides.push({
      type: "estimate",
      heading: "概算見積",
      total: input.estimate.total,
      plan: input.estimate.plan,
      personDays: input.estimate.personDays,
      phases: input.estimate.phases,
    });
  }

  if (input.schedule) {
    slides.push({
      type: "schedule",
      heading: "開発スケジュール",
      start: input.schedule.start,
      end: input.schedule.end,
      phases: input.schedule.phases,
      milestones: input.schedule.milestones,
    });
  }

  slides.push({
    type: "closing",
    title: "次のステップ",
    bullets: [
      "本要件定義書のレビュー・ご確認",
      "見積・スケジュールのすり合わせ",
      "開発フェーズ（PoC / MVP / 本開発）の決定",
      "契約・キックオフ",
    ],
    contact: input.project.orgName ?? "AIdeaLab",
  });

  // AIdeaLab brand end card
  slides.push({ type: "endcard", tagline: "AIとIdeaでイノベーションを起こす" });

  return slides;
}
