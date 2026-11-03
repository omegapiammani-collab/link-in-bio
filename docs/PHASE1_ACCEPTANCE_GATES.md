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
