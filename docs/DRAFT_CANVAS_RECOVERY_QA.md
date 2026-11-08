# Draft canvas recovery — local evidence

Date: 2026-11-08 Asia/Jakarta.
Scope: integration/unified-book-workflow-20261107, baseline ffcb3bd5d2a53a8183830c601f8d68950ac5f9ee plus existing uncommitted work. Constitution §§3,4,6,7,8,17,19.
Repository: F:\bc-book-import-export-20261106. Existing worktree changes preserved.

## Requirement-to-evidence matrix

| Requirement | Existing implementation | Change | Evidence/status |
|---|---|---|---|
| Refresh after failed save | Unsaved canvas edits held only in React memory | sessionStorage recovery keyed by book and chapter, explicit restore/discard | PASS: simulated HTTP 503, reload, prompt, explicit restore and successful persisted save |
| Concurrent edits | Chapter PATCH uses expectedVersion and 409 | Recovery retains original expectedVersion | PASS: second session writes, local conflict, reload/restore still returns 409 and leaves remote content unchanged |
| Recoverable copy | Reload discards local edits | Markdown download from recovery and conflict state | PASS: downloaded recovery file read and compared with fixture text |
| Successful save | Server append-only revisions | Remove tab recovery when editor matches saved content | PASS: sessionStorage key absent after save; reload shows server content |
| Storage unavailable | No recovery | Visible limitation; backup download; normal server save remains available | PASS: injected sessionStorage write failure, warning and subsequent successful DB save |
| Responsive controls | Existing canvas | Native disabled fieldset while recovery unresolved | PASS for canvas no-overflow checks at 320/375/390/768/1024/1440; full accessibility NOT RUN |
| Authorization and DB | Session ownership checks, optimistic locking, revision history | No API, role or schema changes | PASS for existing regression cases: anonymous/foreign owner, stale versions, self-approval, unassigned approval, immutable snapshot |
| Existing authoring workflow | Local integration implementation | Regression only | PASS: existing approval-snapshot-e2e suite, exit 0 |

## Changed files

- components/draft-block-canvas.tsx: adds tab-scoped recovery and explicit download/restore/discard controls. This component already existed as an untracked local implementation before this task; its earlier work was retained.
- tests/draft-canvas-recovery-e2e.cjs: focused browser + database regression, restricted to 127.0.0.1:55999/bookstudio_import_qa and HTTP loopback port 32979. Creates and cleans its own fixtures.
- docs/DRAFT_CANVAS_RECOVERY_QA.md: this evidence record.

No migrations added. No secrets committed or printed. No authentication, approval or publication policy changes.

## Executed checks

| Command | Result |
|---|---|
| npm run typecheck | PASS, exit 0 |
| npm run test:ai-providers | PASS, 4 tests, exit 0 |
| node tests/draft-canvas-recovery-e2e.cjs | PASS, exit 0; failed save, reload, download, recovery, conflict, discard, storage failure and six canvas widths |
| node tests/approval-snapshot-e2e.cjs | PASS, exit 0; existing authoring/review/layout/publication local regression |
| npx prisma migrate status | PASS, exit 0; 12 migrations, database up to date |
| node node_modules/next/dist/bin/next build | PASS, exit 0; isolated source copy F:\tmp\bc-recovery-build-20261108, existing dependencies, leaving development cache untouched |
| git diff --check | PASS, exit 0; existing CRLF conversion warnings only |

The first focused-test attempt failed because its storage-failure injection disabled all localStorage/sessionStorage writes across the app. The test was corrected to fail only canvas recovery sessionStorage writes; the complete corrected test passed.

Verified component SHA256: C7F87118EFB235539EAAC9801CC580F982D9900F2DD1F46F1048EA0D33199C50.
Verified focused-test SHA256: 06EF19422C49969D3A124F9727C95E3DA8930D768032EC1185521D75DB7A1A25.

## Limits and release state

LOCAL / PARTIAL. The local dev server and existing QA PostgreSQL were started for these checks. No commit, push, merge, VPS change or production deployment occurred. Production SHA remains UNKNOWN.

Recovery is scoped to the current browser tab; it is not cross-device storage or a guarantee after tab closure. Stale recovered text deliberately cannot overwrite a newer server version: download it, explicitly load the server version, then reconcile manually. Storage errors cannot guarantee local recovery.

NOT RUN: full route/role/theme matrix, keyboard-only/screen-reader validation, independent visual proof, all five output-format validators, CI, backup/restore rehearsal and deployment checks. Existing export preview tests are not format certification. Full publication readiness remains NO_GO.

Next safe work: complete layout/media QA and format artifact validation, review the accumulated local diff into coherent commits, then run the remaining release gates before requesting production GO.
