import type { GeneratedArchitecture } from "@/lib/ai/providers";

/**
 * Layout for the in-app refined system-architecture diagram: stacked layer
 * bands (top→bottom) with rounded component cards, plus connector endpoints for
 * the explicit edges. Tuned for the rich HTML/SVG board so it matches the
 * Figma风 screen-flow. The export path keeps using scene.ts/layoutArchitecture.
 */

export interface ArchNode {
  name: string;
  note?: string;
  layer: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ArchBand {
  name: string;
  y: number;
  h: number;
}
export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface ArchLayout {
  width: number;
  height: number;
  labelW: number;
  bands: ArchBand[];
  nodes: ArchNode[];
  edges: ArchEdge[];
}

const WIDTH = 920;
const LABEL_W = 128;
const PAD = 24;
const ROW_H = 104;
const ROW_GAP = 22;
const CARD_H = 72;
const CARD_GAP = 14;

export function buildArchitectureLayout(
  arch: GeneratedArchitecture,
): ArchLayout {
  const layers = arch.layers ?? [];
  const height =
    PAD * 2 + layers.length * ROW_H + Math.max(0, layers.length - 1) * ROW_GAP;

  const contentX = LABEL_W + PAD;
  const contentW = WIDTH - contentX - PAD;

  const bands: ArchBand[] = [];
  const nodes: ArchNode[] = [];
  const byName = new Map<string, ArchNode>();

  layers.forEach((layer, li) => {
    const y = PAD + li * (ROW_H + ROW_GAP);
    bands.push({ name: layer.name, y, h: ROW_H });

    const comps = layer.components ?? [];
    const n = Math.max(1, comps.length);
    const cardW = (contentW - (n - 1) * CARD_GAP) / n;
    const cardY = y + (ROW_H - CARD_H) / 2;
    comps.forEach((c, ci) => {
      const node: ArchNode = {
        name: c.name,
        note: c.note,
        layer: li,
        x: contentX + ci * (cardW + CARD_GAP),
        y: cardY,
        w: cardW,
        h: CARD_H,
      };
      nodes.push(node);
      byName.set(c.name, node);
    });
  });

  const edges: ArchEdge[] = (arch.edges ?? [])
    .map((e) => {
      const a = byName.get(e.from);
      const b = byName.get(e.to);
      if (!a || !b) return null;
      const aBelow = a.y > b.y;
      return {
        from: e.from,
        to: e.to,
        label: e.label,
        x1: a.x + a.w / 2,
        y1: aBelow ? a.y : a.y + a.h,
        x2: b.x + b.w / 2,
        y2: aBelow ? b.y + b.h : b.y,
      } as ArchEdge;
    })
    .filter((x): x is ArchEdge => x !== null);

  return { width: WIDTH, height, labelW: LABEL_W, bands, nodes, edges };
}
