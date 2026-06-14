"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

/*
 * Dev-only sign-in. Mints a real database Session row and sets the Auth.js
 * session-token cookie the Prisma adapter reads, so `auth()` resolves it like
 * any other login. Exists purely so the admin UI is demoable before the
 * magic-link (Resend) / OAuth providers are provisioned. Hard-gated to
 * non-production, it must never grant access in a deployed environment.
 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function devSignInAsEditor() {
  if (env.NODE_ENV === "production") {
    throw new Error("Dev sign-in is disabled in production.");
  }

  const user =
    (await prisma.user.findFirst({
      where: { role: { in: ["EDITOR", "ADMIN"] } },
      orderBy: { role: "desc" },
    })) ?? (await prisma.user.findFirst());

  if (!user) {
    throw new Error("No user to sign in as. Run the seed first.");
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  const cookieStore = await cookies();
  cookieStore.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires,
  });

  redirect("/admin");
}
