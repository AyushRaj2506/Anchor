# Anchor - College Second Brain

Anchor organizes academic resources and tasks, analyzes saved content, and answers questions grounded in a user's own knowledge.

[Live app](https://anchor-lime-two.vercel.app/) | [Repository](https://github.com/AyushRaj2506/Anchor)

## Architecture

- React 19 and Vite frontend, deployed to Vercel.
- **Supabase only** for authentication, PostgreSQL data and private file storage.
- Email/password login, signup with confirmation handling, password reset and a recovery form.
- `resources` and `tasks` PostgreSQL tables: user-owned primary keys, indexed timestamps and flexible JSONB document fields.
- Row-level security restricts records to `auth.uid()`. The atomic update RPC also checks the expected owner to reject stale writes after account switching.
- Seven authenticated Vercel endpoints verify Supabase access tokens and handle Gemini or privileged storage operations.
- Private `anchor-resources` bucket with signed upload/download URLs and strict owned-path checks.
- Server-side Gemini REST calls with bounded requests, JSON parsing and validated sources.

There is no Firebase SDK or Firebase service dependency in the running application. Vercel still hosts the frontend/API, and Gemini still provides AI generation.

## Features

Save PDFs, JPEG/PNG/WebP images, notes, documents, URLs, email text and Google Drive links. Organize them using categories, filters, search and bookmarks. Analyze content for summaries, facts, explicit actions and deadlines. Manage To Do, In Progress and Completed tasks; ask grounded questions with validated citations.

Demo mode uses local sample data, resets on reload and labels its knowledge previews. Real AI and private files require authentication. A saved email or Drive link is not an inbox or Drive synchronization integration.

## Local setup

Use Node.js 22.12+ or a compatible Node.js 24 release.

```bash
npm ci
```

Copy `.env.example` to `.env.local`. Configure:

```text
# Public browser configuration
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

# Server-only configuration
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GEMINI_MODEL                 # optional primary model
GEMINI_FALLBACK_MODEL        # optional; empty disables fallback
SUPABASE_ANON_KEY            # optional; defaults to VITE_SUPABASE_ANON_KEY
```

The browser key must be a Supabase publishable/anonymous key, never a service-role or secret key. Private keys must not use the `VITE_` prefix. Keep them in `.env.local` and Vercel server environment settings.

Apply the SQL files in `supabase/migrations/` in filename order using the Supabase SQL editor or migration tooling. They create the tables, indexes, RLS policies and atomic update function. The repository project has already had these migrations applied. Do not reapply CREATE statements manually to that database.

Create/resume the private `anchor-resources` bucket, set its file size cap to 20 MB (`20971520` bytes), and allow `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. The backend signs only paths owned by the verified Supabase UID. Objects are not publicly exposed.

In Supabase Authentication URL Configuration, set the Site URL to the deployed app and allow the local development origin and deployed origin (including the recovery callback `/?recovery=1`). Configure email delivery for confirmation/reset emails. New accounts follow the project's confirmation policy; the UI handles confirmation-required signup. Migration preserved previously allowed sign-in behavior for existing accounts with the owner's approval.

```bash
npm run dev
npm run build
npm run preview
```

Vite development/preview middleware serves the same seven known API routes, limits JSON bodies and returns JSON errors for unknown routes. Restart it after editing handlers or environment configuration. Missing client configuration leaves demo access available.

## Data and consistency

`src/services/database.js` performs Supabase CRUD. Record adapters preserve the existing UI shape. SQL timestamps are read as Dates; document-specific fields remain JSONB. Updates merge fields atomically in PostgreSQL and bind both `auth.uid()` and the expected account ID.

Generated task IDs hash a resource ID and normalized action title. A composite primary key and conflict-safe insert ensure concurrent/retried generation creates one task without overwriting an existing task's progress. This is scoped idempotency, not semantic duplicate detection. Yearless deadlines stay as text; valid date-only deadlines use the end of the local day.

Cross-provider file/metadata operations still need failure handling: PostgreSQL and Storage requests are not one atomic transaction. Failed forms retain input; incomplete operations report errors rather than claiming success.

## AI behavior

All AI routes require a verified Supabase token. Gemini runs server-side. Text, public-URL content and actual supported file bytes can be analyzed. JSON mode is followed by application-level shape/size validation. A configured fallback model can be tried once for quota/unavailability within the remaining request budget.

Large-file generation has a 90-second budget, client requests allow 110 seconds, and AI functions allow 120 seconds. URL retrieval blocks private/reserved addresses, validates redirects, pins approved IPs and bounds time/body size. Protected or JavaScript-only pages can remain unreadable.

Knowledge retrieval uses weighted lexical matching, not an embeddings database. Context is bounded to eight resources and eight tasks; at most two owned supported files may be attached. Source IDs are validated against supplied context. Current context text is client-supplied; server-owned document retrieval would strengthen provenance.

## Verification

```bash
npm run lint
npm test
npm run build
npm run check:api
npm audit --omit=dev --audit-level=moderate
```

CI performs these checks on Node 22 and 24, including real handler imports after pruning development dependencies. `npm run coverage` measures frontend, API and shared server code.

The opt-in live integration check creates synthetic accounts, records and a PDF, tests password login, RLS isolation, owner guards, concurrent merges/task deduplication, AI, private upload/download, grounded answers and password recovery, then removes its known test data. Recovery is tested with generated tokens without sending email. It consumes real AI quota.

```bash
# Set ANCHOR_TEST_URL to a running local or deployed app first.
npm run test:integration
```

## Deployment and migration

Vercel's build configuration contains only the public project URL and anonymous key. Server secrets remain in environment settings. A Supabase-only build no longer needs the earlier Firebase require-ESM workaround.

See [Supabase migration notes](docs/SUPABASE_MIGRATION.md) for import/rollback details and [the historical audit](docs/AUDIT.md) for earlier repair work. Existing local PDF documentation describes the previous Firebase/Supabase architecture and predates this migration.
