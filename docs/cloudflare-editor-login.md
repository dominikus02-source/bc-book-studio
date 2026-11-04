# Editor login through Cloudflare Access

Editors sign in with the existing Cloudflare email OTP flow. The studio automatically loads books after Access verifies the session; no shared editor token is sent to the browser.

Server-only configuration: `CF_ACCESS_ISSUER`, `CF_ACCESS_AUD`, and comma-separated `CF_ACCESS_EDITOR_EMAILS`. Keep the editor allowlist aligned with the Access application policy. The API verifies the Access JWT signature against the issuer JWKS and checks RS256, issuer, audience, expiration, application token type, subject and approved email. Requests with only an email header are rejected.

Legacy server API tokens remain supported for operational integrations. Reviewer approval still requires its distinct reviewer credential; Access editor authentication does not grant approval rights.

Run `npm run test:access` for signed JWT fixtures, invalid sessions and reviewer separation. After deployment, validate a real authorized email session in the browser, `/api/books` returning 200, anonymous origin API requests returning 401 and public requests still redirecting to Access. The health endpoint remains public at the origin for monitoring.

Rollback: restore the prior web image and previous environment file. The change does not migrate the database or alter shared reverse proxy configuration.
