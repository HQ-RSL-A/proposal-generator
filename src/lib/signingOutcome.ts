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
