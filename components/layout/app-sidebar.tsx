"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FilePlus2,
  ShieldCheck,
  BookOpen,
  FileSignature,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIdeaLabLogo, AIdeaLabMark } from "@/components/brand/logo";
import { can } from "@/lib/rbac";
import type { Role } from "@/types/domain";
import { SIDEBAR_COLLAPSED_COOKIE } from "./sidebar-state";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/projects", label: "案件一覧", icon: FolderKanban },
  { href: "/projects/new", label: "新規案件", icon: FilePlus2 },
  { href: "/contract", label: "契約書", icon: FileSignature },
  { href: "/guide", label: "使い方ガイド", icon: BookOpen },
];

export function AppSidebar({
  role,
  defaultCollapsed = false,
}: {
  role: Role;
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const nav = can(role, "admin.access")
    ? [...NAV, { href: "/admin", label: "管理コンソール", icon: ShieldCheck }]
    : NAV;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "メニューを開く" : "メニューを折りたたむ";

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex py-5",
          collapsed ? "flex-col items-center gap-3 px-2" : "items-start justify-between gap-2 pr-3 pl-5",
        )}
      >
        {collapsed ? (
          <AIdeaLabMark className="size-7" />
        ) : (
          <div className="min-w-0">
            <AIdeaLabLogo />
            <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">
              要件定義かけるくん · Internal
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <ToggleIcon className="size-4" />
        </button>
      </div>
      <nav className={cn("flex-1 space-y-1 py-2", collapsed ? "px-2" : "px-3")}>
        {nav.map((item) => {
          const active =
            item.href === "/projects"
              ? pathname === "/projects"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="px-5 py-4 text-[10px] leading-relaxed text-muted-foreground">
          プリセールス特化型
          <br />
          AI要件定義支援システム
        </div>
      )}
    </aside>
  );
}
