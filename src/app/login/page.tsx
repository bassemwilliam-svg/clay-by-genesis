import Link from "next/link";
import { env } from "@/lib/env";
import { devSignInAsEditor } from "./actions";

// Minimal sign-in placeholder. Real providers (magic-link via Resend, OAuth)
// are wired in their milestones; this exists so auth redirects have a target.
export default function LoginPage() {
  const devLogin = env.NODE_ENV !== "production";

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-32 text-center">
      <Link href="/" className="flex items-baseline gap-2.5">
        <span className="text-lg font-semibold tracking-tight">Clay</span>
        <span className="mono-label text-[0.625rem]">by Genesis</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-muted-foreground">
        Authentication providers are connected in a later milestone. The
        session, role, and gating infrastructure are already in place.
      </p>

      {devLogin ? (
        <form action={devSignInAsEditor} className="w-full">
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Dev sign-in as editor
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Development only, disabled in production.
          </p>
        </form>
      ) : null}
    </section>
  );
}
