# Supabase-only migration

## Implemented design

Supabase Auth replaces Firebase Authentication. Supabase PostgreSQL resources/tasks tables replace Firestore. Existing private Storage remains on Supabase. Vercel and Gemini keep their hosting/generation roles.

Resource/task documents retain flexible JSONB fields. Relational columns enforce user ownership, composite record identity and indexed creation timestamps. RLS applies to every table. `anchor_update_record` merges JSONB atomically and checks the caller's expected UID before modifying data, protecting against account-switch races with colliding record IDs.

## Existing data

The migration exported eight legacy accounts, twelve resources and eleven tasks to an ignored local backup. Existing Firebase SCRYPT hashes were converted from base64url to standard padded base64 for Supabase's importer. An end-to-end synthetic test proved that the original password works after import. No plaintext existing password was read or required.

The owner explicitly chose to preserve existing immediate sign-in behavior. Imported accounts are confirmed for Supabase login, while trusted app metadata retains the original email-verification flag and legacy UID. New signups follow the Supabase project's own confirmation setting.

Four private files were copied to paths prefixed by their new Supabase UID. Resource paths were rewritten. Imported rows were compared against the export. Original Firebase accounts/documents and old file objects remain intact for rollback; no existing production data was deleted.

The ignored `.migration.local/` directory contains the sensitive backup and UID map. Never commit, upload or share it. Public repository migration helpers contain no exported accounts, credentials or hashes.

## Reproducibility

1. Export legacy account records, per-account resources/tasks, and the project's SCRYPT configuration through an authorized admin environment. Store the result locally in `.migration.local/firebase-backup.json` with `hashConfig`, `users`, and `data` arrays. The running app no longer needs Firebase dependencies.
2. Apply `supabase/migrations/` in order to a fresh target.
3. Run `node scripts/migrate-to-supabase.mjs` for preflight only.
4. Use `--run` to import. `--confirm-existing` is an explicit policy choice for preserving unverified-email login; do not add it without the owner's authorization.
5. The importer resumes by trusted legacy UID metadata, refuses unrelated email collisions, preserves existing rows rather than overwriting changed data, and never deletes legacy objects. A changed source export needs reconciliation before retrying conflicting rows.
6. Verify counts/content, file integrity, real password compatibility and independent-account RLS before cutover. Coordinate a quiet cutover or enforce a write freeze for an actively used production app; the importer does not provide continuous dual-write synchronization.

## Verification performed

The final local suite passed 142 tests across 16 files; lint, build and real API startup passed. The complete dependency audit reported zero vulnerabilities at verification.

- Original-password compatibility tested with disposable accounts and cleaned up.
- Supabase account/data/file import compared against the source export.
- Real frontend auth/database modules exercised against Supabase: restoration/token, CRUD, timestamp normalization, stale-owner denial and concurrent generated-task deduplication.
- Live local API workflow passed: password authentication, PostgreSQL CRUD, anonymous/cross-account denial, atomic concurrent merges, signed private uploads/downloads, PDF/text/URL AI, grounded citations, file deletion and recovery-token/new-password sign-in.
- Synthetic data was cleaned up. These checks do not read existing users' knowledge content beyond the authorized migration comparison.

## Rollback and operating notes

A code rollback to the earlier Git commit restores Firebase-backed behavior; legacy accounts, records and original paths remain available. New Supabase-only writes after cutover are not automatically copied back to Firebase. Reconcile them before any rollback so new work is not hidden or lost. Do not retire or delete Firebase project data merely because the app no longer uses it.

Auth confirmation/reset callbacks require correct Supabase Site URL/redirect allowlists and working email delivery. The owner confirmed the deployed/local redirect URLs were updated and that only default email delivery is configured. The integration test verifies recovery tokens and allowed callbacks without sending email; it does not prove SMTP delivery to every real recipient. Unrestricted confirmation/reset delivery remains dependent on custom SMTP configuration.

The Supabase security advisor reports that leaked-password protection is disabled. This is separate from RLS and token verification; configure it according to the project's plan and policy: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Production cutover is recorded in the release response after successful deployment checks. Do not infer deployment from a successful local build.
