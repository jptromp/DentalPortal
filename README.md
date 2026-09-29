# Dental Design Portal

Case-management portal for a dental design service: clients (laboratories and practices) submit cases and download finished designs; the design team manages the workload in a separate admin area. See [the specification](Dental_Design_Portal_Development_Specification.md).

**Stack:** Next.js 16 · Neon Postgres + Drizzle ORM · Better Auth · Cloudflare R2 · Vercel

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm db:migrate              # apply migrations to the database in DATABASE_URL_UNPOOLED
pnpm db:seed                 # fictional demo data (see below)
pnpm dev
```

Environment variables are documented in [.env.example](.env.example).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Local development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Create a migration after editing `src/db/schema/` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Browse the database |
| `pnpm db:seed` | Seed demo data into an empty database |
| `pnpm db:seed --reset` | **Wipe all data** and reseed (demo databases only) |

## Demo mode

With `DEMO_MODE=true`:

- Emails are stored in the `email_outbox` table instead of being sent, and shown at `/demo-inbox`.
- Sign-in pages list the demo accounts. All use the password `DemoPortal2026!`.

Demo mode exposes sign-in links and passwords publicly. Turn it off before real clients use the system.

To send real email, set `RESEND_API_KEY` and `EMAIL_FROM` (requires a verified domain in Resend).

## File uploads

Scans and other case files go straight from the browser to the private R2 bucket as multipart uploads (16 MiB parts, three in parallel), so large files never pass through the web server. The flow is `POST /api/uploads` → `POST /api/uploads/:id/parts` (presigned part URLs) → `POST /api/uploads/:id/complete`, which checks the size and the file's leading bytes against its extension. Downloads go through `/api/files/:id`, which checks access, logs the download, and redirects to a 5-minute link.

- Accepted types and size limits are in `src/lib/files/rules.ts` and can be overridden with an `uploads` row in `app_settings`.
- The R2 bucket's CORS policy must allow `PUT` from every origin that uploads. Vercel preview URLs are not allowed yet, so uploads only work locally and on the production URL.
- **No malware scanner is connected.** Files stay `scanStatus = "pending"`; in demo mode they are downloadable and marked "Not scanned (demo)". With demo mode off, pending files cannot be downloaded or released until a scanner sets them to `clean`.
- Recommended: an R2 lifecycle rule that aborts incomplete multipart uploads after 7 days.

## Structure

- `src/db/schema/` — database tables; `drizzle/` — generated migrations
- `src/lib/auth.ts` — Better Auth configuration
- `src/lib/session.ts` — `requireClient` / `requireStaff` / `requireAdmin`; every protected page and action must use these
- `src/lib/queries/` — data access, always scoped by organisation for clients
- `src/lib/case-status.ts` — internal statuses, client-facing labels, and progress stages
- `src/app/portal/` — client portal; `src/app/admin/` — design team area
- `scripts/seed.ts` — demo data
