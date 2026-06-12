import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@rsla.io")) {
    redirect("/sign-in");
  }
  return session;
}
