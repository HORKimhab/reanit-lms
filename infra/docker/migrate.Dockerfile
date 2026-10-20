# One-shot image that applies packages/db migrations to DATABASE_URL (the owner connection), then exits.
# Build from the repo root: docker build -f infra/docker/migrate.Dockerfile -t reanit-migrate .
# Each deploy runs it before starting the new api and worker (infra/deploy/deploy.sh).

FROM node:24.21-alpine
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@reanit/db"
# The Prisma CLI directly, so the container needs neither pnpm nor a writable store at run time.
WORKDIR /repo/packages/db
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
