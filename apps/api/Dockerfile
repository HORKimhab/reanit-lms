# apps/api image. Build from the repo root: docker build -f apps/api/Dockerfile -t reanit-api .
# The build stage bundles the app with the workspace packages (see tsup.config.ts); the runtime
# stage holds only that bundle and the API's own production dependencies, and runs as `node`.

FROM node:24.21-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "api..."
RUN pnpm turbo run build --filter=api
# Production dependencies only; the @reanit/* packages are already inside dist.
RUN pnpm --filter api deploy --prod --legacy /out

FROM node:24.21-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]
