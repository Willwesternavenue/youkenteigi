"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveHearing } from "@/app/_actions/hearings";

const FORMAT_LABELS: Record<string, string> = {
  online: "オンライン",
  offline: "対面",
};

export function HearingEditor({
  projectId,
  initialText,
  initialDate,
  initialTime,
  initialFormat,
  initialParticipants,
  initialOurParticipants,
}: {
  projectId: string;
  initialText: string;
  initialDate: string;
  initialTime: string;
  initialFormat: string;
  initialParticipants: string;
  initialOurParticipants: string;
}) {
  const [text, setText] = useState(initialText);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [format, setFormat] = useState(initialFormat || "online");
  const [participants, setParticipants] = useState(initialParticipants);
  const [ourParticipants, setOurParticipants] = useState(initialOurParticipants);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveHearing(projectId, {
        rawText: text,
        meetingDate: date || undefined,
        meetingTime: time || undefined,
        meetingFormat: format || undefined,
        clientParticipants: participants || undefined,
        ourParticipants: ourParticipants || undefined,
      });
      if (res.ok) toast.success("ヒアリング内容を保存しました");
      else toast.error("保存できませんでした");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="meetingDate">初回商談日</Label>
          <Input
            id="meetingDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meetingTime">商談時刻</Label>
          <Input
            id="meetingTime"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>形式</Label>
          <Select value={format} onValueChange={(v) => v && setFormat(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string | null) => (v ? FORMAT_LABELS[v] : "選択")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">オンライン</SelectItem>
              <SelectItem value="offline">対面</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="participants">先方の参加者名</Label>
          <Input
            id="participants"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="例: 情報システム部 田中様、カスタマーサポート部 佐藤様"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ourParticipants">弊社側の参加者名</Label>
          <Input
            id="ourParticipants"
            value={ourParticipants}
            onChange={(e) => setOurParticipants(e.target.value)}
            placeholder="例: 営業 佐藤、PM 鈴木"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rawText">ヒアリング内容 / 議事録</Label>
        <Textarea
          id="rawText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder="初回商談で聞いた内容、議事録、メール本文などを貼り付けてください。&#10;このテキストをもとに AI整理・RFP・要件定義書を生成します。"
          className="font-sans"
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存する"}
        </Button>
      </div>
    </div>
  );
}
