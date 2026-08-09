"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { brandToast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addUser, setUserActive, setUserRole } from "@/actions/users";
import { UserPlus } from "lucide-react";

const ROLE_ITEMS = [
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
] as const;

export interface TeamUserRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  avatarUrl: string | null;
  lastLoginLabel: string | null;
  isYou: boolean;
}

export function TeamSettings({ users }: { users: TeamUserRow[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ADMIN" | "MEMBER">("MEMBER");
  /* Per-control pending key ("<userId>:role", "<userId>:active", "add") — only the
     clicked control spins and only its row locks, never the whole panel. */
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string
  ) {
    setBusyKey(key);
    try {
      const result = await action();
      if (!result.ok) {
        brandToast("error", result.error ?? "That didn't work.");
        return;
      }
      brandToast("success", success);
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Anyone here can sign in with their rsla.io Google account. Members can create and send
          proposals. Admins can also void, manage the team, and change settings.
        </p>

        <div className="divide-y divide-border rounded-xl border border-border">
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {user.name}
                    {user.isYou ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                    <Badge
                      variant="secondary"
                      className={
                        user.role === "ADMIN"
                          ? "border-0 bg-accent text-accent-foreground"
                          : "border-0 bg-muted text-muted-foreground"
                      }
                    >
                      {user.role === "ADMIN" ? "Admin" : "Member"}
                    </Badge>
                    {!user.active ? (
                      <Badge variant="secondary" className="border-0 bg-rose-100 text-rose-700">
                        Access removed
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                    {user.lastLoginLabel ? ` · last sign-in ${user.lastLoginLabel}` : " · hasn't signed in yet"}
                  </p>
                </div>
              </div>
              {!user.isYou ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyKey === `${user.id}:role`}
                    disabled={
                      (busyKey !== null && busyKey.startsWith(`${user.id}:`)) || !user.active
                    }
                    onClick={() =>
                      run(
                        `${user.id}:role`,
                        () =>
                          setUserRole({
                            userId: user.id,
                            role: user.role === "ADMIN" ? "MEMBER" : "ADMIN",
                          }),
                        "Role updated"
                      )
                    }
                  >
                    Make {user.role === "ADMIN" ? "member" : "admin"}
                  </Button>
                  <Button
                    size="sm"
                    variant={user.active ? "destructive" : "secondary"}
                    loading={busyKey === `${user.id}:active`}
                    disabled={busyKey !== null && busyKey.startsWith(`${user.id}:`)}
                    onClick={() =>
                      run(
                        `${user.id}:active`,
                        () => setUserActive({ userId: user.id, active: !user.active }),
                        user.active ? "Access removed" : "Access restored"
                      )
                    }
                  >
                    {user.active ? "Remove access" : "Restore"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="h-4 w-4 text-primary" /> Add a teammate
          </p>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
            <div className="col-span-2 sm:col-span-4">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First Last" />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <Label className="text-xs">rsla.io email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@rsla.io"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label className="text-xs">Role</Label>
              <Select
                items={ROLE_ITEMS}
                value={role}
                onValueChange={(value) => setRole(value as "ADMIN" | "MEMBER")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Button
                className="w-full"
                loading={busyKey === "add"}
                disabled={!name.trim() || !email.trim()}
                onClick={() =>
                  run(
                    "add",
                    () => addUser({ name, email, role }),
                    "Teammate added. They can sign in now."
                  ).then(() => {
                    setName("");
                    setEmail("");
                    setRole("MEMBER");
                  })
                }
              >
                Add
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            No invite email needed. Once added, they sign in at proposals.rsla.io with Google.
            Passwords and profile photos live in their Google account.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
