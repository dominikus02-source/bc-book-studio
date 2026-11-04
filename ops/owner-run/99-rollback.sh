#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/owner-run/config.env
source "$base/config.env"
if [[ "${1:-}" == "--ci-fixture" ]]; then
  [[ "${BC_CI_FIXTURE:-}" == "1" && -n "${BC_CI_ROOT:-}" && "$BC_CI_ROOT" == /tmp/* ]] || { echo "BLOCKED: fixture isolation missing"; exit 1; }
  [[ -f "$BC_CI_ROOT/.fixture-marker" && -d "$BC_CI_ROOT/conf.d" ]] || { echo "BLOCKED: fixture marker missing"; exit 1; }
  backup="${2:-}"
  [[ -d "$backup" && "$backup" == "$BC_CI_ROOT"/backup-* ]] || { echo "BLOCKED: fixture backup invalid"; exit 1; }
  mv "$BC_CI_ROOT/conf.d" "$BC_CI_ROOT/replaced-$(date +%s%N)"
  cp -a "$backup" "$BC_CI_ROOT/conf.d"
  bash "$BC_CI_ROOT/validate.sh"
  bash "$BC_CI_ROOT/reload.sh"
  bash "$BC_CI_ROOT/baseline.sh"
  echo "CI FIXTURE: restored original conf.d"
  exit 0
fi
backup="${1:-}"
if [[ "$backup" == "--dry-run" ]]; then
  echo "DRY RUN: restore dated conf.d backup to $HOST_CONFD; validate; reload; verify all baseline hosts"
  exit 0
fi
[[ -n "$backup" && -d "$backup" ]] || { echo "Usage: $0 BACKUP_DIRECTORY [--dry-run]"; exit 2; }
[[ "${2:-}" != "--dry-run" ]] || { echo "DRY RUN: would restore $backup"; exit 0; }
echo "BLOCKED: full-directory restoration is not yet tested in CI; no production changes performed."
exit 1
