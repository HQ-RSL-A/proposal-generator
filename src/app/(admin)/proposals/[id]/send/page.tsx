import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/currency";
import { validatePaymentConfigForSend } from "@/lib/validation";
import { isManualInvoice, isSignOnly, type PaymentConfig, type TokensJson } from "@/lib/types";
import { clientFullName } from "@/lib/clientName";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendForm } from "@/components/proposals/sendForm";

export default async function SendPage({ params }: { params: Promise<{ id: string }> }) {
  // Re-validate here, not just in the (admin) layout — the page renders before the layout body
  // and otherwise fetches the draft + secret pricing ungated (RSL-26).
  await requireUser();
  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) notFound();
  if (proposal.status !== "DRAFT") redirect(`/proposals/${id}`);

  const tokens = proposal.tokens as unknown as TokensJson;
  const config = proposal.paymentConfig as unknown as PaymentConfig;
  const priceErrors = validatePaymentConfigForSend(config);
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  const signatureMissing = !settings?.signatureBlobUrl;

  const checkoutSummary = (() => {
    if (isManualInvoice(config))
      return "Manual invoice. Full pricing shows on the proposal, but no checkout runs — you'll invoice and mark it paid.";
    if (isSignOnly(config)) return "Sign-only. No checkout after signing.";
    if (config.tiers?.length) {
      return `Client picks one of ${config.tiers.length} tiers on the signing page; checkout charges the selected tier.`;
    }
    const parts: string[] = [];
    if (config.oneTime) parts.push(`${formatCents(config.oneTime.amountCents)} one-time`);
    if (config.recurring) parts.push(`${formatCents(config.recurring.amountCents)} recurring`);
    return `Checkout collects ${parts.join(" + ")} right after the final signature.`;
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Send proposal</h1>
        <p className="mt-1 text-sm text-muted-foreground">{proposal.title}</p>
      </div>

      {signatureMissing ? (
        <Alert variant="destructive">
          <AlertTitle>Saved signature missing</AlertTitle>
          <AlertDescription>
            Your signature auto-applies at send. Save it in Settings first. Sending is blocked
            until then.
          </AlertDescription>
        </Alert>
      ) : null}

      {priceErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Pricing mismatch</AlertTitle>
          <AlertDescription>{priceErrors.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What happens on send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Content is frozen and SHA-256 hashed. The legal record locks here.</p>
          <p>• Your signature is applied as RSL/A&apos;s execution of the agreement.</p>
          <p>• {checkoutSummary}</p>
          <p>
            • Valid until <strong className="text-foreground">{tokens["Client.ValidUntil"]}</strong>{" "}
            with automatic reminders at 3 days and 1 day before expiry.
          </p>
        </CardContent>
      </Card>

      <SendForm
        proposalId={proposal.id}
        defaultName={clientFullName(tokens["Client.FirstName"], tokens["Client.LastName"])}
        defaultEmail=""
      />
    </div>
  );
}
