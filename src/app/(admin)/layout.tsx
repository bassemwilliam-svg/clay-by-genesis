import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Role-gated admin: product CRUD, asset/version upload, course builder, orders,
// bundles, taxonomy. EDITOR or ADMIN required.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("EDITOR");
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4 md:px-10">
        <Link href="/admin" className="font-semibold tracking-tight">
          Clay <span className="text-muted-foreground">· Admin</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground">
            Overview
          </Link>
          <Link href="/admin/products" className="hover:text-foreground">
            Products
          </Link>
          <Link href="/admin/homepage" className="hover:text-foreground">
            Homepage
          </Link>
          <Link href="/admin/assets" className="hover:text-foreground">
            Assets
          </Link>
          <Link href="/admin/courses" className="hover:text-foreground">
            Courses
          </Link>
          <Link href="/admin/orders" className="hover:text-foreground">
            Orders
          </Link>
          <Link href="/admin/stats" className="hover:text-foreground">
            Stats
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
