"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addUser, setUserActive, setUserRole } from "@/actions/users";
import { UserPlus } from "lucide-react";

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
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success(success);
      router.refresh();
    } finally {
      setBusy(false);
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
            <div key={user.id} className="flex items-center justify-between gap-3 p-3">
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
                    disabled={busy || !user.active}
                    onClick={() =>
                      run(
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
                    disabled={busy}
                    onClick={() =>
                      run(
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
          <div className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-4">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First Last" />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">rsla.io email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@rsla.io"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Role</Label>
              <select
                className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <Button
                className="w-full"
                disabled={busy || !name.trim() || !email.trim()}
                onClick={() =>
                  run(() => addUser({ name, email, role }), "Teammate added. They can sign in now.").then(
                    () => {
                      setName("");
                      setEmail("");
                      setRole("MEMBER");
                    }
                  )
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
