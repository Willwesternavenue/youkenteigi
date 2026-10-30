import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  classifyAppendixLine,
  classifyContractLine,
  splitSlots,
  templateLines,
  type ContractTab,
  type ContractValues,
} from "@/lib/contract/render";

/**
 * 契約書プレビュー（AgreementWriter preview.js の移植）。
 * 通常表示: 入力値をハイライト、未入力は【未入力】。
 * 差分表示: 差し込み口ごとに「元テンプレートの空欄（項目名）を削除 → 入力値を追加」の
 * レッドラインで描画し、弁護士レビュー済み本文から何が変わったかを明示する。
 */

// 紙面は常に白地（ダークモードでも契約書の見た目を保つ）。明朝はシステムフォントを使い、
// ビルド時の Google Fonts 取得に依存しない。
const PAPER_FONT =
  '"Noto Serif JP", "Yu Mincho", YuMincho, "Hiragino Mincho ProN", "ＭＳ 明朝", serif';

function SlotText({
  text,
  values,
  diff,
}: {
  text: string;
  values: ContractValues;
  diff: boolean;
}) {
  return splitSlots(text, values).map((seg, i) => {
    if (seg.kind === "text") return <Fragment key={i}>{seg.text}</Fragment>;
    if (diff) {
      return (
        <Fragment key={i}>
          <del className="mr-[0.15em] rounded-[3px] bg-[#fdecec] px-[0.3em] text-[0.9em] text-[#b3261e] decoration-[#b3261e]">
            【{seg.label}】
          </del>
          {seg.value ? (
            <ins className="rounded-[3px] bg-[#e6f4ea] px-[0.3em] font-semibold whitespace-pre-wrap text-[#146c2e] no-underline">
              {seg.value}
            </ins>
          ) : (
            <ins className="rounded-[3px] bg-[#fff3cd] px-[0.3em] font-medium text-[#856404] italic no-underline">
              （未入力）
            </ins>
          )}
        </Fragment>
      );
    }
    return seg.value ? (
      <span
        key={i}
        className="border-b-2 border-primary pb-px font-semibold whitespace-pre-wrap text-primary"
      >
        {seg.value}
      </span>
    ) : (
      <span
        key={i}
        className="rounded border border-dashed border-[#f0c040] bg-[#fff3cd] px-[0.4em] py-[0.1em] text-[0.9em] font-semibold text-[#856404]"
      >
        【未入力】
      </span>
    );
  });
}

function renderContract(values: ContractValues, diff: boolean): ReactNode[] {
  return templateLines("contract").map((line, i) => {
    const { kind, text } = classifyContractLine(line);
    const body = <SlotText text={text} values={values} diff={diff} />;
    switch (kind) {
      case "blank":
        return <br key={i} />;
      case "title":
        return (
          <h2 key={i} className="mb-8 text-center text-[12.5px] font-bold tracking-[0.3em]">
            {text}
          </h2>
        );
      case "section":
        return (
          <p key={i} className="mt-[1.5em] mb-[0.5em] font-bold">
            {body}
          </p>
        );
      case "numbered":
      case "indent1":
        return (
          <p key={i} className="pl-[1em]">
            {body}
          </p>
        );
      case "indent2":
        return (
          <p key={i} className="pl-[2em]">
            {body}
          </p>
        );
      default:
        return <p key={i}>{body}</p>;
    }
  });
}

function renderAppendix(values: ContractValues, diff: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let lastWasBlank = true;
  let seenMajor = false;
  templateLines("appendix").forEach((line, i) => {
    const { kind, text } = classifyAppendixLine(line);
    if (kind === "blank") {
      if (!lastWasBlank) out.push(<div key={i} className="h-2" />);
      lastWasBlank = true;
      return;
    }
    lastWasBlank = false;
    const body = <SlotText text={text} values={values} diff={diff} />;
    switch (kind) {
      case "title":
        out.push(
          <h2 key={i} className="mb-8 text-center text-[12.5px] font-bold tracking-[0.3em]">
            {text}
          </h2>,
        );
        break;
      case "major":
        out.push(
          <p
            key={i}
            className={cn(
              "mb-[0.5em] border-b border-black/10 pb-[0.3em] text-base font-bold tracking-[0.02em]",
              seenMajor ? "mt-[1.5em]" : "mt-0",
            )}
          >
            {body}
          </p>,
        );
        seenMajor = true;
        break;
      case "sub":
        out.push(
          <p key={i} className="mt-[0.85em] mb-[0.3em] font-semibold text-[#262626]">
            {body}
          </p>,
        );
        break;
      case "note":
        out.push(
          <p
            key={i}
            className="mt-3 mb-2 border-l-[3px] border-primary bg-[#f7f6ff] py-[0.6rem] pr-[0.85rem] pl-[1.1rem] text-[0.92rem] text-[#444]"
          >
            {body}
          </p>,
        );
        break;
      default:
        out.push(
          <p key={i} className="mb-[0.4em] pl-[1em]">
            {body}
          </p>,
        );
    }
  });
  return out;
}

export function ContractDiffLegend() {
  return (
    <div className="flex flex-wrap gap-5 rounded-md border bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <del className="rounded-[3px] bg-[#fdecec] px-[0.3em] text-[#b3261e]">元テンプレート</del>
        差し替え前（空欄）
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ins className="rounded-[3px] bg-[#e6f4ea] px-[0.3em] font-semibold text-[#146c2e] no-underline">
          入力値
        </ins>
        差し替え後
      </span>
    </div>
  );
}

export function ContractDocument({
  tab,
  values,
  diff,
}: {
  tab: ContractTab;
  values: ContractValues;
  diff: boolean;
}) {
  return (
    <div
      className="relative w-full max-w-[800px] overflow-hidden rounded-lg bg-white px-6 py-12 text-[14px] leading-[2] text-[#1a1a1a] shadow-lg sm:px-14 sm:py-16"
      style={{ fontFamily: PAPER_FONT }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      {tab === "contract" ? renderContract(values, diff) : renderAppendix(values, diff)}
    </div>
  );
}
