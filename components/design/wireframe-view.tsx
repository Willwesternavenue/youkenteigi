import type { WireframeBlock } from "@/lib/ai/providers";

/**
 * Low-fi screen mockup rendered deterministically from a screen's wireframe
 * blocks. Gives a "concrete screen UI" preview in the 画面遷移 tab without a
 * design tool. Brand accent = the target product's Vivid Blue (#264bf1).
 */

const BLUE = "#264bf1";
const SOFT = "#eef1ff";

function Bar({ w, h = 8, c = "#e2e8f0", r = 3 }: { w: string; h?: number; c?: string; r?: number }) {
  return <div style={{ width: w, height: h, background: c, borderRadius: r }} />;
}

function Block({ block }: { block: WireframeBlock }) {
  const wrap = (children: React.ReactNode) => (
    <div className="space-y-1">
      {block.label && (
        <div className="text-[9px] leading-tight text-slate-400">{block.label}</div>
      )}
      {children}
    </div>
  );

  switch (block.kind) {
    case "kpi":
      return wrap(
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded border border-slate-200 p-1.5">
              <Bar w="50%" h={4} />
              <div className="mt-1 h-3 w-8 rounded" style={{ background: BLUE }} />
            </div>
          ))}
        </div>,
      );
    case "toolbar":
      return wrap(
        <div className="flex items-center gap-1.5">
          <div className="h-4 flex-1 rounded border border-slate-200 bg-white" />
          <Bar w="36px" h={16} c={SOFT} />
          <div className="h-4 w-10 rounded" style={{ background: BLUE }} />
        </div>,
      );
    case "search":
      return wrap(
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 flex-1 items-center rounded border border-slate-200 bg-white px-1.5">
            <div className="size-2 rounded-full border border-slate-300" />
          </div>
          <div className="h-5 w-10 rounded" style={{ background: BLUE }} />
        </div>,
      );
    case "table":
      return wrap(
        <div className="overflow-hidden rounded border border-slate-200">
          <div className="flex gap-2 px-1.5 py-1" style={{ background: SOFT }}>
            {["28%", "22%", "18%", "16%"].map((w, i) => (
              <Bar key={i} w={w} h={4} c="#c7d0e8" />
            ))}
          </div>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="flex gap-2 border-t border-slate-100 px-1.5 py-1">
              {["28%", "22%", "18%", "16%"].map((w, i) => (
                <Bar key={i} w={w} h={4} />
              ))}
            </div>
          ))}
        </div>,
      );
    case "cards":
      return wrap(
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded border border-slate-200 p-1.5">
              <div className="h-1 w-full rounded" style={{ background: BLUE }} />
              <div className="mt-1 space-y-1">
                <Bar w="80%" h={4} />
                <Bar w="60%" h={3} />
              </div>
            </div>
          ))}
        </div>,
      );
    case "form":
      return wrap(
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-0.5">
              <Bar w="30%" h={3} c="#cbd5e1" />
              <div className="h-4 w-full rounded border border-slate-200 bg-white" />
            </div>
          ))}
          <div className="h-4 w-14 rounded" style={{ background: BLUE }} />
        </div>,
      );
    case "detail":
      return wrap(
        <div className="flex gap-1.5">
          <div className="flex-1 space-y-1 rounded border border-slate-200 p-1.5">
            <Bar w="70%" h={4} />
            <Bar w="100%" h={3} />
            <Bar w="90%" h={3} />
            <Bar w="95%" h={3} />
          </div>
          <div className="w-1/3 space-y-1 rounded border p-1.5" style={{ background: SOFT, borderColor: "#c7d0e8" }}>
            <div className="h-1 w-full rounded" style={{ background: BLUE }} />
            <Bar w="80%" h={3} c="#c7d0e8" />
            <Bar w="60%" h={3} c="#c7d0e8" />
          </div>
        </div>,
      );
    case "chart":
      return wrap(
        <div className="flex h-12 items-end gap-1.5 rounded border border-slate-200 p-1.5">
          {[40, 65, 50, 80, 60, 90].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${h}%`, background: i % 2 ? SOFT : BLUE }}
            />
          ))}
        </div>,
      );
    case "list":
      return wrap(
        <div className="space-y-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5 rounded border border-slate-100 px-1.5 py-1">
              <div className="size-3 shrink-0 rounded-full" style={{ background: SOFT }} />
              <Bar w="60%" h={3} />
              <div className="ml-auto"><Bar w="24px" h={3} c="#cbd5e1" /></div>
            </div>
          ))}
        </div>,
      );
    case "buttons":
      return wrap(
        <div className="flex justify-end gap-1.5">
          <Bar w="40px" h={16} c={SOFT} />
          <div className="h-4 w-14 rounded" style={{ background: BLUE }} />
        </div>,
      );
    case "upload":
      return wrap(
        <div className="flex h-10 items-center justify-center rounded border border-dashed border-slate-300 text-[9px] text-slate-400">
          ファイルをドロップ
        </div>,
      );
    case "text":
      return wrap(
        <div className="space-y-1">
          <Bar w="100%" h={3} />
          <Bar w="92%" h={3} />
          <Bar w="80%" h={3} />
        </div>,
      );
    default:
      return null;
  }
}

export function WireframeView({
  name,
  role,
  blocks,
}: {
  name: string;
  role?: string;
  blocks: WireframeBlock[];
}) {
  const isAuth = blocks.some((b) => b.kind === "auth");

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      {/* browser chrome */}
      <div className="flex items-center gap-1 border-b bg-slate-50 px-2 py-1.5">
        <span className="size-1.5 rounded-full bg-slate-300" />
        <span className="size-1.5 rounded-full bg-slate-300" />
        <span className="size-1.5 rounded-full bg-slate-300" />
        <span className="ml-1.5 truncate text-[10px] font-medium text-slate-600">
          {name}
          {role && <span className="ml-1 text-slate-400">· {role}</span>}
        </span>
      </div>

      {isAuth ? (
        <div className="flex h-[180px] items-center justify-center bg-slate-50">
          <div className="w-2/3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mx-auto size-5 rounded" style={{ background: BLUE }} />
            <Bar w="60%" h={4} c="#cbd5e1" r={3} />
            <div className="h-5 w-full rounded border border-slate-200" />
            <div className="h-5 w-full rounded" style={{ background: BLUE }} />
          </div>
        </div>
      ) : (
        <div className="flex h-[180px]">
          {/* sidebar */}
          <div className="w-10 shrink-0 space-y-1 border-r bg-slate-50 p-1.5">
            <div className="h-2.5 rounded" style={{ background: BLUE }} />
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} w="100%" h={6} c="#e2e8f0" />
            ))}
          </div>
          {/* main */}
          <div className="flex-1 space-y-1.5 overflow-hidden p-2">
            <Bar w="40%" h={6} c="#cbd5e1" />
            {blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
