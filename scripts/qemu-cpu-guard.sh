#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"
qemu=$(command -v qemu-x86_64 || command -v qemu-x86_64-static || true)
if [ -z "$qemu" ]; then
  echo "qemu-x86_64 is required" >&2
  exit 1
fi
if ! command -v gcc >/dev/null 2>&1; then
  echo "gcc is required to confirm CPUID" >&2
  exit 1
fi
node_bin=$(command -v node)
gcc -O2 -o /tmp/cpu-check "$root/scripts/cpu-check.c"
"$qemu" -cpu qemu64 /tmp/cpu-check
"$qemu" -cpu qemu64 "$node_bin" "$root/scripts/load-server-modules.cjs"

if [ ! -f "$root/.next/standalone/server.js" ]; then
  echo "Missing .next/standalone/server.js. Run npm run build first." >&2
  exit 1
fi
mkdir -p "$root/.next/standalone/.next" "$root/.next/standalone/public"
cp -a "$root/.next/static" "$root/.next/standalone/.next/static"
cp -a "$root/public/." "$root/.next/standalone/public/"
if [ -d "$root/assets" ]; then
  rm -rf "$root/.next/standalone/assets"
  cp -a "$root/assets" "$root/.next/standalone/assets"
fi
if [ -d "$root/node_modules/pdfjs-dist/legacy/build" ]; then
  mkdir -p "$root/.next/standalone/node_modules/pdfjs-dist/legacy/build"
  cp -a "$root/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs" "$root/.next/standalone/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
fi
if find "$root/.next/standalone" -path '*@napi-rs/canvas*' -print -quit | grep -q .; then
  echo "Standalone image still contains @napi-rs/canvas" >&2
  exit 1
fi

port=${QEMU_GUARD_PORT:-3198}
export PORT=$port
export HOSTNAME=127.0.0.1
export NODE_ENV=production
log=/tmp/qemu-server.log
(
  cd "$root/.next/standalone" || exit 1
  exec "$qemu" -cpu qemu64 "$node_bin" server.js
) >"$log" 2>&1 &
server=$!
cleanup() { kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
ready=0
i=0
while [ "$i" -lt 90 ]; do
  if ! kill -0 "$server" 2>/dev/null; then
    echo "Server exited before ready" >&2
    cat "$log" >&2
    exit 132
  fi
  if curl -sf "http://127.0.0.1:$port/api/health" >/dev/null; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "Health check did not succeed" >&2
  cat "$log" >&2
  exit 1
fi
curl -sf "http://127.0.0.1:$port/api/health"
echo
export_code=$(curl -s -o /tmp/qemu-export.out -w '%{http_code}' "http://127.0.0.1:$port/api/books/cpu-guard/export?format=pdf&preview=1" || true)
if ! kill -0 "$server" 2>/dev/null; then
  echo "Export request killed the server (SIGILL)" >&2
  cat "$log" >&2
  exit 132
fi
case "$export_code" in
  [1-5][0-9][0-9]) ;;
  *) echo "Export route returned $export_code" >&2; cat "$log" >&2; exit 1 ;;
esac
echo "export status $export_code"
