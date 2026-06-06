"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Info,
  MessagesSquare,
  FileText,
  Calculator,
  CalendarRange,
  LayoutPanelLeft,
  ScrollText,
  Presentation,
  BadgeCheck,
  Sparkles,
  CornerDownRight,
  ListTree,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionTab {
  seg: string;
  label: string;
  /** highlight as the key AI step (AI整理). */
  emphasis?: boolean;
  /** render as a subordinate of the preceding emphasized tab (追加質問 ⊂ AI整理). */
  sub?: boolean;
}
interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  /** sequential workflow step shown as a number in the left nav. */
  step?: number;
  tabs: SectionTab[];
}

/** Two-level project nav: left vertical sections, horizontal sub-tabs per section. */
export const SECTIONS: Section[] = [
  { key: "overview", label: "概要", icon: Info, tabs: [{ seg: "", label: "概要" }] },
  {
    key: "input",
    label: "議事録",
    icon: MessagesSquare,
    step: 1,
    tabs: [
      { seg: "hearing", label: "初回ヒアリング" },
      { seg: "organize", label: "AI整理", emphasis: true },
      { seg: "questions", label: "追加質問", sub: true },
      { seg: "minutes", label: "打ち合わせ履歴" },
      { seg: "resources", label: "資料" },
    ],
  },
  {
    // RFP = クライアントから受け取る提案依頼書
    key: "rfp",
    label: "RFP",
    icon: FileText,
    step: 2,
    tabs: [{ seg: "rfp", label: "RFP" }],
  },
  {
    // スコープ・WBS = 開発形態に応じて内容が変わる（特にコンサル）
    key: "scope",
    label: "スコープ・WBS",
    icon: ListTree,
    step: 3,
    tabs: [{ seg: "scope", label: "スコープ・WBS" }],
  },
  {
    // 要件定義 = こちらから提出する成果物（プロダクトのコア）
    key: "requirements",
    label: "要件定義",
    icon: ScrollText,
    step: 4,
    tabs: [
      { seg: "requirements", label: "要件定義" },
      { seg: "quality", label: "品質チェック" },
    ],
  },
  {
    key: "design",
    label: "画面設計",
    icon: LayoutPanelLeft,
    step: 5,
    tabs: [
      { seg: "design", label: "システム構成図" },
      { seg: "screens", label: "画面一覧" },
      { seg: "transition", label: "画面遷移" },
    ],
  },
  {
    key: "estimate",
    label: "見積",
    icon: Calculator,
    step: 6,
    tabs: [{ seg: "estimate", label: "見積" }],
  },
  {
    key: "schedule",
    label: "スケジュール",
    icon: CalendarRange,
    step: 7,
    tabs: [{ seg: "schedule", label: "スケジュール" }],
  },
  {
    key: "proposal",
    label: "提案スライド",
    icon: Presentation,
    step: 8,
    tabs: [{ seg: "slides", label: "スライド" }],
  },
  {
    key: "review",
    label: "レビュー・承認",
    icon: BadgeCheck,
    step: 9,
    tabs: [
      { seg: "review", label: "レビュー・承認" },
      { seg: "consistency", label: "整合性チェック" },
    ],
  },
];

function currentSeg(pathname: string, base: string): string {
  if (pathname === base) return "";
  const rest = pathname.startsWith(base + "/") ? pathname.slice(base.length + 1) : "";
  return rest.split("/")[0] ?? "";
}

function sectionForSeg(seg: string): Section {
  return (
    SECTIONS.find((s) => s.tabs.some((t) => t.seg === seg)) ?? SECTIONS[0]
  );
}

function href(base: string, seg: string): string {
  return seg ? `${base}/${seg}` : base;
}

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const seg = currentSeg(pathname, base);
  const active = sectionForSeg(seg);

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 md:w-44 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const isActive = s.key === active.key;
        // link to the section's first tab (or its overview)
        return (
          <Link
            key={s.key}
            href={href(base, s.tabs[0].seg)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "w-3.5 shrink-0 text-center text-[11px] font-bold tabular-nums",
                isActive ? "text-primary" : "text-muted-foreground/60",
              )}
            >
              {s.step ?? ""}
            </span>
            <Icon className="size-4 shrink-0" />
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProjectSubTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const seg = currentSeg(pathname, base);
  const active = sectionForSeg(seg);

  if (active.tabs.length <= 1) return null;

  return (
    <div className="border-b">
      <div className="-mb-px flex items-end gap-1 overflow-x-auto">
        {active.tabs.map((t) => {
          const tabActive = t.seg === seg;
          if (t.emphasis) {
            // key AI step — make it pop
            return (
              <Link
                key={t.seg}
                href={href(base, t.seg)}
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                  tabActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-primary/5 text-primary hover:bg-primary/10",
                )}
              >
                <Sparkles className="size-3.5" />
                {t.label}
              </Link>
            );
          }
          if (t.sub) {
            // subordinate of the preceding emphasized tab (追加質問 ⊂ AI整理)
            return (
              <Link
                key={t.seg}
                href={href(base, t.seg)}
                className={cn(
                  "inline-flex items-center gap-0.5 whitespace-nowrap border-b-2 py-2 pr-3 pl-1 text-xs transition-colors",
                  tabActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <CornerDownRight className="size-3 opacity-60" />
                {t.label}
              </Link>
            );
          }
          return (
            <Link
              key={t.seg || "overview"}
              href={href(base, t.seg)}
              className={cn(
                "whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
                tabActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
