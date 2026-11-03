# BC Book Studio

Independent book publishing studio for BahasaCerdas.

## Current implementation

- Next.js 15 + React 19 + TypeScript.
- PostgreSQL via Prisma: books, ordered chapters, review decisions and approval status.
- Bearer-token protected editorial API and dashboard.
- Draft → review → approval; exports are blocked until approval.
- Optional AI-assisted chapter drafts using an OpenAI-compatible chat-completions provider; generated text must be reviewed before saving.
- PDF and EPUB export of approved books.
- Docker/Compose, GitHub CI, health endpoint and initial database migration.

## Local setup

Node.js 22, PostgreSQL 16. Copy `.env.example` to `.env`, fill `DATABASE_URL` and `STUDIO_API_KEY` (at least 24 characters). Optionally set AI credentials.

```sh
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Visit http://localhost:3000, enter your studio token and create a book. Run `npm run typecheck` and `npm run build` before release.

## Limitations and security

This is an **early functional MVP**, not a completed AI publishing factory. AI currently produces chapter drafts, not a full agent orchestration engine. Token auth is single-owner and does not separate author/reviewer roles; a proper identity provider and independent approvals are needed. PDF's built-in font lacks full Indonesian and Unicode glyph support; embed a licensed Unicode font before production. No images, exercises pipeline, EPUB accessibility validation, automated curriculum verification, job queue, integration API, or scheduled backups yet. Deployment to VPS has not been performed or verified.

Never reuse the BahasaCerdas production database or commit secrets. See [deployment runbook](docs/DEPLOYMENT.md).
