# Owner-run staging procedures

No scripts are run automatically. Use a dedicated owner session on VPS.
Review scripts and fill `hostnames.txt` with **every** existing hostname before preflight.
Run `bash ops/owner-run/01-preflight.sh`; inspect logs and baseline.
Run `bash ops/owner-run/02-deploy-verifier.sh` only after complete JWT tests pass.
Do **not** enable Caddy snippet until temporary Caddy validation and rollback testing pass.
`99-rollback.sh` requires a previously saved exact snippet backup.
Never print credentials, access tokens, or private keys. Never restart production containers.
Send back redacted log paths and status/latency results.
