# QA Handoff — PT Bahasa Cerdas Indonesia ISBN Office
Date: 2026-11-08 | Environment: Windows localhost 127.0.0.1:32979 | Release: LOCAL ONLY / PRODUCTION HOLD

## Implemented
- ADMIN-only Studio dashboard `/studio?module=ISBN%20%26%20Legalitas`.
- Publisher profile CRUD (single company, id `bci-publisher`); empty legal identifiers are not fabricated.
- Company legal PDF vault with SHA-256, private download and non-destructive archive.
- Edition-specific ISBN applications tied to existing `Book.id`: title, author, format, language, edition, territory, size, rights, URL catalog.
- Evidence upload per application, SHA-256 and typed requirements, audit log, restricted status transitions.
- Manual `SUBMITTED_EXTERNAL` status requires book approval, company ISBN account ACTIVE, documentary requirements, catalog URL and official reference.
- Manual `ISSUED` requires ISBN-13 checksum plus evidence issued through Perpusnas (official PDF or official portal URL). Never auto-issues an ISBN.
- On-demand DOCX/PDF draft templates for publisher membership, ISBN request, originality statement, translation permission, transferred publication rights, public-domain basis.
- Guidance for Indonesian publisher issuing English-language/international-market titles through the national ISBN agency (Perpusnas).
- Responsive layout, light/dark, API RBAC. No external submission adapter implemented.

## Database migrations
- `20261108180000_publisher_isbn_office`
- `20261108181000_publisher_document_vault`
Applied non-destructively to local QA and marked applied, with Prisma schema/client validated. Existing historical migration drift detected before these changes (do NOT run migrate reset on production). Separate staging migration rehearsal and database backup are required before deployment.

## Evidence checked
- `node tests/isbn-office-e2e.cjs`: RBAC, profile, application CRUD, ISBN false-claim gate, document readiness gate, PDF/DOCX templates, evidence checksum download, archive and audit PASS.
- `node tests/publisher-vault-e2e.cjs`: legal PDF upload, list, download hash, archive PASS.
- `node tests/isbn-office-browser-e2e.cjs`: responsive 390, 768, 1440 px PASS, no overflow or browser JS errors.
- `node tests/isbn-letter-render-e2e.cjs`: sample 1-page PDF plus DOCX generated; PDF rendered via pdftoppm.
- `npm run typecheck`: PASS.
- Isolated Next build `BC_QA_NEXT_DIST_DIR=.next-isbn-qa node node_modules/next/dist/bin/next build`: PASS, exit 0. QA build directory removed afterwards to save space.
- `node --env-file=.env.local node_modules/prisma/build/index.js migrate status`: 24 migrations recorded; database schema up to date according to migration history.
- `git diff --check`: PASS (line-ending warnings only).

## Important constraints
- Do not display or claim actual ISBN until official issuance evidence is added.
- Templates are editable draft documents, not the Perpusnas annex verbatim; compare with current official forms and obtain valid signatures/stamps/meterai.
- Professional review of legal letters, real screen-reader/touch testing, virus scanning, backup/restore QA and security/tenant isolation are pending.
- Single publisher company; future multiple legal publishers must introduce explicit publisher membership/tenant access instead of relying solely on current ADMIN.
- Local working tree has substantial unrelated modifications/untracked features; no mass commit or production deployment performed. Integrate through a clean branch only after dependencies and full CI have been reconciled.

## Sources
- https://peraturan.go.id/files/perpusnas-no-11-tahun-2025.pdf
- https://isbn.perpusnas.go.id/landing_page/home
- https://isbn.perpusnas.go.id/landing_page/prosedur
- https://www.isbn-international.org/node/88
