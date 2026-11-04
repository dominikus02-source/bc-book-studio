# BC Book Studio release candidate

## Scope
Combines the repository dashboard/navigation/11-role agent catalog with the closed-beta owner-scoped Prisma API. The beta adapter does not replace the planned versioned FastAPI architecture. Agent roles and prototype modules remain explicitly marked; an operational 11-agent engine is not claimed.

Editor access uses the Cloudflare session, not a shared editor token. AI credentials may be configured after the restricted web release. Reviewer decisions remain separately authorized.

## Faster build and delivery
The reusable CI job runs a locked install, production build, type check, dependency audit and desktop/mobile browser tests. The release workflow then builds a non-root Next.js standalone image on GitHub using BuildKit cache. It also builds a separate Prisma migration-tool image.

Image verification applies migrations to an ephemeral CI-only PostgreSQL database, checks the homepage and health endpoint, rejects anonymous/forged API authentication, and executes a Prisma query from the final runtime image. Browser CRUD tests use API fixtures; they do not establish real-user JWT or database isolation PASS.

An explicit bookstudio-rc-* tag publishes only the tested images, tagged with the exact source SHA. After this workflow reaches the default branch, manual workflow dispatch is also available. Digests appear in the run summary. No workflow changes a VPS, domain, Access policy or production database.

## Deployment to bcbookstudio.bahasacerdas.com
1. Complete the Linux image checks on this candidate.
2. Review a real Cloudflare-authenticated editor session and two-user CRUD isolation in preview.
3. Publish the same reviewed source SHA with an explicit bookstudio-rc-* tag (or workflow dispatch after the workflow exists on main).
4. Copy compose.release.yml and scripts/deploy-release.sh to the existing dedicated Book Studio Compose directory. Preserve its server-only .env and compose.edge.yml.
5. Set BC_BOOK_STUDIO_IMAGE and BC_BOOK_STUDIO_MIGRATOR_IMAGE to the immutable digests in the run summary, and BC_BOOK_STUDIO_VERIFIED_SHA to the source commit.
6. Run bash scripts/deploy-release.sh --check. This pulls only those images, verifies the runtime revision and checks migration status. Pending migrations block deployment.
7. Apply pending migrations only under a separate backed-up migration plan. In particular, owner isolation changes the old API's insert contract; ensure the rollback image already understands ownerId. Do not silently migrate and then claim an older token-only image is a compatible rollback.
8. Once preflight passes, run bash scripts/deploy-release.sh --apply. It verifies a fresh database archive, switches only the Book Studio web service, and checks health/API rejection. Failed web startup or smoke checks restore the previous image; no schema rollback is attempted.

Use only the existing bc-book-studio-runtime project. The script does not restart BahasaCerdas, JUMPA, Caddy or database containers and does not change DNS/Cloudflare Access. Existing image backups and database dumps must remain private.

Public access remains subject to the user's explicit RILIS instruction. Successful CI is not a claim that public release or the real-user browser gate passed.

## Validation on Windows
Build, TypeScript, dependency audit (0 vulnerabilities), and three Playwright scenarios passed. Linux Docker image validation is reported separately by GitHub Actions. Build duration/image size must be read from the workflow output rather than assumed.
