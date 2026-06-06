import { redirect } from "next/navigation";
import { getSession, ALLOWED_DOMAIN } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

const ERROR_MESSAGES: Record<string, string> = {
  forbidden_domain: `@${ALLOWED_DOMAIN} のメールアドレスのみログインできます。`,
  disabled: "このアカウントは無効化されています。管理者にお問い合わせください。",
  no_org: "組織が初期化されていません。管理者にお問い合わせください。",
  auth: "ログインリンクが無効または期限切れです。もう一度お試しください。",
  missing_code: "ログインリンクが無効です。もう一度お試しください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSession();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;
  const initialError = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <LoginForm initialError={initialError} />
    </div>
  );
}
