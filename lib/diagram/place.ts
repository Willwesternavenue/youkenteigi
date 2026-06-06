import type { DiagramScene } from "./scene";

/** A scene mapped (scaled + centered) into a target rectangle in slide coords. */
export interface PlacedBox {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  emphasis?: boolean;
}

export interface PlacedArrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  head: [number, number][]; // 3 triangle points at the arrow end
  label?: string;
  lx: number;
  ly: number;
}

export interface Placed {
  boxes: PlacedBox[];
  arrows: PlacedArrow[];
  scale: number;
}

function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 6,
): [number, number][] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  return [
    [x2, y2],
    [x2 - size * Math.cos(a - Math.PI / 6), y2 - size * Math.sin(a - Math.PI / 6)],
    [x2 - size * Math.cos(a + Math.PI / 6), y2 - size * Math.sin(a + Math.PI / 6)],
  ];
}

export function placeScene(
  scene: DiagramScene,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): Placed {
  // guard against an empty scene (no boxes) — avoid divide-by-zero → NaN/Infinity
  const scale =
    scene.width > 0 && scene.height > 0
      ? Math.min(tw / scene.width, th / scene.height)
      : 0;
  const ox = tx + (tw - scene.width * scale) / 2;
  const oy = ty + (th - scene.height * scale) / 2;
  const mx = (x: number) => ox + x * scale;
  const my = (y: number) => oy + y * scale;

  return {
    scale,
    boxes: scene.boxes.map((b) => ({
      x: mx(b.x),
      y: my(b.y),
      w: b.w * scale,
      h: b.h * scale,
      title: b.title,
      subtitle: b.subtitle,
      emphasis: b.emphasis,
    })),
    arrows: scene.arrows.map((a) => {
      const x1 = mx(a.x1);
      const y1 = my(a.y1);
      const x2 = mx(a.x2);
      const y2 = my(a.y2);
      return {
        x1,
        y1,
        x2,
        y2,
        head: arrowHead(x1, y1, x2, y2),
        label: a.label,
        lx: (x1 + x2) / 2,
        ly: (y1 + y2) / 2,
      };
    }),
  };
}
