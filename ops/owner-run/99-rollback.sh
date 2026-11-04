#!/usr/bin/env bash
set -euo pipefail
echo "Rollback ONLY BC Book Studio snippet. Other routes are untouched."
backup="${1:?Usage: 99-rollback.sh /absolute/path/to/previous/bcbookstudio.caddy.backup}"
[[ -f "$backup" ]] || { echo "Backup missing"; exit 1; }
read -r -p "Restore BC Book Studio snippet and reload Caddy? [yes/NO] " answer
[[ "$answer" == yes ]] || exit 0
dest=/opt/bahasacerdas/config/caddy.d/bcbookstudio.caddy
sudo cp "$backup" "$dest"
docker exec bahasacerdas-prod-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec bahasacerdas-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile
echo "Rollback applied; verify host baselines."
