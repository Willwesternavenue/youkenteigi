"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  FileDown,
  ChevronRight,
  ChevronDown,
  Info,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  computeTotals,
  aggregateByCategory,
  aggregateByActivity,
  planForTotal,
  PLAN_TIERS,
  itemHours,
  itemAmount,
  hoursToDays,
} from "@/lib/estimate-calc";
import { formatYen } from "@/lib/format";
import {
  generateEstimate,
  saveEstimateEdit,
  type EstimateItemEdit,
} from "@/app/_actions/estimates";

export interface EstimateData {
  id: string;
  estimateName: string;
  defaultUnitPrice: number;
  bufferRate: number;
  taxRate: number;
  version: number;
  items: EstimateItemEdit[];
}

const ACTIVITY_KEYS: { key: keyof EstimateItemEdit; label: string }[] = [
  { key: "hoursDesign", label: "設計" },
  { key: "hoursImpl", label: "実装" },
  { key: "hoursTest", label: "テスト" },
  { key: "hoursCoord", label: "調整" },
  { key: "hoursMgmt", label: "管理" },
];

export function EstimateEditor({
  projectId,
  estimate,
}: {
  projectId: string;
  estimate: EstimateData | null;
}) {
  const router = useRouter();
  const [genPending, startGen] = useTransition();

  function generate() {
    startGen(async () => {
      const res = await generateEstimate(projectId);
      if (res.ok) {
        toast.success("見積を生成しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!estimate) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">見積</h2>
          <p className="text-sm text-muted-foreground">
            大項目→中項目→小項目の3階層＋設計/実装/テスト/調整/管理（時間）で工数見積を生成します。
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">まだ見積がありません。</p>
            <Button onClick={generate} disabled={genPending}>
              <Sparkles className="size-4" />
              {genPending ? "生成中…" : "見積を生成"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <EstimateBody
      projectId={projectId}
      estimate={estimate}
      onRegenerate={generate}
      regenPending={genPending}
    />
  );
}

function EstimateBody({
  projectId,
  estimate,
  onRegenerate,
  regenPending,
}: {
  projectId: string;
  estimate: EstimateData;
  onRegenerate: () => void;
  regenPending: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<EstimateItemEdit[]>(estimate.items);
  const [unitPrice, setUnitPrice] = useState(estimate.defaultUnitPrice);
  const [bufferRate, setBufferRate] = useState(estimate.bufferRate);
  const [dirty, setDirty] = useState(false);
  const [savePending, startSave] = useTransition();
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [openDetail, setOpenDetail] = useState<Set<number>>(new Set());

  // keep unitPrice in sync on the items for amount math
  const itemsWithPrice = useMemo(
    () => items.map((it) => ({ ...it, unitPrice })),
    [items, unitPrice],
  );
  const totals = useMemo(
    () => computeTotals(itemsWithPrice, bufferRate, estimate.taxRate),
    [itemsWithPrice, bufferRate, estimate.taxRate],
  );
  const byActivity = useMemo(
    () => aggregateByActivity(itemsWithPrice),
    [itemsWithPrice],
  );
  const plan = planForTotal(totals.total);

  const grouped = useMemo(() => {
    const map = new Map<string, { item: EstimateItemEdit; idx: number }[]>();
    const order: string[] = [];
    items.forEach((it, idx) => {
      const c = it.category || "その他";
      if (!map.has(c)) {
        map.set(c, []);
        order.push(c);
      }
      map.get(c)!.push({ item: it, idx });
    });
    return order.map((c) => {
      const rows = map.get(c)!;
      const withPrice = rows.map((r) => ({ ...r.item, unitPrice }));
      const hours = withPrice.reduce((a, i) => a + itemHours(i), 0);
      const amount = withPrice.reduce((a, i) => a + itemAmount(i), 0);
      return { category: c, rows, hours, amount };
    });
  }, [items, unitPrice]);

  const allCats = grouped.map((g) => g.category);

  function toggleCat(c: string) {
    setOpenCats((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  }
  function toggleDetail(idx: number) {
    setOpenDetail((prev) => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  }

  function update(idx: number, patch: Partial<EstimateItemEdit>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setDirty(true);
  }
  function addRow(category: string) {
    setItems((prev) => [
      ...prev,
      {
        category,
        subCategory: "",
        role: "",
        taskName: "新規作業",
        approach: "",
        purpose: "",
        hoursDesign: 0,
        hoursImpl: 0,
        hoursTest: 0,
        hoursCoord: 0,
        hoursMgmt: 0,
        unitPrice,
      },
    ]);
    setOpenCats((prev) => new Set(prev).add(category));
    setDirty(true);
  }
  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function save() {
    startSave(async () => {
      const res = await saveEstimateEdit(
        projectId,
        estimate.estimateName,
        unitPrice,
        bufferRate,
        items.map((i) => ({ ...i, unitPrice })),
      );
      if (res.ok) {
        setDirty(false);
        toast.success("新しいバージョンとして保存しました");
        router.refresh();
      } else toast.error("保存できませんでした");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">見積</h2>
          <Badge variant="secondary">v{estimate.version}</Badge>
          <Badge variant="outline">プラン: {plan}</Badge>
          {dirty && <Badge variant="outline" className="text-amber-600">未保存</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setOpenCats(new Set(allCats))} variant="ghost" size="sm">
            <ChevronsUpDown className="size-3.5" />
            全展開
          </Button>
          <Button onClick={() => setOpenCats(new Set())} variant="ghost" size="sm">
            <ChevronsDownUp className="size-3.5" />
            全折りたたみ
          </Button>
          <Button
            render={<a href={`/api/export/estimate/${estimate.id}`} download />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <FileDown className="size-3.5" />
            XLSX
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">人日単価 (円 / 8h)</label>
          <Input
            type="number"
            value={unitPrice}
            onChange={(e) => {
              setUnitPrice(Number(e.target.value));
              setDirty(true);
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">バッファ率</label>
          <Input
            type="number"
            step="0.01"
            value={bufferRate}
            onChange={(e) => {
              setBufferRate(Number(e.target.value));
              setDirty(true);
            }}
          />
        </div>
      </div>

      {/* collapsible category tree */}
      <div className="space-y-2">
        {grouped.map((g) => {
          const open = openCats.has(g.category);
          return (
            <div key={g.category} className="overflow-hidden rounded-lg border bg-background">
              <button
                onClick={() => toggleCat(g.category)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
              >
                {open ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium">{g.category}</span>
                <Badge variant="secondary" className="ml-1 font-normal">
                  {g.rows.length}項目
                </Badge>
                <div className="ml-auto flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {g.hours}h ({hoursToDays(g.hours)}人日)
                  </span>
                  <span className="w-24 text-right font-semibold tabular-nums">
                    {formatYen(g.amount)}
                  </span>
                </div>
              </button>

              {open && (
                <div className="overflow-x-auto border-t">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                        <th className="px-2 py-1.5 text-left font-medium">中項目 / 小項目</th>
                        {ACTIVITY_KEYS.map((a) => (
                          <th key={a.key} className="w-14 px-1 py-1.5 text-right font-medium">
                            {a.label}
                          </th>
                        ))}
                        <th className="w-20 px-2 py-1.5 text-right font-medium">計</th>
                        <th className="w-24 px-2 py-1.5 text-right font-medium">金額</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map(({ item, idx }) => {
                        const withPrice = { ...item, unitPrice };
                        const h = itemHours(withPrice);
                        const detailOpen = openDetail.has(idx);
                        return (
                          <Fragment key={idx}>
                            <tr className="border-b last:border-0">
                              <td className="px-2 py-1">
                                <div className="flex items-start gap-1">
                                  <button
                                    onClick={() => toggleDetail(idx)}
                                    className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                                    title="実装方針・開発目的"
                                  >
                                    <Info className="size-3.5" />
                                  </button>
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <Input
                                      value={item.subCategory ?? ""}
                                      onChange={(e) => update(idx, { subCategory: e.target.value })}
                                      placeholder="中項目"
                                      className="h-6 border-transparent bg-transparent px-1 text-xs text-muted-foreground hover:border-input"
                                    />
                                    <Input
                                      value={item.taskName}
                                      onChange={(e) => update(idx, { taskName: e.target.value })}
                                      placeholder="小項目"
                                      className="h-7 border-transparent bg-transparent px-1 font-medium hover:border-input"
                                    />
                                  </div>
                                </div>
                              </td>
                              {ACTIVITY_KEYS.map((a) => (
                                <td key={a.key} className="px-1 py-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={(item[a.key] as number) ?? 0}
                                    onChange={(e) =>
                                      update(idx, {
                                        [a.key]: Number(e.target.value),
                                      } as Partial<EstimateItemEdit>)
                                    }
                                    className="h-7 w-12 px-1 text-right tabular-nums"
                                  />
                                </td>
                              ))}
                              <td className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground">
                                {h}h
                                <br />
                                {hoursToDays(h)}人日
                              </td>
                              <td className="px-2 py-1 text-right tabular-nums">
                                {formatYen(itemAmount(withPrice))}
                              </td>
                              <td className="px-1 py-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeRow(idx)}
                                >
                                  <Trash2 className="size-3.5 text-muted-foreground" />
                                </Button>
                              </td>
                            </tr>
                            {detailOpen && (
                              <tr className="border-b bg-muted/20 last:border-0">
                                <td colSpan={ACTIVITY_KEYS.length + 4} className="px-2 py-2">
                                  <div className="grid gap-2 pl-6 sm:grid-cols-2">
                                    <label className="space-y-0.5">
                                      <span className="text-[11px] text-muted-foreground">実装方針</span>
                                      <Input
                                        value={item.approach ?? ""}
                                        onChange={(e) => update(idx, { approach: e.target.value })}
                                        className="h-7 text-xs"
                                      />
                                    </label>
                                    <label className="space-y-0.5">
                                      <span className="text-[11px] text-muted-foreground">開発目的</span>
                                      <Input
                                        value={item.purpose ?? ""}
                                        onChange={(e) => update(idx, { purpose: e.target.value })}
                                        className="h-7 text-xs"
                                      />
                                    </label>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="border-t p-1.5">
                    <Button variant="ghost" size="sm" onClick={() => addRow(g.category)}>
                      <Plus className="size-3.5" />
                      行を追加
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">合計</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="総工数" value={`${totals.totalHours}h（${totals.totalPersonDays}人日）`} />
            <Row label="小計" value={formatYen(totals.subtotal)} />
            <Row label={`バッファ (${Math.round(bufferRate * 100)}%)`} value={formatYen(totals.buffer)} />
            <Row label="税抜合計" value={formatYen(totals.preTax)} />
            <Row label={`消費税 (${Math.round(estimate.taxRate * 100)}%)`} value={formatYen(totals.tax)} />
            <div className="flex justify-between border-t pt-2 text-base font-bold text-primary">
              <span>合計</span>
              <span>{formatYen(totals.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">アクティビティ別</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {byActivity.map((a) => (
              <Row key={a.key} label={a.label} value={`${a.hours}h（${a.personDays}人日）`} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">大項目別</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {grouped.map((g) => (
              <Row key={g.category} label={g.category} value={formatYen(g.amount)} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_TIERS.map((p) => (
          <Card key={p.name} className={p.name === plan ? "border-primary" : ""}>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between text-sm">
                {p.name}
                {p.name === plan && <Badge>現在</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
              <p className="mt-1 text-sm font-medium">
                {formatYen(p.min)}
                {p.max ? ` 〜 ${formatYen(p.max)}` : " 〜"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums font-medium">{value}</span>
    </div>
  );
}
