"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAiSettings } from "@/app/_actions/admin";

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock（決定論・APIキー不要）",
  claude: "Claude（要 ANTHROPIC_API_KEY）",
};

export function AiSettingsForm({
  initial,
}: {
  initial: {
    provider: string;
    defaultModel: string;
    monthlyBudget: string;
  };
}) {
  const [provider, setProvider] = useState(initial.provider || "mock");
  const [defaultModel, setDefaultModel] = useState(initial.defaultModel);
  const [monthlyBudget, setMonthlyBudget] = useState(initial.monthlyBudget);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveAiSettings({
        provider: provider as "mock" | "claude",
        defaultModel: defaultModel || undefined,
        monthlyBudget: monthlyBudget || undefined,
      });
      if (res.ok) toast.success("AI設定を保存しました");
      else toast.error(res.error);
    });
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label>プロバイダ</Label>
        <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
          <SelectTrigger>
            <SelectValue>{(v: string | null) => (v ? PROVIDER_LABELS[v] : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mock">{PROVIDER_LABELS.mock}</SelectItem>
            <SelectItem value="claude">{PROVIDER_LABELS.claude}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-model">既定モデル（任意）</Label>
        <Input
          id="ai-model"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder="claude-sonnet-4-6"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-budget">月次コスト上限（円・任意）</Label>
        <Input
          id="ai-budget"
          type="number"
          value={monthlyBudget}
          onChange={(e) => setMonthlyBudget(e.target.value)}
          placeholder="100000"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        ※ 実行プロバイダはサーバの環境変数（AI_PROVIDER / ANTHROPIC_API_KEY）が優先されます。
        <br />
        ※ <strong>月次コスト上限</strong>は概算コストで強制されます。今月の概算が上限に達すると生成がブロックされます。
        <strong> 0 を設定すると AI生成を即時停止</strong>（緊急停止スイッチ）。空欄なら無制限。
        加えて 1ユーザーあたり毎分20回のレート制限がかかります。
      </p>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存する"}
        </Button>
      </div>
    </div>
  );
}
