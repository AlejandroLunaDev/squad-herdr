#!/usr/bin/env bash
# Opens one herdr pane per role in the current tab. Each pane runs its own Claude Code
# session named <tab>-<role>, started from the plugin agent squad:<role>.
# Usage, from a pane inside herdr: squad-up.sh [role...]
# Inside Claude Code, /squad [role...] runs this script.
# With no roles, run from a terminal, it shows an fzf menu of every role with orquestador
# and implementador pre-marked; Esc opens nothing and leaves this pane open. Without a
# terminal (the /squad command) or without fzf it opens orquestador and implementador.
# On demand only (never pre-marked): revisor, charla, disenador, pm.
# Layout: charla gets a full-height column on the left; the other roles fill a grid
# to its right, row by row, with ceil(sqrt(n)) columns. The launcher pane closes last.
# Runs on macOS, Linux and Windows (Git Bash) with bash 3.2 or later. Needs herdr and
# claude on PATH; fzf is optional. The mods cache-clock and token-weather are not loaded
# here: they are installed as dependencies of the squad plugin.
set -euo pipefail

: "${HERDR_TAB_ID:?run this from a pane inside herdr}"
: "${HERDR_PANE_ID:?run this from a pane inside herdr}"

# json_string <key>: the string value of <key> in the JSON herdr prints on one line.
# Plain sed, so BSD and GNU sed read it alike.
json_string() {
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"
}

tab=$(herdr tab get "$HERDR_TAB_ID" | json_string label)
# Git Bash: pwd -W gives the Windows form (C:/...) that herdr and claude expect there.
# Elsewhere pwd -W fails and plain pwd answers.
cwd=$(pwd -W 2>/dev/null || pwd)

if [ $# -eq 0 ]; then
  set -- orquestador implementador
  if [ -t 0 ] && command -v fzf >/dev/null; then
    # The menu is a centered box over the zoomed launcher; every fzf exit (pick, Esc,
    # Ctrl-C, failure) un-zooms before the first split. pos(1) and pos(2) pre-mark the
    # first two lines, so the default stays on top. Each line is "role  description": only
    # the role is searched and printed (--nth, --accept-nth). The description is gray
    # through --ansi because fzf on Windows draws 16 colors and drops dim and bold.
    herdr pane zoom "$HERDR_PANE_ID" --on >/dev/null
    rc=0
    picked=$(printf '%-16s\033[90m%s\033[0m\n' \
      orquestador 'plans the tab, orders the others' \
      implementador 'the only writer: code, tests, commits' \
      revisor 'reviews pull requests, read-only' \
      charla 'answers questions, cheaply' \
      disenador 'screens, emails and visual pieces' \
      pm 'the whole project: map, product, checks' |
      fzf --multi --ansi --nth=1 --accept-nth=1 \
        --layout=reverse --border=rounded --border-label=' squad ' --margin=30%,30% --padding=1 \
        --prompt='filter › ' --pointer='❯ ' --marker='✓ ' --gutter=' ' --info=inline-right --no-separator \
        --footer=$'Tab mark/unmark · type to filter\nEnter open the marked · Esc cancel' \
        --color='bg+:-1,marker:bright-green,pointer:bright-cyan,prompt:cyan,border:bright-black,label:bright-white,footer:bright-black' \
        --bind 'load:pos(1)+toggle+pos(2)+toggle+first') || rc=$?
    herdr pane zoom "$HERDR_PANE_ID" --off >/dev/null
    # One role per line, split into the arguments on purpose.
    # shellcheck disable=SC2086
    case $rc in
      0) set -- $picked ;;
      1 | 130) exit 0 ;; # 1: Enter with nothing to pick; 130: Esc
      *) echo "fzf exited $rc, opening orquestador implementador" >&2 ;;
    esac
  fi
fi

# role_config <role>: sets model and effort, or exits on an unknown role. Models are
# aliases, so each role follows the latest model of its family.
role_config() {
  case "$1" in
    orquestador) model=opus; effort=high ;;
    implementador) model=opus; effort=xhigh ;;
    revisor) model=haiku; effort=high ;;
    charla) model=sonnet; effort=medium ;;
    disenador) model=opus; effort=high ;;
    pm) model=opus; effort=high ;;
    *) echo "unknown role: $1" >&2; exit 1 ;;
  esac
}

# Every role is checked before the first split, so a typo creates no panes.
charla=() grid=()
for role in "$@"; do
  role_config "$role"
  if [ "$role" = charla ]; then charla=(charla); else grid+=("$role"); fi
done
n=${#grid[@]}
cols=1
while [ $((cols * cols)) -lt "$n" ]; do cols=$((cols + 1)); done
rows=$(((n + cols - 1) / cols))

# split <pane> <direction> <k>: the pane keeps 1/k of its space and the new pane id goes
# to $pane. Splitting the new pane again with k-1, k-2, ... 2 leaves k even parts.
split() {
  pane=$(herdr pane split --pane "$1" --direction "$2" --ratio "$(printf '0.%04d' $((10000 / $3)))" --cwd "$cwd" | json_string pane_id)
}

# One pane per role, in the order charla, then the grid row by row.
panes=()
area=$HERDR_PANE_ID
if [ ${#charla[@]} -gt 0 ]; then
  split "$area" right 2
  area=$pane
  panes+=("$pane")
fi
if [ "$n" -gt 0 ]; then
  # Charla keeps 1/3 and the grid 2/3; the ratio holds once the launcher closes and its
  # space goes to them. Without charla the launcher keeps 1/3 and the grid gets all of it later.
  split "$area" right 3
  starts=("$pane")
  for ((k = rows; k > 1; k--)); do split "$pane" down "$k"; starts+=("$pane"); done
  for ((r = 0; r < rows; r++)); do
    pane=${starts[r]}
    panes+=("$pane")
    k=$((n - r * cols < cols ? n - r * cols : cols))
    for ((; k > 1; k--)); do split "$pane" right "$k"; panes+=("$pane"); done
  done
fi

# ${a[@]+"${a[@]}"} expands an empty array to nothing: bash 3.2 (macOS) stops on a
# plain "${a[@]}" of an empty array under set -u.
i=0
for role in ${charla[@]+"${charla[@]}"} ${grid[@]+"${grid[@]}"}; do
  role_config "$role"
  pane=${panes[i]}
  i=$((i + 1))
  herdr pane run "$pane" "claude --agent squad:$role --name $tab-$role --model $model --effort $effort"
  echo "$tab-$role -> $pane"
done

herdr pane close "$HERDR_PANE_ID"
