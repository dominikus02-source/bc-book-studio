# BC Book Studio — frontend libraries & staging gates

**Status:** dependency/toolchain branch, not production deployment. Base is the backend WIP branch `feat/production-foundation-20261104`; keep PR #1 and QMD PR #2 independent until reviewed.

## Stack and rationale

| Purpose | Library/tool | Notes |
|---|---|---|
| Web/UI | Next.js 15, React 19, TypeScript strict | Existing framework, same SSR setup |
| Styling | Tailwind CSS v4, `@tailwindcss/postcss`, PostCSS | Build-time CSS, served locally by Next.js; **no Tailwind Play CDN** |
| Fonts | `@fontsource-variable/dm-sans`, `@fontsource-variable/manrope` | Font packages bundled as local assets, no Google Fonts stylesheet |
| Components | Radix Dialog/Dropdown/Slot | Accessible interactive primitives; adopt incrementally, not replace every screen |
| Utilities | `clsx`, `tailwind-merge`, `class-variance-authority` | Composable variants and conflict-free Tailwind classes |
| Forms | `react-hook-form`, `zod`, `@hookform/resolvers` | Client validation; backend must validate independently |
| Client data | `@tanstack/react-query` | Add provider once API contracts are finalized; do not connect mock backend as real |
| Feedback | `sonner`, `lucide-react` | Toasts and icons; only show success when operations succeed |
| Test | Vitest + Playwright + axe-core | Unit, viewport 320–1440px, keyboard, third-party network, a11y |
| Book publishing | Quarto/QMD/Typst (separate QMD PR #2) | Not installed by this frontend toolchain PR |

## Local developer commands

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:install
npm run test:e2e
npm run check
```

Keep Node 22 consistent with GitHub CI and Docker. Never load Tailwind from `cdn.tailwindcss.com`, Google Fonts stylesheet or untrusted public JS CDN. `@fontsource-variable` font binaries are served by the app's own origin. Test verifies outgoing browser requests during dashboard load.

## Staging path (NOT production)

1. Resolve PR #1 architecture and QMD #2 handoffs; approve the final API contract, DB migration ownership, worker durability, publishing gate G9, and environment-specific secrets.
2. CI must pass `npm ci`, lint, TypeScript, Vitest, Next build, Playwright viewport/a11y/network checks, backend test and Docker build. Lockfile must be committed.
3. Stage the `compose.staging.yml` stack only on an **isolated host or namespace** using a separate database, volume, Redis, network and credentials. Never reuse the BahasaCerdas production database.
4. Bind the frontend initially to `127.0.0.1:3180`; configure TLS / Cloudflare Access behind a reviewed reverse proxy. Do not publicize a partially authenticated preview.
5. Observe health, logs, CPU/memory/disk, backup/recovery, and rollback image digest. Run QMD worker only with its own sandbox and safe render restrictions.
6. After cross-agent review, deploy to production with a **separate human-approved workflow** and rollback plan. This PR intentionally has no auto-deploy or credentials.

## Responsive design acceptance

- Viewport matrix: 320, 375, 390, 768, 1024 and 1440 CSS pixels; no horizontal document overflow.
- Mobile navigation works with button, close control, Escape, and accessible overlay. Use focus-visible, 44px touch targets, semantic headings/navigation and proper labels.
- All major dashboard routes/tabs must be reviewed at mobile/tablet/desktop; baseline tests cover the dashboard and can be expanded as modules become functional.
- No claims of full accessibility from axe alone; complete manual keyboard and screen-reader review before release.

## Environment and rollback

- `.env.staging.example` is illustrative only. `compose.staging.yml` already references `.env.staging`. Real credentials must stay on server, never committed.
- Docker should install deterministically with `npm ci`. No startup `npm install`, no runtime build/compilation, no unreviewed Quarto binary installation.
- Baseline frontend remains a prototype: most modules currently store state in memory only, and data/AI/backend integrations are not activated.
- Read `docs/ARCHITECTURE_DECISIONS.md` and `docs/QMD_AGENT_INTEGRATION.md` (from QMD PR #2) before implementing shared contracts.
