# therapy-aid API — Bun + Hono, SQLite via bun:sqlite (no native module to compile on arm64).
#
# BUILD CONTEXT IS THE REPO ROOT, not backend/ — the bun workspace lockfile and packages/shared
# live there: `docker build -f backend/Dockerfile .` (docker-compose.yml already does this).
FROM oven/bun:1
WORKDIR /app

# Workspace manifests first, for layer caching. Every member's package.json must be present or
# the root install has nothing to resolve `workspace:*` against. --production skips devDeps,
# which keeps the frontend's whole build toolchain (vite, vitest, …) out of this image.
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY backend/package.json backend/bunfig.toml ./backend/
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile --production

COPY packages/shared ./packages/shared
WORKDIR /app/backend
COPY backend/tsconfig.json ./
COPY backend/db-schemas ./db-schemas
COPY backend/src ./src

# The SQLite file lives in the /data volume and its daily snapshots in /backups (see
# docker-compose.yml) — never in the image.
ENV PORT=3010 DB_PATH=/data/therapy-aid.sqlite BACKUP_DIR=/backups APP_ENV=production
EXPOSE 3010
CMD ["bun", "src/index.ts"]
