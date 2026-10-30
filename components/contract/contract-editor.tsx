"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileOutput, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CONTRACT_FIELDS,
  contractTexts,
  contractTitle,
  fillEmpty,
  requiredProgress,
  type ContractTab,
  type ContractValues,
} from "@/lib/contract/render";
import type { ContractField } from "@/lib/contract/template";
import { createGoogleDoc, preloadGoogleDocs } from "@/lib/contract/google-docs";
import {
  deleteContract,
  getContractPrefill,
  restoreContract,
  saveContract,
} from "@/app/_actions/contracts";
import { ContractDiffLegend, ContractDocument } from "./contract-document";

const DATE_FIELDS = ["contract_year", "contract_month", "contract_day"];

// フォームのグループ順はテンプレートのフィールド定義順
const GROUPS: { name: string; fields: ContractField[] }[] = [];
for (const f of CONTRACT_FIELDS) {
  const g = GROUPS.find((x) => x.name === f.group);
  if (g) g.fields.push(f);
  else GROUPS.push({ name: f.group, fields: [f] });
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function sameValues(a: ContractValues, b: ContractValues): boolean {
  return CONTRACT_FIELDS.every((f) => (a[f.id] ?? "").trim() === (b[f.id] ?? "").trim());
}

export function ContractEditor({
  contractId,
  projectId,
  projectName,
  showProjectLink,
  initialValues,
  initialVersion,
  canEdit,
}: {
  contractId: string;
  projectId: string | null;
  projectName: string | null;
  showProjectLink: boolean;
  initialValues: ContractValues;
  initialVersion: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ContractValues>(initialValues);
  const [saved, setSaved] = useState<ContractValues>(initialValues);
  const [version, setVersion] = useState(initialVersion);
  const [tab, setTab] = useState<ContractTab>("contract");
  const [diff, setDiff] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = !sameValues(values, saved);
  const progress = requiredProgress(values);

  useEffect(() => preloadGoogleDocs(), []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));

  function save() {
    startTransition(async () => {
      const res = await saveContract(contractId, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(values);
      setVersion(res.version);
      toast.success(`v${res.version} として保存しました`);
    });
  }

  function prefill() {
    startTransition(async () => {
      const res = await getContractPrefill(contractId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { values: next, filledKeys } = fillEmpty(values, res.values);
      if (filledKeys.length === 0) {
        toast.info("案件情報から入力できる空欄はありませんでした");
        return;
      }
      setValues(next);
      toast.success(`案件情報から ${filledKeys.length} 項目を入力しました（未保存）`);
    });
  }

  function remove() {
    const message = dirty
      ? "この契約書を削除しますか？（未保存の変更も破棄されます）"
      : "この契約書を削除しますか？";
    if (!confirm(message)) return;
    startTransition(async () => {
      const res = await deleteContract(contractId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // 単体ページなら一覧へ、案件タブなら同じタブを再表示（次の契約書か空の状態）
      if (showProjectLink) router.push("/contract");
      else router.refresh();
      toast.success("契約書を削除しました", {
        action: { label: "元に戻す", onClick: () => undoRemove() },
      });
    });
  }

  async function undoRemove() {
    const res = await restoreContract(contractId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("削除を取り消しました");
    if (showProjectLink) router.push(`/contract/${contractId}`);
    else router.refresh();
  }

  function downloadText() {
    const { contractText, appendixText } = contractTexts(values);
    const fullText = contractText + "\n\n" + "═".repeat(50) + "\n\n" + appendixText;
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractTitle(values)}_${today()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportDocs() {
    setExporting(true);
    try {
      const { contractText, appendixText } = contractTexts(values);
      const result = await createGoogleDoc(
        `${contractTitle(values)}_${today()}`,
        contractText,
        appendixText,
      );
      setDocUrl(result.url);
      toast.success("Google Docs にドキュメントを作成しました", {
        action: { label: "開く", onClick: () => window.open(result.url, "_blank") },
      });
    } catch (e) {
      toast.error(`エラー: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{contractTitle(values)}</h2>
          <p className="text-xs text-muted-foreground">
            v{version}
            {dirty && <span className="ml-2 font-medium text-amber-600">未保存の変更あり</span>}
            {showProjectLink && projectId && (
              <>
                {" · "}
                <Link href={`/projects/${projectId}/contract`} className="underline">
                  {projectName ?? "案件"}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && projectId && (
            <Button variant="outline" onClick={prefill} disabled={pending}>
              <Wand2 className="size-4" />
              案件情報から入力
            </Button>
          )}
          <Button variant="outline" onClick={downloadText}>
            <Download className="size-4" />
            テキスト保存
          </Button>
          <Button variant="outline" onClick={exportDocs} disabled={exporting}>
            <FileOutput className="size-4" />
            {exporting ? "作成中..." : "Google Docs に出力"}
          </Button>
          {canEdit && (
            <Button onClick={save} disabled={!dirty || pending}>
              <Save className="size-4" />
              保存
            </Button>
          )}
          {canEdit && (
            <Button variant="destructive" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" />
              削除
            </Button>
          )}
        </div>
      </div>
      {docUrl && (
        <p className="text-sm">
          <a href={docUrl} target="_blank" rel="noreferrer" className="text-primary underline">
            作成した Google Docs を開く →
          </a>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <aside className="space-y-5 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-2">
          <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <span className="shrink-0 text-xs font-medium">
              {progress.filled}/{progress.total} 必須項目
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((progress.filled / progress.total) * 100)}%` }}
              />
            </div>
          </div>
          {GROUPS.map((group) => {
            const dates = group.fields.filter((f) => DATE_FIELDS.includes(f.id));
            const others = group.fields.filter((f) => !DATE_FIELDS.includes(f.id));
            return (
              <section key={group.name} className="space-y-3">
                <h3 className="border-b pb-1 text-sm font-semibold">{group.name}</h3>
                {others.map((f) => (
                  <FieldInput key={f.id} field={f} value={values[f.id] ?? ""} onChange={set} disabled={!canEdit} />
                ))}
                {dates.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {dates.map((f) => (
                      <FieldInput key={f.id} field={f} value={values[f.id] ?? ""} onChange={set} disabled={!canEdit} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </aside>

        <main className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["contract", "契約書本文"],
                ["appendix", "別紙"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={tab === key ? "default" : "outline"}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={diff ? "default" : "outline"}
              className="ml-auto"
              onClick={() => setDiff((d) => !d)}
              title="元テンプレートとの差分（レッドライン）を表示"
            >
              差分表示
            </Button>
          </div>
          {diff && <ContractDiffLegend />}
          <div className="flex justify-center rounded-lg bg-muted/50 p-3 sm:p-6">
            <ContractDocument tab={tab} values={values} diff={diff} />
          </div>
        </main>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ContractField;
  value: string;
  onChange: (id: string, value: string) => void;
  disabled: boolean;
}) {
  const id = `contract-${field.id}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      )}
    </div>
  );
}
