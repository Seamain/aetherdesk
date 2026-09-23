# ---- Build frontend ----
FROM node:24-slim AS client-build
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY client/package.json ./client/package.json
RUN pnpm install --filter client --frozen-lockfile
COPY client ./client
RUN pnpm --filter client build

# ---- Runtime ----
# Production: set AETHER_TOKEN so dangerous APIs require Bearer auth.
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate \
  && pnpm install --prod --frozen-lockfile
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist
COPY start.sh daemon.sh ./
RUN mkdir -p /app/data \
  && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 3001
ENV PORT=3001
# REQUIRED for production — Bearer auth on dangerous APIs (kill/runner/proxy/scripts/backup/webhook mutate):
# ENV AETHER_TOKEN=change-me
CMD ["node", "server/index.js"]
