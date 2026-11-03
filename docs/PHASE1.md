# Phase 1 — Foundation & Security

## Completed locally
- Next.js 16 / React 19 / Tailwind CSS 4 project skeleton, Thai homepage, restricted Owner dashboard.
- Google OAuth via Supabase Auth (SSR cookie sessions, PKCE callback route).
- Owner-only server identity check (fail closed when not configured).
- Initial PostgreSQL schema + RLS for all core data tables (migration prepared but NOT applied).
- Baseline slug and schedule validation + Node tests.
- GitHub Actions CI draft and environment example.

## Not complete / not claimed
- No npm dependencies installed in this environment; `npm run build` and TypeScript checks not verified.
- No Cloudflare deployment or runtime compatibility test; no Cloudflare or Supabase accounts connected here.
- No Google Cloud OAuth credentials configured; no real sign-in executed.
- No migration applied to production or development Supabase.
- Full RLS integration tests, rate limiting, file scanning, audit writing and backup automation are outstanding.
- Public renderer/blocks/editor/publishing are later phases.

## First-time setup
1. GitHub repository is `omegapiammani-collab/link-in-bio`; Phase 1 is proposed via pull request.
2. Create Supabase Free project and configure a Google OAuth Client in Google Auth Platform.
3. In Google OAuth client, add the Supabase Auth callback URL from Supabase Google provider settings; configure Supabase Site URL and allowed redirect `http://localhost:3000/auth/callback` for local testing.
4. Copy `.env.example` to `.env.local` and enter Supabase URL and public publishable key. Never expose the service-role key to a browser or commit it.
5. Run `npm install` (generates lockfile); `npm run check` and `npm run build`.
6. Review SQL migration and apply to a development Supabase project. First sign in with Google to create `auth.users` record; locate its UUID securely in the Supabase dashboard.
7. Bootstrap `owner_config` via the privileged SQL editor, and set `OWNER_AUTH_USER_ID` to that same UUID in server-only environment. Sign out and back in, test owner and non-owner accounts.
8. Deploy only after completing runtime compatibility spike, secrets management and RLS integration tests.

## Security notes
- The starter app does not include any privileged write API; browser code uses only the publishable key.
- `getUser()` checks identity with Supabase; the server validates the matching Owner UUID; DB RLS independently checks it.
- Do not cache authenticated responses or leak session cookies in shared CDN caches.
- Restrict OAuth redirect allowlist in production; avoid open redirect parameters.
- Only allow privileged bootstrap via SQL Editor, never from public routes.
- Never grant anonymous SELECT to draft or historic snapshot tables.
- The public renderer and its safe cached fallback need separate, reviewed public-read access design in Phase 2.
- This migration is a starting model and needs a live Supabase test before approval.
