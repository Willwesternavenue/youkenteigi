import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <LoginForm />
    </div>
  );
}
