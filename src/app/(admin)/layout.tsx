import { requireAuth } from "@/lib/authGuard";
import { AppShell } from "@/components/layout/appShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <AppShell>{children}</AppShell>;
}
