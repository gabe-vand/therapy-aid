# therapy-aid frontend — build with Bun, serve static with nginx.
#
# BUILD CONTEXT IS THE REPO ROOT, not frontend/ — the bun workspace lockfile and packages/shared
# live there: `docker build -f frontend/Dockerfile .` (docker-compose.yml already does this).
#
# SINGLE ORIGIN: nginx serves the SPA and proxies /api/* to the backend over the compose network,
# so VITE_API_BASE_URL stays unset and env.ts falls back to the relative /api.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json backend/bunfig.toml ./backend/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY frontend ./frontend
ARG VITE_APP_ENV=production
ENV VITE_APP_ENV=$VITE_APP_ENV
RUN bun run --cwd frontend build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
