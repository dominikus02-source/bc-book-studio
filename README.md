# BC Book Studio

Independent educational book publishing studio for [BahasaCerdas](https://bahasacerdas.com).

Create, review, and publish books for grades 1–12 with a built-in quality gate.

## Features

- **Editorial workflow**: Draft → Review → Approval (exports blocked until approved)
- **AI-assisted drafting**: Optional chapter generation (human review required)
- **Export**: PDF and EPUB for approved books
- **Role separation**: Distinct tokens for editor and reviewer
- **Stack**: Next.js 15 + React 19 + TypeScript + Prisma + PostgreSQL

## Quick Start

**Requirements**: Node.js 22, PostgreSQL 16

```sh
cp .env.example .env
# Fill DATABASE_URL, STUDIO_API_KEY, and a different STUDIO_REVIEWER_API_KEY
# (each token ≥ 24 characters). Optionally add AI credentials.

npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000, enter your studio token, and create a book.

Before releasing:

```sh
npm run typecheck
npm run build
```

## Project Structure

- `app/` — Next.js app and API routes
- `prisma/` — Schema and migrations
- `docs/` — Deployment and vision documents
- `AGENTS.md` — Guidance for AI coding agents

## Documentation

- [Product vision](docs/VISION.md) — Direction for print + digital publishing
- [Deployment runbook](docs/DEPLOYMENT.md)
- [AGENTS.md](AGENTS.md) — Conventions for coding agents

## Current Limitations

This is an early functional MVP.

- AI produces chapter drafts only (not a full agent system)
- Tokens are not per-user identity
- PDF uses limited fonts (Unicode/Indonesian support needs a licensed font)
- No images, exercises pipeline, or automated curriculum checks yet
- Deployment to production VPS not yet verified

**Security notes**

- Never reuse the BahasaCerdas production database
- Never commit secrets

## License

Private / internal use for BahasaCerdas. Contact the maintainer for questions.
