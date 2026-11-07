# End-to-end book production acceptance contract

This branch adds the first **internal** publication gate to the existing XLSX/Markdown CRUD candidate. It does not enable public distribution, assign ISBNs, migrate production databases, or deploy a VPS.

## Stage-by-stage acceptance
| Stage | Editable records / CRUD | Blocking acceptance |
|---|---|---|
| 1. Account and brief | Authorized user creates, reads, edits, deletes owned drafts; XLSX/Markdown is parsed locally | Session, RBAC and schema validation; no secrets in imports |
| 2. Outline and manuscript | Owned book metadata, chapters, ordering, autosave, revision history | Nonempty title, author, description, chapter content and consistent ordering |
| 3. Editorial | Genre-specific checkpoints; reviewer assignment, reviewer notes and decisions | Independent reviewer, all checkpoints true, zero open critical findings |
| 4. Art and rights | Managed licensed assets with alt text | All assets need rights metadata and accessible descriptions |
| 5. Typesetting | Export approved manuscripts as PDF, EPUB and DOCX | Rendered bytes validated; images/Unicode/TOC/accessibility checked externally |
| 6. Internal publication | GET readiness and POST publish/unpublish `/api/books/:id/publication` | Owner only; approved and checked; immutable-at-publication JSON snapshot, monotonically increasing version on republish |
| 7. Distribution and ISBN | NOT IMPLEMENTED | Publisher identity, author permissions, metadata, format QA, applicable Indonesian publisher and Perpusnas requirements, release decision |
| 8. Post-publication | Internal unpublish and version tracking | No public URL exposure or retailer distribution until signed-off |

## API
`GET /api/books/{id}/publication` returns readiness, specific blockers, and current internal-publication state. `POST` accepts strictly `{"action":"publish"}` or `{"action":"unpublish"}`. A duplicate active publish or unpublish returns 409. Unauthenticated returns denial; non-owners receive 404. Published metadata is a snapshot, not a public-facing storefront.

## Mandatory gates before merging or deploying
- Run Prisma migrations against a disposable copy of a fresh and a restored database, then verify rollback compatibility with the current production image.
- Build/typecheck, lint, dependency audit, and all CI checks on the exact head SHA.
- Test owner/reviewer/outsider access; draft and missing-reviewer publication denial; review rejection; critical notes; successful publish; duplicate publish denial; unpublish; incremented republish version; parallel publish race; preservation of approved manuscript.
- Validate exported PDF (Unicode, trim/bleed, fonts), EPUB3 (epubcheck, navigation, accessibility), DOCX (open in LibreOffice/Word), rights and metadata using real example books.
- Back up production database with restore proof and immutable runtime image digest. Never alter unrelated BahasaCerdas/JUMPA containers.
- Keep Cloudflare Access and authentication enabled. Do not declare ISBN assigned or external publication without independent evidence.

## Limitations
A publication snapshot is an internal state transition. It is not an ISBN certificate, public reader endpoint, distribution order, copyright clearance, or verified professional PDF/EPUB production. Checks are currently user-confirmed boolean editorial attestations; independent human oversight remains necessary. An existing approved book may require re-review after substantive changes: block such mutations in all book/chapter/asset endpoints and add regression coverage before release.
