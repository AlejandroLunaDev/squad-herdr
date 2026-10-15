#!/usr/bin/env bash
# Runs squad-up.sh against the stub herdr next to this file and checks the herdr calls it
# makes. Stdin is not a terminal, so no fzf menu opens.
# Usage: tests/squad-up/run.sh [shell]   The shell runs the script; CI passes /bin/bash,
# which is bash 3.2 on macOS.
set -u

here=$(cd "$(dirname "$0")" && pwd)
script=$here/../../plugins/squad/scripts/squad-up.sh
shell=${1:-bash}
log=$(mktemp)
trap 'rm -f "$log"' EXIT
failures=0

# check <name> <expected exit code> <expected launch lines> <role...>: runs the script with
# the roles and compares its exit code and the stub's pane run and pane close calls.
check() {
  name=$1 want_rc=$2 want=$3
  shift 3
  : >"$log"
  rc=0
  out=$(HERDR_STUB_LOG=$log HERDR_TAB_ID=tab HERDR_PANE_ID=p0 PATH="$here:$PATH" "$shell" "$script" "$@" </dev/null 2>&1) || rc=$?
  got=$(grep -E '^pane (run|close) ' "$log")
  if [ "$rc" = "$want_rc" ] && [ "$got" = "$want" ]; then
    echo "ok   $name"
  else
    failures=$((failures + 1))
    printf 'FAIL %s (exit %s, want %s)\n--- want\n%s\n--- got\n%s\n--- output\n%s\n' "$name" "$rc" "$want_rc" "$want" "$got" "$out"
  fi
}

orquestador='claude --agent squad:orquestador --name try-orquestador --model opus --effort high'
implementador='claude --agent squad:implementador --name try-implementador --model opus --effort xhigh'
revisor='claude --agent squad:revisor --name try-revisor --model haiku --effort high'
charla='claude --agent squad:charla --name try-charla --model sonnet --effort medium'

# No roles and no terminal: the default pair. Charla is never set, so this covers an empty
# array under set -u.
check 'no roles opens orquestador and implementador' 0 "pane run p1 $orquestador
pane run p2 $implementador
pane close p0"

# Charla alone leaves the grid empty.
check 'charla alone' 0 "pane run p1 $charla
pane close p0" charla

# Charla gets the left column; the other three fill a 2 x 2 grid, row by row.
check 'charla plus a grid of three' 0 "pane run p1 $charla
pane run p2 $orquestador
pane run p4 $implementador
pane run p3 $revisor
pane close p0" orquestador implementador revisor charla

# An unknown role stops before the first split.
check 'unknown role fails' 1 '' bogus
if grep -q '^pane split' "$log"; then
  failures=$((failures + 1))
  echo 'FAIL unknown role made split calls'
else
  echo 'ok   unknown role makes no split calls'
fi

[ "$failures" -eq 0 ] || { echo "$failures failed"; exit 1; }
echo 'all passed'
