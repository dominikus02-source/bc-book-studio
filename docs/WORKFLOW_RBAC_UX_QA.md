# Workflow, CRUD/RBAC and UX audit

Date: 2026-11-08 Asia/Jakarta.
Scope: LOCAL integration/unified-book-workflow-20261107, baseline ffcb3bd plus pre-existing uncommitted work. Constitution §§3–12,17,19. All unrelated worktree changes retained.

## Findings and implemented corrections

| Requirement | Observed gap | Implemented change | Evidence |
|---|---|---|---|
| One book across stages | Header selector and editor held independent IDs | Editor selection updates parent and URL; browser history restores selection; redundant selector removed | Two-book browser test, refresh and Back PASS |
| Server stage readiness | Header derived progress independently | Workflow GET returns five stage availability/completion/missing requirements; UI uses that response | API + browser tests PASS |
| Revisit Rancang | Outline hidden and API locked after WRITING | Owner can edit/add outline in OUTLINE/WRITING/EDITING while DRAFT; continuing WRITING navigates without a repeated transition | API and UI revisit test PASS |
| Revalidate earlier stages | OUTLINE→WRITING and submit could ignore invalidated brief | Earlier fields rechecked; submit requires writing stage, valid brief, objectives and contents | Missing writingGoal and early-submit tests PASS |
| Review assignment consistency | Assignment check/write could race with submit | Same Book row lock + transaction as submit; audit assign/remove; only active independent reviewer qualifies at submit | Assignment role/status tests PASS |
| Review notes consistency | Notes could race with approval | Lock Book before rechecking assignment/status and writing; append audit for create/update/remove | Critical note vs approval race test PASS |
| Immutable final readiness | Any old approval snapshot could be mistaken for current approval | Terbit availability requires snapshot with the exact current approvedAt | Implemented; legacy export rejection covered by snapshot suite |
| Human stage UX | Duplicated Next controls, technical statuses and audit IDs | Compact five-step navigation, short stage guidance, status labels, optional tools collapsed, editorial history without internal audit IDs | Browser journeys + screenshot inspection |
| Simpler Review | Imports and assignment details dominated screen | Reviewer → checklist → submit; extra tools and email assignment collapsed | Browser responsive suite |
| Responsive / readable | Tall mobile stepper, weak dark hint contrast | Five compact mobile stage buttons; readable fields, 44px controls, dark hint colors, compact book switcher | Five workspaces × six widths × two themes; screenshot inspection |
| Owner controls | Assigned reviewer could see chapter mutation controls | Owner-only chapter action rendering; server checks retained | API negative tests; reviewer UI completeness remains PARTIAL |

## Files changed in this task

Backend:
- lib/workflow.ts
- lib/reviewer-access.ts
- app/api/books/[id]/chapters/route.ts
- app/api/books/[id]/chapters/[chapterId]/route.ts
- app/api/books/[id]/review/route.ts
- app/api/books/[id]/reviewers/route.ts
- app/api/reviewer/notes/route.ts
- app/api/reviewer/notes/[id]/route.ts

Frontend:
- app/studio/dashboard.tsx
- app/globals.css
- components/beta-workspace.tsx
- components/brief-gate.tsx
- components/outline-workspace.tsx

Evidence:
- tests/workflow-rbac-ux-e2e.cjs
- docs/WORKFLOW_RBAC_UX_QA.md

No schema changes or migrations. Existing notes can still be removed, but their full pre-removal value is now retained in the same transaction's audit event. This is not a complete soft-delete UI.

## Verification

Test database explicitly restricted by scripts to 127.0.0.1:55999/bookstudio_import_qa. HTTP origin 127.0.0.1:32979. Fixture users/books are isolated and cleaned up.

- npm run typecheck: PASS, exit 0.
- node tests/workflow-rbac-ux-e2e.cjs: PASS on first complete run; final UI rerun pending below.
- node tests/draft-canvas-recovery-e2e.cjs: PASS, included in sequential final regression process.
- node tests/approval-snapshot-e2e.cjs: PASS, exit 0; author workflow, chapter CRUD/revisions/conflicts, approval snapshot, layout, HTML publication/revocation and preview regression.
- Initial regression found a chapter drag timeout after layout changes. Explicitly draggable handles corrected it; subsequent full regression passed.
- Build on isolated source copy F:\tmp\bc-workflow-build-20261108: first build PASS, exit 0; final Review UI rebuild pending below.
- Screenshots for five author workspaces in both themes: F:\tmp\bc-workflow-ux-qa. Screenshots are QA fixtures, not real manuscripts.

Role cases exercised: EDITOR owner, other EDITOR, assigned REVIEWER, unassigned ADMIN, anonymous. ADMIN receives no ownership bypass. Independent review remains mandatory. No AI provider calls or public production actions.

## Remaining gaps and release state

LOCAL / PARTIAL, no commit/push/deploy. Production SHA UNKNOWN.
- Book DELETE still hard-deletes a DRAFT and related records. It needs proper archive/restore before claiming full constitution CRUD compliance.
- Book metadata PATCH does not yet provide optimistic locking; chapter editing does.
- Review state transitions are still implemented in the review route; not all transitions have been centralized in lib/workflow.
- Full CRUD/RBAC coverage for every asset, provider/settings route and all role combinations is NOT RUN.
- No full screen-reader/manual keyboard audit, WCAG certification, external five-format validation, backup/restore rehearsal or CI/production verification.
- The viewport matrix checks horizontal overflow and browser errors, not every visual state or every role.
- Existing author-stage data remains editable as drafts; final approval and publication safeguards remain enforced.

Next safe priorities: archival book CRUD, metadata conflict handling, full route/role matrix and release-format validators. Deployment remains NO_GO until release requirements are met.

## Final verification results

Final workflow/RBAC/responsive rerun after Review simplification: PASS, exit 0. All five workspaces × six widths × light/dark passed overflow checks, with no browser JavaScript errors. Provider adapter tests: 4/4 PASS. git diff --check: PASS, exit 0. Final isolated Next.js build after synchronizing latest component and CSS: PASS, exit 0. Typecheck: PASS. No remaining pending test processes from this task.
