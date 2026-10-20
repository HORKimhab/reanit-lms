# Image for a Nest app (apps/api or apps/worker). Build from the repo root:
#   docker build -f infra/docker/nest.Dockerfile --build-arg APP=api -t reanit-api .
# The build stage bundles the app with the workspace packages (see packages/config/tsup.nest.js); the
# runtime stage holds only that bundle and the app's own production dependencies, and runs as `node`.
# Health checks live in the compose files, since the worker serves no HTTP.

FROM node:24.21-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG APP
COPY . .
RUN pnpm install --frozen-lockfile --filter "${APP}..."
RUN pnpm turbo run build --filter="${APP}"
# Production dependencies only; the @reanit/* packages are already inside dist.
RUN pnpm --filter "${APP}" deploy --prod --legacy /out

FROM node:24.21-alpine AS runtime
ARG APP
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/${APP}/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "--import", "./dist/instrument.js", "dist/main.js"]
