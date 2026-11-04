#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.env
source "$base/config.env"
compose="$base/../../compose.phase1.yml"
if [[ "${1:-}" == "--dry-run" ]]; then
  printf 'DRY RUN: docker compose -f %q config --quiet\n' "$compose"
  printf 'DRY RUN: docker compose -f %q up -d --no-deps verifier static\n' "$compose"
  exit 0
fi
[[ $# -eq 0 ]] || { echo "Usage: $0 [--dry-run]"; exit 2; }
read -r -p "Deploy ONLY Phase 1 verifier/static containers? [yes/NO] " answer
[[ "$answer" == yes ]] || exit 0
export CADDY_NETWORK
docker network inspect "$CADDY_NETWORK" >/dev/null
[[ -n "${CF_ACCESS_TEAM_DOMAIN:-}" && -n "${CF_ACCESS_AUD:-}" ]] || { echo "Access settings missing; do not echo their values"; exit 1; }
docker compose -f "$compose" config --quiet
docker compose -f "$compose" up -d --no-deps verifier static
docker compose -f "$compose" ps
