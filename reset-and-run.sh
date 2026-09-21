#!/usr/bin/env bash
set -uo pipefail

# Full local reset: wipes the Postgres volume, brings db/rabbitmq back up
# fresh (which auto-applies docs/db/schema.sql + docs/db/seed.sql via
# docker-entrypoint-initdb.d — see docker-compose.yml), then (re)starts
# apps/agent, apps/api, apps/edge and the dashboard.
#
# Usage: ./reset-and-run.sh
#
# Does NOT touch ngrok — the tunnel URL stays whatever it already is, so
# the WhatsApp webhook subscription never needs re-pointing.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${ROOT_DIR}/.run-logs"
mkdir -p "$LOG_DIR"

log() { echo "==> $*"; }

# Each of these runs under a watch/reload supervisor (tsx watch, uvicorn
# --reload), which is a PARENT + CHILD pair — `ss`'s single reported pid is
# only the child bound to the socket. Killing just that one leaves the
# parent alive, which can respawn a new child that then loses an
# "Address already in use" race against a freshly-started replacement,
# leaving a process that's listening at the TCP level but never actually
# answers a request. Match by full command line instead, so both die.
stop_service() {
  local pattern="$1" label="$2"
  local pids
  pids="$(pgrep -f "$pattern" || true)"
  if [ -n "$pids" ]; then
    log "Stopping ${label} (pids: $(echo "$pids" | tr '\n' ' '))"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
}

wait_port_free() {
  local port="$1" tries=15
  while [ "$tries" -gt 0 ]; do
    if ! ss -ltn 2>/dev/null | grep -q ":${port} "; then
      return 0
    fi
    sleep 1
    tries=$((tries - 1))
  done
  return 1
}

# Confirms the process actually answers a request, not just that something
# is listening on the port — a stuck/half-started process can do the latter
# without doing the former (exactly what broke the WhatsApp webhook once).
wait_for_service() {
  local name="$1" port="$2" path="${3:-/}" tries=30
  while [ "$tries" -gt 0 ]; do
    if curl -s --max-time 3 -o /dev/null "http://localhost:${port}${path}"; then
      log "${name}: up and responding on :${port}"
      return 0
    fi
    sleep 1
    tries=$((tries - 1))
  done
  echo "    ${name}: NOT RESPONDING on :${port} after 30s — check ${LOG_DIR}/${name}.log"
  return 1
}

log "Stopping app processes (agent, api, edge, dashboard)..."
stop_service "tsx watch --env-file-if-exists=.env src/index.ts" "agent"
stop_service "env-cmd.*tsx watch src/index.ts" "api"
stop_service "uvicorn edge.main:app" "edge"
stop_service "apps/dashboard.*vite" "dashboard"
sleep 2

for port in 4111 4000 8000 5173; do
  if ! wait_port_free "$port"; then
    log "Port ${port} still held — force-killing the remaining listener"
    pid="$(ss -ltnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
  fi
done

log "Wiping the Postgres volume..."
docker compose down -v

log "Starting db + rabbitmq fresh (auto-applies schema.sql + seed.sql)..."
docker compose up -d db rabbitmq

log "Waiting for Postgres to finish init and apply the seed..."
tries=30
until docker exec conversational-commerce-db-1 pg_isready -U kadakaran >/dev/null 2>&1; do
  tries=$((tries - 1))
  if [ "$tries" -le 0 ]; then
    echo "    Postgres did not become ready in time — check docker logs conversational-commerce-db-1"
    exit 1
  fi
  sleep 1
done
# pg_isready flips true briefly between the init-db run and the real
# restart that follows it — give the entrypoint's second startup a moment
# to finish before treating the DB as ready.
sleep 3

catalog_count="$(docker exec conversational-commerce-db-1 psql -U kadakaran -d kadakaran -tAc 'select count(*) from catalog;' 2>/dev/null || echo 0)"
log "Seed applied — ${catalog_count} catalog items loaded."

log "Starting apps/agent, apps/api, apps/edge, apps/dashboard..."
(cd apps/agent && nohup npx tsx watch --env-file-if-exists=.env src/index.ts > "${LOG_DIR}/agent.log" 2>&1 & disown)
(cd apps/api && nohup npx env-cmd tsx watch src/index.ts > "${LOG_DIR}/api.log" 2>&1 & disown)
(cd apps/edge && nohup uv run uvicorn edge.main:app --reload --port 8000 > "${LOG_DIR}/edge.log" 2>&1 & disown)
(cd apps/dashboard && nohup npx vite > "${LOG_DIR}/dashboard.log" 2>&1 & disown)

log "Waiting for services to come up..."
sleep 4

ok=1
wait_for_service agent 4111 "/" || ok=0
wait_for_service api 4000 "/api/health" || ok=0
wait_for_service edge 8000 "/webhook?hub.mode=subscribe&hub.verify_token=secret_token&hub.challenge=1" || ok=0
wait_for_service dashboard 5173 "/" || ok=0

if [ "$ok" -eq 1 ]; then
  log "All services up. Logs in ${LOG_DIR}/"
else
  log "Some services did not start — check the logs above."
  exit 1
fi
