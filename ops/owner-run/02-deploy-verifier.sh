#!/usr/bin/env bash
set -euo pipefail
echo "Will deploy ONLY bc-book-studio verifier using its own compose file."
read -r -p "Confirm verifier deployment? [yes/NO] " answer
[[ "$answer" == yes ]] || exit 0
mkdir -p "$HOME/bcbookstudio-owner-logs"
log="$HOME/bcbookstudio-owner-logs/verifier-$(date -u +%Y%m%dT%H%M%SZ).log"
{
 docker compose --project-directory /opt/bc-book-studio -f /opt/bc-book-studio/compose.phase1.yml config --quiet
 docker compose --project-directory /opt/bc-book-studio -f /opt/bc-book-studio/compose.phase1.yml up -d --no-deps verifier
 docker inspect bc-book-studio-staging-verifier-1 --format '{{.State.Health.Status}}'
} 2>&1 | tee "$log"
