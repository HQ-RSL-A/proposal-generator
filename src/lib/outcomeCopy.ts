import { formatCents } from "@/lib/currency";

/**
 * Shared copy for the post-sign outcome screens. /sign/[token]/paid and /pay/[token]
 * render the same situations, so the strings live here to stop them drifting. Payment
 * messaging is keyed to STATUS (confirmed vs still clearing), never to the payment
 * METHOD — no card-vs-bank wording anywhere.
 */
export const OUTCOME_COPY = {
  invalidLink: {
    title: "This link isn't valid",
    body: "Check the most recent email from RSL/A, or ask for a fresh link.",
  },
  paymentConfirmed: {
    title: "You're all set",
    body: "Your payment came through, and your fully signed agreement is in your inbox, so everything you agreed to is already in your hands.",
  },
  paymentProcessing: {
    title: "Your payment is on its way",
    body: "It's clearing now, which can take a day or two. We'll email you the moment it lands, and there's nothing more you need to do.",
  },
} as const;

/**
 * Confirmed-payment copy for a deposit deal: the deposit landed, but a balance and any
 * retainer follow later, so it must not read "paid in full".
 */
export function depositPaidCopy(input: {
  remainingCents: number | null;
  deferredRecurringDisplay: string | null;
}): { title: string; body: string } {
  const remainingLine =
    input.remainingCents != null
      ? `The remaining ${formatCents(input.remainingCents)} is collected when the build is complete.`
      : "The rest of the build fee is collected when the build is complete.";
  const retainer = input.deferredRecurringDisplay
    ? ` Your ${input.deferredRecurringDisplay} retainer starts when work begins.`
    : "";
  return {
    title: "Deposit received, we're underway",
    body: `Your deposit came through, and your signed agreement is in your inbox. ${remainingLine}${retainer}`,
  };
}
