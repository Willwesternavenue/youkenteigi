import { requireUser } from "@/lib/auth";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">新規案件</h1>
        <p className="text-sm text-muted-foreground">
          初回商談の情報を入力して案件を作成します。後から編集できます。
        </p>
      </div>
      <ProjectForm />
    </div>
  );
}
