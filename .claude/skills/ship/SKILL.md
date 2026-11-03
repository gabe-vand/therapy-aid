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
| `api` | Bun + Hono on :3010; SQLite at `/data/therapy-aid.sqlite` and session audio in `/data/recordings` (volume `db-data`) |
| `web` | nginx: the built SPA + `/api/*` → `api:3010` (prefix stripped; 50 MB bodies, 600 s timeouts). Host port `127.0.0.1:8080` only |
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

### Secrets on the Pi

Everything secret or tunable lives in **`~/therapy-aid.env`** on the Pi, outside the deploy dir
(which every deploy replaces). `scripts/deploy.sh` passes it to compose with `--env-file`, and
`docker-compose.yml` forwards the keys below into the `api` container. Every key is optional as far
as `docker compose up` is concerned (unset = empty), but the app needs the first three to be useful.

| Key | What it does |
|---|---|
| `ALLOWED_TAILSCALE_LOGIN` | The one tailnet login allowed in (e.g. `you@gmail.com`). **Unset = the API rejects every request** (fail closed), so a fresh Pi shows 401s until this is set. |
| `ANTHROPIC_API_KEY` | Claude. Without it sessions fail at "summarizing" with a clear message; Retry works once it is set. |
| `DEEPGRAM_API_KEY` | Transcription of recordings. Pasted notes never need it. Without it a recording fails at "transcribing" and the audio stays on disk. |
| `APP_TIMEZONE` | IANA zone for dates the AI sees. Default `America/New_York`. |
| `CLAUDE_MODEL` | Optional: force ONE model for every task. Leave empty to use the per-task routing in `svc-models.ts`. |
| `CLAUDE_MODEL_<TASK>` / `CLAUDE_EFFORT_<TASK>` | Optional per-task overrides. Tasks: `SUMMARIZE`, `MAP_PROBLEMS`, `FOCUS`, `INSIGHT`, `CHAT`, `TITLE`. Effort: `low`, `medium`, `high`, `xhigh`, `max`. Settings > AI usage shows what each task really costs. |
| `TS_AUTHKEY` | Optional non-interactive Tailscale login (see Troubleshooting). |

```bash
# create / edit it (chmod 600: it holds API keys). Plain KEY=value lines, no quotes, no `export`.
$P -t pi@raspberrypi 'touch ~/therapy-aid.env && chmod 600 ~/therapy-aid.env && nano ~/therapy-aid.env'
# apply a change without a full deploy (compose re-reads the env file, recreates only `api`):
$P pi@raspberrypi 'cd therapy-aid && docker compose --env-file ~/therapy-aid.env up -d api'
# confirm what the api booted with: a warning per missing key, never a value
$P pi@raspberrypi 'cd therapy-aid && docker compose logs api | grep -E "\[(auth|ai|deepgram)\]" | tail -12'
```

Never paste a key into chat or a commit. The api's boot log warns about each missing key and prints
the model routing table, never a key's value.

### Seeding history

`scripts/import-seed.ts` loads Gabe's profile, journal and past therapy notes from the local,
gitignored `seed-data/` folder (`profile.md`, `journal.md`, `therapy-notes.md`; each journal/notes
entry starts with a `## YYYY-MM-DD` heading). It runs **on a dev machine over HTTP, never on the
Pi**, and `seed-data/` never ships (it is not in git, so not in `git archive`).

```bash
# 0. The stack must be deployed, ANTHROPIC_API_KEY set (see above), and this machine on the tailnet.
bun scripts/import-seed.ts --dry-run        # parses the files, prints counts and dates, sends nothing
bun scripts/import-seed.ts --url https://therapy-aid.elephant-trench.ts.net --dir seed-data
```

- Order: profile (PUT), then journal entries (POST, skipping any date already present), then therapy
  notes **oldest first**: each note is POSTed to `/sessions/notes`, then the CLI polls the session until
  it is `ready` before sending the next, because problem mapping must see the earlier sessions'
  problems. Expect 1-3 minutes per note (summarize, map problems, refocus); six notes is ~10-15 min.
- `occurred_at` is the heading date at 12:00 local time. Re-running is safe: days that already have a
  journal entry or a `ready` session are skipped, a `failed` session is retried, one still processing is
  waited on.
- The profile is only written when the app has none; if it was edited in Settings the CLI leaves it
  alone (`--overwrite-profile` replaces it).
- `--url` rules: `localhost`/`127.0.0.1` get bare paths (the API directly, `bun run dev:api`); any other
  host gets `/api` appended (nginx strips it). `--prefix` overrides the guess. `--only profile,journal,notes`
  runs a subset; `--timeout <min>` changes the per-session wait (default 15).
- A `failed` session stops the run and prints the session's error. Fix the cause (usually a missing
  `ANTHROPIC_API_KEY`), run the same command again. A 401 means this machine is not on the tailnet as
  `ALLOWED_TAILSCALE_LOGIN`.
- Do not paste seed content into chat or a PR: the repo is public and the files are personal.

After seeding (or once, after margin notes shipped), classify the existing journal against the
problems so Home's "In your journal lately" and each problem's "In your journal" are filled in:

```bash
bun scripts/classify-journal.ts --url https://therapy-aid.elephant-trench.ts.net --dry-run   # counts only
bun scripts/classify-journal.ts --url https://therapy-aid.elephant-trench.ts.net             # Haiku per paragraph, links only, no notes
```

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
- **Recordings are not in the daily snapshots** (they cover the database only). Audio lives in the `db-data` volume under `/data/recordings`; it survives redeploys but not `down -v`.
- **Out of disk:** `docker system df`; `docker builder prune -f` clears build cache.
