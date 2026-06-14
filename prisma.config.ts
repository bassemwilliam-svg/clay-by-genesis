import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config file. Load it via Node's
// built-in env-file loader (Node 20.12+), guarded so CI can inject env directly.
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No local env file; rely on the ambient environment.
  }
}

// Prisma 7 moved datasource/migration config out of schema.prisma into this file.
// The runtime client connects via a driver adapter (src/lib/db/prisma.ts);
// this config is what `prisma migrate` / `prisma db` use.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
