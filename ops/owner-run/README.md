# BC Book Studio — owner-run (Option A)

**Not production-ready.** Only the owner runs these scripts, after reviewing the CI, complete hostname inventory, Caddy image/version, and all files. Do not run 03 while the approval evidence and snippet are missing. Never execute through the assistant's VPS account.

1. On the owner's VPS session, check out the approved commit of `feat/staging-auth-crud` in a separate temporary worktree (do not replace the deployed repository).
2. Review scripts: `sed -n '1,240p' ops/owner-run/{01-preflight,02-deploy-verifier,03-caddy-snippet,99-rollback}.sh`.
3. Put **every** existing hostname in `ops/owner-run/hostnames.txt`, one per line. This file must be verified against the real Caddy config. Do not include secrets.
4. Run `bash ops/owner-run/01-preflight.sh`; return redacted baseline and Caddy image/version. Confirm all hosts are accounted for.
5. Only after the verifier Docker test CI is green, run `bash ops/owner-run/02-deploy-verifier.sh`.
6. Have the exact Caddy image/version and proposed snippet tested in a **temporary CI container**, and separately test rollback with a real backup. Store reviewed snippet as `ops/owner-run/bcbookstudio.caddy` and create `ops/owner-run/caddy-ci-approved.txt` containing CI run URL and reviewed image digest. Do not fabricate this evidence.
7. Run `bash ops/owner-run/03-caddy-snippet.sh` only when all prior gates pass. The script backs up only the BC Book Studio snippet, validates Caddy, reloads without restarting the container, compares HTTP statuses/latency of all listed hosts, and attempts rollback if a regression is detected.
8. If manual rollback is needed, run `bash ops/owner-run/99-rollback.sh /absolute/path/to/caddy-YYYYMMDDTHHMMSSZ.backup`. **Note:** when no original snippet existed, rollback must remove the newly added snippet instead; 99 currently requires an existing backup. Do not use it in that scenario without review.

**Do not run steps 5–8 yet** until the CI and staging validation gates pass. The scripts intentionally ask for owner confirmation.

Send back the redacted log filenames, complete hostname statuses/latencies, Caddy image digest, verifier health and browser Access login/logout results. Never send private keys, JWTs, cookies, or env values.

## Constraints

No changes to SSH keys, sudoers, passwords, group memberships, other hosts/routes, DNS, WAF, other databases or production containers. Caddy must only be validated/reloaded, never restarted. The scripts are owner-executed, not assistant-executed.
