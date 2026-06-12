import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be set");
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  const msaPath = path.join(__dirname, "content", "msaV3.md");
  const bodyMarkdown = fs.readFileSync(msaPath, "utf8");
  const sha256 = crypto.createHash("sha256").update(bodyMarkdown, "utf8").digest("hex");

  const msa = await prisma.msaVersion.upsert({
    where: { version: "v3" },
    create: { version: "v3", bodyMarkdown, sha256 },
    update: {}, // immutable — never overwrite an existing version
  });
  console.log(`MsaVersion v3 ready (${msa.id}), sha256 ${sha256.slice(0, 12)}…`);

  await prisma.adminSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  console.log("AdminSettings singleton ready");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
