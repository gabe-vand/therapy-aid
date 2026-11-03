---
name: ship
description: Ship the current changes — commit them to a branch, push, open (or update) the GitHub pull request, and redeploy that branch to the Raspberry Pi so it is live at https://therapy-aid.elephant-trench.ts.net. Use when asked to ship, open/update a PR, deploy, redeploy, or "push this to the Pi", and to troubleshoot the Pi stack (containers, Tailscale sidecar, SQLite volume).
---

# Ship: PR + redeploy to the Pi

Two halves, always in this order: **(A) get the changes into a PR**, then **(B) deploy that exact
commit to the Pi**. B ships committed `HEAD` only, so A must have committed everything first.

> The Pi runs **whatever was shipped last** — usually an open PR's branch, not `main`. Say which
> branch and SHA went live in the final report.

## A. Pull request

1. **Look first.** `git status`, `git diff --stat`, `git log --oneline -5`, and the current branch.
   If nothing is uncommitted and the branch has no unpushed commits, skip to B (redeploy only).
2. **Pre-flight** — from the repo root, all must pass; fix failures before shipping, don't skip:
   `bun run test`, `bun run --cwd backend lint`, `bun run build`.
   Also confirm `features.html` reflects the change (CLAUDE.md hard rule 3).
3. **Branch.** If on `main`, create a branch named for the change (`feat/…`, `fix/…`, `chore/…`).
   Never commit to `main` directly. On an existing feature branch, keep using it.
4. **Commit** the relevant files by name (not `git add -A` blindly — check for stray artifacts,
   `.env` files, `*.sqlite`). Message: imperative summary line, a short body on the *why*, and
   end with the attribution line this session's instructions specify.
5. **Push**: `git push -u origin <branch>`.
6. **PR**: `gh pr view --json url,state 2>/dev/null` — if an open PR exists for the branch, the
   push already updated it; otherwise
   `gh pr create --base main --title "<summary>" --body "<what / why / how it was tested>"`
   (end the body with the attribution line this session's instructions specify).
   Report the PR URL.

**GitHub auth:** the repo is `gabe-vand/therapy-aid`. If push or `gh` fails with 403/permission
errors, the active account is the wrong one — check `gh auth status` and switch with
`gh auth switch --user gabe-vand` (git push uses the same credential via GCM). Don't work around
it; tell the user.

## B. Redeploy to the Pi

Run from the repo root (Git Bash):

```bash
bun run deploy          # = bash scripts/deploy.sh
```

What it does (read `scripts/deploy.sh` for detail):
1. Refuses if the tree is dirty — only committed `HEAD` ships.
2. Streams `git archive HEAD` over ssh into `~/therapy-aid` on the Pi (staged, then swapped in).
3. `APP_REVISION=<sha> docker compose up -d --build --remove-orphans` on the Pi; prunes old images.
4. Polls `/api/health` until it reports the new revision — first on the Pi (`127.0.0.1:8080`), then
   over the tailnet URL. Exit 0 only when the new SHA answers on the tailnet.

The Pi builds the images itself (arm64). A cold build takes a few minutes; incremental ones are
faster thanks to layer caching. Use a generous Bash timeout (≥ 10 min) or run it in the background.

Env overrides: `DEPLOY_HOST` (default `pi@raspberrypi`), `DEPLOY_DIR`, `DEPLOY_URL`,
`DEPLOY_WAIT_SECONDS`.

## The Pi

| | |
|---|---|
| ssh | `pi@raspberrypi` over the tailnet (MagicDNS). On Windows use `/c/Windows/System32/OpenSSH/ssh.exe` — the key is in the Windows ssh-agent, which Git Bash's `ssh` can't see. `raspberrypi.local` (mDNS) and the LAN IPs only work at home. |
| Box | Raspberry Pi 4, 3.7 GB RAM, Debian 12 (bookworm) arm64, Docker CE + compose plugin |
| Deploy dir | `~/therapy-aid` — **replaced on every deploy**; never keep state in it |
| Compose project | `therapy-aid` (`docker-compose.yml`) |
| URL | https://therapy-aid.elephant-trench.ts.net — tailnet only, Funnel off |

| Container | Role |
|---|---|
| `api` | Bun + Hono on :3010; SQLite at `/data/therapy-aid.sqlite` (volume `db-data`) |
| `web` | nginx: the built SPA + `/api/*` → `api:3010` (prefix stripped). Host port `127.0.0.1:8080` only |
| `ts` | Tailscale sidecar — tailnet node `therapy-aid`, `tailscale serve` HTTPS :443 → `web:80`. Identity in volume `ts-state` |

### Troubleshooting

```bash
P=/c/Windows/System32/OpenSSH/ssh.exe
$P pi@raspberrypi 'cd therapy-aid && docker compose ps'
$P pi@raspberrypi 'cd therapy-aid && docker compose logs --tail=100 api'   # or web / ts
$P pi@raspberrypi 'curl -s http://127.0.0.1:8080/api/health'
```

- **Pi reachable, tailnet URL not:** the `ts` node isn't logged in (fresh Pi, `ts-state` volume
  deleted, or key expired). Run `bash scripts/ts-login.sh` **on the Pi** in `~/therapy-aid` (in the
  background — it blocks until approved) and give the user the URL it prints, **as plain text in
  chat** (not inside a question widget — they need to copy it). Do NOT hand out the URL from
  `docker compose logs ts`: containerboot restarts `tailscale up` every 60 s and mints a new node
  key each time, so an approved link from those logs is usually already dead (it also leaves a
  stale machine holding the name). Afterwards, disable key expiry for the machine in the admin
  console. Non-interactive alternative: `TS_AUTHKEY=tskey-…` in `~/therapy-aid.env`, then redeploy.
- **`ts` restart-looping with "changing settings via 'tailscale up' requires mentioning all
  non-default flags":** the saved prefs differ from containerboot's flags. `TS_AUTH_ONCE=true` in
  `docker-compose.yml` prevents this; if it reappears, check that var is still set.
- **Name came up as `therapy-aid-1`:** an older `therapy-aid` machine still exists in the admin
  console — delete it there, then `docker compose restart ts`.
- **Data:** SQLite lives in the `db-data` volume and survives redeploys and `docker compose down`.
  **Never run `docker compose down -v`** — it deletes the live database (the backups survive).

### Backups and restore

The API snapshots the database once per UTC day into `~/therapy-aid-backups/therapy-aid-YYYY-MM-DD.sqlite`
on the Pi (verified with `integrity_check`, newest 30 kept). `curl …/api/health` → `backup_ok`
must be `true`; if not, `docker compose logs api | grep backup`.

```bash
# list / copy one off the Pi (Windows ssh for the key):
$P pi@raspberrypi 'ls -lh ~/therapy-aid-backups'
/c/Windows/System32/OpenSSH/scp.exe pi@raspberrypi:therapy-aid-backups/therapy-aid-2026-11-03.sqlite .

# restore a snapshot ON THE PI (in ~/therapy-aid). Stops the API, keeps the current DB aside:
docker compose stop api
docker run --rm -v therapy-aid_db-data:/data -v ~/therapy-aid-backups:/backups alpine sh -c \
  'mkdir -p /data/pre-restore && mv /data/therapy-aid.sqlite* /data/pre-restore/ ; cp /backups/therapy-aid-YYYY-MM-DD.sqlite /data/therapy-aid.sqlite'
docker compose start api
```

Restoring is destructive to everything written since that snapshot — confirm with the user first.
- **Out of disk:** `docker system df`; `docker builder prune -f` clears build cache.
