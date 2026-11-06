# AGENTS.md

## Project
BC Book Studio — independent educational book publishing studio for BahasaCerdas.
Next.js 15 + React 19 + TypeScript + Prisma + PostgreSQL.

## Commands
- `npm install`
- `npm run db:generate && npm run db:migrate`
- `npm run dev`
- `npm run typecheck && npm run build`

## Conventions
- Preserve the quality gate: DRAFT → REVIEW → APPROVED. Exports must remain blocked until APPROVED.
- Prefer Indonesian language in user-facing strings.
- AI-generated text is always a draft; humans must review before saving.
- Embed Unicode-capable fonts for any PDF export work (current PDF uses limited WinAnsi fonts).
- Keep editor and reviewer tokens separate.

## Boundaries
- Do not remove the reviewer token separation or the approval requirement.
- Do not commit secrets or reuse the BahasaCerdas production database.
- Prefer incremental improvements that fit the existing API and schema over large rewrites.
- See docs/VISION.md for product direction.
