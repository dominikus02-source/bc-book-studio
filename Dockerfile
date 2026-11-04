# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,id=book-npm,target=/root/.npm,sharing=locked npm ci --prefer-offline --no-audit --no-fund
COPY . .
RUN --mount=type=cache,id=book-next,target=/app/.next/cache,sharing=locked npm run build
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
USER node
CMD ["npm","run","start"]
