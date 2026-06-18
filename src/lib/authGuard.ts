import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { User } from "@/generated/prisma/client";

/** Loads the signed-in allowlisted user. Redirects to sign-in otherwise. */
export async function requireUser(): Promise<User> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email?.endsWith("@rsla.io")) redirect("/sign-in");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) redirect("/sign-in");
  return user;
}

/** Pages that only admins should see. Members get bounced to the dashboard. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Back-compat alias used across server actions. */
export async function requireAuth(): Promise<User> {
  return requireUser();
}

/**
 * API-route variant of requireUser: returns the live, active, allowlisted user, or null so the
 * caller can answer 401 (route handlers respond with a status, not a redirect). Re-validates the
 * User row + active flag on every request — never trusting the login-time allowlist — so an
 * offboarded or deactivated @rsla.io account with a still-valid JWT loses access immediately,
 * even though the JWT itself hasn't expired (RSL-11).
 */
export async function getActiveApiUser(): Promise<User | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email?.endsWith("@rsla.io")) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return null;
  return user;
}
