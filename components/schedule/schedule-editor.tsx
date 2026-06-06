"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, FileDown, ImageDown, Flag, Save, Plus, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GanttChart, type GanttBar } from "./gantt-chart";
import { formatDate } from "@/lib/format";
import { buildScheduleView } from "@/lib/schedule-view";
import { buildGanttSvg } from "@/lib/export/gantt-svg";
import type { NonWorkingPeriod } from "@/lib/holidays";
import {
  generateSchedule,
  saveScheduleEdit,
} from "@/app/_actions/schedules";

export interface RawTask {
  taskKey: string;
  taskName: string;
  phase: string;
  durationDays: number;
  assigneeRole?: string | null;
  dependencyTaskKeys: string[];
  needsClientReview?: boolean | null;
  risk?: string | null;
  progress: number;
}

export interface RawMilestone {
  title: string;
  afterTaskKey?: string;
  type?: string;
  isClientVisible?: boolean;
}

export interface ScheduleData {
  id: string;
  version: number;
  scheduleName: string;
  startDate: string;
  tasks: RawTask[];
  milestones: RawMilestone[];
  nonWorkingPeriods: NonWorkingPeriod[];
}

export function ScheduleEditor({
  projectId,
  schedule,
}: {
  projectId: string;
  schedule: ScheduleData | null;
}) {
  const router = useRouter();
  const [genPending, startGen] = useTransition();

  function generate() {
    startGen(async () => {
      const res = await generateSchedule(projectId);
      if (res.ok) {
        toast.success("スケジュールを生成しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!schedule) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">スケジュール</h2>
          <p className="text-sm text-muted-foreground">
            タスク・依存関係・クリティカルパス・マイルストーンを含む開発スケジュールを生成します。
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              まだスケジュールがありません。
            </p>
            <Button onClick={generate} disabled={genPending}>
              <Sparkles className="size-4" />
              {genPending ? "生成中…" : "スケジュールを生成"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ScheduleBody
      projectId={projectId}
      schedule={schedule}
      onRegenerate={generate}
      regenPending={genPending}
    />
  );
}

function ScheduleBody({
  projectId,
  schedule,
  onRegenerate,
  regenPending,
}: {
  projectId: string;
  schedule: ScheduleData;
  onRegenerate: () => void;
  regenPending: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"internal" | "client">("internal");
  const [grain, setGrain] = useState<"week" | "month">("week");
  const [tasks, setTasks] = useState<RawTask[]>(schedule.tasks);
  const [periods, setPeriods] = useState<NonWorkingPeriod[]>(
    schedule.nonWorkingPeriods,
  );
  const [dirty, setDirty] = useState(false);
  const [savePending, startSave] = useTransition();

  // recompute dates / critical path / gridlines live (holidays + custom periods)
  const computed = useMemo(
    () =>
      buildScheduleView(tasks, schedule.startDate, {
        granularity: grain,
        periods,
      }),
    [tasks, schedule.startDate, grain, periods],
  );
  const endByKey = useMemo(
    () => new Map(computed.tasks.map((t) => [t.taskKey, t.endDate])),
    [computed],
  );

  function setDuration(taskKey: string, newDuration: number) {
    setTasks((prev) =>
      prev.map((t) =>
        t.taskKey === taskKey
          ? { ...t, durationDays: Math.max(1, Math.round(newDuration)) }
          : t,
      ),
    );
    setDirty(true);
  }

  function addPeriod(preset?: NonWorkingPeriod) {
    setPeriods((p) => [
      ...p,
      preset ?? { name: "休業", start: computed.projectStart, end: computed.projectStart },
    ]);
    setDirty(true);
  }
  function updatePeriod(idx: number, patch: Partial<NonWorkingPeriod>) {
    setPeriods((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
    setDirty(true);
  }
  function removePeriod(idx: number) {
    setPeriods((p) => p.filter((_, i) => i !== idx));
    setDirty(true);
  }
  const startYear = Number(schedule.startDate.slice(0, 4)) || 2026;

  const internalBars: GanttBar[] = computed.tasks.map((t) => ({
    key: t.taskKey,
    label: t.taskName,
    phase: t.phase,
    startOffset: t.startOffset,
    finishOffset: t.finishOffset,
    progress: t.progress,
    isCriticalPath: !!t.isCriticalPath,
    needsClientReview: !!t.needsClientReview,
    sub: `${t.durationDays}日`,
  }));

  const clientBars: GanttBar[] = useMemo(() => {
    const map = new Map<string, { s: number; f: number }>();
    for (const t of computed.tasks) {
      const cur = map.get(t.phase) ?? { s: t.startOffset, f: t.finishOffset };
      cur.s = Math.min(cur.s, t.startOffset);
      cur.f = Math.max(cur.f, t.finishOffset);
      map.set(t.phase, cur);
    }
    return computed.phases.map((p) => ({
      key: p.phase,
      label: p.phase,
      phase: p.phase,
      startOffset: map.get(p.phase)?.s ?? 0,
      finishOffset: map.get(p.phase)?.f ?? 1,
      sub: `${p.weeks}週間`,
    }));
  }, [computed]);

  function exportImage() {
    const bars = view === "internal" ? internalBars : clientBars;
    const keyToFinish = new Map(
      computed.tasks.map((t) => [t.taskKey, t.finishOffset]),
    );
    const milestones = schedule.milestones
      .filter((m) => view === "internal" || (m.isClientVisible ?? true))
      .map((m) => ({
        title: m.title,
        offset: m.afterTaskKey
          ? (keyToFinish.get(m.afterTaskKey) ?? computed.totalBusinessDays)
          : computed.totalBusinessDays,
      }));
    const { svg, width, height } = buildGanttSvg({
      title: `${schedule.scheduleName}（${view === "client" ? "クライアント向け" : "社内向け"}）`,
      subtitle: `${computed.projectStart} 〜 ${computed.projectEnd}`,
      bars: bars.map((b) => ({
        label: b.label,
        phase: b.phase,
        startOffset: b.startOffset,
        finishOffset: b.finishOffset,
        sub: b.sub,
      })),
      total: computed.totalBusinessDays,
      start: computed.projectStart,
      end: computed.projectEnd,
      monthLines: computed.gridLines
        .filter((g) => g.kind === "month")
        .map((g) => ({ offset: g.offset, label: g.label ?? "" })),
      milestones,
    });

    const scale = 2;
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const c = canvas.getContext("2d");
      if (!c) {
        URL.revokeObjectURL(url);
        toast.error("画像の生成に失敗しました");
        return;
      }
      c.scale(scale, scale);
      c.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("画像の生成に失敗しました");
          return;
        }
        const a = document.createElement("a");
        const href = URL.createObjectURL(blob);
        a.href = href;
        a.download = `${schedule.scheduleName}_${view === "client" ? "クライアント向け" : "社内向け"}.png`;
        a.click();
        URL.revokeObjectURL(href);
        toast.success("画像を保存しました");
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("画像の生成に失敗しました");
    };
    img.src = url;
  }

  function save() {
    startSave(async () => {
      const res = await saveScheduleEdit(
        projectId,
        schedule.scheduleName,
        schedule.startDate,
        tasks.map((t) => ({
          taskKey: t.taskKey,
          taskName: t.taskName,
          phase: t.phase,
          durationDays: t.durationDays,
          assigneeRole: t.assigneeRole ?? undefined,
          dependencyTaskKeys: t.dependencyTaskKeys,
          needsClientReview: t.needsClientReview ?? undefined,
          risk: t.risk ?? undefined,
        })),
        schedule.milestones,
        periods,
      );
      if (res.ok) {
        setDirty(false);
        toast.success("新しいバージョンとして保存しました");
        router.refresh();
      } else toast.error("保存できませんでした");
    });
  }

  const milestonesView = schedule.milestones.map((m) => ({
    title: m.title,
    isClientVisible: m.isClientVisible ?? true,
    date:
      (m.afterTaskKey && endByKey.get(m.afterTaskKey)) || computed.projectEnd,
  }));
  const visibleMilestones = milestonesView.filter(
    (m) => view === "internal" || m.isClientVisible,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">スケジュール</h2>
          <Badge variant="secondary">v{schedule.version}</Badge>
          <Badge variant="outline">
            {computed.projectStart} 〜 {computed.projectEnd}
          </Badge>
          {dirty && <Badge variant="outline" className="text-amber-600">未保存</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <button
              onClick={() => setGrain("week")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${grain === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              週ベース
            </button>
            <button
              onClick={() => setGrain("month")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${grain === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              月ベース
            </button>
          </div>
          <div className="flex rounded-md border p-0.5">
            <button
              onClick={() => setView("internal")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${view === "internal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              社内向け
            </button>
            <button
              onClick={() => setView("client")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${view === "client" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              クライアント向け
            </button>
          </div>
          <Button onClick={exportImage} variant="outline" size="sm">
            <ImageDown className="size-3.5" />
            画像(PNG)
          </Button>
          <Button
            render={<a href={`/api/export/schedule/${schedule.id}`} download />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <FileDown className="size-3.5" />
            PDF
          </Button>
          <Button onClick={onRegenerate} variant="outline" size="sm" disabled={regenPending}>
            <Sparkles className="size-3.5" />
            {regenPending ? "再生成中…" : "再生成"}
          </Button>
          <Button onClick={save} size="sm" disabled={savePending || !dirty}>
            <Save className="size-3.5" />
            {savePending ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      {view === "internal" && (
        <p className="text-xs text-muted-foreground">
          ガントの棒の右端をドラッグ、または表の「日数」を編集すると期間が変わり、日程とクリティカルパスが再計算されます。保存で新バージョンになります。
        </p>
      )}

      <GanttChart
        bars={view === "internal" ? internalBars : clientBars}
        total={computed.totalBusinessDays}
        startLabel={computed.projectStart}
        gridLines={computed.gridLines}
        pxPerDay={grain === "week" ? 18 : 7}
        editable={view === "internal"}
        onResize={setDuration}
      />

      {view === "internal" ? (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タスク</TableHead>
                <TableHead>フェーズ</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>開始</TableHead>
                <TableHead>終了</TableHead>
                <TableHead className="w-24 text-right">日数</TableHead>
                <TableHead>CP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computed.tasks.map((t) => (
                <TableRow key={t.taskKey}>
                  <TableCell className="font-medium">
                    {t.taskName}
                    {t.needsClientReview && (
                      <Badge variant="outline" className="ml-2 text-amber-600">
                        要確認
                      </Badge>
                    )}
                    {t.risk && (
                      <div className="text-[11px] text-rose-600">⚠ {t.risk}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.phase}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.assigneeRole ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(t.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(t.endDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={1}
                      value={t.durationDays}
                      onChange={(e) =>
                        setDuration(t.taskKey, Number(e.target.value))
                      }
                      className="h-7 w-16 px-1 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    {t.isCriticalPath && (
                      <span className="text-rose-500" title="クリティカルパス">
                        ●
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>フェーズ</TableHead>
                <TableHead>開始</TableHead>
                <TableHead>終了</TableHead>
                <TableHead className="text-right">期間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computed.phases.map((p) => (
                <TableRow key={p.phase}>
                  <TableCell className="font-medium">{p.phase}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.endDate)}
                  </TableCell>
                  <TableCell className="text-right">{p.weeks}週間</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-primary" />
            カレンダー（祝日・休業日）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            日本の祝日（{startYear}年〜）は自動で営業日から除外されます。お盆・年末年始など独自の休業期間を追加・調整できます（保存で反映）。
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() =>
                addPeriod({ name: "お盆休み", start: `${startYear}-08-13`, end: `${startYear}-08-16` })
              }
            >
              ＋お盆休み
            </Badge>
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() =>
                addPeriod({ name: "年末年始", start: `${startYear}-12-29`, end: `${startYear + 1}-01-03` })
              }
            >
              ＋年末年始
            </Badge>
            <Badge variant="secondary" className="cursor-pointer" onClick={() => addPeriod()}>
              <Plus className="mr-0.5 size-3" />
              期間を追加
            </Badge>
          </div>
          {periods.length > 0 && (
            <div className="space-y-1.5">
              {periods.map((p, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <Input
                    value={p.name}
                    onChange={(e) => updatePeriod(idx, { name: e.target.value })}
                    placeholder="名称（例: お盆休み）"
                    className="h-8 w-40"
                  />
                  <Input
                    type="date"
                    value={p.start}
                    onChange={(e) => updatePeriod(idx, { start: e.target.value })}
                    className="h-8 w-40"
                  />
                  <span className="text-muted-foreground">〜</span>
                  <Input
                    type="date"
                    value={p.end}
                    onChange={(e) => updatePeriod(idx, { end: e.target.value })}
                    className="h-8 w-40"
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => removePeriod(idx)}>
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {grain === "week" && computed.holidays.length > 0 && (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                この期間の祝日・休業日（{computed.holidays.length}日）
              </div>
              <div className="flex flex-wrap gap-1">
                {computed.holidays.map((h, i) => (
                  <Badge key={i} variant="outline" className="font-normal">
                    {formatDate(h.date)} {h.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {visibleMilestones.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flag className="size-4 text-primary" />
              マイルストーン
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {visibleMilestones.map((m, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge variant="secondary">{formatDate(m.date)}</Badge>
                  {m.title}
                  {!m.isClientVisible && (
                    <span className="text-[11px] text-muted-foreground">（社内）</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
