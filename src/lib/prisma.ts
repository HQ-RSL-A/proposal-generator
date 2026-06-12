import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Use pooler URL on production (Vercel can't resolve direct Supabase host)
  // Fall back to direct URL for local dev
  const connectionString = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DATABASE_URL_POOLER must be set");
  }
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
