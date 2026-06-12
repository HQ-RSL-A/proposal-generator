import { put } from "@vercel/blob";

/**
 * All stored artifacts (signature PNGs, signed PDFs) are private. Reads go
 * through server routes; private blob URLs are fetched with the RW token.
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

export async function fetchPrivateBlob(url: string): Promise<Buffer> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Blob fetch failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export const blobPaths = {
  signature: (proposalId: string, partyId: string) =>
    `proposals/${proposalId}/signatures/${partyId}.png`,
  signedPdf: (proposalId: string, versionNumber: number) =>
    `proposals/${proposalId}/v${versionNumber}/signed.pdf`,
  adminSignature: () => `settings/admin-signature.png`,
};
