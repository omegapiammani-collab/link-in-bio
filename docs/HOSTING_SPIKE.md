# Cloudflare Workers Free — hosting compatibility gate

Cloudflare is the selected target. Next.js on Workers requires an actual runtime compatibility test before production use.

## Free constraints to measure (verify current documentation)
- Workers Free request and CPU limits; do not enable paid overages.
- Supabase Free can pause after low activity; no guaranteed uptime.
- Avoid expensive SSR at every request; prefer immutable published artifacts and cache where safe.

## Spike checklist (NOT executed)
1. Validate this Next.js app against current Cloudflare Workers Next.js compatibility guidance.
2. Deploy a preview Workers Free build with environment secrets set outside GitHub.
3. Test `/`, `/login`, `/auth/callback`, `/admin` and authorization rejection.
4. Test Supabase cookie/session behavior and redirects behind the edge runtime.
5. Inspect request CPU, memory, and free plan limits; test 10 pages × 20 blocks workload when renderer exists.
6. Test cold start, Safari iOS / Android browsers, cookie redirects and CSP.
7. Record Go/No-Go; if incompatible with free Workers, report to Owner BEFORE changing stack or enabling billing.

References:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/platform/limits/
- https://supabase.com/docs/guides/auth/server-side
