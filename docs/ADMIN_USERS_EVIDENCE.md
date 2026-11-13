# Admin users dashboard: requirement and evidence
Date: 2026-11-11. Branch: work/admin-user-dashboard. Baseline: b0ba5d1.
Contract: constitution.md. Changes are scoped to account administration.
No Prisma schema or migration changes. Reuse StudioUser, StudioSession, StudioAuthToken and UsageCounter.

| Requirement | Existing implementation | Change | Evidence | Status |
|---|---|---|---|---|
| User dashboard | Basic Manajemen Akun | Stats, search/filter, clear actions, /admin guarded shortcut | admin-users-e2e.cjs browser/API | PASS local |
| Create/read/update | POST/GET/PATCH | Editable email, optimistic updatedAt check, safe autosave | Real isolated Postgres; save, reload and persisted value | PASS local |
| Archive/reactivate | Soft-deactivate API | Confirmation; retain books; update version; revoke sessions/tokens | API delete, reactivation, session rejection | PASS local |
| Password reset | Self-service tokens | Superadmin email action; 30min one-time token; no password/token response | Local SMTP sink; consume token, reject reuse, login new password | PASS local |
| Activation resend | Self-service activation | Explicit admin recovery action | SMTP sink + inactive-account checks | PASS local |
| RBAC/conflicts | Superadmin guard | Recovery validation/origin/cooldown; stale edit409; protect superadmin | Anonymous/editor403, protected account403, invalid state409, cooldown429 | PASS local |
| SMTP failure | Existing generic errors | Recovery503; remove undelivered token; leave password unchanged | Injected451 SMTP failure and DB query | PASS local |
| Responsive/theme | Basic cards | Scoped dark tokens, wrapping cards and44px controls | 320/375/390/768/1024/1440 light/dark; no overflow; screenshot reviewed | PASS local |
| Keyboard | Browser native controls | Visible focus styles | Search -> filter keyboard Tab; reset confirmation/button | PASS local |
| Build/types | Existing build | No new dependencies | npm run build exit0; npm run typecheck exit0 | PASS local |
| Regression | Existing five Playwright cases | Additional CI step for admin E2E | npx playwright test --reporter=line: 5 passed, exit0; isolated bookstudio_release_ci | PASS local |
| Production SMTP inbox | Existing server SMTP | No real-user password reset sent during tests | Not exercised | NOT RUN |
| Assistive technology | Existing browser semantics | Labeled controls/live messages | Real screen-reader and200%/400% zoom not exercised | NOT RUN |
| Release | Production b0ba5d1 | Clean commit, PR and CI required before deploy | Not yet deployed | Pending |

Test command: DATABASE_URL=<isolated bookstudio_admin_qa> node tests/admin-users-e2e.cjs (exit0).
The test refuses other databases and uses only @example.invalid users, a local SMTP sink and disposable QA records.
GitHub CI also permits its isolated bookstudio_release_ci database.
Tests do not send real email or change production passwords. All temporary sessions/users are removed after tests.
Existing build lint warnings outside changed files remain; no blanket publisher-readiness claim.
Rollback: previous runtime image and existing database backups; this feature has no schema changes.
