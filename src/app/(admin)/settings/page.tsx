import { prisma } from "@/lib/prisma";
import { SignatureSettings } from "@/components/settings/signatureSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-bold">Settings</h1>
      <SignatureSettings
        hasSignature={Boolean(settings?.signatureBlobUrl)}
        adoptedName={settings?.signatureAdoptedName ?? "Rahul Lalia"}
      />
    </div>
  );
}
