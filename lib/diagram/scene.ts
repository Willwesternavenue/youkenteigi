import type {
  GeneratedArchitecture,
  GeneratedScreen,
  GeneratedTransition,
} from "@/lib/ai/providers";

/**
 * A renderer-agnostic diagram "scene": absolutely-positioned boxes + arrows in
 * a logical coordinate space. One scene is consumed by three renderers — SVG
 * (in-app), pdfmake (PDF), pptxgenjs (editable PPTX) — so screen-transition and
 * architecture diagrams look identical everywhere and export without a browser.
 */

export interface DiagramBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  emphasis?: boolean; // filled accent vs soft
}

export interface DiagramArrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
}

export interface DiagramScene {
  width: number;
  height: number;
  boxes: DiagramBox[];
  arrows: DiagramArrow[];
}

// ---------- screen transition flow (layered by depth from roots) ----------

const S_BOXW = 168;
const S_BOXH = 56;
const S_COLGAP = 56;
const S_ROWGAP = 22;
const PAD = 16;

export function layoutScreenFlow(
  screensIn: GeneratedScreen[],
  transitions: GeneratedTransition[],
): DiagramScene {
  const keys = screensIn.map((s) => s.key);
  if (keys.length === 0) {
    return { width: PAD * 2, height: PAD * 2, boxes: [], arrows: [] };
  }
  const keySet = new Set(keys);
  const edges = transitions.filter((t) => keySet.has(t.from) && keySet.has(t.to));

  const indeg = new Map<string, number>(keys.map((k) => [k, 0]));
  const adj = new Map<string, string[]>(keys.map((k) => [k, []]));
  for (const e of edges) {
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    adj.get(e.from)!.push(e.to);
  }

  // depth = BFS distance from roots (indegree 0; fallback first screen)
  const roots = keys.filter((k) => (indeg.get(k) ?? 0) === 0);
  const startRoots = roots.length ? roots : keys.slice(0, 1);
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const r of startRoots) {
    depth.set(r, 0);
    queue.push(r);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const nxt of adj.get(cur) ?? []) {
      // first visit fixes the column (BFS distance); later edges don't deepen it
      if (!depth.has(nxt)) {
        depth.set(nxt, d + 1);
        queue.push(nxt);
      }
    }
  }
  // any unreached screens go to column 0
  for (const k of keys) if (!depth.has(k)) depth.set(k, 0);

  const byCol = new Map<number, string[]>();
  for (const k of keys) {
    const c = depth.get(k)!;
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c)!.push(k);
  }
  const numCols = Math.max(...Array.from(byCol.keys())) + 1;
  const maxRows = Math.max(...Array.from(byCol.values()).map((a) => a.length));

  const width = PAD * 2 + numCols * S_BOXW + (numCols - 1) * S_COLGAP;
  const height = PAD * 2 + maxRows * S_BOXH + (maxRows - 1) * S_ROWGAP;

  const pos = new Map<string, DiagramBox>();
  const screenByKey = new Map(screensIn.map((s) => [s.key, s]));
  for (let c = 0; c < numCols; c++) {
    const col = byCol.get(c) ?? [];
    const colHeight = col.length * S_BOXH + (col.length - 1) * S_ROWGAP;
    const y0 = (height - colHeight) / 2;
    col.forEach((k, r) => {
      const s = screenByKey.get(k)!;
      pos.set(k, {
        id: k,
        x: PAD + c * (S_BOXW + S_COLGAP),
        y: y0 + r * (S_BOXH + S_ROWGAP),
        w: S_BOXW,
        h: S_BOXH,
        title: s.name,
        subtitle: s.role ?? undefined,
        emphasis: c === 0,
      });
    });
  }

  const arrows: DiagramArrow[] = edges.map((e) => {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    const forward = b.x >= a.x;
    return {
      x1: forward ? a.x + a.w : a.x,
      y1: a.y + a.h / 2,
      x2: forward ? b.x : b.x + b.w,
      y2: b.y + b.h / 2,
      label: e.trigger,
    };
  });

  return { width, height, boxes: Array.from(pos.values()), arrows };
}

// ---------- architecture (tiered rows top→bottom) ----------

const A_WIDTH = 900;
const A_LABELW = 120;
const A_ROWH = 76;
const A_ROWGAP = 18;
const A_BOXH = 52;

export function layoutArchitecture(arch: GeneratedArchitecture): DiagramScene {
  const layers = arch.layers ?? [];
  const height = PAD * 2 + layers.length * A_ROWH + (layers.length - 1) * A_ROWGAP;
  const boxes: DiagramBox[] = [];
  const byName = new Map<string, DiagramBox>();

  const contentX = A_LABELW + PAD;
  const contentW = A_WIDTH - contentX - PAD;

  layers.forEach((layer, li) => {
    const y = PAD + li * (A_ROWH + A_ROWGAP);
    // layer label as a soft full-row band marker (rendered via a box w/o emphasis)
    boxes.push({
      id: `__layer_${li}`,
      x: PAD,
      y: y + (A_ROWH - A_BOXH) / 2,
      w: A_LABELW - PAD,
      h: A_BOXH,
      title: layer.name,
      emphasis: true,
    });
    const n = Math.max(1, layer.components.length);
    const gap = 16;
    const bw = (contentW - (n - 1) * gap) / n;
    layer.components.forEach((c, ci) => {
      const box: DiagramBox = {
        id: c.name,
        x: contentX + ci * (bw + gap),
        y: y + (A_ROWH - A_BOXH) / 2,
        w: bw,
        h: A_BOXH,
        title: c.name,
        subtitle: c.note,
      };
      boxes.push(box);
      byName.set(c.name, box);
    });
  });

  const arrows: DiagramArrow[] = (arch.edges ?? [])
    .map((e) => {
      const a = byName.get(e.from);
      const b = byName.get(e.to);
      if (!a || !b) return null;
      return {
        x1: a.x + a.w / 2,
        y1: a.y + a.h,
        x2: b.x + b.w / 2,
        y2: b.y,
        label: e.label,
      } as DiagramArrow;
    })
    .filter((x): x is DiagramArrow => x !== null);

  return { width: A_WIDTH, height, boxes, arrows };
}
