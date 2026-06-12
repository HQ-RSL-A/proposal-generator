import { get, put } from "@vercel/blob";

/**
 * All stored artifacts (signature PNGs, signed PDFs) live in a PRIVATE Blob
 * store. Auth is OIDC-based (BLOB_STORE_ID + VERCEL_OIDC_TOKEN): ambient on
 * Vercel, pulled locally via `vercel env pull`. No static RW token exists.
 */
export async function putPrivate(
  pathname: string,
  data: Buffer,
  contentType: string
): Promise<{ url: string; pathname: string }> {
  const result = await put(pathname, data, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url: result.url, pathname: result.pathname };
}

export async function fetchPrivateBlob(urlOrPathname: string): Promise<Buffer> {
  const result = await get(urlOrPathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob fetch failed for ${urlOrPathname}`);
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export const blobPaths = {
  signature: (proposalId: string, partyId: string) =>
    `proposals/${proposalId}/signatures/${partyId}.png`,
  signedPdf: (proposalId: string, versionNumber: number) =>
    `proposals/${proposalId}/v${versionNumber}/signed.pdf`,
  adminSignature: () => `settings/admin-signature.png`,
};
