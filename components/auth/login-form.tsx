"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { AIdeaLabMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requestMagicLink } from "@/app/_actions/auth";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestMagicLink(email);
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-3 text-center">
        <AIdeaLabMark className="mx-auto size-12" />
        <div>
          <CardTitle className="text-lg">要件定義かけるくん Internal</CardTitle>
          <CardDescription className="mt-1">
            社内アカウントでログイン
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-3 py-2 text-center">
            <MailCheck className="mx-auto size-10 text-primary" />
            <p className="text-sm font-medium">ログインリンクを送信しました</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{email}</span> 宛のメールにある
              リンクをクリックするとログインできます。
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              別のメールアドレスで送り直す
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@aidealab.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "送信中…" : "ログインリンクを送信"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              @aidealab.com のメールアドレスのみ利用できます。パスワードは不要です。
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
