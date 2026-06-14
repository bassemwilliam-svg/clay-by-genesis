import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

/*
 * Route-gating helpers used by (account) and (admin) layouts. Centralizing the
 * checks here keeps gating logic out of individual pages and consistent across
 * the app. DB-backed sessions make these checks authoritative.
 */

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

const ROLE_RANK: Record<UserRole, number> = {
  BUYER: 0,
  EDITOR: 1,
  ADMIN: 2,
};

export function roleAtLeast(role: UserRole, minimum: UserRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function requireRole(minimum: UserRole) {
  const user = await requireUser();
  if (!roleAtLeast(user.role, minimum)) {
    redirect("/");
  }
  return user;
}

/**
 * Non-redirecting variant for route handlers: returns the user when authorized,
 * or null so the caller can respond with 401/403 instead of an HTML redirect.
 */
export async function authorizeRole(minimum: UserRole) {
  const session = await auth();
  const user = session?.user;
  if (!user || !roleAtLeast(user.role, minimum)) return null;
  return user;
}
