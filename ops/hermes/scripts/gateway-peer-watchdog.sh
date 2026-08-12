#!/bin/bash
set -uo pipefail

hermes_bin="${HERMES_BIN:-${HOME}/.local/bin/hermes}"
primary_home="${GATEWAY_WATCHDOG_PRIMARY_HOME:-${HOME}/.hermes}"
secondary_profile="${GATEWAY_WATCHDOG_SECONDARY_PROFILE:-radar-secondary}"
secondary_home="${GATEWAY_WATCHDOG_SECONDARY_HOME:-${primary_home}/profiles/${secondary_profile}}"
self_home="${HERMES_HOME:-$primary_home}"
failure_threshold="${GATEWAY_WATCHDOG_FAILURE_THRESHOLD:-2}"
heartbeat_max_age="${GATEWAY_WATCHDOG_HEARTBEAT_MAX_AGE:-180}"

case "$failure_threshold" in
  ''|*[!0-9]*) failure_threshold=2 ;;
esac
case "$heartbeat_max_age" in
  ''|*[!0-9]*) heartbeat_max_age=180 ;;
esac
if [ "$failure_threshold" -lt 1 ]; then failure_threshold=1; fi
if [ "$heartbeat_max_age" -lt 60 ]; then heartbeat_max_age=60; fi

if [ "$self_home" = "$secondary_home" ] || [[ "$0" == "$secondary_home"/* ]]; then
  self_alias="secondary"
  self_label="第二微信"
  peer_alias="primary"
  peer_label="主微信"
  peer_home="$primary_home"
  if [ "${GATEWAY_WATCHDOG_NO_JITTER:-0}" != "1" ]; then sleep 12; fi
else
  self_alias="primary"
  self_label="主微信"
  peer_alias="secondary"
  peer_label="第二微信"
  peer_home="$secondary_home"
fi

state_dir="${GATEWAY_WATCHDOG_STATE_DIR:-${primary_home}/state}"
mkdir -p "$state_dir"
chmod 700 "$state_dir" 2>/dev/null || true
lock_dir="${state_dir}/gateway-peer-watchdog.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  if find "$lock_dir" -maxdepth 0 -mmin +3 -print -quit 2>/dev/null | grep -q .; then
    rmdir "$lock_dir" 2>/dev/null || exit 0
    mkdir "$lock_dir" 2>/dev/null || exit 0
  else
    exit 0
  fi
fi
trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT

state_path="${state_dir}/gateway-peer-watchdog-${peer_alias}.json"

json_value() {
  local file="$1" path="$2" fallback="$3"
  python3 - "$file" "$path" "$fallback" <<'PY'
import json
import sys

file_path, dotted_path, fallback = sys.argv[1:]
try:
    with open(file_path, encoding="utf-8") as handle:
        value = json.load(handle)
    for key in dotted_path.split("."):
        value = value[key]
except (OSError, ValueError, TypeError, KeyError):
    raise SystemExit(1)

if value is None:
    value = fallback
if isinstance(value, bool):
    print("true" if value else "false")
elif isinstance(value, (str, int, float)):
    print(value)
else:
    raise SystemExit(1)
PY
}

file_mtime() {
  if stat -f %m "$1" >/dev/null 2>&1; then
    stat -f %m "$1"
  else
    stat -c %Y "$1"
  fi
}

health_reason="healthy"
peer_is_healthy() {
  local gateway_state="${peer_home}/gateway_state.json"
  local heartbeat="${peer_home}/state/gateway.heartbeat"
  local gateway_status weixin_status pid heartbeat_mtime now
  if [ ! -s "$gateway_state" ]; then health_reason="gateway_state_missing"; return 1; fi
  if [ ! -s "$heartbeat" ]; then health_reason="heartbeat_missing"; return 1; fi
  gateway_status=$(json_value "$gateway_state" "gateway_state" "unknown" 2>/dev/null) || {
    health_reason="gateway_state_invalid"; return 1;
  }
  weixin_status=$(json_value "$gateway_state" "platforms.weixin.state" "unknown" 2>/dev/null) || {
    health_reason="gateway_state_invalid"; return 1;
  }
  pid=$(json_value "$gateway_state" "pid" "0" 2>/dev/null) || {
    health_reason="gateway_state_invalid"; return 1;
  }
  if [ "$gateway_status" != "running" ]; then health_reason="gateway_not_running"; return 1; fi
  if [ "$weixin_status" != "connected" ]; then health_reason="weixin_disconnected"; return 1; fi
  case "$pid" in ''|*[!0-9]*) health_reason="process_unavailable"; return 1 ;; esac
  if [ "$pid" -le 1 ] || ! kill -0 "$pid" 2>/dev/null; then
    health_reason="process_unavailable"; return 1
  fi
  heartbeat_mtime=$(file_mtime "$heartbeat") || {
    health_reason="heartbeat_unreadable"; return 1;
  }
  now=$(date +%s)
  if [ $((now - heartbeat_mtime)) -gt "$heartbeat_max_age" ]; then
    health_reason="heartbeat_stale"; return 1
  fi
  return 0
}

previous_failures=0
previous_alerted=false
if [ -s "$state_path" ]; then
  previous_failures=$(json_value "$state_path" "consecutiveFailures" "0" 2>/dev/null || printf '0')
  previous_alerted=$(json_value "$state_path" "alerted" "false" 2>/dev/null || printf 'false')
fi
case "$previous_failures" in ''|*[!0-9]*) previous_failures=0 ;; esac
if [ "$previous_alerted" != "true" ]; then previous_alerted=false; fi

send_message() {
  local body="$1" result
  result=$(HERMES_HOME="$self_home" "$hermes_bin" send --to weixin --json "$body" 2>/dev/null) || return 1
  provider_message_id=$(printf '%s' "$result" | python3 -c '
import json
import sys

try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
message_id = payload.get("message_id") if isinstance(payload, dict) else None
if payload.get("success") is not True or not isinstance(message_id, str) or not message_id:
    raise SystemExit(1)
print(message_id)
' 2>/dev/null) || return 1
  return 0
}

write_state() {
  local health="$1" failures="$2" alerted="$3" reason="$4" receipt="$5" notification_kind="$6" temporary
  local final_receipt="$receipt" final_kind="$notification_kind" notified_at=""
  if [ -s "$state_path" ]; then
    if [ -z "$final_receipt" ]; then final_receipt=$(json_value "$state_path" "providerMessageId" "" 2>/dev/null || true); fi
    if [ -z "$final_kind" ]; then final_kind=$(json_value "$state_path" "lastNotificationKind" "" 2>/dev/null || true); fi
    notified_at=$(json_value "$state_path" "lastNotifiedAt" "" 2>/dev/null || true)
  fi
  if [ -n "$receipt" ]; then notified_at=$(date -u +%Y-%m-%dT%H:%M:%SZ); fi
  temporary=$(mktemp "${state_dir}/.gateway-peer-watchdog.XXXXXX") || exit 1
  python3 - "$temporary" "$peer_alias" "$health" "$failures" "$alerted" "$reason" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$final_receipt" "$final_kind" "$notified_at" <<'PY'
import json
import sys

path, peer, health, failures, alerted, reason, checked_at, receipt, notification_kind, notified_at = sys.argv[1:]
payload = {
    "peer": peer,
    "health": health,
    "consecutiveFailures": int(failures),
    "alerted": alerted == "true",
    "lastReason": reason,
    "checkedAt": checked_at,
    "providerMessageId": receipt or None,
    "lastNotificationKind": notification_kind or None,
    "lastNotifiedAt": notified_at or None,
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    handle.write("\n")
PY
  chmod 600 "$temporary"
  mv "$temporary" "$state_path"
}

provider_message_id=""
beijing_now=$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')
if peer_is_healthy; then
  if [ "$previous_alerted" = "true" ]; then
    recovery_message="【Hermes 双微信恢复】
${peer_label} gateway 已恢复，进程心跳和微信连接均正常。
当前通知由${self_label}发送。
北京时间：${beijing_now}
仅恢复雷达派发与简单对话能力；系统未读取另一微信的聊天内容。"
    if send_message "$recovery_message"; then
      write_state "healthy" 0 false "healthy" "$provider_message_id" "recovery"
    else
      write_state "healthy" 0 true "recovery_notification_failed" "" ""
    fi
  else
    write_state "healthy" 0 false "healthy" "" ""
  fi
  exit 0
fi

failures=$((previous_failures + 1))
if [ "$failures" -ge "$failure_threshold" ] && [ "$previous_alerted" != "true" ]; then
  alert_message="【Hermes 双微信告警】
${peer_label} gateway 连续 ${failures} 次健康检查失败。
检测结果：${health_reason}
影响：该账号可能暂时无法接收雷达或进行简单对话；${self_label}仍在运行。
北京时间：${beijing_now}
系统会继续检查，恢复后另行通知。此检查只看运行状态，不读取聊天内容。"
  if send_message "$alert_message"; then
    write_state "unhealthy" "$failures" true "$health_reason" "$provider_message_id" "alert"
  else
    write_state "unhealthy" "$failures" false "alert_notification_failed" "" ""
  fi
else
  write_state "unhealthy" "$failures" "$previous_alerted" "$health_reason" "" ""
fi
