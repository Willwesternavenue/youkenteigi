import { requireUser } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader name={user.name} email={user.email} role={user.role} />
        <main className="flex-1 overflow-x-hidden px-5 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
