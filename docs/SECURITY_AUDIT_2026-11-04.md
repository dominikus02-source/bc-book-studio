# Dependency security audit — 2026-11-04

Audit was run with `npm audit --json`, `npm audit --omit=dev`, `npm ls postcss deepmerge-ts next prisma @prisma/config` against a clean lockfile.

| Direct advisory | Installed before | Vulnerable range | Fixed resolved | Dependency path | Context |
| --- | --- | --- | --- | --- | --- |
| GHSA-qx2v-qp2m-jg93 | postcss 8.4.31 | <8.5.10 | 8.5.32 | next 15.5.29 -> postcss | Next CSS build dependency |
| GHSA-6g55-p6wh-862q | postcss 8.4.31 | <=8.5.11 | 8.5.32 | next -> postcss | Next CSS build dependency |
| GHSA-fxqj-rqcc-2cmp | postcss 8.4.31 | <=8.5.22 | 8.5.32 | next -> postcss | Next CSS build dependency |
| GHSA-r28c-9q8g-f849 | postcss 8.4.31 | <=8.5.17 | 8.5.32 | next -> postcss | Next CSS build dependency |
| GHSA-ggr8-5vv4-36mx | deepmerge-ts 7.1.5 | <8.0.0 | 8.0.2 | prisma 6.19.3 -> @prisma/config -> deepmerge-ts | Prisma CLI config/build/migration tooling |

`npm audit` also reports meta-vulnerabilities in `next` (moderate), `prisma` (high), and `@prisma/config` (high); these are dependency paths to the direct advisories, not separate GHSA findings.

No `npm audit fix --force` was used. Plain `npm audit fix` changed nothing. The last Next 15 available in registry at the time was 15.5.29 and retained postcss 8.4.31; Prisma 6.19.3 retained deepmerge-ts 7.1.5. Explicit overrides resolved postcss to 8.5.32 and deepmerge-ts to 8.0.2. `npm ci`, `prisma generate`, typecheck, Next build and npm audit succeeded in a temporary PC workspace. CI independently verifies them.

**Risk still to test:** deepmerge-ts 8 is a major transitive override for Prisma 6. A real isolated database migration smoke test has not been performed. The override must not be treated as production-approved until this compatibility gate passes.

No security exceptions or suppressed advisories have been approved or applied.
