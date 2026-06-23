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

/**
 * A line label flows verbatim into the Stripe Checkout product name (product_data.name) and the
 * deposit line wraps it as `{pct}% deposit on {label}` (+~15 chars); Client.ProposalTitle flows
 * into the session metadata (500-char cap). MAX_LINE_LABEL_CHARS caps the SOURCE label the admin
 * types, leaving headroom for the deposit wrapper before STRIPE_MAX_PRODUCT_NAME_CHARS. Both fail
 * loud on SAVE so an over-long input never reaches a Stripe exception on the client's post-signature
 * pay attempt (RSL-36, sibling of the RSL-30 floor above).
 */
export const MAX_LINE_LABEL_CHARS = 200;
export const MAX_PROPOSAL_TITLE_CHARS = 200;

/** Stripe's product_data.name hard cap; the backstop guards the EFFECTIVE label
 * (incl. the deposit wrapper) against this, while MAX_LINE_LABEL_CHARS (200)
 * caps the admin-typed SOURCE label with headroom for the wrapper. */
export const STRIPE_MAX_PRODUCT_NAME_CHARS = 250;
