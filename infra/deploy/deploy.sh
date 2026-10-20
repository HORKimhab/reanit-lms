#!/usr/bin/env sh
# Deploys one image tag on the droplet: pull, migrate the database, then replace the running containers.
# Run from /opt/reanit by .github/workflows/deploy.yml, or by hand to roll back: ./deploy.sh <tag>.
# Migrations only move forward, so a rollback runs older code against the newer schema.
# DOCKER_CONFIG points at the short-lived, read-only registry login the workflow uploads.
set -eu

tag="${1:?usage: deploy.sh <image tag>}"
cd "$(dirname "$0")"

# Record the tag in .env, so later `docker compose` commands keep using this release.
sed -i '/^IMAGE_TAG=/d' .env
echo "IMAGE_TAG=${tag}" >>.env

docker compose --profile migrate pull --quiet
docker compose run --rm migrate
docker compose up -d --remove-orphans --wait
docker image prune -f
