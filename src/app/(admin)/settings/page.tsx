import { requireAdmin } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignatureSettings } from "@/components/settings/signatureSettings";
import { TeamSettings, type TeamUserRow } from "@/components/settings/teamSettings";
import { SystemHealthPanel } from "@/components/settings/systemHealth";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireAdmin();
  const { tab } = await searchParams;
  const [settings, users] = await Promise.all([
    prisma.adminSettings.findUnique({ where: { id: "singleton" } }),
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
  ]);

  const teamRows: TeamUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    avatarUrl: user.avatarUrl,
    lastLoginLabel: user.lastLoginAt ? formatDate(user.lastLoginAt) : null,
    isYou: user.id === me.id,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-heading text-2xl font-bold">Settings</h1>

      <Tabs defaultValue={tab === "system" ? "system" : "general"}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-5 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.avatarUrl}
                  alt={me.name}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {me.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {me.name}
                  <Badge variant="secondary" className="border-0 bg-accent text-accent-foreground">
                    {me.role === "ADMIN" ? "Admin" : "Member"}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">{me.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Photo, name, and password come from your Google account. Change them there and
                  they update here on your next sign-in.
                </p>
              </div>
            </CardContent>
          </Card>

          <SignatureSettings
            hasSignature={Boolean(settings?.signatureBlobUrl)}
            adoptedName={settings?.signatureAdoptedName ?? "Rahul Lalia"}
          />

          <TeamSettings users={teamRows} />
        </TabsContent>

        <TabsContent value="system" className="pt-4">
          <SystemHealthPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
