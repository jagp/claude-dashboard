# Claude Code Dashboard — Hot-Start Brief

> Context bundle exported from a working session on **2026-07-09**.
> Goal of the future project: an **interactive, self-designable dashboard** for a
> Claude Code session — one that can not only *display* state (like a statusline)
> but *trigger actions* (close terminal, open logs, start a new session, etc.).
> The plain-statusline groundwork is already shipped (see below); this project is
> about crossing the interactivity boundary that a statusline cannot.

## Files in this bundle
- `chat-transcript.jsonl` — full transcript of the design/feasibility conversation (point-in-time copy, 275 lines).
- `statusline-payload-sample.json` — a real captured statusline stdin payload (schema reference: `rate_limits`, `worktree`, `pr`, `model`, `effort`, etc.).
- `statusline.current.js` — the shipped statusline (already live at `~/.claude/statusline.js`). Starting point / reference.

## What's already DONE (shipped, no extension)
Live in `~/.claude/statusline.js`. Two-line output:
- **Line 1:** `<modelIcon><effortIcon>   ⌛ <rem5h>% [<reset>]  |  📅 <rem7d>% [<reset>]`
  - Model icon = block-height ramp (simple→complex): `haiku ▂ · sonnet ▄ · opus ▆ · fable █` (fallback `▁`).
  - Effort icon = model-picker circle ramp: `low ○ · medium ◐ · high ● · xhigh ◉ · max ★` (xhigh = ultracode).
  - Usage shows **remaining** % (100−consumed) and the **reset stamp only** (no countdown). 5h = time `H:MM`, 7d = `M/D H:MM`. Any other `rate_limits` key (e.g. a future Fable cap) renders generically.
- **Line 2:** OSC 8 clickable nav — `⑂ <branch>` and `📂 <worktree>` open the folder in VS Code (`vscode://file/…`); `🔗 PR #<n>` opens the PR on GitHub. Clickability needs a hyperlink-aware terminal (VS Code integrated, iTerm2, WezTerm); Windows Terminal may need `FORCE_HYPERLINK=1`.

## Core feasibility findings (the reason this project exists)
A statusline is **display-only text**, re-rendered each tick. Its ONLY interactive
capability is OSC 8 hyperlinks that open a **URL** (http/file/custom-scheme) via the
OS. It cannot execute commands. Actions split into **three layers**:

| Layer | Owns | Examples | Reachable from a link? |
|-------|------|----------|------------------------|
| **A. VS Code UI** | editor, tabs, terminals, panels, logs | close tab/terminal, open logs, VS Code Speech | ✅ **only via a custom VS Code extension** |
| **B. The Claude Code process** | its TUI + internal actions | `/rc`, `/context`, `/status`, stop (Esc), transcript toggle, Claude's push-to-talk | ❌ **unreachable** — only stdin/keyboard reaches it |
| **C. The OS** | launching apps/processes | open folder in VS Code, open GitHub, **start a new `claude` session** | ✅ URL schemes (`vscode://`, `file://`, `https://`, or a custom `claudectl://`) |

Key boundary: **VS Code deliberately blocks terminal-output links from running
`command:` URIs** (terminal output is untrusted). The sanctioned bridge for Layer A
is an **extension** with a `TerminalLinkProvider` — trusted code that can call
`vscode.commands.executeCommand(...)` on click AND attach custom tooltips (the only
way to get custom hover text, which raw OSC 8 cannot do). Layer B stays keyboard-only
regardless — nothing outside the Claude Code process can inject actions into it.

For Layer C without an extension: a **custom OS-registered protocol** (`claudectl://`,
Windows registry `HKCU\Software\Classes\…`) → a handler script can launch a new
session, open things, run `gh`, etc. ⚠️ Security surface: a registered scheme is
invocable by any web page — destructive handlers (delete worktree) must be gated or
skipped.

## The original controls wishlist, mapped to layers
- 🆕 new session (leave this alive) → **C** — feasible via `claudectl://` handler or extension.
- 📳 `/rc`, `/context`, `/status` → **B** — not reachable; stay keypresses.
- ❌ close session + wrap/delete worktree → mixed **A/B/C** — destructive, needs careful gating.
- 🛑 stop → **B** (Esc / `chat:cancel`), keypress only.
- 🧾 transcript → **B** toggle (Ctrl+O) is keypress; but the transcript **file** can be opened via **C**.
- ⏺️ voice → **B** (`voice:pushToTalk`, Ctrl+Space); VS Code Speech is a *different* feature (A).

## The idea the user likes: a **self-designable dashboard**
User explicitly wants the dashboard to be user-configurable/self-designable (compose
their own controls/layout). Open design questions for the next brainstorming pass:
- Extension vs. custom-protocol vs. hybrid — how much of Layer A do we want?
- What's the "self-design" surface — a config file? a visual editor? drag-drop panel?
- Which destructive actions (if any) do we expose, and how do we gate them safely?
- Does the dashboard live in the statusline row, a VS Code webview/panel, or both?

## Next step
Run `superpowers:brainstorming` on THIS project (fresh spec → plan → implement).
Point the new session at this folder; read the transcript for full reasoning.
