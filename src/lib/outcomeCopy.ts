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
