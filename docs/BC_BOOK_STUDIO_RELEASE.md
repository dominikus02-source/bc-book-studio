# BC Book Studio — release runbook (BLOCKED)

Verified on 2026-11-04 (Asia/Jakarta). This is a release checklist, not release approval.

## Architecture and routing
- Public hostname: https://bcbookstudio.bahasacerdas.com
- Cloudflare zone: bahasacerdas.com; proxied DNS A -> 103.242.10.81.
- Cloudflare Access application: "BC Book Studio — Staging" (self_hosted), app id cddc9754-8955-48fc-b8b1-dba4b058bfe5.
- Access policy: "BC Book Studio staging — four approved testers", ALLOW limited to four approved email identities. Keep unchanged until explicit owner message **RILIS**.
- Preview-only tunnel "bc-book-studio-preview-pc" is inactive and associated with another hostname; do not assume it is staging ingress.
- VPS: bc-prod-01; shared production host. Existing staging deployment documentation reports only a phase-one verifier, not an actual Next.js + backend + isolated database runtime. Do not overwrite the verifier/authentication boundary.

## Deployment gates
1. Access VPS as existing authorized deploy operator `bcadmin`, with Docker permissions. Current Desktop Commander agent `bcagent` has no Docker socket access; avoid sudo escalation or group alterations.
2. Read-only baseline: `docker ps --no-trunc`, `docker stats --no-stream`, `free -h`, `df -h /`, `docker compose -p bc-book-studio-staging ps`; record current container IDs, image digests, bindings, restart policies, volumes and health. Confirm no other production services will be restarted.
3. Identify isolated Book Studio application's verified Compose/service definition, exact DB isolation, env key presence (never print values), backed-up target path, published localhost port and ingress route. Without these, STOP.
4. Before any schema migration: take a timestamped DB backup to an isolated protected directory, record path, size and restore verification; do not migrate with unverified backup.
5. Deploy only explicitly selected Book Studio Compose project/services, with CPU/RAM limits and restart policy. Make one change, capture before/after `docker ps` and resource stats, verify health, then proceed.
6. Test authenticated desktop/mobile Dashboard, Create Book, Library and Workspace: HTTP 200 and browser/server console clean; verify create/save/reload persisted data, sign-up/sign-in/sign-out if applicable, cross-user isolation, HTTPS/no mixed content, latency, automated repository tests.
7. Keep Access enabled through testing. Do not claim PASS without stored output.

## Rollback — operator must prepare before changing anything
- Save immutable old Compose config, image digest, secrets location (never copy secret values into logs), and database dump location before deploying.
- On a failed Book Studio service update, use the previously recorded image digest and exact project compose file to recreate **only** affected Book Studio services. Do not use `docker compose down` or host-wide prune/restart.
- On a migration failure, stop Book Studio writes and restore the verified isolated database backup under approved recovery procedures. Never restore a shared production database.
- If a Cloudflare Access release is made after **RILIS**, restore the exact saved Access application/policy JSON for app cddc9754-8955-48fc-b8b1-dba4b058bfe5; verify unauthenticated redirect is 302. Do not disable other applications/policies.
- Exact executable deployment and Access rollback commands remain BLOCKED pending the privileged baseline and a captured pre-change Access JSON snapshot. A two-minute reversal cannot be guaranteed until rehearsed.

## Monitoring
- Configure an authenticated, least-privilege health probe of the Book Studio app behind Cloudflare Access, every 60 seconds; alert after 3 consecutive failures to a verified operations channel. Do not store service-token values in git.
- Independently alert on service health, restart count, CPU/RAM and available disk. Monitoring target and notification destination are not configured/verified yet.

## Current evidence and blockers
- 2026-11-04: `bcagent` on bc-prod-01; `docker ps` returned permission denied for /var/run/docker.sock.
- `free -h`: 15 GiB total; 10 GiB available. Root filesystem 116 GB, 16 GB available, 87% used.
- On-host HTTPS GET to public hostname returned HTTP 302 (Access), 0.427097 s. This is not a frontend 200.
- Cloudflare: active zone, proxied DNS A 103.242.10.81; Access allow policy for four email identities.
- Existing repository docs/STAGING_ACTIVATION_STATUS.md reports a healthy verifier service but no working Next.js app, isolated DB or Book Studio origin route.
- GitHub PR #4 is Draft; do not merge or consider release-ready based on cache-related CI alone.

## Emergency contacts
- Incident owner: BC Book Studio owner / authorized `bcadmin` deploy operator — verified direct contact details **not provided**.
- Cloudflare and GitHub account owner: use authorized existing account; no credentials in this document.
- Escalation: stop Book Studio-only deployment; preserve all BahasaCerdas/JUMPA containers and call the authorized VPS operator.
