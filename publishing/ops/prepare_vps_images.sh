#!/usr/bin/env bash
# Isolated, release-gated image preparation. Never modifies existing services.
# Requires a CLEAN checkout of the feature branch outside active production trees.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
REPO="$(pwd -P)"
case "$REPO" in
  /opt/bc-book-studio-runtime/source|/opt/bc-book-studio-runtime/source/*|/opt/bahasacerdas/*)
    echo "BLOCKED: refusing to build from active production source" >&2; exit 2;;
esac
if [[ "$(git branch --show-current)" != "feat/scientific-publishing-toolchain-20261104" ]]; then
  echo "BLOCKED: wrong source branch" >&2; exit 2
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "BLOCKED: working tree must be clean" >&2; exit 2
fi
python3 publishing/ops/vps_preflight.py || exit 2
if [[ "${1:-}" != "--apply" ]]; then
  echo "PREFLIGHT PASS ONLY: pass --apply to prepare isolated images (no app deployment)"
  exit 0
fi
sha="$(git rev-parse --short=12 HEAD)"
before="$(mktemp)"
after="$(mktemp)"
trap 'rm -f "$before" "$after"' EXIT
docker ps --format '{{.ID}} {{.Names}} {{.Status}}' | sort > "$before"
echo "Building new isolated images; no running services will be modified."
docker build --progress plain -f publishing/Dockerfile.science -t "bc-book-science:${sha}" .
docker build --progress plain -f publishing/Dockerfile.geo --build-arg "SCIENCE_IMAGE=bc-book-science:${sha}" -t "bc-book-geo:${sha}" .
docker build --progress plain -f publishing/Dockerfile -t "bc-book-quarto:${sha}" .
for image in "bc-book-science:${sha}" "bc-book-geo:${sha}" "bc-book-quarto:${sha}"; do
  docker image inspect "$image" >/dev/null
done
docker run --rm --network none --read-only --cap-drop ALL \
  --pids-limit 64 --memory 2g --cpus 1 --tmpfs /tmp:rw,nosuid,size=256m \
  --entrypoint python "bc-book-science:${sha}" -m unittest discover -s /opt/bc/publishing/tests -p test_scientific_assets.py -v
docker run --rm --network none --read-only --cap-drop ALL \
  --pids-limit 64 --memory 2g --cpus 1 --tmpfs /tmp:rw,nosuid,size=256m \
  --entrypoint python "bc-book-geo:${sha}" -m unittest discover -s /opt/bc/publishing/tests -p test_geospatial.py -v
docker run --rm --network none --read-only --cap-drop ALL \
  --tmpfs /tmp:rw,nosuid,size=256m --entrypoint quarto "bc-book-quarto:${sha}" --version
docker ps --format '{{.ID}} {{.Names}} {{.Status}}' | sort > "$after"
if ! diff -u "$before" "$after"; then
  echo "BLOCKED: running container inventory changed during build; investigate" >&2
  exit 3
fi
echo "ISOLATED_IMAGES_VERIFIED ${sha}; NO persistent worker started, NO release performed."
