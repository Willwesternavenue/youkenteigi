/**
 * Deterministic SVG of a Gantt chart for image (PNG) export — used for the
 * client-facing schedule so it can be dropped into Canva / slides. Pure string
 * output (no browser), mirroring the on-screen Gantt geometry. The client
 * converts the SVG to PNG via canvas (lib has no DOM dependency).
 */

export interface GanttSvgBar {
  label: string;
  phase: string;
  startOffset: number;
  finishOffset: number;
  sub?: string;
}
export interface GanttSvgMilestone {
  title: string;
  offset: number; // business-day offset on the same axis as bars
}
export interface GanttSvgInput {
  title: string;
  subtitle?: string;
  bars: GanttSvgBar[];
  total: number;
  start: string;
  end: string;
  monthLines: { offset: number; label: string }[];
  milestones?: GanttSvgMilestone[];
}

const PHASE_HEX = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#14b8a6",
];
const INK = "#00032a";
const MUTED = "#64748b";
const GRID = "#e2e8f0";
const GRID_MONTH = "#cbd5e1";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function buildGanttSvg(input: GanttSvgInput): {
  svg: string;
  width: number;
  height: number;
} {
  const W = 1200;
  const PAD = 32;
  const LABEL_W = 200;
  const chartX = PAD + LABEL_W;
  const chartW = W - chartX - PAD;
  const titleH = input.subtitle ? 64 : 48;
  const monthH = 26;
  const rowH = 38;
  const barH = 24;
  const phases = Array.from(new Set(input.bars.map((b) => b.phase)));
  const colorOf = (p: string) => PHASE_HEX[phases.indexOf(p) % PHASE_HEX.length];

  const ms = input.milestones ?? [];
  const chartTop = titleH + monthH;
  const chartH = input.bars.length * rowH;
  const msH = ms.length ? 78 : 12;
  const legendH = 40;
  const H = chartTop + chartH + msH + legendH + PAD;

  const x = (off: number) =>
    chartX + (off / Math.max(1, input.total)) * chartW;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif">`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);

  // title + subtitle
  parts.push(
    `<text x="${PAD}" y="${PAD + 6}" font-size="20" font-weight="700" fill="${INK}">${esc(input.title)}</text>`,
  );
  if (input.subtitle) {
    parts.push(
      `<text x="${PAD}" y="${PAD + 28}" font-size="13" fill="${MUTED}">${esc(input.subtitle)}</text>`,
    );
  }

  // month gridlines spanning the chart, with labels in the month header
  const gridBottom = chartTop + chartH;
  for (const m of input.monthLines) {
    const mx = x(m.offset);
    parts.push(
      `<line x1="${mx.toFixed(1)}" y1="${chartTop}" x2="${mx.toFixed(1)}" y2="${gridBottom}" stroke="${GRID_MONTH}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${mx.toFixed(1)}" y="${chartTop - 8}" font-size="11" fill="${MUTED}" text-anchor="middle">${esc(m.label)}</text>`,
    );
  }
  // (period is shown in the subtitle; month labels above cover the axis)

  // bars
  input.bars.forEach((b, i) => {
    const rowY = chartTop + i * rowH;
    const barY = rowY + (rowH - barH) / 2;
    // row label
    parts.push(
      `<text x="${PAD}" y="${barY + barH / 2 + 4}" font-size="13" fill="${INK}">${esc(clip(b.label, 16))}</text>`,
    );
    // track baseline
    parts.push(
      `<rect x="${chartX}" y="${barY}" width="${chartW}" height="${barH}" rx="5" fill="#f1f5f9"/>`,
    );
    const bx = x(b.startOffset);
    const bw = Math.max(6, x(b.finishOffset) - x(b.startOffset));
    const color = colorOf(b.phase);
    parts.push(
      `<rect x="${bx.toFixed(1)}" y="${barY}" width="${bw.toFixed(1)}" height="${barH}" rx="5" fill="${color}"/>`,
    );
    const inner = `${b.label}${b.sub ? `  ${b.sub}` : ""}`;
    if (bw > 90) {
      parts.push(
        `<text x="${(bx + 8).toFixed(1)}" y="${barY + barH / 2 + 4}" font-size="12" font-weight="600" fill="#ffffff">${esc(clip(inner, Math.floor(bw / 9)))}</text>`,
      );
    } else if (b.sub) {
      parts.push(
        `<text x="${(bx + bw + 6).toFixed(1)}" y="${barY + barH / 2 + 4}" font-size="11" fill="${MUTED}">${esc(b.sub)}</text>`,
      );
    }
  });

  // milestones (client visible) as diamonds with staggered labels
  if (ms.length) {
    const baseY = gridBottom + 22;
    parts.push(
      `<line x1="${chartX}" y1="${baseY}" x2="${chartX + chartW}" y2="${baseY}" stroke="${GRID}" stroke-width="1"/>`,
    );
    ms.forEach((m, i) => {
      const mx = x(m.offset);
      const s = 6;
      parts.push(
        `<path d="M ${mx.toFixed(1)} ${baseY - s} L ${(mx + s).toFixed(1)} ${baseY} L ${mx.toFixed(1)} ${baseY + s} L ${(mx - s).toFixed(1)} ${baseY} Z" fill="${INK}"/>`,
      );
      const ly = baseY + (i % 2 ? 34 : 20);
      // keep labels inside the canvas near the edges
      const anchor =
        mx > chartX + chartW - 70
          ? "end"
          : mx < chartX + 70
            ? "start"
            : "middle";
      parts.push(
        `<text x="${mx.toFixed(1)}" y="${ly}" font-size="11" fill="${INK}" text-anchor="${anchor}">◆ ${esc(clip(m.title, 14))}</text>`,
      );
    });
  }

  // legend
  const legendY = H - PAD - 6;
  let lx = PAD;
  for (const p of phases) {
    parts.push(
      `<rect x="${lx}" y="${legendY - 10}" width="11" height="11" rx="2" fill="${colorOf(p)}"/>`,
    );
    parts.push(
      `<text x="${lx + 16}" y="${legendY}" font-size="12" fill="${INK}">${esc(p)}</text>`,
    );
    lx += 20 + Math.min(220, p.length * 14 + 24);
  }

  parts.push("</svg>");
  return { svg: parts.join(""), width: W, height: H };
}
