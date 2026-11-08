# BC Book Studio — Publishing Export Release Gates

Status: **HOLD** for production until the evidence below is attached. Local tests do not authorize a production rollout.

## Architecture

- Next.js API creates an authenticated `ExportJob` row. The production API does **not** render long ZIP exports in its request handler.
- A separately supervised `npm run export:worker` process claims queued database jobs, updates progress, honours cancellation, renews leases, and writes an atomic ZIP to a persistent volume.
- The worker uses authenticated Quarto Worker contract v2 to render PDF, DOCX and EPUB in an isolated service. Request body includes `publishingLayout`, selected page size, chapters and licensed assets. Wrong contract/version, invalid token or unsupported page size is rejected.
- Download endpoint verifies owner, status, output byte count and SHA-256 before serving the archive.
- A selected-size ZIP includes five formats plus manifest and README. An all-sizes ZIP includes 13 PDF and 13 DOCX editions, plus one reflowable EPUB, HTML, flipbook, manifest and README.
- Every file has an individual SHA-256 in `MANIFEST.json`. Unrun validators are explicitly marked `NOT_RUN`.

## Required production services (separate, private)

1. Apply Prisma migration `20261108093000_export_jobs` after a database backup and migration rehearsal.
2. Run isolated Quarto Worker via `npm run quarto:worker`, setting `QUARTO_BIN`, a random `QUARTO_WORKER_TOKEN` (minimum 32 characters), private bind/port, and resource restrictions. Default bind is loopback. A container network bind requires explicit `QUARTO_WORKER_ALLOW_PRIVATE_BIND=1` and network firewall isolation.
3. Configure Next.js and the export-job worker with the same authenticated `QUARTO_WORKER_URL` and token. Set `QUARTO_WORKER_URL` to a private localhost or `.internal` endpoint; never expose the renderer to the public internet.
4. Run `npm run export:worker` as a **separately supervised** restartable process or container. Set `EXPORT_ARTIFACT_DIR` to a **shared persistent volume** readable by Next.js download endpoints. Set `EXPORT_WORKER_ENABLED=true` only after supervision and storage are verified.
5. Set `EXPORT_RETENTION_DAYS` (default seven; allowed 1–90). Job archives expire automatically; metadata/checksums remain in the database. Monitor disk, queue length, failures, render timeouts, and retries.
6. Configure `EPUBCHECK_JAR` + `JAVA_BIN` and `PDFFONTS_BIN`. For PDF/UA or PDF/A use `VERAPDF_BIN` and the required `VERAPDF_FLAVOUR`. Missing validators must show `NOT_RUN`, never PASS.
7. Do not deploy while examinations or other production services require unaffected uptime. Use isolated staging and a rollback plan.

## Local verification commands

```powershell
npm run typecheck
npm run export:worker:once
node tests/quarto-worker-contract-e2e.cjs
node tmp-export-job-worker-e2e.cjs
node tests/publishing-accessibility-browser-e2e.cjs
```

End-to-end checks must verify a genuine queued job, an EPUBCheck PASS, PDF dimensions, DOCX section geometry, manifest SHA-256, authenticated download, browser keyboard/contrast, cancellation and restart recovery.

## Quality gates

| Gate | Automated evidence | Still requires |
| --- | --- | --- |
| PDF | Physical paper geometry all pages; embedded-font check; optional veraPDF result | Actual PDF/UA or PDF/A validation, image/render preflight, print proof, independent reviewer |
| DOCX | OOXML structure + correct physical page geometry | Open in Word/LibreOffice; styles, tables, typography and pagination visual proof |
| EPUB | EPUBCheck result + navigation/package structure | Ace by DAISY; accessibility metadata and assisted reader review |
| HTML/flipbook | Browser responsive/theme/keyboard/static contrast tests; alt attribute checks | Real touch, screen reader, content order, semantic completeness |
| ISBN/Perpusnas | ISBN-13 checksum, independently reviewed official evidence links, KDT/barcode supporting documents | Official publisher verification and evidence of real registration; never synthesize a registration number |
| Editorial | Snapshot/version-bound reviewer evidence | Independent release sign-off and distribution/deposit obligations |

A PASS in typography or EPUBCheck is not equivalent to legal publication eligibility, PDF/UA conformance, WCAG conformance, or accessibility certification.

## Rollback

Stop the export worker and renderer service before changing environment or schema. Never delete live export rows to fix a deployment. Leave queued tasks unprocessed when `EXPORT_WORKER_ENABLED` is false; restore only a verified, compatible backup/snapshot. Preserve other production containers and databases.
