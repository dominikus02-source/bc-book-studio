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

The runtime currently has no AI_API_KEY. Do not claim AI generation PASS.
Configure the server-only provider key, matching HTTPS endpoint and model,
then verify a real authenticated generate/save/export workflow before AI release.
The 11 roles remain a catalog; this release does not activate an agent orchestrator.

Rollback: disable public signup and restore the four-email Access policy before
rolling back the web image. Do not remove Access/JWT authentication.
