"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject, type ProjectInput } from "@/app/_actions/projects";
import {
  DEVELOPMENT_FORMS,
  DEVELOPMENT_FORM_LABELS,
  DEFAULT_DEVELOPMENT_FORM,
  PROJECT_STAGES,
  PHASE_LABELS,
  type DevelopmentForm,
  type ProjectStage,
} from "@/types/domain";

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  );
}

export function ProjectForm() {
  const [error, setError] = useState<string | null>(null);
  const [developmentForm, setDevelopmentForm] = useState<DevelopmentForm>(
    DEFAULT_DEVELOPMENT_FORM,
  );
  const [projectStage, setProjectStage] = useState<ProjectStage>("mvp");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
    const links = [
      { label: "Notion 議事録", url: raw.notionUrl },
      { label: "Canva 資料", url: raw.canvaUrl },
    ].filter((l) => l.url && l.url.trim() !== "");
    const input = {
      ...raw,
      developmentForm,
      projectStage,
      links,
    } as unknown as ProjectInput;
    startTransition(async () => {
      const res = await createProject(input);
      // success path redirects (throws), so we only reach here on failure
      if (res && !res.ok) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
          <Field label="案件名" name="projectName" required placeholder="問い合わせ対応AIアシスタント導入" />
          <Field label="クライアント名" name="clientName" required placeholder="株式会社サンプル製作所" />
          <Field label="クライアントドメイン" name="clientDomain" placeholder="sample.co.jp" />
          <Field label="業界" name="industry" placeholder="製造業" />
          <Field label="部署" name="department" placeholder="カスタマーサポート部" />
          <Field label="先方担当者" name="clientContact" placeholder="情報システム部 田中様" />
          <Field label="自社営業担当" name="salesOwner" />
          <Field label="自社PM" name="pmOwner" />
          <Field label="想定予算下限 (円)" name="budgetMin" type="number" placeholder="7000000" />
          <Field label="想定予算上限 (円)" name="budgetMax" type="number" placeholder="12000000" />
          <Field label="希望開始時期" name="expectedStartDate" type="date" />
          <Field label="希望納期" name="expectedDeliveryDate" type="date" />
          <Field label="提案期限" name="proposalDueDate" type="date" />
          <div className="space-y-1.5">
            <Label>開発形態（契約形態）</Label>
            <Select
              value={developmentForm}
              onValueChange={(v) => v && setDevelopmentForm(v as DevelopmentForm)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? DEVELOPMENT_FORM_LABELS[v as DevelopmentForm] : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_FORMS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {DEVELOPMENT_FORM_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>開発ステージ</Label>
            <Select
              value={projectStage}
              onValueChange={(v) => v && setProjectStage(v as ProjectStage)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? PHASE_LABELS[v as ProjectStage] : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PHASE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">どういうものを作るか（概要）</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="例: 社内FAQ・マニュアルを根拠に、問い合わせの一次回答ドラフトをAIが生成し、オペレーターが確認・送信できるWebアプリ"
            />
          </div>
          <Field label="Notion 議事録URL" name="notionUrl" placeholder="https://www.notion.so/..." />
          <Field label="Canva 資料URL" name="canvaUrl" placeholder="https://www.canva.com/..." />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">案件メモ</Label>
            <Textarea id="note" name="note" rows={3} placeholder="初回商談の補足・背景など" />
          </div>
        </CardContent>
      </Card>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "作成中…" : "案件を作成"}
        </Button>
      </div>
    </form>
  );
}
