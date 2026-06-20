/**
 * How the signing client should react to a decline POST response. Pure + framework-free so the
 * routing logic is unit-tested without rendering the (heavy) signing experience. The component
 * wraps the fetch in a try/catch and maps the outcome to router.push / brandToast (RSL-32).
 */
export type SignOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "toast"; message: string };

export function declineOutcome(
  ok: boolean,
  data: { code?: string; error?: string; redirectUrl?: string },
  token: string
): SignOutcome {
  if (ok) return { kind: "redirect", url: data.redirectUrl ?? `/sign/${token}/declined` };
  // Mirror the sign flow: terminal states route to their page; everything else is a toast.
  switch (data.code) {
    case "already_signed":
      return { kind: "redirect", url: `/sign/${token}/signed` };
    case "expired":
      return { kind: "redirect", url: `/sign/${token}/expired` };
    case "declined":
      return { kind: "redirect", url: `/sign/${token}/declined` };
    default:
      return { kind: "toast", message: data.error ?? "Something went wrong" };
  }
}

/**
 * The plain-text restatement of what the client is agreeing to, shown in the e-sign consent modal.
 * Pure so this binding text is unit-testable. It reads the already-formatted displayStrings, which
 * carry the cadence for recurring lines (RSL-34) — so a discounted recurring tier reads "Growth at
 * $600/month", never a cadence-less "Growth at $600" that would present a retainer as one-time.
 */
export function buildSelectedSummary(input: {
  tiers:
    | {
        id: string;
        label: string;
        oneTime?: { displayString: string } | null;
        recurring?: { displayString: string } | null;
      }[]
    | null
    | undefined;
  selectedTierId: string | null | undefined;
  addOns: { id: string; label: string; displayString: string }[] | null | undefined;
  selectedAddOnIds: string[];
}): string | null {
  const tier = input.tiers?.find((t) => t.id === input.selectedTierId);
  const tierPart = tier
    ? (() => {
        const price = [tier.oneTime?.displayString, tier.recurring?.displayString]
          .filter(Boolean)
          .join(" + ");
        return `${tier.label}${price ? ` at ${price}` : ""}`;
      })()
    : null;
  const selectedAddOns = (input.addOns ?? []).filter((a) => input.selectedAddOnIds.includes(a.id));
  const addOnPart = selectedAddOns.length
    ? `add-ons: ${selectedAddOns.map((a) => `${a.label} (${a.displayString})`).join(", ")}`
    : null;
  const parts = [tierPart, addOnPart].filter(Boolean);
  return parts.length ? parts.join(", plus ") : null;
}
