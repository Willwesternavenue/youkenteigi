"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Presentation,
  FileDown,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  RotateCcw,
  FilePlus2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SlideView } from "./slide-view";
import type { Slide } from "@/lib/slides/deck";
import { saveDeck, resetDeck, fillSlideBullets } from "@/app/_actions/slides";

const TYPE_LABEL: Record<string, string> = {
  cover: "表紙",
  agenda: "アジェンダ",
  section: "本文",
  cards: "カード",
  estimate: "見積",
  schedule: "スケジュール",
  diagram: "図",
  closing: "クロージング",
  endcard: "ブランド",
};
const EDITABLE = new Set(["cover", "agenda", "section", "cards", "closing", "endcard"]);

export function DeckEditor({
  projectId,
  slides: initial,
  hasRequirements,
  source,
}: {
  projectId: string;
  slides: Slide[];
  hasRequirements: boolean;
  source: "saved" | "auto";
}) {
  const router = useRouter();
  const [slides, setSlides] = useState<Slide[]>(initial);
  const [current, setCurrent] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [savePending, startSave] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [fillPending, startFill] = useTransition();

  if (!hasRequirements) {
    return (
      <div className="space-y-4">
        <Heading />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              先に「要件定義」タブで要件定義書を生成してください。スライドは要件定義書（＋見積・スケジュール）から自動構成され、その後に編集できます。
            </p>
            <Button render={<Link href={`/projects/${projectId}/requirements`} />} nativeButton={false}>
              要件定義へ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sel = slides[current];

  function patch(i: number, p: Partial<Slide>) {
    setSlides((s) => s.map((x, idx) => (idx === i ? ({ ...x, ...p } as Slide) : x)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    setSlides((s) => {
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setCurrent(j);
    setDirty(true);
  }
  function remove(i: number) {
    if (slides.length <= 1) return;
    setSlides((s) => s.filter((_, idx) => idx !== i));
    setCurrent((c) => Math.max(0, Math.min(c, slides.length - 2)));
    setDirty(true);
  }
  function addBlank() {
    const blank: Slide = { type: "section", heading: "新しいスライド", bullets: [""] };
    setSlides((s) => {
      const next = [...s];
      next.splice(current + 1, 0, blank);
      return next;
    });
    setCurrent(current + 1);
    setDirty(true);
  }

  function save() {
    startSave(async () => {
      const res = await saveDeck(projectId, slides);
      if (res.ok) {
        setDirty(false);
        toast.success("スライドを保存しました");
      } else toast.error("保存できませんでした");
    });
  }
  function reset() {
    if (!confirm("編集内容を破棄し、要件定義・見積・スケジュールから自動構成に戻します。よろしいですか？")) return;
    startReset(async () => {
      const res = await resetDeck(projectId);
      if (res.ok) {
        setSlides(res.slides as Slide[]);
        setCurrent(0);
        setDirty(false);
        toast.success("自動構成に戻しました");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function fill() {
    if (sel.type !== "section") return;
    const topic = sel.heading?.trim();
    if (!topic) {
      toast.error("先に見出しを入力してください");
      return;
    }
    startFill(async () => {
      const res = await fillSlideBullets(projectId, topic);
      if (res.ok) {
        patch(current, { bullets: res.bullets } as Partial<Slide>);
        toast.success("AIで本文を生成しました");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading />
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <Badge variant="outline" className="text-amber-600">未保存</Badge>}
          {source === "auto" && !dirty && (
            <Badge variant="secondary">自動構成（未保存）</Badge>
          )}
          <Button onClick={reset} variant="outline" size="sm" disabled={resetPending}>
            <RotateCcw className="size-3.5" />
            {resetPending ? "再構成中…" : "自動構成に戻す"}
          </Button>
          <Button
            render={<a href={`/api/export/slides/${projectId}?format=pptx`} download />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <FileDown className="size-3.5" />
            PowerPoint
          </Button>
          <Button
            render={<a href={`/api/export/slides/${projectId}?format=pdf`} download />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <FileDown className="size-3.5" />
            PDF
          </Button>
          <Button onClick={save} size="sm" disabled={savePending || !dirty}>
            <Save className="size-3.5" />
            {savePending ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      {source === "saved" && (
        <p className="text-xs text-muted-foreground">
          書き出し（PPTX/PDF）は保存後の内容になります。編集したら「保存」してください。
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* slide list */}
        <div className="space-y-2">
          <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {slides.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "group rounded-lg border p-1.5 transition-all",
                  i === current ? "ring-2 ring-primary" : "hover:bg-muted/40",
                )}
              >
                <button
                  onClick={() => setCurrent(i)}
                  className="block w-full overflow-hidden rounded"
                >
                  <SlideView slide={s} n={i + 1} />
                </button>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {i + 1}. {TYPE_LABEL[s.type] ?? s.type}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="上へ"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === slides.length - 1}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="下へ"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button
                      onClick={() => remove(i)}
                      disabled={slides.length <= 1}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="削除"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={addBlank} variant="outline" size="sm" className="w-full">
            <FilePlus2 className="size-3.5" />
            空ページを追加
          </Button>
        </div>

        {/* preview + editor */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border shadow-sm">
            <SlideView slide={sel} n={current + 1} />
          </div>

          <Card>
            <CardContent className="space-y-3 py-4">
              <SlideEditor
                slide={sel}
                onPatch={(p) => patch(current, p)}
                onFill={fill}
                fillPending={fillPending}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlideEditor({
  slide,
  onPatch,
  onFill,
  fillPending,
}: {
  slide: Slide;
  onPatch: (p: Partial<Slide>) => void;
  onFill: () => void;
  fillPending: boolean;
}) {
  if (!EDITABLE.has(slide.type)) {
    return (
      <p className="text-sm text-muted-foreground">
        このスライド（{TYPE_LABEL[slide.type] ?? slide.type}）は要件定義・見積・スケジュールから自動生成されます。並べ替え・削除はできますが、内容は各タブで編集してください。
      </p>
    );
  }

  if (slide.type === "cover") {
    return (
      <div className="space-y-2">
        <Field label="タイトル" value={slide.title} onChange={(v) => onPatch({ title: v } as Partial<Slide>)} />
        <Field label="サブタイトル" value={slide.subtitle ?? ""} onChange={(v) => onPatch({ subtitle: v } as Partial<Slide>)} />
        <Field label="クライアント" value={slide.client ?? ""} onChange={(v) => onPatch({ client: v } as Partial<Slide>)} />
      </div>
    );
  }
  if (slide.type === "endcard") {
    return (
      <Field label="タグライン" value={slide.tagline} onChange={(v) => onPatch({ tagline: v } as Partial<Slide>)} />
    );
  }
  if (slide.type === "agenda") {
    return (
      <ListEditor
        label="項目"
        items={slide.items}
        onChange={(items) => onPatch({ items } as Partial<Slide>)}
      />
    );
  }
  if (slide.type === "cards") {
    return (
      <div className="space-y-2">
        <Field label="見出し" value={slide.heading} onChange={(v) => onPatch({ heading: v } as Partial<Slide>)} />
        <ListEditor
          label="カード"
          items={slide.cards.map((c) => c.title)}
          onChange={(titles) =>
            onPatch({ cards: titles.map((t) => ({ title: t })) } as Partial<Slide>)
          }
        />
      </div>
    );
  }
  if (slide.type !== "section" && slide.type !== "closing") return null;
  // section or closing (heading/title + bullets)
  const heading = slide.type === "closing" ? slide.title : slide.heading;
  const setHeading = (v: string) =>
    onPatch((slide.type === "closing" ? { title: v } : { heading: v }) as Partial<Slide>);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="見出し" value={heading} onChange={setHeading} />
        </div>
        {slide.type === "section" && (
          <Button
            onClick={onFill}
            variant="outline"
            size="sm"
            disabled={fillPending}
            className="shrink-0 border-primary/30 text-primary"
          >
            <Sparkles className="size-3.5" />
            {fillPending ? "生成中…" : "AIで埋める"}
          </Button>
        )}
      </div>
      <ListEditor
        label="箇条書き"
        items={slide.bullets}
        onChange={(bullets) => onPatch({ bullets } as Partial<Slide>)}
        multiline
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  multiline,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5">
          {multiline ? (
            <Textarea
              value={it}
              rows={1}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="min-h-8 flex-1 py-1.5"
            />
          ) : (
            <Input
              value={it}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-8 flex-1"
            />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        <Plus className="size-3" />
        行追加
      </Button>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Presentation className="size-4 text-primary" />
        提案スライド
      </h2>
      <p className="text-sm text-muted-foreground">
        要件定義書・見積・スケジュールから自動構成。空ページの追加・並べ替え・編集や、各スライドの「AIで埋める」で作り込めます。
      </p>
    </div>
  );
}
