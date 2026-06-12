// Roundtrip smoke test against the real private Blob store (OIDC auth).
// Run: npx vercel env pull && npx tsx scripts/blobSmoke.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { fetchPrivateBlob, putPrivate } from "../src/lib/blob";

async function main() {
  const payload = Buffer.from(`blob smoke ${new Date().toISOString()}`);
  const { url, pathname } = await putPrivate("smoke/test.txt", payload, "text/plain");
  console.log("put ok:", pathname);
  console.log("url shape:", url.replace(/[a-z0-9]{20,}/gi, "<id>"));

  const roundtrip = await fetchPrivateBlob(url);
  console.log("get by url ok:", roundtrip.equals(payload));

  const byPath = await fetchPrivateBlob("smoke/test.txt");
  console.log("get by pathname ok:", byPath.equals(payload));
}

main().catch((error) => {
  console.error("SMOKE FAILED:", error.message);
  process.exit(1);
});
