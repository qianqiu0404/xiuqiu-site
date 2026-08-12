#!/bin/zsh
set -euo pipefail
mode="${1:-}"
env_file="${RADAR_ENV_FILE:?RADAR_ENV_FILE is required}"
[[ -f "$env_file" && ! -L "$env_file" ]] || { print -u2 'Radar env file must be a regular non-symlink file.'; exit 64; }
[[ "$(stat -f '%Lp' "$env_file")" = "600" ]] || { print -u2 'Radar env file must have mode 0600.'; exit 64; }
set -a
source "$env_file"
set +a
repo_dir="${RADAR_REPO_DIR:?RADAR_REPO_DIR is required}"
state_dir="${RADAR_STATE_DIR:?RADAR_STATE_DIR is required}"
node_bin="${RADAR_NODE_BIN:?RADAR_NODE_BIN is required}"
npm_bin="${RADAR_NPM_BIN:?RADAR_NPM_BIN is required}"
for executable in "$node_bin" "$npm_bin"; do
  [[ "$executable" = /* && -x "$executable" ]] || { print -u2 'Runtime executables must be absolute and executable.'; exit 64; }
  resolved="$(realpath "$executable")"
  [[ -f "$resolved" && -x "$resolved" ]] || { print -u2 'Runtime executable target is invalid.'; exit 64; }
done
export PATH="${node_bin:h}:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$state_dir/pids"
pid_file="$state_dir/pids/${mode}.pid"
[[ ! -L "$pid_file" ]] || { print -u2 'Refusing symlink pid file.'; exit 64; }
print -r -- "$$" >| "$pid_file"
export MARKET_RADAR_DATABASE_URL="$RADAR_LOCAL_DATABASE_URL"
export RADAR_DATABASE_DRIVER=pg RADAR_LOCAL_BACKEND=true RADAR_ENABLE_QIU_MARKET=false
cd "$repo_dir"
case "$mode" in
  public-api) exec "$node_bin" ops/local-backend/server.mjs --public ;;
  internal-api) exec "$node_bin" ops/local-backend/server.mjs --internal ;;
  market-worker) exec "$npm_bin" run market-radar:worker ;;
  learning-worker) exec "$npm_bin" run learning-radar:worker ;;
  digest) exec "$node_bin" ops/local-backend/digest-catchup.mjs ;;
  log-rotation) exec "$node_bin" ops/local-backend/rotate-logs.mjs ;;
  status) exec "$node_bin" ops/local-backend/status.mjs ;;
  *) print -u2 'Unsupported local backend service.'; exit 64 ;;
esac
