#!/usr/bin/env bash
# Ships the committed HEAD to the Pi and rebuilds the stack there. Called by the /ship skill;
# safe to run by hand from the repo: `bun run deploy`.
#
# What ships is `git archive HEAD` — committed work only, streamed over ssh — so the Pi needs no
# GitHub access and no clone. Data is untouched: SQLite and the Tailscale node identity live in
# named Docker volumes, not in the deploy directory this replaces.
#
# Success means the NEW revision answers on the tailnet URL — not merely that compose exited 0.
set -euo pipefail

HOST="${DEPLOY_HOST:-pi@raspberrypi}"
REMOTE_DIR="${DEPLOY_DIR:-therapy-aid}" # relative to the Pi user's $HOME
URL="${DEPLOY_URL:-https://therapy-aid.elephant-trench.ts.net}"
WAIT_SECONDS="${DEPLOY_WAIT_SECONDS:-180}"

# Windows: Git Bash's ssh can't see keys held by the Windows ssh-agent; the system OpenSSH can.
SSH=ssh
[ -x /c/Windows/System32/OpenSSH/ssh.exe ] && SSH=/c/Windows/System32/OpenSSH/ssh.exe

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
    echo "deploy: uncommitted changes — only HEAD ships. Commit (or stash) first." >&2
    exit 1
fi
REV="$(git rev-parse --short HEAD)"
echo "deploy: shipping $REV ($(git rev-parse --abbrev-ref HEAD)) to $HOST:~/$REMOTE_DIR"

# 1. Replace the deploy dir with HEAD's tree. Extract into a staging dir first, so a dropped
#    connection never leaves a half-written tree where the old one was.
git archive --format=tar HEAD | $SSH "$HOST" "set -e; rm -rf '$REMOTE_DIR.next'; mkdir -p '$REMOTE_DIR.next'; tar -x -C '$REMOTE_DIR.next'; rm -rf '$REMOTE_DIR'; mv '$REMOTE_DIR.next' '$REMOTE_DIR'"

# 2. Rebuild and restart on the Pi. Only containers whose image changed are recreated.
$SSH "$HOST" bash -s -- "$REMOTE_DIR" "$REV" <<'REMOTE'
set -euo pipefail
cd "$HOME/$1"
env_args=()
[ -f "$HOME/therapy-aid.env" ] && env_args=(--env-file "$HOME/therapy-aid.env")
APP_REVISION="$2" docker compose "${env_args[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null
REMOTE

# 3. Wait for the new revision: first on the Pi itself (the stack is up), then over the tailnet
#    (the hosting is up). Either can lag a few seconds behind compose.
wait_for() { # <label> <command…> — retries until the command's output carries $REV
    local label="$1" deadline=$((SECONDS + WAIT_SECONDS))
    shift
    until "$@" 2>/dev/null | grep -q "\"revision\":\"$REV\""; do
        if [ "$SECONDS" -ge "$deadline" ]; then
            echo "deploy: $label never reported revision $REV" >&2
            return 1
        fi
        sleep 3
    done
    echo "deploy: $label ✓ revision $REV"
}

wait_for "Pi (127.0.0.1:8080)" $SSH "$HOST" "curl -fsS http://127.0.0.1:8080/api/health"
if ! wait_for "tailnet ($URL)" curl -fsS "$URL/api/health"; then
    echo "deploy: the stack is up but the tailnet URL is not. If the ts sidecar has never logged in" >&2
    echo "        (fresh Pi, deleted ts-state volume, expired key), run its one-time login:" >&2
    echo "        $SSH $HOST 'cd $REMOTE_DIR && bash scripts/ts-login.sh'" >&2
    exit 1
fi
echo "deploy: live at $URL"
