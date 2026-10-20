# apps/web image (Next.js standalone server). Build from the repo root:
#   docker build -f infra/docker/web.Dockerfile -t reanit-web .
# NEXT_PUBLIC_* values are inlined into the browser bundle, so each environment builds its own image.
# API_URL is baked into the `/api/*` rewrite at build time; the default is the api service in infra/deploy.

FROM node:24.21-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_DEPLOY_ENV
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile --filter "web..."
# Workspace packages through turbo; web itself directly, since turbo's strict env mode would drop API_URL.
RUN pnpm turbo run build --filter="web^..."
RUN pnpm --filter web build

FROM node:24.21-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
