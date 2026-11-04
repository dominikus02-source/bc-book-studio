# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
ARG BUILD_CACHE_SCOPE=bc-book-studio-production
ARG TARGETOS
ARG TARGETARCH
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,id=${BUILD_CACHE_SCOPE}-node22-${TARGETOS}-${TARGETARCH}-npm,target=/root/.npm/_cacache,sharing=locked npm ci --prefer-offline --no-audit --no-fund
COPY . .
RUN --mount=type=cache,id=${BUILD_CACHE_SCOPE}-node22-${TARGETOS}-${TARGETARCH}-webpack,target=/app/.next/cache/webpack,sharing=locked --mount=type=cache,id=${BUILD_CACHE_SCOPE}-node22-${TARGETOS}-${TARGETARCH}-turbopack,target=/app/.next/cache/turbopack,sharing=locked --mount=type=cache,id=${BUILD_CACHE_SCOPE}-node22-${TARGETOS}-${TARGETARCH}-swc,target=/app/.next/cache/swc,sharing=locked npm run build
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
USER node
CMD ["npm","run","start"]
