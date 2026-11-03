# Phase 1 Final Acceptance Gates — 3 November 2026

**Current decision: NOT READY TO CLOSE. Do not merge `feature/phase-1-foundation` into application `main`, switch to production, buy a tier, or restore into the live Supabase project.**

## Confirmed by automated tests

1. **Owner vs non-Owner Admin:** owner Google login previously succeeded; a separate real Google login reached `/login?error=unauthorized`, the callback route's explicit post-OAuth, post-`getUser` non-Owner signout. Auth logs corroborated a successful login at 15:50 UTC on 3 Nov. These validate the Admin gate, not the Storage HTTP API.
2. **RLS:** all nine application tables have RLS. Four private-media object policies require Owner authorization for SELECT/INSERT/UPDATE/DELETE. A read-only synthetic JWT-sub test with authenticated role returned `app_private.is_owner()=false` and zero visible Owner mapping.
3. **Backup:** private encrypted artifact `link-in-bio-encrypted-backup-7`, ID `13238095372`, generated in private [Actions #41649973610](https://github.com/omegapiammani-collab/link-in-bio-backups/actions/runs/41649973610). Expires 8 December 2026. Decrypt, checksums and all nine public tables/data/RLS isolated restore passed in private [Actions #41664320484](https://github.com/omegapiammani-collab/link-in-bio-backups/actions/runs/41664320484).
4. **Regression CI:** Next/vinext builds, offline fixture restore, and RLS checks have passing prior GitHub Actions runs.

## Hard blockers to final acceptance

### A. Storage HTTP end-to-end with a non-Owner identity

The Preview deliberately signs non-Owners out after OAuth, so Admin denial is **not** evidence that the private Storage REST API itself rejects that authenticated user. The private bucket currently has **zero objects**, so empty LIST results are insufficient to demonstrate that read/download is denied.

**Pass criteria:** With a real authenticated non-Owner JWT obtained in an authorized test context (never paste token into chat, source code, PR, or logs), confirm forbidden LIST of a known private object, forbidden DOWNLOAD for that exact known object, forbidden INSERT and UPDATE. Verify Owner can retrieve the same known object. The object should be a tiny disposable fixture (not personal data), created through the approved Owner workflow and removed after tests, after a newly encrypted backup proves it contains nonzero media bytes.

**Guardrail:** Do not modify production OAuth callback merely to make a non-Owner Storage token available; instead use a separate isolated Supabase test environment and test accounts, or a private, short-lived authorized test harness that never exposes JWTs. Do not use service-role keys for negative tests because they bypass RLS.

### B. Full Supabase-compatible Auth/Storage restore

An earlier isolated plain PostgreSQL 17 restore of actual `auth` and `storage` schemas failed during pre-data: missing Supabase-managed prerequisite roles, types, extensions/functions. This is a **documented failed acceptance**, not a passed restore. The public app's nine tables restored with *synthetic Auth stubs*, which do not prove Auth data, OAuth configuration, sessions, Storage service, policies, or object bytes.

**Pass criteria:** Use an isolated, version-compatible **Supabase local Docker stack** (not the live Supabase project), decrypt the archived data without exposing it in CI output, restore the compatible database schema/data and dependencies, confirm Auth record references, all nine app tables/RLS, bucket metadata/policies and genuine media object bytes via Storage API. Exercise Admin and non-Owner behaviors on the isolated stack. Supabase managed OAuth provider settings/secrets must be separately configured; the database dump alone cannot restore those. Record checksums/counts only, not identities or file contents.

**Reference docs:** 
- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/self-hosting/restore-from-platform

**Guardrail:** Supabase CLI's managed-to-self-hosted guidance recommends portable roles/schema/data dumps; raw `pg_dump` of managed `auth` and `storage` includes internal dependencies and may not be directly portable. Do not silently replace the first verified encrypted archive; retain it and test a reviewed, independently encrypted portable export on the private runner if needed. No new paid Supabase project or branch.

### C. Independent off-GitHub encrypted copy

Download the stored **encrypted** artifact from private [Actions #41649973610](https://github.com/omegapiammani-collab/link-in-bio-backups/actions/runs/41649973610) using the GitHub UI, extract only `link-in-bio-backup.tar.gz.gpg` from the ZIP, and copy the .gpg file to a separately controlled secure local/encrypted volume or private cloud drive **outside GitHub**. Keep the existing GPG recovery passphrase in the independent password manager. Do not store plaintext archive, passphrase and encrypted artifact together. Record file hash and an access/recovery test without exposing any secrets.

**Pass criteria:** a verified independent encrypted copy exists and can be decrypted with the independently saved passphrase. Before 8 December 2026.

### D. Provider configuration

Confirm Email Provider persisted disabled in Supabase Dashboard. Do not enable Email signup or rotate Google OAuth credentials merely to close the checklist.

## Completion rule

Phase 1 may be marked **complete** only after A–D have independently documented evidence, the Backup artifact is securely retained, and the final CI remains green. Passing RLS policy SQL checks, a synthetic nonempty media fixture, or a successful Admin denial alone does **not** waive the real Auth/Storage recovery requirement. Until then, PR #1 remains Draft and unmerged.

## User-reported operational steps — 3 November 2026

- [x] **Reported by the user**: downloaded the backup artifact and stored a copy outside GitHub. This is **not independently verified** by a file hash or a separate decryption attempt. The encryption recovery passphrase must remain available independently in the password manager.
- [x] **Reported by the user**: used the Google Owner account to run the Admin Storage smoke test. **Pass/fail output was not provided**, and the test deletes the temporary file after upload/download, so this report cannot be used as evidence of a nonempty *archived* Storage backup.
- [ ] **Off-GitHub verification**: confirm the offsite copy contains the original `link-in-bio-backup.tar.gz.gpg` (not just an empty ZIP or shortcut), verify SHA-256 against the extracted artifact, and perform one local decrypt/list test without logging or sharing the passphrase.
- [x] **Owner Storage end-to-end PASS (user-observed, 3 Nov 2026):** user explicitly confirmed the Preview Admin smoke test completed all four steps: upload, download, byte-for-byte comparison and deletion. This is a genuine Owner UI test reported by the user, not an independently captured HTTP transcript; test fixture was deleted, so **does not** prove a non-empty backup or non-Owner Storage denial.
- [ ] **True Non-Owner Storage HTTP** and **full Auth/Storage isolate** remain open.

### Local isolation procedure (never run on the live project)

Supabase supports a local Docker stack started with `supabase init` and `supabase start`. The current archive is a custom `pg_dump` of public/auth/storage and is **not identical** to a Supabase CLI-managed portable dump. Do not blindly `pg_restore` every managed schema over the CLI's initialized internal schemas.

A safe manual recovery exercise has the following **gated** order:

1. On a personal workstation or isolated CI host with Docker, create a disposable directory unrelated to the app's repository. Install a **pinned Supabase CLI** version. Inspect `supabase --help` and `supabase db --help` before proceeding.
2. Run `supabase init` then `supabase start` with a **local-only** project ID and default local credentials. Verify the local API and local Postgres ports; never substitute the live `mmbhuxiejfqipttyujop` URI in any restore command. Do not log in to/link the CLI to the live project.
3. In an isolated temporary directory, decrypt the **off-GitHub** `.tar.gz.gpg` using the recovery passphrase from the password manager, privately extract `database.dump` and `media-manifest.json`, and verify archive checksums and database catalog. Do not upload decrypted archives or commit them to Git.
4. Inspect the local Supabase-managed `auth`/`storage` schema and the dump's object list to build an **explicit, reviewed** compatibility plan (roles, extensions, triggers, constraints, versions). Restore only after checking target compatibility; preserve a clean local database snapshot so failed tests are disposable.
5. Apply `public` application tables/data and RLS in an isolated copy. Restore Auth/Storage only with a version-matched, Supabase-compatible plan. Verify Auth identities and Storage bucket metadata via local SQL **and** local API. External Google OAuth configuration, Google consent screen and JWT secrets are not contained in the database archive.
6. For media bytes, **never copy the downloaded bytes directly into the self-hosted storage filesystem**: use the supported Storage/S3 API to import them, then download again through the local API and compare SHA-256. Since the currently archived bucket contains 0 objects, perform a separately scoped **synthetic nonempty-media exercise** without replacing the existing verified archive. A test fixture cannot pretend to be a preexisting archived production object.
7. Run genuine local Owner and non-Owner authorization tests on list/download/insert/update/delete, then remove the disposable local stack and all plaintext files. Record only PASS/FAIL, versions, counts and hashes, not tokens or identities.

**Further evidence required**: a finished local restore log showing Auth/Storage service compatibility, role/RLS checks and actual object-byte recovery. A simple `pg_restore --list` or nine-table-only recovery does not satisfy these gates.

Official documentation:
- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3
