#!/bin/bash
set -uo pipefail

lock_dir="${TMPDIR:-/tmp}/xiuqiu-learning-radar-dispatch.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  if find "$lock_dir" -maxdepth 0 -mmin +10 -print -quit 2>/dev/null | grep -q .; then
    rmdir "$lock_dir" 2>/dev/null || exit 0
    mkdir "$lock_dir" 2>/dev/null || exit 0
  else
    exit 0
  fi
fi
trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT

hermes_bin="${HERMES_BIN:-${HOME}/.local/bin/hermes}"
output=$("$hermes_bin" learning-radar prepare 2>&1)
exit_code=$?
if [ -n "$output" ]; then printf '%s\n' "$output"; fi
exit "$exit_code"
