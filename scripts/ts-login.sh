#!/usr/bin/env bash
# One-time (or after a key expiry) Tailscale login for the `ts` sidecar, run ON THE PI from
# ~/therapy-aid: `bash scripts/ts-login.sh`.
#
# Why not just read the login URL from `docker compose logs ts`: containerboot gives
# `tailscale up` 60 s, then restarts — and until a login completes nothing is persisted, so every
# restart mints a NEW node key and a new URL. Approving any URL but the very latest authorizes a
# key that is already gone (and leaves a dead "therapy-aid" machine squatting on the name).
#
# This instead runs tailscaled in a throwaway container on the SAME state volume and waits as
# long as it takes. Once approved the identity is in the volume, and the real sidecar boots
# already logged in. No auth key or other secret is involved.
set -euo pipefail

VOLUME=therapy-aid_ts-state
NAME=therapy-aid-ts-login

docker compose stop ts
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -v "$VOLUME:/var/lib/tailscale" tailscale/tailscale:stable \
    tailscaled --statedir=/var/lib/tailscale --tun=userspace-networking >/dev/null

# Wait for tailscaled's socket, then block on the login. `tailscale up` prints the URL to open.
while docker exec "$NAME" tailscale status 2>&1 | grep -q 'failed to connect'; do sleep 1; done
echo "ts-login: open the URL below and approve the machine (no time limit)."
# Same flags containerboot uses (--accept-dns=false is its default), so the saved prefs match.
docker exec "$NAME" tailscale up --hostname=therapy-aid --accept-dns=false

docker rm -f "$NAME" >/dev/null
# --no-deps: start ONLY the sidecar. Without it compose recreates api too, minus APP_REVISION.
docker compose up -d --no-deps ts
echo "ts-login: logged in; the ts sidecar is starting with the saved identity."
