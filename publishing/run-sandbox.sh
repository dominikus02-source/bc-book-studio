#!/usr/bin/env bash
# The host must provide Docker with rootless/user-namespace isolation in production.
# Usage: bash publishing/run-sandbox.sh /absolute/input /absolute/output
set -euo pipefail
if [[ "$#" -ne 2 ]]; then
  echo "Usage: bash publishing/run-sandbox.sh /absolute/input /absolute/output" >&2
  exit 64
fi
input="$(realpath -e "$1")"
output="$(realpath -e "$2")"
[[ -d "$input" && -d "$output" ]] || { echo "Input and output must exist" >&2; exit 64; }
[[ -z "$(find "$output" -mindepth 1 -maxdepth 1 -print -quit)" ]] || { echo "Output must be empty" >&2; exit 64; }
# Never run against live production source volumes; pass only reviewed job directories.
exec docker run --rm \
  --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --cpus 2 --memory 1536m --memory-swap 1536m \
  --user 65532:65532 \
  --tmpfs /tmp:rw,nosuid,nodev,size=768m,uid=65532,gid=65532 \
  --tmpfs /work:rw,nosuid,nodev,size=768m,uid=65532,gid=65532 \
  --mount "type=bind,src=$input,dst=/input,readonly" \
  --mount "type=bind,src=$output,dst=/output" \
  bc-book-studio-qmd:1.11.9 /input /output
