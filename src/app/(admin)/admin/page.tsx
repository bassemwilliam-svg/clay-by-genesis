import Link from "next/link";

export default function AdminHomePage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Manage the catalog. Asset uploads, the course builder, bundles, and
        orders arrive in later stages.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/products"
          className="rounded-lg border border-border p-5 transition hover:border-ring hover:bg-muted/20"
        >
          <h2 className="font-semibold">Products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and edit products with per-category fields. Draft → Published
            → Archived.
          </p>
        </Link>
        <Link
          href="/admin/courses"
          className="rounded-lg border border-border p-5 transition hover:border-ring hover:bg-muted/20"
        >
          <h2 className="font-semibold">Courses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build course curricula, chapters, unlisted-video lessons, and
            graded quizzes that gate progress.
          </p>
        </Link>
        <Link
          href="/admin/homepage"
          className="rounded-lg border border-border p-5 transition hover:border-ring hover:bg-muted/20"
        >
          <h2 className="font-semibold">Homepage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit the marketing homepage: hero carousel slides and the
            full-width video separator.
          </p>
        </Link>
      </div>
    </section>
  );
}
