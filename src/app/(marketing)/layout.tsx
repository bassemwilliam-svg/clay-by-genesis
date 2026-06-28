import Link from "next/link";
import { ConciergeWidget } from "@/components/concierge/concierge-widget";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 md:px-10">
          <Link href="/" className="flex items-baseline gap-2.5">
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
              href="/pricing"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <span className="text-sm text-muted-foreground">
            Start with clay. Ship a world.
          </span>
          <span className="mono-label text-[0.5625rem]">
            © {new Date().getFullYear()} CLAY BY GENESIS · ALL SYSTEMS NOMINAL
          </span>
        </div>
      </footer>

      <ConciergeWidget />
    </div>
  );
}
