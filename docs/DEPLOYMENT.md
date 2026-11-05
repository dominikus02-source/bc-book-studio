# Deployment runbook (not yet executed)
1. Provision a dedicated Linux VPS or isolated project directory, DNS and HTTPS reverse proxy.
2. Install Docker Engine and Compose. Restrict inbound traffic to 80/443 and SSH. Do not expose PostgreSQL publicly.
3. Create a server-only `.env` from `.env.example` with STUDIO_API_KEY (at least 24 random characters), DB_PASSWORD (strong random), AI_API_KEY and AI_MODEL if AI is needed. Keep this file out of Git.
4. Run `docker compose build` and `docker compose up -d db`.
5. Run `docker compose run --rm web npm run db:migrate`, then `docker compose up -d web`.
6. Proxy HTTPS to 127.0.0.1:3100 and verify `/api/health`. Test editorial endpoints with the bearer token.
7. Set up encrypted daily PostgreSQL backups, retention, restore drills, metrics and alerts.
8. Only after a verified staging deployment, configure GitHub Actions SSH deploy with protected environment approval and rollback. Never commit private keys or server secrets.

**Important:** The supplied Compose file is a deployment starting point, not a tested production configuration. API token grants full editor+approver privileges. Separate identities and audit logging are required before a public multi-user rollout. PDF uses built-in WinAnsi fonts and replaces unsupported Unicode characters. EPUB exports XHTML text without illustrations.

For database-backed provider credentials and public email enrollment, follow docs/PUBLIC_RELEASE.md. Configure STUDIO_SECRET_ENCRYPTION_KEY on the server before deployment; administrators add provider keys in Settings after release. AI_API_KEY/AI_MODEL environment values no longer select the generation provider.
