import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Auth-gated area: library, downloads, orders/invoices, course player,
// settings. Gating happens once here via requireUser().
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4 md:px-10">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-semibold tracking-tight">Clay</span>
          <span className="mono-label text-[0.625rem]">by Genesis</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/library" className="hover:text-foreground">
            Library
          </Link>
          <Link href="/learn" className="hover:text-foreground">
            My learning
          </Link>
          <Link href="/orders" className="hover:text-foreground">
            Orders
          </Link>
          <Link href="/settings" className="hover:text-foreground">
            Settings
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
