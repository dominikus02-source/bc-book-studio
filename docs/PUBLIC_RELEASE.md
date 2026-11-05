# Public release preparation

The public mode accepts any valid Cloudflare Access app identity only when
CF_ACCESS_PUBLIC_SIGNUP=true. Issuer, audience, signature, token type, expiration,
subject and email checks remain mandatory. Default is the existing email allowlist.
Public enrollment must use verified email OTP; never an Access bypass.

Data stays scoped to the signed subject. Reviewer credentials remain independent.
Database-backed atomic limits: 20 book creations per user/day, 5 AI attempts per
user/day, 50 AI attempts globally/day. Periods use UTC. Provider failures count.
Apply the additive UsageCounter migration before this version; old web remains
compatible with the database. Existing backup and restore procedure still applies.

Provider API keys may be added through the administrator UI after public release.
Do not claim real provider generation PASS before a key is configured and tested.
The 11 roles remain a catalog; this release does not activate an agent orchestrator.

Rollback: disable public signup and restore the four-email Access policy before
rolling back the web image. Do not remove Access/JWT authentication.

## Database provider credential management
Administrators use Settings to create, list masked metadata, edit/rotate and delete
OpenAI, DeepSeek and Qwen (Singapore) credentials. Any signed-in public user is not
automatically an administrator. CF_ACCESS_ADMIN_EMAILS configures administrators;
when absent, the existing approved editor list retains management access.
API responses never return plaintext, ciphertext or encryption tags. AES-256-GCM
uses a random nonce and binds each secret to its record ID. A server-only 32-byte
master key is separate from PostgreSQL and must be backed up privately.
Changes are audited without recording secrets. A partial unique database index
and a transaction lock enforce at most one active provider. Provider URLs are
fixed on the server; redirects are rejected. Mutations require JSON and reject
foreign browser origins. Deleting/disabling the active provider disables AI;
manual editing and exports remain available. No real key is required to release.
Live AI-provider success remains unverified until an administrator supplies a key.
