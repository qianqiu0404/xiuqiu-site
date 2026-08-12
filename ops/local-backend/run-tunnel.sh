#!/bin/zsh
set -euo pipefail
env_file="${RADAR_ENV_FILE:?RADAR_ENV_FILE is required}"
[[ -f "$env_file" && ! -L "$env_file" && "$(stat -f '%Lp' "$env_file")" = "600" ]] || { print -u2 'Radar env file must be regular, non-symlink and 0600.'; exit 64; }
set -a; source "$env_file"; set +a
for file in "${RADAR_TUNNEL_CONFIG:?}" "${RADAR_TUNNEL_CREDENTIALS:?}"; do
  [[ "$file" = /* && -f "$file" && ! -L "$file" && "$(stat -f '%Lp' "$file")" = "600" ]] || { print -u2 'Tunnel files must be absolute, regular, non-symlink and 0600.'; exit 64; }
done
binary="${RADAR_CLOUDFLARED_BIN:?RADAR_CLOUDFLARED_BIN is required}"
[[ "$binary" = /* && -x "$binary" ]] || { print -u2 'cloudflared must be an absolute executable.'; exit 64; }
/usr/bin/grep -Fq "hostname: ${RADAR_PUBLIC_HOSTNAME:?}" "$RADAR_TUNNEL_CONFIG"
/usr/bin/grep -Fq 'service: http://127.0.0.1:4320' "$RADAR_TUNNEL_CONFIG"
! /usr/bin/grep -Eq '4321|trycloudflare' "$RADAR_TUNNEL_CONFIG"
exec "$binary" tunnel --config "$RADAR_TUNNEL_CONFIG" run "${RADAR_NAMED_TUNNEL_ID:?}"
