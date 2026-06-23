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
 * A line label flows verbatim into the Stripe Checkout product name (product_data.name, ~250-char
 * cap) and the deposit line wraps it as `{pct}% deposit on {label}` (+~15 chars); Client.ProposalTitle
 * flows into the session metadata (500-char cap). Cap both well under those limits at authoring time
 * so an over-long admin input fails on SAVE with a humanized error, never as a Stripe exception on
 * the client's pay attempt after they have signed (RSL-36, sibling of the RSL-30 floor above).
 */
export const MAX_LINE_LABEL_CHARS = 200;
export const MAX_PROPOSAL_TITLE_CHARS = 200;
