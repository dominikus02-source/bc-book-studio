# BC Book Studio — Landing & Account Authentication

## Deployment controls
The changes in this branch are **not** deployed automatically. Use the dedicated BC Book Studio PostgreSQL database, not the Bahasa Cerdas production database. Before promotion: backup, stage migration, ensure CI passes, run auth tests and check redirects at the dedicated HTTPS host.

## SMTP Bahasa Cerdas (verified provider: Resend)
Existing Bahasa Cerdas password recovery uses the `supabase-auth` container's `GOTRUE_SMTP_*` configuration, with host `smtp.resend.com` and port `465`. Set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER` to the authorized sending account, `SMTP_APP_PASSWORD` to the protected SMTP password, `SMTP_FROM` to the verified sender address (optionally with a BC Book Studio display name), and `APP_ORIGIN=https://bcbookstudio.bahasacerdas.com` in the **BC Book Studio secrets manager**. Do not commit secrets. The actual credential transfer was not performed because security controls blocked copying credentials between services. Do not print, log, or export the credential into this repository.

Confirm that the verified sender is permitted for the BC Book Studio emails and test delivery to an invited user before production. Keep sender domain DNS records (SPF, DKIM, DMARC) aligned to Resend.

## Initialize accounts
Run `npm install`, `npm run db:generate`, `npm run db:migrate` against an isolated staging database. Provision invited users with `STUDIO_INVITE_EMAIL=... STUDIO_INVITE_NAME=... STUDIO_INVITE_ROLE=EDITOR node scripts/invite-user.cjs`. Set role `REVIEWER` only for reviewers. The user visits `/activate`, enters their invited email, receives a 30-minute single-use activation link, sets a 12+ character password, then signs in at `/login`. Password reset at `/forgot-password` uses the same verified sender. An unprovisioned email never self-registers.

## QA acceptance gates
1. Public `/` loads; responsive mobile and desktop; links work.
2. Uninvited activation request has neutral response and creates no user.
3. Invited user activation email arrives from approved Bahasa Cerdas sender; link expires in 30 minutes and cannot be reused.
4. Login with wrong password is rejected, correct password sets HttpOnly/Secure/SameSite cookie, and logout clears/revokes session.
5. Forgot password returns neutral response for unknown addresses, valid reset invalidates old sessions.
6. EDITOR can create and submit; only REVIEWER/ADMIN can approve. Legacy bearer editor/reviewer tokens still work for migration; phase them out separately.
7. Enable edge rate limits for `/api/auth/*`, SMTP quota and delivery monitoring before production. Verify DNS SPF, DKIM and DMARC for the sender domain.
8. Production promotion only after staging E2E and independent deploy checks pass.

Notes: UI and API in this branch implement core flows. They do not prove that the target Workspace account, SMTP app password, DNS, delivery, migrations, and hosting are configured.
