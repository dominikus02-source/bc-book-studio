# BC Book Studio — Phase 1 owner-only release gate

**NOT LIVE. DO NOT RUN 02/03/99 IN REAL MODE.** The agent may edit this branch and run CI, but only the owner operates on the VPS. No merge to main, production container recreation/restart, SSH key, sudoers, or password changes.

## Confirmed from owner preflight

- Caddy: `bahasacerdas-prod-caddy-1`; image digest is pinned in `config.env`
- Host snippet path: `/opt/bahasacerdas/config/caddy.d`
- Container import: `/etc/caddy/conf.d/*.caddy`
- Network: `bahasacerdas-prod_edge`
- Known checks: www 200 (0.280008s), jumpa 200 (0.100537s), BC Book Studio 302 (0.202921s)
- **Incomplete**: site addresses for environment-variable sites and imported snippets, bind mount read-only confirmation, origin certificate availability. `BASELINE_COMPLETE=false` must remain false until all verified.
- The `caddy-validate` CI currently tests pinned image and certificate-positive/negative fixture, **not** complete production Caddyfile adaptation, JWT routing, leak checks, reload continuity, or rollback hashes.
- `03` and `99` intentionally fail closed in real mode pending those gates.

## Owner review and future run sequence (not yet authorized to execute)

1. Review the exact branch commit and `config.env`, `01`, `02`, `03`, `99`, snippet and Compose.
2. Run `bash ops/owner-run/01-preflight.sh --dry-run` then, after review, `bash ops/owner-run/01-preflight.sh` for full read-only inventory.
3. Supply all Caddy site addresses including resolved environment-variable hosts and imported conf.d snippets; provide HTTPS status/latency for each. Confirm Docker inspect bind mount source/destination and read-only flag, plus certificate readability (never send keys).
4. Once all CI gates are green and deployment scripts implement tested backup/rollback, run `bash ops/owner-run/02-deploy-verifier.sh --dry-run` then real mode with owner confirmation.
5. Verify staging containers are healthy and JWT checks pass.
6. Run `bash ops/owner-run/03-caddy-snippet.sh --dry-run`; real mode ONLY when rollback hashes and complete baseline gates pass.
7. Browser: unauthenticated -> Access login; allowlisted email -> staging; other email -> denied; direct origin IP -> denied; logout `/cdn-cgi/access/logout`; www and JUMPA unaffected.

Respond **"sudah, Bro"** with redacted logs, all hostname status/latency, mount metadata and browser checklist. Never send cert keys, cookies or JWTs.

## Architecture and security tradeoff

Verifier and static staging share the existing external Caddy network; no host ports are published. Other containers on that Docker network can reach the verifier directly; verifier itself only validates signed Access JWT and exposes a health endpoint. Origin bypass must be tested separately. If the network cannot be used, connecting Caddy to another network is a **new owner decision**, not an agent action.

## Owner read-only commands for missing evidence

```bash
docker inspect -f '{{range .Mounts}}{{println .Source .Destination .RW}}{{end}}' bahasacerdas-prod-caddy-1
docker exec bahasacerdas-prod-caddy-1 sh -c "grep -nE '^[^ #].*\\{|^[[:space:]]*import[[:space:]]' /etc/caddy/Caddyfile"
docker exec bahasacerdas-prod-caddy-1 sh -c 'ls -la /etc/caddy/conf.d; grep -nE "^[^ #].*\\{" /etc/caddy/conf.d/*.caddy'
```

The owner must also supply resolved site addresses from Caddy environment values and all imported snippets; do not guess from these grep outputs.

## Fast owner-only Phase 1 path (still blocked until all gates)

Inventory parser expects **explicit section markers** `[CADDY_ADAPT_JSON]`, `[CURL]`, `[MOUNTS]`, `[IMPORTS]` (and matching closing tags). Put the complete JSON returned by `caddy adapt --pretty` in the first section. CURL lines use `host HTTP:status LATENCY:seconds`. MOUNTS lines use `Source Destination RW`; IMPORTS lines use `import /etc/caddy/conf.d/*.caddy`. Unknown lines and missing statuses fail closed. This normalized format is required; arbitrary console output is not silently guessed.

**Owner sequence:** 01 read-only preflight -> send full inventory -> ingest -> inspect diff -> owner-run orchestration (01 -> 02 -> 03 -> 04). Do not copy generated config into active config until every hostname, mount and import is reviewed.

```bash
# On the owner's authorized machine/checkout, NOT an agent VPS session:
git switch feat/staging-auth-crud
bash ops/owner-run/01-preflight.sh
# Save and inspect complete inventory-output.txt in documented normalized format.
bash ops/owner-run/ingest-inventory.sh inventory-output.txt
diff -u ops/owner-run/config.env ops/owner-run/config.env.generated || true
# Only after complete independent review of generated data and CI evidence:
# cp ops/owner-run/config.env.generated ops/owner-run/config.env
bash ops/owner-run/run-phase1.sh --dry-run
# Real mode intentionally blocked until full production backup/rollback is implemented and CI proven:
# bash ops/owner-run/run-phase1.sh
```

**Rollback owner command** (only with verified backup and fully tested 99 real mode): `bash ops/owner-run/99-rollback.sh /path/to/verified/dated-backup`. At present, 99 real mode intentionally refuses. Do not assume a rollback was performed. Caddy must remain the existing production container; never connect it to another network, restart or recreate it.

**After deployment:** `04-verify.sh` performs read-only baseline comparisons (preserves non-200 statuses), Access 302, direct-origin denial if `ORIGIN_IP` is explicitly supplied, verifier health and port bindings, cert validity and key mode. Owner must still test allowlisted login, other email rejection, logout via `/cdn-cgi/access/logout`, www and JUMPA.

**Security caution:** `run-phase1.sh` is a fail-closed orchestration scaffold, not a production-ready installer. Its 03/99 real modes remain blocked, and it cannot guarantee rollback before a backup path has been verified. Never bypass those gates.
