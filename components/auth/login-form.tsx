"use client";

import { useState, useTransition } from "react";
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
import { loginAction } from "@/app/_actions/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginAction(email);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-3 text-center">
        <AIdeaLabMark className="mx-auto size-12" />
        <div>
          <CardTitle className="text-lg">要件定義書けるくん Internal</CardTitle>
          <CardDescription className="mt-1">
            社内アカウントでログイン
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
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
            {pending ? "ログイン中…" : "ログイン"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            @aidealab.com のメールアドレスのみ利用できます
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
