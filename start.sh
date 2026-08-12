#!/usr/bin/env bash
#
# Start GymGuide on this machine, from nothing, in one command.
#
#   ./start.sh
#
# Checks what it needs, writes a .env with real generated secrets, creates the
# database, applies the 19 migrations, seeds the demo gym, builds, starts, and
# prints the accounts to sign in with.
#
# Safe to re-run. It will not overwrite an existing .env, and re-seeding is
# how you get back to a clean demo.
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; OFF=$'\033[0m'
say()  { printf '%s▸%s %s\n' "$GREEN" "$OFF" "$1"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$OFF" "$1"; }
die()  { printf '\n%s✗ %s%s\n\n%s\n\n' "$RED" "$1" "$OFF" "$2" >&2; exit 1; }

PORT="${PORT:-3000}"
DB_NAME="${DB_NAME:-gymguide}"

# ---------------------------------------------------------------------------
# 1. What we need
# ---------------------------------------------------------------------------
say "Checking prerequisites"

command -v node >/dev/null 2>&1 || die "Node.js is not installed." \
  "Install Node 20.11 or newer: https://nodejs.org
Then run ./start.sh again."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node $(node -v) is too old." "GymGuide needs Node 20.11 or newer."
fi

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm is missing — installing it with corepack"
  corepack enable >/dev/null 2>&1 || die "Could not enable corepack." \
    "Install pnpm manually: npm install -g pnpm@10
Then run ./start.sh again."
  corepack prepare pnpm@10.33.0 --activate >/dev/null 2>&1 || true
fi

command -v psql >/dev/null 2>&1 || die "PostgreSQL client tools are not installed." \
  "GymGuide needs PostgreSQL 14 or newer, because the security model is built on
row-level security inside the database rather than in application code.

  macOS     brew install postgresql@16 && brew services start postgresql@16
  Ubuntu    sudo apt install postgresql
  Windows   https://www.postgresql.org/download/windows/

If you would rather not install PostgreSQL, use Docker instead:

  docker compose up

Then open http://localhost:${PORT}"

# ---------------------------------------------------------------------------
# 2. Find a working superuser connection
# ---------------------------------------------------------------------------
say "Looking for a PostgreSQL server"

# An existing .env is the most likely place to find credentials that work, so
# try it before guessing. Probing first meant that anyone whose server needs a
# password failed before their own configuration was ever read.
CANDIDATES=()
if [ -f .env ]; then
  ENV_DB_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- || true)"
  if [ -n "${ENV_DB_URL:-}" ]; then
    CANDIDATES+=("$ENV_DB_URL")
    # The same credentials against the maintenance database, so we can still
    # CREATE DATABASE when the one named in .env does not exist yet.
    CANDIDATES+=("${ENV_DB_URL%/*}/postgres")
  fi
fi
CANDIDATES+=(
  "postgres://postgres@localhost:5432/postgres"
  "postgres://postgres:postgres@localhost:5432/postgres"
  "postgres://$(whoami)@localhost:5432/postgres"
  "postgres://localhost:5432/postgres"
)

PGSUPER=""
for candidate in "${CANDIDATES[@]}"; do
  # PGCONNECT_TIMEOUT stops a wrong host hanging the script; PGPASSWORD='' keeps
  # psql from stopping to prompt when no password is available.
  if PGCONNECT_TIMEOUT=5 psql -w "$candidate" -tAc 'select 1' >/dev/null 2>&1; then
    PGSUPER="$candidate"; break
  fi
done

if [ -z "$PGSUPER" ]; then
  die "Could not connect to PostgreSQL on localhost:5432." \
"Make sure the server is running:

  macOS     brew services start postgresql@16
  Ubuntu    sudo systemctl start postgresql
  Docker    docker compose up   (starts PostgreSQL and GymGuide together)

If your server needs a password or runs elsewhere, set DATABASE_URL in .env
and run ./start.sh again."
fi
say "Connected as a superuser"

# ---------------------------------------------------------------------------
# 3. Environment. Real secrets, generated once, never overwritten.
# ---------------------------------------------------------------------------
if [ -f .env ]; then
  say "Using the .env already here (delete it to start fresh)"
else
  say "Writing .env with freshly generated secrets"
  APP_PASSWORD="$(node -e 'console.log(require("crypto").randomBytes(18).toString("base64url"))')"
  SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64"))')"
  SUPER_PREFIX="${PGSUPER%/postgres}"

  cp .env.example .env
  # The connection strings and the two secrets are the only lines that must
  # differ per machine; everything else in .env.example is a sane default.
  node -e '
    const fs = require("fs");
    const [file, dbUrl, appUrl, secret] = process.argv.slice(1);
    const out = fs.readFileSync(file, "utf8")
      .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${dbUrl}`)
      .replace(/^DATABASE_APP_URL=.*$/m, `DATABASE_APP_URL=${appUrl}`)
      .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);
    fs.writeFileSync(file, out);
  ' .env "${SUPER_PREFIX}/${DB_NAME}" "postgres://gymguide_app:${APP_PASSWORD}@localhost:5432/${DB_NAME}" "$SESSION_SECRET"
fi

# ---------------------------------------------------------------------------
# 4. Database
# ---------------------------------------------------------------------------
if psql -w "$PGSUPER" -tAc "select 1 from pg_database where datname = '${DB_NAME}'" | grep -q 1; then
  say "Database '${DB_NAME}' already exists"
else
  say "Creating database '${DB_NAME}'"
  psql -w "$PGSUPER" -q -c "create database ${DB_NAME}" \
    || die "Could not create the database." "Create it by hand:  createdb ${DB_NAME}"
fi

# ---------------------------------------------------------------------------
# 5. Install, migrate, seed, build
# ---------------------------------------------------------------------------
say "Installing dependencies (a minute or two the first time)"
pnpm install --silent

say "Applying migrations and seeding the demo gym"
# `reset` drops and recreates the schema, so re-running gives a clean demo.
pnpm db:bootstrap

say "Building"
pnpm build >/dev/null 2>&1 || { warn "Production build failed — starting in dev mode instead"; DEV_MODE=1; }

# ---------------------------------------------------------------------------
# 6. Go
# ---------------------------------------------------------------------------
cat <<BANNER

${BOLD}GymGuide is starting on http://localhost:${PORT}${OFF}

  Sign in at ${BOLD}http://localhost:${PORT}/sign-in${OFF}
  Password for every account below: ${BOLD}GymGuide!Demo2026${OFF}

  ${BOLD}Start here${OFF}
    frontdesk@apexfitness.pk     enrol a member, take a payment
    nida.aslam@example.com       lands mid-onboarding; say yes to chest pain
    ayesha.khan@example.com      the member app and the workout player
    coach@apexfitness.pk         copy a program, edit it, publish it
    owner@apexfitness.pk         both branches, money, reports
    manager.dha@apexfitness.pk   ${DIM}the same reports page, one branch${OFF}
    support@gymguide.app         the platform console

  ${DIM}To reset the demo data at any time:  pnpm db:bootstrap${OFF}
  ${DIM}Stop the server with Ctrl-C.${OFF}

BANNER

if [ "${DEV_MODE:-0}" = "1" ]; then
  exec pnpm dev
else
  exec pnpm start
fi
