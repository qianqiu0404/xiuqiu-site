#!/bin/bash
set -uo pipefail

hermes_bin="${HERMES_BIN:-${HOME}/.local/bin/hermes}"
"$hermes_bin" market-radar connection-test
