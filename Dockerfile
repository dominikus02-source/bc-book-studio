# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Migration tooling is separate from the small web runtime.
FROM deps AS migrator
ARG REVISION=unknown
LABEL org.opencontainers.image.revision=$REVISION
COPY --chown=node:node prisma ./prisma
RUN ./node_modules/.bin/prisma generate
USER node
ENTRYPOINT ["./node_modules/.bin/prisma"]
CMD ["migrate", "status"]

FROM deps AS builder
COPY . .
RUN mkdir -p public && npm run build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.revision=$REVISION
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
