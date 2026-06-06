"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatBudgetRange, formatDate } from "@/lib/format";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/types/domain";

export interface ProjectListItem {
  id: string;
  projectName: string;
  clientName: string;
  status: string;
  salesOwner: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  proposalDueDate: string | null;
  updatedAt: string;
}

export function ProjectListTable({ projects }: { projects: ProjectListItem[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesText =
        q === "" ||
        `${p.projectName} ${p.clientName} ${p.salesOwner ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase());
      const matchesStatus = status === "all" || p.status === status;
      return matchesText && matchesStatus;
    });
  }, [projects, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="案件名・クライアント・担当で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="ステータス">
              {(v: string | null) =>
                v && v !== "all"
                  ? PROJECT_STATUS_LABELS[v as ProjectStatus]
                  : "すべてのステータス"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステータス</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} 件
        </span>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件名</TableHead>
              <TableHead>クライアント</TableHead>
              <TableHead>担当</TableHead>
              <TableHead>想定予算</TableHead>
              <TableHead>提案期限</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  該当する案件がありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/projects/${p.id}`} className="hover:underline">
                    {p.projectName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.clientName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.salesOwner ?? "—"}
                </TableCell>
                <TableCell>{formatBudgetRange(p.budgetMin, p.budgetMax)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.proposalDueDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
