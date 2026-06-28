import Link from "next/link";
import { ConciergeWidget } from "@/components/concierge/concierge-widget";
import { CartNavLink } from "@/components/cart/cart-nav-link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Storefront chrome (browse, products, categories, courses, bundles, cart,
// checkout). Rendered with ISR; the concierge launcher is persistent across it.
// The shell reads like an instrument panel: a fixed top rail with a system
// readout, a thin coordinate strip, and a spec-sheet footer.
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 md:px-10">
          <Link href="/" className="group flex items-baseline gap-2.5">
            <span className="text-lg font-semibold tracking-tight">Clay</span>
            <span className="mono-label hidden text-[0.625rem] sm:inline">
              by Genesis
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/browse"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Browse
            </Link>
            <Link
              href="/courses"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Courses
            </Link>
            <Link
              href="/library"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Library
            </Link>
            <CartNavLink />
            <ThemeToggle />
          </nav>
        </div>
        {/* Coordinate strip, a hairline readout under the rail. */}
        <div className="flex items-center justify-between border-t border-border/60 px-6 py-1 md:px-10">
          <span className="mono-label text-[0.5625rem]">
            CATALOG / CLAY
          </span>
          <span className="mono-label hidden text-[0.5625rem] sm:inline">
            PROCEDURAL · CUSTOMIZABLE · ENGINE-READY
          </span>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-12 md:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="flex items-baseline gap-2.5">
                <span className="text-lg font-semibold tracking-tight">Clay</span>
                <span className="mono-label text-[0.625rem]">by Genesis</span>
              </span>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Start with clay, ship a world. Procedural building blocks you
                reshape into something unmistakably yours, engine-ready in
                minutes, not weeks.
              </p>
            </div>
            <FooterCol
              heading="Catalog"
              links={[
                { label: "Browse all", href: "/browse" },
                { label: "Courses", href: "/courses" },
                { label: "Your library", href: "/library" },
                { label: "Cart", href: "/cart" },
              ]}
            />
            <FooterCol
              heading="System"
              links={[
                { label: "Home", href: "/" },
                { label: "Sign in", href: "/login" },
              ]}
            />
            <div>
              <span className="mono-label">Spec</span>
              <dl className="mt-3 space-y-1.5 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>BUILD</dt>
                  <dd className="text-foreground/70">2026.06</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>ENGINE</dt>
                  <dd className="text-foreground/70">NEXT / RSC</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>STATUS</dt>
                  <dd className="text-primary/80">ONLINE</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-dashed border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="mono-label text-[0.5625rem]">
              © {new Date().getFullYear()} CLAY BY GENESIS · ALL SYSTEMS NOMINAL
            </span>
            <span className="mono-label text-[0.5625rem]">
              0,0 · {/* crop-mark origin */}
              <span className="text-primary/60">SHAPED</span>
            </span>
          </div>
        </div>
      </footer>

      <ConciergeWidget />
    </div>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <span className="mono-label">{heading}</span>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
