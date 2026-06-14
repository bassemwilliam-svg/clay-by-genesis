# Clay by Genesis

An owned digital marketplace for procedural 3D assets, environment kits, and the
courses that teach them. Built by Genesis to sell its work directly: customizable,
engine-ready building blocks so creators are ready for whatever project comes next.

Full-stack Next.js app: catalog, faceted browse and search, an AI concierge
(Atlas), cart and Stripe checkout, webhook-driven entitlements, ownership-gated
expiring download URLs, a YouTube-backed LMS with quizzes, bundles, memberships,
and reviews. Ownership is materialized as `Entitlement` rows (the single source of
truth); money is stored as integer cents.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + TypeScript
- **PostgreSQL + Prisma 7** (engine-free, `@prisma/adapter-pg` driver adapter) + **pgvector**
- **Tailwind CSS v4** + shadcn/ui (Radix) + lucide-react
- **react-three-fiber / three.js** for the live configurator
- **Auth.js (NextAuth v5)** with the Prisma adapter and DB sessions (roles: BUYER / EDITOR / ADMIN)
- **Stripe** payments behind a provider-agnostic abstraction
- **Cloudflare R2 or AWS S3** for asset files (selected by `STORAGE_PROVIDER`)
- **Anthropic Claude API** for the Atlas concierge
- **Zod** for shared validation

## Getting started

Requires Node 20.12+ and a local PostgreSQL with the `pgvector` extension.

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL and AUTH_SECRET at minimum
npx prisma migrate dev       # apply migrations
npx prisma db seed           # seed catalog + demo data
npm run dev                  # http://localhost:3000
```

All environment variables are documented in `.env.example`. Nothing reads
`process.env` directly; access is centralized in `src/lib/env.ts`. Most integrations
(Stripe, Resend, Upstash, YouTube, R2/S3) degrade gracefully when unset, so the core
storefront runs with just `DATABASE_URL` and `AUTH_SECRET`.

## Deployment

### Full application (Vercel)

The app needs a Node runtime, a Postgres database, and the configured
integrations, so it deploys to Vercel (or any Node host), not to static hosting.

1. Push this repo to GitHub and import it on Vercel. The framework is auto-detected;
   `vercel.json` pins the build to `prisma generate && next build` and a `postinstall`
   hook regenerates the Prisma client on every fresh install.
2. Provision a Postgres database with `pgvector` (Neon, Supabase, or similar) and set
   `DATABASE_URL`.
3. Add the environment variables from `.env.example` in the Vercel project settings.
   At minimum: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`.
   Add Stripe / R2 / S3 / Anthropic / Resend / Upstash / YouTube keys to enable those
   features.
4. Run `prisma migrate deploy` against the production database (locally with the prod
   `DATABASE_URL`, or as a deploy step) before the first launch.

### Static landing (GitHub Pages)

`index.html` (the live configurator landing) and `clay-identity.html` (the brand
identity page) are fully self-contained static pages with no local asset
dependencies. To publish them on GitHub Pages:

1. In the repository Settings, under Pages, set the source to **Deploy from a
   branch**, branch `main`, folder `/ (root)`.
2. The root `.nojekyll` file disables Jekyll so the pages are served verbatim.
3. `index.html` becomes the published landing.

(If you prefer to isolate the Pages source from the app, move the two HTML files
into a `docs/` folder and point Pages at `main` / `docs`.)
