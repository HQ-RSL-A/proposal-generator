// DB-verified orphaned-blob sweep for the private Vercel Blob store.
//   Dry-run (default):  npx tsx scripts/blobSweep.ts
//   Delete orphans:     APPLY=1 npx tsx scripts/blobSweep.ts
//
// An orphan is a `proposals/{id}/...` blob whose `{id}` has NO matching Proposal row.
// `settings/` (the saved admin-signature template) is never listed or touched. Never
// bulk-deletes the `proposals/` prefix. Auth uses BLOB_READ_WRITE_TOKEN from .env
// (a dashboard-minted RW token; local OIDC is dev-scoped and 403s — see BRAIN Gotchas).
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { list, del } from "@vercel/blob";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const APPLY = process.env.APPLY === "1";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  // 1. List every blob under proposals/ (paginate).
  const blobs: { pathname: string; url: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: "proposals/", cursor, limit: 1000 });
    for (const b of res.blobs) blobs.push({ pathname: b.pathname, url: b.url, size: b.size });
    cursor = res.cursor;
  } while (cursor);

  // 2. Group by the {id} segment: proposals/{id}/...
  const byId = new Map<string, typeof blobs>();
  for (const b of blobs) {
    const id = b.pathname.split("/")[1];
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(b);
  }
  const ids = [...byId.keys()];

  // 3. Which ids still exist as Proposal rows?
  const existing = new Set(
    (await prisma.proposal.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id)
  );

  const keptIds = ids.filter((id) => existing.has(id)).sort();
  const orphanIds = ids.filter((id) => !existing.has(id)).sort();
  const sz = (arr: typeof blobs) => arr.reduce((n, b) => n + b.size, 0);
  const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;

  console.log(`Mode: ${APPLY ? "APPLY (will delete)" : "DRY-RUN (no deletion)"}`);
  console.log(`proposals/ blobs: ${blobs.length} across ${ids.length} proposal id(s)\n`);

  console.log(`KEPT — live Proposal rows (${keptIds.length} id, ${blobs.filter((b) => existing.has(b.pathname.split("/")[1])).length} blobs):`);
  for (const id of keptIds) {
    const arr = byId.get(id)!;
    console.log(`  KEEP ${id}  ${arr.length} blob(s) ${kb(sz(arr))}`);
  }

  const orphanBlobs = orphanIds.flatMap((id) => byId.get(id)!);
  console.log(`\nORPHANS — no Proposal row (${orphanIds.length} id, ${orphanBlobs.length} blobs, ${kb(sz(orphanBlobs))}):`);
  for (const id of orphanIds) {
    const arr = byId.get(id)!;
    console.log(`  ORPHAN ${id}  ${arr.length} blob(s) ${kb(sz(arr))}`);
    for (const b of arr) console.log(`         ${b.pathname}`);
  }

  if (APPLY && orphanBlobs.length) {
    console.log(`\nDeleting ${orphanBlobs.length} orphan blob(s)...`);
    const urls = orphanBlobs.map((b) => b.url);
    for (let i = 0; i < urls.length; i += 100) {
      await del(urls.slice(i, i + 100));
      console.log(`  deleted ${Math.min(i + 100, urls.length)}/${urls.length}`);
    }
    console.log("Done. Re-run dry to confirm orphans are gone.");
  } else if (!APPLY && orphanBlobs.length) {
    console.log(`\n(DRY-RUN) Re-run with APPLY=1 to delete the ${orphanBlobs.length} orphan blob(s) above.`);
  } else {
    console.log("\nNo orphans to delete.");
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
