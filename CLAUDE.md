# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**therapy-aid** — a personal web app, self-hosted on a Raspberry Pi and reachable **only over the
tailnet** at **https://therapy-aid.elephant-trench.ts.net**. It keeps Gabe's weekly therapy
within reach: sessions (recorded or pasted notes) → summaries → persistent problems → a focus
banner, plus a journal with on-demand insights and a chat grounded in all of it.

Its structure and conventions are adopted from `rx-unified-portal` (Rx Hub) — the same layering,
file-size cap, hooks rule and docs layout, minus everything that existed only because Rx Hub shares
another app's Postgres.

## Git workflow

Work happens on a branch and lands through a pull request. **`/ship`** (`.claude/skills/ship/`)
does both halves: commits the current changes to a branch, pushes, opens or updates the PR, and
redeploys that branch to the Pi. Never commit straight to `main`.

**NEVER park or discard the working tree.** No `git stash`, no `git checkout -- <file>`, no
`git reset --hard` — not to compare a test baseline, not "just for a second". An IDE re-saving its
buffers underneath a stash leaves a third version that `git stash pop` refuses to merge. To check
whether a test failure is pre-existing, reason about whether the change touches that path, or ask.
If a clean tree is genuinely required, commit first — commits are cheap here. Any git operation that
would overwrite working-tree files is the user's to run, not yours.

## Working alongside other agents

Several agents may work this repo in parallel. Do the task, say what was done, stop. Working-tree
changes appearing under you — a file holding different content, a test failing in code you never
touched — are almost always a sibling agent, not corruption and not your bug. Don't "repair" the
tree; touch only the files your task needs and mention anything odd in your final message.

## Required reading

Before starting any task, read the relevant conventions file in `docs/`:

- Backend: [`docs/backend-conventions.html`](docs/backend-conventions.html) — read before any work in `backend/`.
- Frontend: [`docs/frontend-conventions.html`](docs/frontend-conventions.html) — read before any work in `frontend/`.
  Also [`docs/frontend-styling.html`](docs/frontend-styling.html) — tokens, theme, `Page` widths, primitives, mobile, the
  journal editor — before touching styles or layout.
- Architecture: [`docs/architecture.html`](docs/architecture.html) — the session pipeline, data model, context pack +
  retrieval — and [`docs/architecture-ops.html`](docs/architecture-ops.html) — model routing and cost (the model
  eval), auth, where data lives on the Pi, seeding, failure behaviour. Read both before touching more than one module.

`docs/` is HTML only. Pages share `docs/docs.css` and follow the rule-card layout (hero → stackline
→ TOC → numbered rule cards). Classic scripts, no build step, no dependencies — the pages open
straight off disk. A page that needs more than one file gets its own folder.

## Hard rules (non-negotiable)

1. **Every file must be below 200 lines.** Split proactively, not after.
   `backend/tests/architecture/file-size.test.ts` enforces it across the whole workspace (code,
   `scripts/`, `docs/` and `features.html`).
2. **Frontend uses hooks wherever possible** — components never call the network directly; every
   API call lives in a `services/hooks/use-*.ts` hook that owns loading/error state.
3. **`features.html` must be updated with EVERY update** — it is the static status page explaining
   what is and isn't implemented. Any change that adds, finishes, or breaks a feature updates it in
   the same commit. The `docs/*.html` pages likewise stay current when conventions change.
   **All documentation lives in `docs/` (plus `features.html`) — never inside `src/`.** A file's
   *why* belongs in its header comment. There is no `.md` under `src/` at all.
4. **Queries live only in `src/repositories/`.** Routes never see the database; services never see
   Drizzle or `svc-db`. `backend/tests/architecture/layering.test.ts` enforces it.
5. **DDL is idempotent and one file per table.** `backend/db-schemas/NNN.<table>.sql` re-runs on
   every boot with no ledger. Changing an existing table appends to that table's own file, dated in
   a comment — a new number is for a new table only.

## Repo layout

A **Bun workspace** (root `package.json` → `backend`, `frontend`, `packages/*`). ONE root `bun.lock`
and ONE `bun install` at the root — `bun install` inside an app is wrong and will fight the workspace.

- `backend/` — Bun + Hono API (TypeScript). SQLite via `bun:sqlite` + Drizzle.
- `frontend/` — Vite + React 18 + TypeScript SPA. Tailwind v4 (layout only) + design tokens in
  `src/styles/tokens.css`, react-router v6.
- `packages/shared/` — `@therapy-aid/shared`: types BOTH apps use. No build step — `main`/`types`
  point at the TypeScript itself. A type goes here only when both sides use it.
- `docs/` — conventions, as HTML (`docs.css` is shared). `features.html` — the living status page.
- `docker-compose.yml`, `*/Dockerfile`, `deploy/` — the Pi stack. `scripts/deploy.sh` ships it.

Each app's `tsconfig.json` extends the root `tsconfig.base.json` and overrides only what is its own.

## Common commands

From the repo root: `bun install` (once, for the whole workspace), then `bun run dev` (frontend on
**:5173**), `bun run dev:api` (API on **:3010**, watch mode), `bun run build`, `bun run test` (both
suites), `bun run deploy` (ship HEAD to the Pi — normally via `/ship`), `bun run eval` (the model
eval, `scripts/eval-models.ts`: real prompts on `seed-data/` per model into the gitignored `eval-out/`;
`--judge` adds Opus grades. Costs real money — run it only when choosing `TASK_MODELS`).

Backend (inside `backend/`): `bun run dev`, `bun run test` (Bun test runner against `tests/`, on an
in-memory SQLite — no files touched), `bun run lint` (typecheck), `bun run format` (Prettier).

Frontend (inside `frontend/`): `bun run dev`, `bun run build` (typecheck + production build),
`bun run lint` (typecheck only), `bun run test` (Vitest + Testing Library on happy-dom).

Formatting: one root `.prettierrc` — 4-space, 250 width, single quotes, trailing commas.

## Database & environment

- **SQLite**, one file. Locally `backend/data/therapy-aid.sqlite` (gitignored, created on first
  boot); on the Pi `/data/therapy-aid.sqlite` inside the `db-data` Docker volume, so it survives
  every redeploy. **Never `docker compose down -v` on the Pi** — that deletes it.
- `dbMigrate()` applies `backend/db-schemas/*.sql` in filename order at boot, before the server
  binds. Each file runs in a transaction.
- **Daily backups** (`services/backups/`): the API takes one `VACUUM INTO` snapshot per UTC day
  (checked on boot and hourly), verifies it with `integrity_check`, and keeps the newest
  `BACKUP_RETENTION_DAYS` (30). On the Pi they land in `~/therapy-aid-backups/` on the host.
  `/health` reports `backup_ok`. Restore steps are in the `/ship` skill.
- Every var has a working local default — `bun run dev:api` needs no env file. New env vars go in
  `EnvKey` + `app_env` (+ `MANDATORY` if required) in `svc-env.ts` **and** `.env.example` in the
  same commit. Read env only through `app_env` / `services/env.ts` — never `process.env.X` or
  `import.meta.env.X` elsewhere.

## Backend architecture

Entry: `backend/src/index.ts` — validates env via `getEnvStatus()` (exits if mandatory vars are
missing), runs `dbMigrate()`, then serves `app` from `src/app.ts` (the mount table, kept separate so
tests drive it with `app.request()`). Path alias `@/*` → `backend/src/*`.

Layering — functional, no classes/DI:
`src/routes/<module>/<router>.ts` (thin Hono routers) → `src/services/<module>/` (business logic)
→ `src/repositories/<module>.ts` (**the only place queries live**) → `src/db/schema/` (entities).
- Routers respond ONLY via `rsp(c, data, stc, message)` with the `stc`/`err` enums — never raw
  `c.json`. Every response is the `{ data, status_code, message }` envelope (`ApiEnvelope`).
- One folder per module under `routes/`, even for a single file.
- `src/services/common/svc-*.ts` — cross-cutting infra (env, db, migrate, response).
- Routers mount at **bare paths** (`/hello`, `/health`); the `/api` prefix the SPA uses is stripped
  by nginx (Pi) and the Vite proxy (dev).

## Frontend architecture

Entry: `frontend/src/main.tsx` → `App.tsx` (flat `<Routes>`). Path alias `@` → `frontend/src`.
- `pages/` — one component per screen. `components/<feature>/` — feature components.
- `services/api.ts` — the only fetch wrapper; resolves to the envelope and never throws.
  Components consume `services/hooks/use-*.ts`.
- **Same origin.** `env.api_base_url` defaults to the relative `/api`.
- Styling: tokens from `src/styles/tokens.css` (`var(--ink)`, `var(--surface)`, `var(--accent)`, …)
  — never hardcoded colors. Tailwind v4 for layout utility only.

## Hosting (the Pi)

- Host: `pi@raspberrypi` over the tailnet (Pi 4, Debian 12 arm64). On Windows, use the system
  OpenSSH (`/c/Windows/System32/OpenSSH/ssh.exe`) — the key lives in the Windows ssh-agent, which
  Git Bash's `ssh` can't see. `scripts/deploy.sh` already picks the right one.
- Stack: `docker compose` project `therapy-aid` in `~/therapy-aid` — `api` (Bun), `web` (nginx: SPA
  + `/api` proxy), `ts` (Tailscale sidecar, node name `therapy-aid`, `tailscale serve` HTTPS on
  :443, Funnel off). Only the tailnet can reach it; the one host port is `127.0.0.1:8080`.
- The deploy dir is replaced wholesale on every deploy (`git archive HEAD`) — never keep state
  there. State lives in the `db-data` and `ts-state` volumes (recordings sit next to the database
  in `db-data`), backups in `~/therapy-aid-backups/`, secrets in `~/therapy-aid.env`.
  `ALLOWED_TAILSCALE_LOGIN` is effectively required there: unset, every request except `/health` is
  rejected. `ANTHROPIC_API_KEY` / `DEEPGRAM_API_KEY` are optional at boot (AI and transcription fail
  with a readable message until set).
- Full runbook: `.claude/skills/ship/SKILL.md` — including "Secrets on the Pi" (the env file's keys)
  and "Seeding history" (`scripts/import-seed.ts`).

## When adding a new API endpoint

1. Create `routes/<module>/<module>.ts` + `services/<module>/` + (queries only)
   `repositories/<module>.ts`; mount in `src/app.ts`.
2. New tables: `backend/db-schemas/NNN.<table>.sql` (next free number, idempotent) + Drizzle schema
   in `src/db/schema/`. Changing an EXISTING table appends to that table's file (hard rule 5).
3. A response shape the SPA also reads goes in `@therapy-aid/shared`.
4. New env vars: `svc-env.ts` + `.env.example` (same commit).
5. Write tests; **update `features.html`** (hard rule 3).
