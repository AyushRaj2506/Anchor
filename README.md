# Anchor — College Second Brain

Anchor organizes college resources and tasks, analyzes saved content, and answers questions grounded in a user's own knowledge.

[Live app](https://anchor-lime-two.vercel.app/) · [Repository](https://github.com/AyushRaj2506/Anchor)

## Features

- Firebase email/password authentication, password reset, and demo access.
- PDFs, JPEG/PNG/WebP images, notes, documents, URLs, emails, and Google Drive links.
- Library search, categories, filtering, bookmarks, and resource details.
- Gemini summaries, extracted content, action items, and deadlines.
- Tasks with priorities, deadlines, and To Do / In Progress / Completed columns.
- Grounded knowledge questions with validated resource/task citations.
- Responsive navigation, keyboard-accessible dialogs, and light/dark themes.

Demo resources and tasks are local samples. Changes reset on reload. Demo knowledge search returns a clearly labeled local preview; live AI and private file storage require an authenticated account.

## Architecture

- React 19 + Vite frontend.
- Firebase Authentication and user-scoped Firestore collections: `users/{uid}/resources` and `users/{uid}/tasks`.
- Firestore Lite for the app's online CRUD and transaction operations.
- Seven authenticated Vercel serverless endpoints under `api/`.
- Private Supabase bucket `anchor-resources` with signed upload/download URLs.
- Server-side Gemini REST requests in JSON mode, followed by application validation.
- Shared authentication, provider, path, and public-URL validation helpers under `server/`.

AI-generated task IDs are deterministic, and creation uses a Firestore transaction to prevent duplicates across retries and tabs. Incomplete dates retain the original text; the app does not invent a missing year.

## Local setup

Use Node.js **22.12+** or a compatible Node.js 24 release.

```bash
npm ci
```

Copy `.env.example` to `.env.local` and populate the configuration. Then run:

```bash
npm run dev
```

Vite serves the frontend and the same `/api/` handlers used by Vercel. The local middleware accepts only the seven known routes, limits JSON bodies, and returns JSON errors for invalid requests. Restart the server after changing backend handlers or environment variables.

For a production-build preview:

```bash
npm run build
npm run preview
```

The preview server also provides the local API middleware. Missing Firebase configuration leaves demo access available and shows a useful error when a real sign-in is attempted.

## Configuration

Client/build variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID  # optional
VITE_FIREBASE_STORAGE_BUCKET       # optional legacy Firebase Storage
VITE_FIREBASE_MEASUREMENT_ID       # optional; analytics is not initialized
```

Server variables:

```text
GEMINI_API_KEY
GEMINI_MODEL              # optional; defaults to gemini-2.5-flash
GEMINI_FALLBACK_MODEL     # optional; defaults to gemini-3.5-flash-lite; empty disables fallback
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FIREBASE_PROJECT_ID       # optional; defaults to VITE_FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Existing deployments can continue to use `VITE_SUPABASE_URL` instead of `SUPABASE_URL`. No Supabase anonymous key is needed by this implementation. Store the Firebase private key with escaped `\n` newlines as shown in `.env.example`.

Keep all private credentials in `.env.local` and Vercel's environment settings. Never prefix private keys with `VITE_` or commit them.

### Supabase

Create/resume the project and configure `anchor-resources` with:

- **Private** access.
- Maximum file size **20 MB** (`20971520` bytes).
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.

The bucket limit enforces the real uploaded size in addition to frontend/API validation. File extensions must match their MIME types. Storage paths are scoped to the verified Firebase UID and reject traversal and encoded/ambiguous segments. Supabase service credentials stay on the server.

If the Supabase hostname fails DNS resolution, check whether the project is paused. Resuming the project is necessary before uploads, previews, and file analysis can work.

### Firebase

Enable Email/Password in Firebase Authentication. Deploy `firestore.rules` to the matching Firebase project; the rules restrict each user's documents and subcollections to that user's UID. `storage.rules` is retained for legacy Firebase Storage and supports deleting owned files.

### AI and URL ingestion

All AI endpoints require a valid Firebase ID token. Requests have bounded durations and do not repeat the same failed generation call. A primary-model quota/unavailability response can switch once to the configured fallback model within the remaining request budget. If both models are unavailable, the app reports the error. Large-document analysis has a 90-second generation budget; Vercel AI functions allow 120 seconds. Rate-limit and timeout errors have explicit user-facing messages.

JSON mode is intentional: the provider's nested response-schema constraint repeatedly timed out during the live audit. The same analysis request completed in approximately 2–3 seconds using JSON mode with server-side field validation.

URL ingestion validates public addresses, checks redirects, pins the connection to a validated address, and limits time and streamed response size. A bounded public DNS-over-HTTPS fallback handles failures of the local OS resolver. Private/protected pages and pages requiring JavaScript may need to be pasted as notes.

## Verification

```bash
npm run lint
npm test
npm run coverage
npm run build
npm audit --omit=dev --audit-level=moderate
```

`npm test` runs once and exits. Use `npm run test:watch` for watch mode. Coverage includes frontend code, API handlers, and shared server helpers.

The regression suite covers authentication, account-switch races, failed saves, task creation/status, live statistics, malformed legacy data, unsafe links, knowledge retrieval, AI output validation, storage isolation, and URL network protections. GitHub Actions runs lint, tests, build, and the production dependency audit on Node.js 22 and 24.

An opt-in live integration check is also available:

```bash
npm run test:integration
```

Start the app on port 5173 first, or set `ANCHOR_TEST_URL` to the development/preview URL. The script uses your configured live services, creates one temporary account and synthetic note/task/PDF, tests the protected APIs, and cleans up its own known test data and account in `finally`. It makes billable Gemini requests. It does not read or delete existing user content.

See [the audit report](docs/AUDIT.md) for verified results, remaining external limitations, and deployment status. Historical Lighthouse report files are not presented as measurements of the current build.

## Deployment

Vercel detects the Vite frontend and the `api/` serverless functions. Configure the server and client variables in Vercel, then deploy the reviewed changes. `vercel.json` sets AI function duration and security/no-cache headers.

A local build or passing local integration check does not deploy changes to the linked production site. After deployment, rerun the integration check with `ANCHOR_TEST_URL` set to the deployed URL and verify the main browser flows.
