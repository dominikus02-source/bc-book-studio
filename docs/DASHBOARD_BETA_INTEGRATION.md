# Dashboard integration with closed beta

## Sources and scope
- Beta base: 9e9d4452ac36a14366a79c1e9c5137a1ab6f36e4 (PR #8).
- Dashboard source: f41cb91e7560e8c61881d03c5cbb4bd981c27809 (frontend tooling branch).
- Preserve original navigation, typography, responsive shell, modules and command brief.
- Preserve Cloudflare RS256 signature/issuer/audience verification and owner-scoped database queries.
- No production deployment, DNS/Access policy change, new schema migration, or main merge.

## Architecture decision: preview adapter
The existing Next.js beta API remains the preview data adapter. This does not replace the planned versioned FastAPI architecture described in ARCHITECTURE_DECISIONS.md. Prisma remains the sole schema owner for this beta database; SQLAlchemy is not connected to these tables.

| UI | Beta contract |
| --- | --- |
| Dashboard / library | GET /api/books, private owner scope |
| Create command brief | POST /api/books: title, grade, subject, description |
| Edit / delete draft | PATCH / DELETE /api/books/:id |
| Save chapter | POST /api/books/:id/chapters |
| Optional author draft | POST /api/books/:id/generate |
| Editorial review | POST /api/books/:id/review; separate reviewer token for decisions |
| Approved exports | GET /api/books/:id/export?format=pdf or epub |
| Agent center | Versioned agents/agent-registry.json; 11 design-only roles |

The complete command brief is preserved as description (maximum 12,000 characters), without truncating user input or claiming that an agent job was dispatched. Output preferences in that brief are requests, not supported-runtime guarantees. No new export format is claimed.

One shared book state backs the dashboard and library. The editor remains mounted across menu changes so unsaved chapter content survives navigation; changing books requests confirmation, and leaving the page triggers a browser warning.

## Capability limits
- Agent registry is integrated as a read-only contract. The 11-agent orchestrator is not running in this beta.
- Idea Lab, curriculum, exercises, visuals and pedagogy preserve their original prototype status and local-only notices.
- PDF/EPUB use existing beta export endpoints; Quarto/DOCX pipeline is not wired here.
- Real signed Cloudflare browser sessions and two-user API isolation require live session validation. Database isolation tests and forged-token HTTP checks are separate evidence.
- Browser CRUD integration tests use controlled API fixtures, not real-user Cloudflare credentials.

## Validation commands
- npm run build
- npm run typecheck
- npm audit --audit-level=high
- node --env-file=.env.production test-owner-isolation.cjs
- npx playwright test dashboard-integration.spec.ts --workers=1 --reporter=line (isolated loopback 3182)
