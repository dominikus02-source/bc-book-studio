# Layout media and workspace acceptance

Scope: local integration/unified-book-workflow-20261107; constitution sections 3, 4, 6, 7, 12, 19.

| Requirement | Existing | Change | Evidence/status |
|---|---|---|---|
| Upload image in canvas | Existing authorized asset POST; canvas only selects assets | Reuse asset API with alt/license validation | NOT RUN |
| Embed link | Markdown supports links; no block control | HTTPS link block and safe video preview, printed fallback link | NOT RUN |
| Paper sizes | A4/A5/B5 real; A4/A5 demo | Extended presets and bounded custom mm | NOT RUN |
| Full workspace | Nested panels and demo fixed width | Scoped full-width CSS and toolbar wrapping | NOT RUN |
| Persistence and revisions | Chapter expectedVersion and append-only revisions; approved layout JSON | Reuse existing contracts, no schema migration | NOT RUN |
| Responsive/security | Existing QA script | Browser dimensions, upload rejection, refresh, 403/409 regression | NOT RUN |

F3 is not assumed to have a standardized dimension; use custom width/height in mm.
Production unchanged. Demo remains explicitly browser-only; approved content remains immutable.
