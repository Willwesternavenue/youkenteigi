import ExcelJS from "exceljs";
import type { EstimateTotals } from "@/lib/estimate-calc";

/** Estimate data shaped for XLSX export (spec §7.18 / §11). Activity-hours model. */
export interface EstimateExportItem {
  category: string;
  subCategory?: string | null;
  taskName: string;
  approach?: string | null;
  purpose?: string | null;
  role?: string | null;
  hoursDesign: number;
  hoursImpl: number;
  hoursTest: number;
  hoursCoord: number;
  hoursMgmt: number;
  hours: number;
  personDays: number;
  amount: number;
}

export interface EstimateExport {
  title: string;
  defaultUnitPrice: number;
  bufferRate: number;
  taxRate: number;
  items: EstimateExportItem[];
  totals: EstimateTotals;
}

const YEN = '#,##0"円"';
const NAVY = "FF1E3A5F";
const SOFT = "FFEEF1FF";

export async function toXlsx(data: EstimateExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "要件定義書けるくん Internal";
  const ws = wb.addWorksheet("見積");

  ws.mergeCells("A1:M1");
  const title = ws.getCell("A1");
  title.value = data.title;
  title.font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getRow(1).height = 24;
  ws.addRow([]);

  const headers = [
    "大項目",
    "中項目",
    "小項目",
    "設計",
    "実装",
    "テスト",
    "調整",
    "管理",
    "計(h)",
    "人日",
    "金額",
    "実装方針",
    "開発目的",
  ];
  const header = ws.addRow(headers);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle" };
  });

  // group by category with subtotal rows
  const groups = new Map<string, EstimateExportItem[]>();
  const order: string[] = [];
  for (const it of data.items) {
    const c = it.category || "その他";
    if (!groups.has(c)) {
      groups.set(c, []);
      order.push(c);
    }
    groups.get(c)!.push(it);
  }

  for (const cat of order) {
    const rows = groups.get(cat)!;
    const catHours = rows.reduce((a, i) => a + i.hours, 0);
    const catAmount = rows.reduce((a, i) => a + i.amount, 0);
    const catRow = ws.addRow([cat, "", "", "", "", "", "", "", catHours, "", catAmount, "", ""]);
    catRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: NAVY } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
    });
    catRow.getCell(11).numFmt = YEN;

    for (const it of rows) {
      const row = ws.addRow([
        "",
        it.subCategory ?? "",
        it.taskName,
        it.hoursDesign,
        it.hoursImpl,
        it.hoursTest,
        it.hoursCoord,
        it.hoursMgmt,
        it.hours,
        it.personDays,
        it.amount,
        it.approach ?? "",
        it.purpose ?? "",
      ]);
      row.getCell(11).numFmt = YEN;
    }
  }

  ws.addRow([]);
  const t = data.totals;
  const totalRows: [string, number][] = [
    ["小計", t.subtotal],
    [`バッファ (${Math.round(data.bufferRate * 100)}%)`, t.buffer],
    ["税抜合計", t.preTax],
    [`消費税 (${Math.round(data.taxRate * 100)}%)`, t.tax],
    ["合計", t.total],
  ];
  for (const [label, value] of totalRows) {
    const row = ws.addRow(["", "", "", "", "", "", "", "", "", label, value, "", ""]);
    row.getCell(11).numFmt = YEN;
    if (label === "合計") {
      row.getCell(10).font = { bold: true };
      row.getCell(11).font = { bold: true, color: { argb: NAVY } };
    }
  }
  ws.addRow(["", "", "", "", "", "", "", "", t.totalHours, t.totalPersonDays, "総工数(h/人日)", "", ""]);

  ws.columns = [
    { width: 20 },
    { width: 20 },
    { width: 30 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 8 },
    { width: 8 },
    { width: 14 },
    { width: 36 },
    { width: 36 },
  ];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
