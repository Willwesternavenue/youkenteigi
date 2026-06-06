"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  Send,
  Calculator,
  CalendarRange,
  LayoutPanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { adjustEstimate } from "@/app/_actions/estimates";
import { adjustSchedule } from "@/app/_actions/schedules";
import { adjustScreenDesign } from "@/app/_actions/screen-design";

type Target = "estimate" | "schedule" | "design";

const TARGETS: {
  key: Target;
  label: string;
  icon: typeof Calculator;
  examples: string[];
}[] = [
  {
    key: "estimate",
    label: "見積",
    icon: Calculator,
    examples: ["700万円以内に収めて", "テスト工数を厚めに"],
  },
  {
    key: "schedule",
    label: "スケジュール",
    icon: CalendarRange,
    examples: ["PoCを8週間に", "テストを3週間に"],
  },
  {
    key: "design",
    label: "画面設計",
    icon: LayoutPanelLeft,
    examples: ["通知設定画面を追加して", "レポート画面は削除"],
  },
];

function detectTarget(pathname: string): Target {
  if (pathname.includes("/schedule")) return "schedule";
  if (
    pathname.includes("/design") ||
    pathname.includes("/screens") ||
    pathname.includes("/transition")
  )
    return "design";
  return "estimate";
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  target?: Target;
  ok?: boolean;
}

/* ------------------------------------------------------------------ */
/* Context — open state shared between the trigger (left nav), the     */
/* layout shell (widens when open) and the docked panel itself.        */
/* Lives in the project layout, so it persists across tab navigation.  */
/* ------------------------------------------------------------------ */

interface AssistantCtx {
  open: boolean;
  toggle: () => void;
  close: () => void;
  projectId: string;
}

const Ctx = createContext<AssistantCtx | null>(null);

function useAssistant(): AssistantCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AssistantProvider が必要です");
  return c;
}

export function AssistantProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
        close: () => setOpen(false),
        projectId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/** Wraps the whole project view; widens the centered container when the
 *  panel is open so the docked column sits beside the content (no overlay). */
export function AssistantShell({ children }: { children: React.ReactNode }) {
  const { open } = useAssistant();
  return (
    <div
      className={cn(
        "mx-auto space-y-4 transition-[max-width] duration-300 ease-out",
        open ? "max-w-[100rem]" : "max-w-6xl",
      )}
    >
      {children}
    </div>
  );
}

/** The button in the left nav that opens/closes the docked panel. */
export function AssistantTrigger() {
  const { open, toggle } = useAssistant();
  return (
    <Button
      onClick={toggle}
      variant="outline"
      size="sm"
      aria-pressed={open}
      className={cn(
        "w-full justify-start gap-2 border-primary/30 text-primary",
        open && "bg-primary/10",
      )}
    >
      <Sparkles className="size-4" />
      AIアシスタント
    </Button>
  );
}

/** The docked conversation column. In-flow flex child (pushes content,
 *  never overlays). Returns null when closed but stays mounted, so the
 *  conversation log survives open/close and tab switches. */
export function AssistantDock() {
  const { open, close, projectId } = useAssistant();
  const router = useRouter();
  const pathname = usePathname();
  const [target, setTarget] = useState<Target>(detectTarget(pathname));
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, start] = useTransition();
  const logRef = useRef<HTMLDivElement>(null);

  // follow the current tab as context
  useEffect(() => setTarget(detectTarget(pathname)), [pathname]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs, open]);

  const cfg = TARGETS.find((t) => t.key === target)!;

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text, target }]);
    start(async () => {
      const res =
        target === "estimate"
          ? await adjustEstimate(projectId, text)
          : target === "schedule"
            ? await adjustSchedule(projectId, text)
            : await adjustScreenDesign(projectId, text);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          ok: res.ok,
          text: res.ok
            ? `${cfg.label}を更新しました（新バージョン）。`
            : res.error,
        },
      ]);
      if (res.ok) router.refresh();
    });
  }

  if (!open) return null;

  return (
    <aside className="w-full shrink-0 md:w-[340px]">
      <div className="sticky top-4 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            AIアシスタント
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close}>
            <X className="size-4" />
          </Button>
        </div>

        {/* target selector */}
        <div className="border-b px-4 py-2.5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            対象（現在のタブに自動追従。変更も可）
          </div>
          <div className="flex gap-1">
            {TARGETS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTarget(t.key)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium",
                    target === t.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* conversation */}
        <div
          ref={logRef}
          className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
        >
          {msgs.length === 0 && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                見積・スケジュール・画面設計を、自然言語でまとめて調整できます。指示は「対象」に反映され、新バージョンとして保存されます。
              </p>
              <div className="flex flex-wrap gap-1">
                {cfg.examples.map((ex) => (
                  <Badge
                    key={ex}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setInput(ex)}
                  >
                    {ex}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : m.ok === false
                      ? "bg-rose-50 text-rose-700"
                      : "bg-muted",
                )}
              >
                {m.role === "user" && m.target && (
                  <span className="mr-1 text-[10px] opacity-80">
                    [{TARGETS.find((t) => t.key === m.target)?.label}]
                  </span>
                )}
                {m.text}
              </div>
            </div>
          ))}
          {pending && (
            <div className="text-xs text-muted-foreground">調整中…</div>
          )}
        </div>

        {/* input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${cfg.label}への指示…`}
              onKeyDown={(e) => e.key === "Enter" && !pending && send()}
              disabled={pending}
            />
            <Button
              size="icon"
              onClick={send}
              disabled={pending || !input.trim()}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
