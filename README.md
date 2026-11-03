# Thai Link-in-Bio — Phase 1 starter

Single-User Multi-Page application foundation. Approved scope: v1.1, SRS v1.0.

**This is not a finished application and has not been deployed.** Cloudflare Workers Free + Supabase Free + GitHub Free + Google OAuth are the selected services. No paid plans.

## Requirements
Node.js 22+, npm, a Supabase Free project, Google OAuth credentials. Before real deployment, test Cloudflare Workers/vinext compatibility.

## Local setup
```sh
cp .env.example .env.local
npm install
npm run dev
npm run check
```

The OAuth sign-in works only after Supabase and Google are configured and the owner UUID is established. The database migration is **not** auto-applied.

Read `docs/PHASE1.md` and `docs/HOSTING_SPIKE.md` before making any cloud changes.

## Status
- Phase 1 scaffolding, first-pass schema, and unit-test baseline prepared.
- Cloud connection/configuration, live migrations, E2E, RLS tests, hosting spike and production deployment pending.