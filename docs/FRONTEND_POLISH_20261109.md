# Frontend polish — scoped implementation / PARTIAL release gate

Source: `ef57bbd84f68ce2fc2faf6d3f7cd133830c10047` on remote `feat/printing-responsive-logic-20261108`, 9 commits ahead of `wip/grok-handoff-20261108`. Not the untransferred Windows candidate. PR base: source branch, to isolate frontend changes without merging unrelated work.

## Requirement → implementation → verification plan
| Requirement | Existing gap | Change | Evidence/status |
|---|---|---|---|
| Persistent light/dark/system | Studio writes light on initial mount; competing theme states; storage can throw | One theme controller, guarded storage, media/tab sync, pre-paint bootstrap | Unit tests + changed-frontend graph typecheck PASS; full typecheck BLOCKED |
| Public mobile navigation | Links disappear under 960px; floating theme switch overlays content | In-flow theme control, keyboard disclosure nav, skip link | Browser review pending |
| Studio shell | Public `.topbar`/`.brand` rules leak into dashboard; drawer lacks focus management | Scope public selectors, shell spacing, focus return/trap/Escape/inert background | Browser review pending |
| Consistent light/dark surfaces | Partial shared token aliases; reviewer also has its own scoped review tokens | Semantic aliases + targeted shell/auth/form/control surfaces | Contrast unit tests PASS; visual BLOCKED |
| Phone usability | Dense controls, header wrapping, narrow dialogs | Reflow scoped toolbars, dialog bounds, tap targets | 320/390/768/1440 review pending |
| Preserve publishing/auth/data | Protected routes, manuscript paper and export must not change | No API, schema, auth, export or paper rules modified | Diff review + existing unit tests |
| Build and product-wide quality | No lint script; E2E require DB/private records | Run typecheck/build and self-contained tests; no DB/migrations | Pending; full journeys NOT RUN |

No deployment, merge, Windows changes, new data, credentials, dependencies or committed cache artifacts. Full product readiness and all-route visual/a11y acceptance are NOT claimed. See constitution sections 19/20.

## Verification evidence (9 Nov 2026 WIB)
- `npm ci --no-audit --no-fund`: PASS (exit 0), 420 packages. No dependency/lock changes.
- `npx prisma generate`: PASS (exit 0); generated client only; no database connection or migrations.
- `node --test tests/theme-preference.test.cjs tests/interface-contract.test.cjs tests/provider-compat.test.cjs tests/ai-token-usage-parser.test.cjs`: PASS (19/19, exit 0).
- Changed-frontend import graph `npx tsc --noEmit --project /workspace/bc-frontend-check-20261109.json`: PASS (exit 0). Temporary config outside repo; excludes unrelated API routes, NOT a substitute for full typecheck.
- `npm run typecheck`: BLOCKED (exit 2): existing API import `app/api/reviewer/route.ts:4` references absent `lib/review-readiness`. Import is present at base SHA and `git ls-tree HEAD lib/review-readiness.ts` is empty. Not modified because review business/auth logic is out of frontend scope.
- `npm run build`: BLOCKED (exit 1): same absent review-readiness module. No ignored build/type errors or fabricated helper introduced.
- `git diff --check`: PASS (exit 0).
- Visual browser, keyboard, contrast across actual rendered pages, full stage CRUD/RBAC and exports: NOT RUN. Token contrast tests are not WCAG certification.
- Final delivery: DRAFT PR only, not ready to merge. No deployment or merge. Browser review remains BLOCKED.

## Route / role / viewport review matrix
All screenshots requested in both themes at 390/768/1440px (plus 320px header smoke).
| Route | Role | Review target | Status |
|---|---|---|---|
| `/` | Anonymous | Nav/menu disclosure, hero, feature grid, footer, focus/skip, no overflow | BLOCKED visual |
| `/login` | Anonymous | Theme rail, password visibility, focus and autofill layout | BLOCKED visual |
| `/activate`, `/forgot-password`, `/reset-password` | Anonymous | Shared auth card and recovery states | BLOCKED visual |
| `/progress` | Anonymous | Existing dashboard; theme rail placement | BLOCKED visual |
| `/studio` and `?module=Buat%20Buku`, `Proyek%20Buku`, `Studio%20Penulisan`, `Pengaturan` | Editor (real authorized session only) | Drawer focus, shell, forms/controls, editor paper unchanged | BLOCKED without test DB/session |
| `/reviewer` | Assigned reviewer | Semantic token aliases; no auth bypass | BLOCKED without test DB/session |
| `/read/[id]`, live-preview, pagination | Authorized published/private access as existing | Reader, manuscript, export fidelity intentionally not restyled | NOT RUN |

Remaining: full product-wide audit is not completed. Screenshot review, authenticated editor/reviewer/reader journeys, forced-colors/assistive technology, 200% zoom and 375/1024px checks remain. Production release stays HOLD.

HTTP smoke (exit 0): `/`, `/login`, `/activate`, `/forgot-password`, `/reset-password`, `/progress` return 200 with bootstrap and labeled theme selector. Anonymous `/studio` and `/reviewer` resolve to `/login`, preserving protection (no sign-in attempted). This is HTTP evidence, not visual verification.

The box-only review server was restarted with an isolated ignored `.next-frontend-review-3210` cache after transient missing `.next/server/app/page.js` errors. It is not a deployed preview or Windows server. Generated `next-env.d.ts` / `tsconfig.json` changes are excluded from the patch.

## Final browser result and release decision
Parent browser attempts reported `ERR_CONNECTION_REFUSED` for localhost/loopback, then HTTP 403 `Access denied` for the box network URL. No actual route, theme, mobile layout, keyboard interaction or screenshot was visually inspected. Further retries and browser automation were stopped; no access-control workaround was attempted. Successful Shell HTTP responses do NOT override this visual QA blocker.

DRAFT / PARTIAL only: not ready to merge, not all frontend complete, not deployment-ready. The absent backend module predates this patch and was intentionally not synthesized. Authenticated studio/reviewer, real manuscript/reader/export flows, mobile overflow, rendered contrast, screen reader and full route matrix remain unverified.

Final code audit: shared theme owns persistence without mount writes; guarded storage and bootstrap are covered by unit tests. Drawer dialog uses a role-compatible container, traps Tab, closes on Escape, restores focus, scroll state and previous inert state. Public header rules are scoped away from studio. No paper geometry, APIs, auth gates, database schema, deployment or workflow business logic changed. `.gitignore` now excludes all `.next-*/` review caches; no generated configs, cache, node_modules, secrets, data, screenshots or private manuscripts are included.

The parent confirmed the CLI/PR workflow; this patch targets remote source branch `feat/printing-responsive-logic-20261108` at the SHA above. It does not incorporate the blocked/unpushed Windows consolidation commits and must not be described as that local latest version.
