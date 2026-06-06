/**
 * Layout for the in-app "Figma风" screen-flow canvas: places each screen as a
 * larger node (sized to hold a wireframe thumbnail) in depth-ordered columns and
 * computes arrow endpoints between them. Separate from scene.ts (which sizes
 * small schematic boxes for PDF/PPTX export) — this one is tuned for the rich
 * HTML/SVG preview that embeds the actual screen UI.
 */

export interface FlowNodeInput {
  key: string;
  name: string;
  role?: string;
}
export interface FlowEdgeInput {
  from: string;
  to: string;
  label?: string;
}

export interface FlowNode {
  key: string;
  name: string;
  role?: string;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isStart: boolean;
}
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dir: "forward" | "back" | "same";
}
export interface FlowLayout {
  width: number;
  height: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowLayoutOpts {
  nodeW?: number;
  nodeH?: number;
  colGap?: number;
  rowGap?: number;
  pad?: number;
}

export function buildFlowLayout(
  screensIn: FlowNodeInput[],
  transitions: FlowEdgeInput[],
  opts: FlowLayoutOpts = {},
): FlowLayout {
  const NODE_W = opts.nodeW ?? 248;
  const NODE_H = opts.nodeH ?? 214;
  const COL_GAP = opts.colGap ?? 104;
  const ROW_GAP = opts.rowGap ?? 44;
  const PAD = opts.pad ?? 28;
  const GAP = 8; // small clearance so arrowheads aren't hidden under nodes

  const keys = screensIn.map((s) => s.key);
  if (keys.length === 0) {
    return { width: PAD * 2, height: PAD * 2, nodes: [], edges: [] };
  }
  const keySet = new Set(keys);
  const edges = transitions.filter(
    (t) => keySet.has(t.from) && keySet.has(t.to),
  );

  const indeg = new Map<string, number>(keys.map((k) => [k, 0]));
  const adj = new Map<string, string[]>(keys.map((k) => [k, []]));
  for (const e of edges) {
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    adj.get(e.from)!.push(e.to);
  }

  // depth = BFS distance from roots (indegree 0; fallback first screen)
  const roots = keys.filter((k) => (indeg.get(k) ?? 0) === 0);
  const startRoots = roots.length ? roots : keys.slice(0, 1);
  const startSet = new Set(startRoots);
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
      if (!depth.has(nxt)) {
        depth.set(nxt, d + 1);
        queue.push(nxt);
      }
    }
  }
  for (const k of keys) if (!depth.has(k)) depth.set(k, 0);

  const byCol = new Map<number, string[]>();
  for (const k of keys) {
    const c = depth.get(k)!;
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c)!.push(k);
  }
  const numCols = Math.max(...Array.from(byCol.keys())) + 1;
  const maxRows = Math.max(...Array.from(byCol.values()).map((a) => a.length));

  const width = PAD * 2 + numCols * NODE_W + (numCols - 1) * COL_GAP;
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

  const nodeByKey = new Map<string, FlowNode>();
  const screenByKey = new Map(screensIn.map((s) => [s.key, s]));
  for (let c = 0; c < numCols; c++) {
    const col = byCol.get(c) ?? [];
    const colHeight = col.length * NODE_H + (col.length - 1) * ROW_GAP;
    const y0 = PAD + (height - PAD * 2 - colHeight) / 2;
    col.forEach((k, r) => {
      const s = screenByKey.get(k)!;
      nodeByKey.set(k, {
        key: k,
        name: s.name,
        role: s.role,
        col: c,
        x: PAD + c * (NODE_W + COL_GAP),
        y: y0 + r * (NODE_H + ROW_GAP),
        w: NODE_W,
        h: NODE_H,
        isStart: startSet.has(k),
      });
    });
  }

  const laidEdges: FlowEdge[] = edges.map((e) => {
    const a = nodeByKey.get(e.from)!;
    const b = nodeByKey.get(e.to)!;
    const acy = a.y + a.h / 2;
    const bcy = b.y + b.h / 2;
    let dir: FlowEdge["dir"];
    let x1: number;
    let x2: number;
    if (b.col > a.col) {
      dir = "forward";
      x1 = a.x + a.w;
      x2 = b.x - GAP;
    } else if (b.col < a.col) {
      dir = "back";
      x1 = a.x;
      x2 = b.x + b.w + GAP;
    } else {
      dir = "same";
      x1 = a.x + a.w;
      x2 = b.x + b.w + GAP;
    }
    return { from: e.from, to: e.to, label: e.label, x1, y1: acy, x2, y2: bcy, dir };
  });

  return {
    width,
    height,
    nodes: Array.from(nodeByKey.values()),
    edges: laidEdges,
  };
}
