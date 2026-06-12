import crypto from "crypto";

/**
 * Signing tokens: 32 random bytes (256 bits) as hex. The raw token only ever
 * exists in the emailed URL; the DB stores its SHA-256. Lookup is by hash —
 * a 256-bit random value cannot be brute-forced, so a fast hash is correct here.
 */
export function generateSigningToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Tokens are 64 hex chars; reject anything else before touching the DB. */
export function isWellFormedToken(raw: string): boolean {
  return /^[0-9a-f]{64}$/.test(raw);
}

export function signingUrl(rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1235";
  return `${base}/sign/${rawToken}`;
}

export function paymentUrl(rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1235";
  return `${base}/pay/${rawToken}`;
}
