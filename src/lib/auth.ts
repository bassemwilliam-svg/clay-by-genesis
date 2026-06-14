import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import type { MembershipTier, UserRole } from "@prisma/client";

/*
 * Auth.js (NextAuth v5) configuration.
 *
 * - Prisma adapter + DATABASE session strategy: sessions live in Postgres and
 *   are revocable (deleting the Session row logs the user out everywhere),
 *   which makes role/entitlement checks authoritative.
 * - Role is surfaced on the session for gating (BUYER / EDITOR / ADMIN).
 * - Providers are added at their milestones (magic-link with Resend in Stage 8,
 *   OAuth as needed). The config below is complete and type-checks today.
 * - Node runtime: we gate routes in (account)/(admin) layouts via `auth()`
 *   rather than edge middleware (Next 16 `proxy` has no edge runtime).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role: UserRole }).role;
        session.user.membershipTier = (
          user as { membershipTier: MembershipTier }
        ).membershipTier;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      membershipTier: MembershipTier;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    membershipTier: MembershipTier;
  }
}
