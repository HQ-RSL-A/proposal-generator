"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSignature, HeartPulse, LogOut, Plus, Settings } from "lucide-react";

export interface ShellUser {
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  avatarUrl: string | null;
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();

  const nav = [
    { href: "/dashboard", label: "Proposals", icon: FileSignature },
    ...(user.role === "ADMIN"
      ? [
          { href: "/health", label: "Health", icon: HeartPulse },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logomark.svg" alt="RSL/A" width={22} height={22} />
              <span className="font-heading text-sm font-bold tracking-tight">Proposals</span>
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" nativeButton={false} render={<Link href="/proposals/new" />}>
              <Plus className="h-4 w-4" />
              New Proposal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none ring-ring/50 focus-visible:ring-2">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {user.email} · {user.role === "ADMIN" ? "Admin" : "Member"}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "ADMIN" ? (
                  <DropdownMenuItem render={<Link href="/settings" />}>
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
