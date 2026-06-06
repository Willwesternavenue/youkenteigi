import type {
  TDocumentDefinitions,
  Content,
  TableCell,
} from "pdfmake/interfaces";
import { renderDocDefinition } from "./to-pdf";

/** Schedule data shaped for PDF export (spec §7.18 / §12). */
export interface ScheduleExport {
  title: string;
  projectStart: string;
  projectEnd: string;
  tasks: {
    taskName: string;
    phase: string;
    startDate: string;
    endDate: string;
    durationDays: number | null;
    assigneeRole?: string | null;
    progress: number;
    isCriticalPath?: boolean | null;
    needsClientReview?: boolean | null;
    risk?: string | null;
  }[];
  phases: { phase: string; startDate: string; endDate: string; weeks: number }[];
  milestones: { title: string; milestoneDate: string; isClientVisible?: boolean | null }[];
}

const NAVY = "#1e3a5f";

function headerCell(text: string): TableCell {
  return { text, bold: true, color: "white", fillColor: NAVY, fontSize: 9 };
}

export async function toSchedulePdf(data: ScheduleExport): Promise<Buffer> {
  const content: Content[] = [
    { text: data.title, style: "title", margin: [0, 0, 0, 4] },
    {
      text: `期間: ${data.projectStart} 〜 ${data.projectEnd}`,
      color: "#475569",
      margin: [0, 0, 0, 14],
    },
    { text: "社内向け詳細スケジュール", style: "h2", margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: ["*", 60, 52, 52, 30, 56, 36],
        body: [
          [
            headerCell("タスク"),
            headerCell("フェーズ"),
            headerCell("開始"),
            headerCell("終了"),
            headerCell("日数"),
            headerCell("担当"),
            headerCell("CP"),
          ],
          ...data.tasks.map((t) => [
            {
              text:
                t.taskName + (t.needsClientReview ? "（要確認）" : ""),
              fontSize: 9,
            },
            { text: t.phase, fontSize: 9 },
            { text: t.startDate, fontSize: 8 },
            { text: t.endDate, fontSize: 8 },
            { text: `${t.durationDays ?? ""}`, fontSize: 9, alignment: "center" as const },
            { text: t.assigneeRole ?? "", fontSize: 8 },
            {
              text: t.isCriticalPath ? "●" : "",
              color: "#e11d48",
              alignment: "center" as const,
            },
          ]),
        ],
      },
      layout: {
        hLineColor: () => "#e2e8f0",
        vLineColor: () => "#e2e8f0",
      },
    },
    {
      text: "クライアント共有用スケジュール（フェーズ単位）",
      style: "h2",
      margin: [0, 16, 0, 6],
    },
    {
      table: {
        headerRows: 1,
        widths: ["*", 70, 70, 50],
        body: [
          [
            headerCell("フェーズ"),
            headerCell("開始"),
            headerCell("終了"),
            headerCell("期間"),
          ],
          ...data.phases.map((p) => [
            { text: p.phase, fontSize: 9 },
            { text: p.startDate, fontSize: 9 },
            { text: p.endDate, fontSize: 9 },
            { text: `${p.weeks}週間`, fontSize: 9, alignment: "center" as const },
          ]),
        ],
      },
      layout: { hLineColor: () => "#e2e8f0", vLineColor: () => "#e2e8f0" },
    },
  ];

  if (data.milestones.length) {
    content.push(
      { text: "マイルストーン", style: "h2", margin: [0, 16, 0, 6] },
      {
        ul: data.milestones.map(
          (m) =>
            `${m.milestoneDate} — ${m.title}${m.isClientVisible ? "" : "（社内）"}`,
        ),
        fontSize: 9,
      },
    );
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    styles: {
      title: { fontSize: 18, bold: true },
      h2: { fontSize: 13, bold: true, color: NAVY },
    },
    pageMargins: [40, 48, 40, 48],
    pageOrientation: "landscape",
  };

  return renderDocDefinition(docDefinition);
}
