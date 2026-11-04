# Staging cache activation — verified blocker

Date: 4 November 2026.

The workflow failure was diagnosed from GitHub annotations: Unrecognized named-value: 'runner' in runner.temp at workflow-level env. The corrected workflow configures cache from a runner step; semantic actionlint validation, npm ci, Prisma generation, typecheck, Next build and Docker build passed on commit c76941fc191a6cdb8e2ae066d46d41ef57838730 (CI run 41803492359). A newer documentation-only commit still requires its own CI result.

The existing GitHub Actions deploy SSH identity in the BahasaCerdas repository successfully reaches bcadmin on the VPS. Docker and runtime metadata are available through that authorized route; Desktop Commander itself remains bcagent and the PC is offline.

DNS bcbookstudio.bahasacerdas.com points to 103.242.10.81 through Cloudflare. Public requests encounter the existing Access gate. Docker project bc-book-studio-staging contains only a healthy phase-one verifier service: bc-book-studio-staging-verifier-1, image sha256:1f491119cd8a687316a19c9e872a2f880b8f71fb77ad3fd70eb7cd1aaea9f725. It runs Python server.py, has no frontend assets, proxy upstream or /api/books implementation, and has no database settings. The current live shared Caddy route map has no Book Studio application route. No Next.js book runtime or isolated Book Studio database/schema has been verified.

Do not replace the verifier with the application: it serves an existing authentication boundary. Do not infer that the domain is a working, isolated book application from a 302 or the verifier's healthy status. Do not provision/migrate a database during this cache-only task.

Owner/project prerequisite: provide the actual isolated Book Studio staging application/database and its official ingress/deployment configuration (console VPS, existing bcstudio deployment). This must be ready before deploying PR #4 and testing authenticated book CRUD/export. No password/private key needs to be sent.

No Book Studio service was changed, so no rollback was required. Its existing verifier image remains intact. No Book Studio staging install/build/image/deploy benchmark or login/CRUD/export result is certified; prior local/CI timings do not establish staging activation. Keep PR #4 Draft until final CI and actual deployed staging tests pass.
