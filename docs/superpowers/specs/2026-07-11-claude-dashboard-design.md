# Claude Code Dashboard — Design Spec

**Date:** 2026-07-11
**Status:** Draft for review
**Predecessor:** `HOTSTART.md` (feasibility findings, 2026-07-09)

## 1. Purpose

An interactive, self-designable dashboard for Claude Code sessions — one that not
only *displays* state (like the shipped statusline) but *triggers actions*: start
a new session, open the transcript, resume past work, and eventually control the
whole fleet of sessions from one place.

This spec covers the near-term "off the shelf" build (v1, no VS Code extension)
**and** the long-term vision: the full verb catalog the URL-handler method
unlocks, theoretical bridges into the Layer B "in-app" territory, and the
Mission Control display that ties it together.

## 2. Scope decisions (assumptions — flag if wrong)

| Question | Decision |
|---|---|
| What "off the shelf" means | v1 = Layer C only (URL schemes + a tiny custom protocol handler). No VS Code extension until v3. |
| Basic action items for v1 | Transcript link, richer nav links, new-session launcher, config-driven custom buttons. |
| Self-design surface | v1: a JSON config file. v2: Mission Control layout editor. |
| Destructive actions | None in v1. Gated confirmations before any land (v2+). |
| Where it lives | v1: statusline rows. v2: a local web page (Mission Control). |
| Platform | Windows 11 first (registry `HKCU`, `wt.exe`); design keeps handler logic portable. |

## 3. Architecture: sensor / actuator / display

The load-bearing insight: **the statusline script already receives the complete
session JSON on every render tick** (`transcript_path`, `context_window`, `cost`,
`rate_limits`, `worktree`, `pr`, `model`, `effort`, `session_name`, …). It is a
free, already-installed telemetry heartbeat.

```
┌────────────────────────── per session ──────────────────────────┐
│  Claude Code ──stdin JSON──▶ statusline.js                      │
│                               ├─▶ renders status rows (display) │
│                               └─▶ appends state snapshot to     │
│                                   ~/.claude/dashboard/state/    │
│                                   <session_id>.json   (SENSOR)  │
└─────────────────────────────────────────────────────────────────┘
          ▲                                        │
          │ keystrokes only (Layer B boundary)     ▼ reads
┌─────────┴──────────┐                 ┌────────────────────────┐
│ claudectl://verbs  │◀── clicks ──────│  Display surfaces      │
│ handler (ACTUATOR) │                 │  v1: statusline OSC 8  │
│ registry HKCU,     │                 │  v2: Mission Control   │
│ allowlist + gates  │                 │      local web page    │
└────────────────────┘                 └────────────────────────┘
```

- **Sensor** — statusline writes a small JSON snapshot per session per tick
  (atomic write, last-write-wins). Stale files (mtime > ~10 min) mean the
  session is idle/dead. Zero new processes; the heartbeat rides on rendering.
- **Actuator** — one OS-registered protocol, `claudectl://`, handled by a local
  script. Every actionable pixel in every display surface is just a link.
- **Display** — v1 reuses the statusline rows; v2 adds Mission Control, a local
  HTML page whose buttons are `claudectl://` links and whose data is the state
  directory. Same sensor, same actuator, richer glass.

## 4. v1 Tier 0 — statusline enrichment (zero new machinery)

Pure edits to `statusline.js`, shippable immediately:

1. **🧾 Transcript link** — `vscode://file/<transcript_path>` on line 2. The
   wishlist item "open the transcript file" costs one `osc8()` call; the path
   is already in the payload.
2. **⌂ Original project link** — when in a worktree, link `worktree.original_cwd`.
3. **Context gauge** — render `context_window.remaining_percentage` as a compact
   bar next to the rate-limit windows (e.g. `⛁ 84%`).
4. **Session cost** — `cost.total_cost_usd` rounded, e.g. `$2.75`.

Invariant preserved: never throw, always print (a broken statusline hides the bar).

## 5. v1 Tier 1 — the `claudectl://` actuator + self-designed buttons

### 5.1 Protocol registration
- `HKCU\Software\Classes\claudectl\shell\open\command` → `node <handler> "%1"`.
  Per-user, no admin. `install.ps1` (idempotent) and `uninstall.ps1`.

### 5.2 Handler (`src/claudectl-handler.js`)
- Parses `claudectl://<verb>?<query>`; **hard-coded verb allowlist** — unknown
  verbs show a message box and exit.
- v1 verbs:
  - `new-session?dir=<path>[&model=][&effort=]` — launch `claude` in a new
    Windows Terminal tab (`wt.exe -d <dir> -- claude …`); fallback
    `start powershell -NoExit claude` if `wt` is absent.
  - `open?path=<path>` — ShellExecute a file/folder (Explorer / default app).
  - `copy?text=<...>` — put text on the clipboard (session id, PR URL, paths).
- Every invocation appends one line to `%LOCALAPPDATA%\claudectl\invocations.log`.

### 5.3 Security model
A registered scheme is invocable by **any web page**. Trust lives in the handler,
never the link:
- Allowlist of verbs; parameters validated (paths must exist; no shell
  interpolation — args passed as arrays, never string-concatenated commands).
- Process-spawning verbs show a native Yes/No confirmation naming the exact
  action ("Start a new Claude session in C:\…?"). Per-verb `"confirm": false`
  opt-out in config for power use.
- Destructive verbs (kill, delete-worktree) **do not exist in v1** — not gated,
  absent.

### 5.4 Self-design config (`~/.claude/dashboard.json`)
```json
{ "controls": [
    { "icon": "🆕", "label": "new",  "url": "claudectl://new-session?dir={workspace.project_dir}" },
    { "icon": "🧾", "label": "log",  "url": "vscode://file/{transcript_path}" },
    { "icon": "📋", "label": "sid",  "url": "claudectl://copy?text={session_id}" }
] }
```
- Statusline renders a third row from this; `{dotted.path}` placeholders resolve
  against the live payload; entries whose placeholders are missing are skipped.
- Missing/invalid config → silently fall back to the shipped two-row output.
- This file **is** the v1 "self-designable" surface: users compose their own
  buttons from any URL, including verbs they invent later.

## 6. Long-term verb catalog (what the URL-handler method can grow into)

The handler is trusted local code — a click can do anything the OS can. Planned
families, roughly in build order:

**Session lifecycle**
- `new-session` with presets (model/effort/dir), incl. `--append-system-prompt` profiles
- `new-worktree?repo=&name=` — create git worktree, then launch a session inside it
- `resume?session=<id>` — `claude --resume` a past session picked from Mission Control
- `fork?session=<id>` — resume into a fresh worktree (parallel exploration)
- `bg?dir=&prompt=` — fire a headless `claude -p` background job
- `kill?session=<id>` — end a session's process *(destructive: v2+, double-gated)*

**Git / GitHub**
- `pr-open`, `pr-create` (`gh pr create` from the session's branch), `pr-checks`
- `branch-switch`, `pull`, `worktree-clean` *(destructive parts gated)*
- `diff?dir=` — open the VS Code SCM/diff view for the worktree

**Files & telemetry**
- `open` generalized: transcript, `CLAUDE.md`, `~/.claude/settings.json`, the
  statusline script itself, `%LOCALAPPDATA%` logs
- `copy` generalized: any payload field
- `usage-report` — parse `~/.claude` history, render a cost/usage page
- `toast?text=` — Windows notification (session finished, needs input)

**Meta**
- `dashboard` — start/focus the Mission Control local server (§8)
- `edit-dashboard` — open `dashboard.json`, later the visual editor

## 7. Layer B bridges — reaching the "in-app" actions (theoretical)

Layer B (`/context`, stop/Esc, Ctrl+O transcript, Ctrl+Space voice) is
keyboard-only by design. Ranked bridge strategies:

1. **Own the stdin: ConPTY wrapper (strongest, sessions we launch).** When
   `new-session` launches Claude, launch it under a thin pseudo-terminal wrapper
   (node-pty). The wrapper relays I/O transparently and exposes a named-pipe
   control channel. The dashboard can then *reliably* send `Esc`, `/context⏎`,
   `Ctrl+O`, `Ctrl+Space` to that session forever. This turns every
   dashboard-launched session into a fully controllable one — the Layer B wall
   only stands for sessions we didn't start. (WSL/tmux users get this for free
   via `tmux send-keys`; ConPTY is the native-Windows equivalent.)
2. **Hooks as a mailbox (sanctioned, asynchronous).** Claude Code hooks
   (SessionStart, UserPromptSubmit, Stop, …) run *inside* the session. A hook
   checks `~/.claude/dashboard/mailbox/<session_id>/` and injects queued
   instructions at its next opportunity. Can't interrupt mid-turn, but gives
   the dashboard a legitimate write-path into a session's behavior.
3. **Synthesized keystrokes (fragile fallback, any session).** Handler focuses
   the right window (match VS Code/WT title against session name) and uses
   SendInput to type. Works for stop/toggles today; risk of typing into the
   wrong window means it must verify the foreground title first and stay
   opt-in.
4. **MCP control-plane (model-mediated).** A local MCP server exposed to
   sessions with a "check dashboard commands" surface — influence arrives on
   the model's next turn. Weakest guarantees, zero OS trickery.

v1 ships none of these; the spec records them so `new-session` (v1) is built
ConPTY-ready (launch command isolated in one module).

## 8. Mission Control — the impressive display (v2 target)

A single local web page (localhost server started by `claudectl://dashboard`;
plain Node, no framework) showing **every Claude Code session on the machine as
a live card grid**:

- **Fleet header** — shared 5h/7d rate-limit bars with reset stamps (one truth
  for all sessions), total spend today, sessions active/idle counts.
- **Session cards** — one per fresh state file: model/effort badge (same glyph
  ramps as the statusline), session name, branch/worktree/PR chips (clickable),
  context-remaining radial gauge, cost ticker, sparkline of context usage over
  the last N ticks (history is free — the sensor appends), last-activity clock
  that fades the card as it goes stale.
- **Action rows on every card** — the same `claudectl://` verbs: resume, fork,
  open transcript, open folder, copy id; fleet-level: new session (picks
  directory), usage report.
- **Self-design mode** — drag cards, hide fields, add custom buttons; layout
  persists to `dashboard.json` (the same file the statusline reads — one config,
  two skins).
- Auto-refresh by polling the state dir (file mtimes) — no sockets needed at
  v2; SSE later if polling feels coarse.

A static HTML mockup of this page ships with the spec so the target look is
concrete before any server code exists.

## 9. v3+ — the extension tier

Only when v2 proves insufficient: a minimal VS Code extension adds
`TerminalLinkProvider` (hover tooltips, trusted `command:` execution), Layer A
verbs (close terminal/tab, open panels), and window-accurate focus for
keystroke bridging. The protocol handler remains the shared actuator so nothing
built in v1/v2 is thrown away.

## 10. Error handling

- Statusline: never throw; any sensor-write failure is swallowed (display wins).
- Handler: every failure → message box + log line; exit code non-zero.
- Mission Control: a card with unparsable state renders as a "corrupt state"
  card with an `open?path=` link to the offending file.

## 11. Testing

- `statusline.js`: golden test — pipe `statusline-payload-sample.json`, assert
  rows (already have the fixture).
- Handler: unit-test URL parsing/allowlist by invoking with argv strings; no
  registry needed. Manual E2E: click each link in a VS Code terminal.
- `install.ps1`: assert `Get-Item HKCU:\Software\Classes\claudectl` after run;
  idempotent on second run.

## 12. Non-goals (v1)

- No VS Code extension, no webview, no Electron.
- No destructive verbs (kill/delete/merge).
- No Layer B bridge implementation (documented only).
- No cross-machine anything; single Windows user profile.
