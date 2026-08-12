# GymGuide, for `docker compose up`.
#
# One stage on purpose: the container also runs migrations and the seed, which
# need the TypeScript sources and tsx at run time, so there is nothing to gain
# from copying a slimmer artefact across.
FROM node:22-bookworm-slim

# Postgres client tools are not needed by the app, but they make it possible to
# inspect the database from inside the container while debugging.
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Manifests first, so a source change does not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/domain/package.json ./packages/domain/
COPY packages/ui/package.json ./packages/ui/

# The mobile app is an Expo project that this image never builds or runs, and
# its dependency tree is large. Skipping it keeps the image small.
RUN pnpm install --frozen-lockfile --filter '!@gymguide/mobile'

COPY . .

# Build with a placeholder database URL: `next build` collects page data and
# must not need a live server to do it.
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgres://placeholder@localhost:5432/placeholder \
    DATABASE_APP_URL=postgres://placeholder@localhost:5432/placeholder \
    SESSION_SECRET=build-time-placeholder-value-not-used-at-runtime \
    pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
