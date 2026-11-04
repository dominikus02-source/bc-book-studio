#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_file="${1:--}"
if [[ "$source_file" != "-" && ! -f "$source_file" ]]; then echo "ERROR: inventory file missing" >&2; exit 2; fi
python3 "$base/ingest-inventory.py" "$source_file" "$base/config.env" "$base/config.env.generated"
diff -u "$base/config.env" "$base/config.env.generated" || [[ $? -eq 1 ]]
