# Review Naskah CRUD integration — 2026-11-08

Scope: LOCAL runtime http://127.0.0.1:3106, F:/bc-book-import-export-20261106.
Branch: fix/review-crud-integration-20261108. Base SHA: 11767c9c7cf9ec81ab8cccc1965699f074df7b51.
Contract: constitution.md. Unrelated ISBN, CSS and runtime-generated changes preserved and excluded from this feature commit.

## Requirement-to-evidence matrix
| Requirement | Existing gap | Final change | Evidence/status |
|---|---|---|---|
| Same book across stages | Review ignored URL bookId; next action dropped ID | Controlled selection; URL, dashboard selection and next-stage navigation retain bookId | PASS: both browser suites |
| Owner access to feedback | Endpoint/UI only showed reviewer assignments | Owner reads own books and feedback; shortcut to existing editorial checklist and assignment workflow | PASS: owner browser and API tests |
| Reviewer CRUD | Existing controls not reachable in owner context | Assigned reviewer create/read/update/resolve/archive; owner cannot mutate reviewer notes or self-approve | PASS: browser CRUD plus direct database read |
| Concurrent changes | Optional version checks; status/delete sent no version | Mandatory expectedVersion; edit uses version captured when opening form | PASS: stale update/delete -> 409; missing version rejected |
| Non-destructive deletion | Notes hard-deleted | ARCHIVED state retains content and audit; excluded from active list; archived book cannot be reviewed | PASS: database persistence, audit and list tests |
| Cross-reviewer blockers | UI saw only current reviewer's notes while backend checked all | Read all book notes within authorized book; only author's own notes editable | Implemented; multi-assigned-reviewer browser scenario NOT RUN |
| Workflow integrity | Must preserve independent approval | Existing reject/resubmit/approve gates and immutable snapshot retained | PASS: reject -> DRAFT -> submit -> APPROVED -> layout ready; closed review denied |
| Cross-stage regression | Navigation and RBAC may regress | Same book maintained through existing workflow | PASS: workflow-rbac-ux-e2e |
| Responsive UI | Verify actual runtime | Existing design preserved | PASS: 320/375/390/768/1024/1440, light/dark, no overflow or browser JS errors |
| Database compatibility | No destructive change allowed | Reuses string status column, no migration | PASS: 24 migrations, database up to date |

## Files
- app/api/reviewer/route.ts: owner/assigned-reviewer read scope and permissions.
- app/api/reviewer/notes/[id]/route.ts: version requirement and archive semantics.
- lib/reviewer-access.ts: archived-book access denied.
- app/reviewer/reviewer-workspace.tsx: selection, permissions, owner guidance, versioned mutations.
- app/studio/dashboard.tsx: expose owner review view and synchronize book selection.
- tests/review-crud-integration.cjs: runtime browser/API/database tests.
- tests/workflow-rbac-ux-e2e.cjs: versioned note contract and configurable test origin.

## Observed verification
- npx tsc --noEmit: exit 0.
- node tests/review-crud-integration.cjs: exit 0; ten PASS groups. Evidence: test-results/review-crud-integration.json.
- REVIEW_QA_ORIGIN=http://127.0.0.1:3106 node --env-file=.env.local tests/workflow-rbac-ux-e2e.cjs: exit 0; ownership, prerequisites, two-book navigation, Back/reload, five workspaces across six widths and two themes, concurrent approval/note serialization.
- node --env-file=.env.local node_modules/prisma/build/index.js migrate status: database schema up to date, 24 migrations; subsequent typecheck shell exit 0.
- git diff --check: no whitespace errors.
- Initial optimized build: exit 0. Final optimized build after edit-version refinement: result recorded below.
- First new-suite run passed assertions but fixture deletion failed because approval snapshot FK correctly restricts book deletion. Test cleanup was corrected to archive its books and deactivate its test users, preserving snapshot/audit data. Affected test fixtures were archived, temporary sessions removed, and suite rerun successfully.

## User-selected book (read-only observation)
cmw7py2k60014urc0fvsh7vgw is DRAFT / BRIEF, with 0 active chapters observed, 0 assigned reviewers and 0 review notes. No content, assignments or workflow state were changed for this book. Review mutations remain gated until the author completes earlier stages and submits to an independent reviewer.

## Compatibility, limitations and release status
No schema migration. Clients updating/deleting notes must now send expectedVersion from updatedAt; all production UI callers and the workflow regression test were updated. Deletion means archive; audit/history persists.
Full screen-reader usability, keyboard-only audit, export-file integrity, five-format creation-to-publication, production parity and CI are NOT RUN in this task. No blanket full-product readiness claim.
Local feature tested; global publication release remains PARTIAL / NO_GO pending existing publication gates. No VPS/staging/production deploy or public publication. No AI provider calls.
Rollback: revert this feature commit; archived rows should remain archived and must not be hard-deleted. A rollback of the reader filter must retain exclusion of ARCHIVED notes.

Final build: BC_QA_NEXT_DIST_DIR=.next-review-qa node node_modules/next/dist/bin/next build — PASS, exit 0, 103.20 seconds. Local development runtime was left running at port 3106.
