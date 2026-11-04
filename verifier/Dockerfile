FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
FROM base AS test
COPY requirements-test.txt .
RUN pip install --no-cache-dir -r requirements-test.txt
COPY tests/ /tests/
ENV CF_ACCESS_TEAM_DOMAIN=test.cloudflareaccess.com CF_ACCESS_AUD=local-test-audience
CMD ["python", "-m", "pytest", "-q", "/tests"]
FROM base AS runtime
RUN useradd --system --uid 10001 studio
USER 10001:10001
EXPOSE 8080
CMD ["python", "server.py"]
