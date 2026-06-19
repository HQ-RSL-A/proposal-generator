/**
 * The one client-facing contact address. It is a Google group, so replies land
 * with the whole team. Personal addresses never appear on public surfaces.
 */
export const SUPPORT_EMAIL = "team@rsla.io";

/**
 * Stripe rejects a Checkout charge below $0.50 USD. Every charged line (a discounted net or a
 * deposit %) is floored at this at authoring time so a sub-50c charge fails loud on the admin
 * side, never on the client's pay attempt after they've signed (RSL-30).
 */
export const STRIPE_MIN_CHARGE_CENTS = 50;
