# squad-herdr

A Claude Code plugin marketplace that opens a squad of role-based Claude Code sessions in one [herdr](https://herdr.dev) tab. Each session plays one role: the orquestador plans the task, the implementador writes the code, the revisor reviews the pull request, and a few more join on demand. One command, `/squad`, splits the tab into one pane per role and starts every session in its pane.

<!-- Image placeholder: docs/squad-tab.png, a herdr tab with the orquestador and implementador panes open. -->

## Requirements

| Tool | Notes |
|------|-------|
| Claude Code | 2.1.287 or later, where mods load by default. |
| herdr | Every role runs in a herdr pane. |
| bash | macOS, Linux, or Git Bash on Windows. |
| fzf | Optional. Shows the role menu when the script runs from a terminal. |

## Install

### Stable channel

Type these at the prompt of a Claude Code session:

```text
/plugin marketplace add AlejandroLunaDev/squad-herdr
/plugin install squad@squad-herdr
```

### Dev channel

The dev channel follows the `dev` branch, so it gets each change before a release:

```text
/plugin marketplace add https://raw.githubusercontent.com/AlejandroLunaDev/squad-herdr/dev/channels/dev/marketplace.json
/plugin install squad@squad-herdr-dev
```

### The mods come with it

Installing `squad` also installs and enables its two dependencies, the mods `cache-clock` and `token-weather`, at the same scope. A mod changes Claude Code's own interface, so both are active in every Claude Code session, not only in squad sessions.

| Mod | What it draws above the prompt |
|-----|--------------------------------|
| `cache-clock` | A countdown ring showing how long the prompt cache stays warm, the last turn's cache tokens and, on a subscription, the usage windows. |
| `token-weather` | A forecast of the context window: a weather icon, the fill percentage and a chart of the last turns. |

## Usage

Run `/squad` in a Claude Code session that runs inside a herdr pane:

```text
/squad                      # orquestador and implementador
/squad revisor              # only the roles you name
/squad charla orquestador implementador
```

Each role opens in its own pane, as a session named `<tab>-<role>`. Charla gets a full-height column on the left; the other roles fill a grid to its right. The pane that ran `/squad` closes last, once every role is running.

<!-- Image placeholder: docs/squad-menu.png, the fzf role menu over the launcher pane. -->

### From a plain terminal

Run from a terminal with no roles, the script shows an fzf menu of every role, with orquestador and implementador marked. `/squad` cannot show the menu, because Claude Code runs it without a terminal. Claude Code documents no stable path to the installed copy of the script, so run it from a clone, in a shell inside a herdr pane:

```bash
git clone https://github.com/AlejandroLunaDev/squad-herdr.git
bash squad-herdr/plugins/squad/scripts/squad-up.sh
```

The script starts the installed `squad:<role>` agents, so the plugin must be installed as well. Without fzf it opens orquestador and implementador.

## Roles

| Role | Model, effort | What it does | Opens |
|------|---------------|--------------|-------|
| `orquestador` | opus, high | Plans the tab's one task, orders the implementador and the revisor, and brings every decision back to you. Opens a revisor itself when a pull request needs review. | default |
| `implementador` | opus, xhigh | The only writer of the tab: code, tests and local commits. Pushes, pull requests and merges wait for your OK. | default |
| `revisor` | haiku, high | Reviews one pull request per order, read-only, and reports correctness problems and unmet requirements only. | on demand |
| `charla` | sonnet, medium | Talks things through and answers questions, so the orquestador's context stays clean. Read-only. | on demand |
| `disenador` | opus, high | Designs screens, emails and visual pieces and hands them to the orquestador. Read-only on the repository. | on demand |
| `pm` | opus, high | Keeps the map of the whole project above every squad and checks what squads report. Talks only to orquestadores. | on demand |

Models are aliases, so each role follows the latest model of its family. The sessions find each other by name and talk through messages; you talk to any of them in its own pane.

## Attribution

`token-weather` is not ours. It was written by Claude Code DevRel (copyright 2026 Anthropic PBC), is licensed under Apache-2.0, and is vendored unmodified from [claude-code-playground](https://github.com/anthropics/claude-code-playground). See [its NOTICE](plugins/token-weather/NOTICE).

## License

MIT, see [LICENSE](LICENSE), except `plugins/token-weather`, which keeps its Apache-2.0 [LICENSE](plugins/token-weather/LICENSE).

squad-herdr is an independent project. It is not affiliated with or endorsed by Anthropic.
