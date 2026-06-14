import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireEnv } from "@/lib/env";

/*
 * Singleton Prisma client (Prisma 7).
 *
 * Prisma 7 is engine-free: it connects through a driver adapter rather than the
 * bundled Rust engine. We use @prisma/adapter-pg (node-postgres), which is
 * portable across Neon / Supabase / self-hosted Postgres, the concrete host
 * can be decided later without touching this file.
 *
 * The dev hot-reload guard prevents connection-pool exhaustion. The whole app
 * talks to Postgres only through this instance.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
