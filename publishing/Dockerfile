# Build-only network access is required to install verified tools.
# Run this image with --network none, --read-only, --cap-drop ALL and resource limits.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl python3 epubcheck poppler-utils \
    fonts-noto-core fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ARG QUARTO_VERSION=1.11.9
ARG QUARTO_SHA256=64078d1623d9ab89da766591f3410a0756f3737a37efb0897c7e84b863bf092a
RUN curl -fsSL --retry 3 \
    "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.deb" \
    -o /tmp/quarto.deb \
    && echo "${QUARTO_SHA256}  /tmp/quarto.deb" | sha256sum -c - \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/quarto.deb \
    && rm -f /tmp/quarto.deb \
    && rm -rf /var/lib/apt/lists/*
COPY publishing /opt/bc/publishing
ENV PYTHONPATH=/opt/bc
ENV HOME=/tmp XDG_CACHE_HOME=/tmp/.cache QUARTO_DENO_DIR=/tmp/deno
WORKDIR /work
USER 65532:65532
ENTRYPOINT ["python3", "-m", "publishing.render_job"]
