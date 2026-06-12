"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/proposals";

const newUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .refine((e) => e.endsWith("@rsla.io"), "Team accounts need an @rsla.io email."),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function addUser(input: {
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}): Promise<ActionResult> {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can add teammates." };
  const parsed = newUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    if (existing.active) return { ok: false, error: "That teammate already has access." };
    await prisma.user.update({
      where: { id: existing.id },
      data: { active: true, role: parsed.data.role, name: parsed.data.name },
    });
  } else {
    await prisma.user.create({ data: parsed.data });
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserRole(input: {
  userId: string;
  role: "ADMIN" | "MEMBER";
}): Promise<ActionResult> {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can change roles." };
  if (input.userId === actor.id && input.role !== "ADMIN") {
    return { ok: false, error: "You can't demote yourself. Ask another admin." };
  }
  await prisma.user.update({ where: { id: input.userId }, data: { role: input.role } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserActive(input: {
  userId: string;
  active: boolean;
}): Promise<ActionResult> {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can manage access." };
  if (input.userId === actor.id) {
    return { ok: false, error: "You can't remove your own access." };
  }
  if (!input.active) {
    const target = await prisma.user.findUnique({ where: { id: input.userId } });
    if (target?.role === "ADMIN") {
      const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) return { ok: false, error: "At least one admin has to stay active." };
    }
  }
  await prisma.user.update({ where: { id: input.userId }, data: { active: input.active } });
  revalidatePath("/settings");
  return { ok: true };
}
