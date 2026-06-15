import { prisma } from "@/lib/prisma";
import { gateToken } from "@/lib/partyTokens";
import { sectionsFromFrozen, buildProposalSections } from "@/lib/proposalContent";
import { frozenPaymentConfig, frozenTokens, frozenTrackRecord } from "@/lib/signingService";
import { formatDate, formatDateTime } from "@/lib/dates";
import { isSignOnly, type FrozenContent } from "@/lib/types";
import { SigningExperience } from "@/components/signing/signingExperience";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import type { SignerSlot } from "@/components/proposal/proposalView";
import { Button } from "@/components/ui/button";
import { Archive, CalendarClock, CheckCircle2, Landmark, Link2Off, MailX } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SigningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gate = await gateToken(token);

  if (!gate.ok) {
    if (gate.reason === "expired") {
      return (
        <OutcomeCard icon={CalendarClock} tone="wait" title="This proposal has expired">
          <p>
            The signing window for this proposal has closed. Reach out and we&apos;ll send a fresh
            version if the engagement is still on the table.
          </p>
        </OutcomeCard>
      );
    }
    if (gate.reason === "voided") {
      return (
        <OutcomeCard icon={Archive} tone="neutral" title="This proposal was withdrawn">
          <p>This version is no longer active. If a revised proposal is coming, it will arrive by email.</p>
        </OutcomeCard>
      );
    }
    if (gate.reason === "declined") {
      return (
        <OutcomeCard icon={MailX} tone="neutral" title="This proposal was declined">
          <p>This proposal has been declined and is no longer open for signing.</p>
        </OutcomeCard>
      );
    }
    return (
      <OutcomeCard icon={Link2Off} tone="neutral" title="This link isn't valid">
        <p>
          It may have been replaced by a newer email. Check the most recent message from RSL/A, or
          ask for a fresh link.
        </p>
      </OutcomeCard>
    );
  }

  const party = gate.party;
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: party.proposalId },
    include: {
      parties: { orderBy: { orderIndex: "asc" } },
      signatures: true,
      msaVersion: true,
    },
  });

  const config = frozenPaymentConfig(proposal);
  const signOnly = isSignOnly(config);

  // Already signed → status page (payer gets a payment CTA while checkout is open).
  if (party.signedAt) {
    const paymentOpen =
      proposal.status === "SIGNED" &&
      ["AWAITING", "SESSION_EXPIRED", "FAILED"].includes(proposal.paymentStatus);
    const finalDoc =
      proposal.status === "SIGNED"
        ? await prisma.generatedDocument.findFirst({
            where: { proposalId: proposal.id, isFinal: true },
            select: { id: true },
          })
        : null;
    return (
      <OutcomeCard icon={CheckCircle2} tone="success" title="You've signed this proposal">
        <p>
          You signed on {formatDateTime(party.signedAt)}.{" "}
          {proposal.status === "SIGNED"
            ? "All parties have signed. Your executed copy was emailed to you."
            : "We're waiting on the remaining signatures; you'll get the executed copy by email once everyone has signed."}
        </p>
        {paymentOpen && party.payer ? (
          <div className="pt-3">
            <Button className="w-full" nativeButton={false} render={<a href={`/pay/${token}`} />}>
              Complete payment
            </Button>
          </div>
        ) : null}
        {finalDoc ? (
          <div className="pt-3">
            <Button
              className="w-full"
              variant={paymentOpen && party.payer ? "outline" : "default"}
              nativeButton={false}
              render={<a href={`/api/sign/${token}/document`} />}
            >
              Download your signed agreement
            </Button>
          </div>
        ) : null}
        {proposal.paymentStatus === "PROCESSING" && party.payer ? (
          <p className="flex items-center justify-center gap-1.5 font-medium text-foreground">
            <Landmark className="h-4 w-4" /> Your bank transfer is processing. No further action
            needed.
          </p>
        ) : null}
      </OutcomeCard>
    );
  }

  const frozen = proposal.frozenContent as unknown as FrozenContent | null;
  const sections = frozen
    ? sectionsFromFrozen(frozen, proposal.msaVersion.bodyMarkdown, proposal.selectedTierId)
    : buildProposalSections({
        tokens: frozenTokens(proposal),
        paymentConfig: config,
        trackRecord: frozenTrackRecord(proposal),
        msaBodyMarkdown: proposal.msaVersion.bodyMarkdown,
        selectedTierId: proposal.selectedTierId,
      });

  const signedIds = new Set(proposal.signatures.map((sig) => sig.partyId));
  const clientSlots: SignerSlot[] = proposal.parties
    .filter((p) => p.role === "CLIENT_SIGNER")
    .map((p) => ({
      name: p.name,
      detail: p.id === party.id ? "You" : frozenTokens(proposal)["Client.Company"],
      signedAt: p.signedAt ? formatDate(p.signedAt) : null,
      signatureImageUrl: signedIds.has(p.id) ? `/api/sign/${token}/signature/${p.id}` : null,
      isSelf: p.id === party.id,
    }));

  const rslaParty = proposal.parties.find((p) => p.role === "ADMIN_SIGNER");
  const rslaSlot: SignerSlot = {
    name: sections.acceptance.rslaName,
    detail: sections.acceptance.rslaTitle,
    signedAt: rslaParty?.signedAt ? formatDate(rslaParty.signedAt) : null,
    signatureImageUrl:
      rslaParty && signedIds.has(rslaParty.id)
        ? `/api/sign/${token}/signature/${rslaParty.id}`
        : null,
  };

  const initialAddOnIds = (proposal.selectedAddOnIds as unknown as string[] | null) ?? [];

  return (
    <SigningExperience
      token={token}
      sections={sections}
      paymentConfig={config}
      partyName={party.name}
      requiresTier={Boolean(config.tiers && config.tiers.length > 0 && !proposal.selectedTierId)}
      initialTierId={proposal.selectedTierId}
      initialAddOnIds={initialAddOnIds}
      willCheckout={!signOnly && party.payer}
      validUntilLabel={proposal.validUntil ? formatDate(proposal.validUntil) : null}
      clientSlots={clientSlots}
      rslaSlot={rslaSlot}
    />
  );
}
