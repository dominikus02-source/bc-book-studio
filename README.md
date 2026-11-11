# BC Book Studio

Release candidate for the repository's Indonesian editorial dashboard and owner-scoped closed-beta API.

## Included
- Original dashboard shell/navigation, dynamic project counts, book command brief, library, persistent chapter editor and the 11-role agent catalog.
- Cloudflare Access JWT authentication; books are scoped to the authenticated subject in every beta API route.
- Create/update/delete drafts, save chapters, submit review and export approved PDF/EPUB. Reviewer decisions remain separately authorized.
- Optional AI chapter drafts. API credentials may be configured after the restricted website release.
- Locked dependencies, local fonts/Tailwind, desktop/mobile browser checks and dependency audit.
- GitHub-built standalone runtime and separate Prisma migration image, with cached layers, image smoke tests and digest-pinned deployment tooling.

## Run locally
Use Node.js 22 and an isolated PostgreSQL database. Copy .env.example to a server-only .env and configure DATABASE_URL, CF_ACCESS_TEAM_DOMAIN and the correct CF_ACCESS_AUD. See the beta deployment guide for existing environment variables.

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm run start
```

Cloudflare Access provides the browser session in deployed environments; a request without a valid signed identity is rejected. Do not bypass authentication for local testing. The Playwright UI tests use controlled API fixtures.

## Verify
```sh
npm run build
npm run typecheck
npm audit --audit-level=high
npx playwright install chromium
npx playwright test
```

## Release
[Release candidate runbook](docs/RELEASE_CANDIDATE.md) describes image verification, publication, migration preflight, database backup and web rollback for bcbookstudio.bahasacerdas.com. A successful build does not imply real-user browser validation or public release. Cloudflare Access remains in place until the user explicitly requests RILIS.

## Capability limits
The agent catalog defines 11 logical roles; the orchestrator is not running in this beta. Prototype modules show their local/design status. AI can draft a chapter only after an explicit request; proposals are not applied until the author inserts them. Final PDF, EPUB, and DOCX use the Quarto renderer when it is configured. Without Quarto, preview PDF/EPUB/DOCX still include book metadata and Unicode text, while HTML and flipbook are served directly. Preview files are labeled as drafts and are not a print-certification or Perpusnas ISBN record.

Prisma alone owns the beta database. The dashboard integration does not replace the planned FastAPI architecture or connect SQLAlchemy to these tables. Never reuse the BahasaCerdas production database or commit secrets.
