#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/owner-run/config.env
source "$base/config.env"
backup="${1:-}"
if [[ "$backup" == "--dry-run" ]]; then
  echo "DRY RUN: restore dated conf.d backup to $HOST_CONFD; validate; reload; verify all baseline hosts"
  exit 0
fi
[[ -n "$backup" && -d "$backup" ]] || { echo "Usage: $0 BACKUP_DIRECTORY [--dry-run]"; exit 2; }
[[ "${2:-}" != "--dry-run" ]] || { echo "DRY RUN: would restore $backup"; exit 0; }
echo "BLOCKED: full-directory restoration is not yet tested in CI; no production changes performed."
exit 1
