---
name: install
description: This skill should be used when the user asks to "install the clickable statusline", "set up the statusline", "enable the statusline plugin", "register claudectl", or runs /clickable-statusline:install. Deploys the statusline script, wires it into settings.json, and (on Windows) registers the claudectl:// Explorer protocol.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
---

# Install the clickable statusline

Deploy the plugin's statusline to `~/.claude/statusline.js`, point the user's
`statusLine` setting at it, and on Windows register the `claudectl://` protocol
so local-path links open Windows Explorer instead of being hijacked by VS
Code's terminal. All steps are idempotent and reversible via
`/clickable-statusline:uninstall`.

Resolve the plugin root first: it is two directory levels above this skill's
base directory (`<plugin-root>/skills/install/` → `<plugin-root>`). Below,
`${CLAUDE_PLUGIN_ROOT}` means that resolved absolute path — substitute it
literally in every command. The files used:

- `${CLAUDE_PLUGIN_ROOT}/statusline/statusline.js` — the statusline itself
- `${CLAUDE_PLUGIN_ROOT}/statusline/claudectl-register.ps1` — Windows protocol installer
- `${CLAUDE_PLUGIN_ROOT}/statusline/claudectl-unregister.ps1`, `claudectl-handler.ps1`, `claudectl.vbs` — deployed by the register script

## Prerequisites

1. Verify Node.js is available: `node --version`. If missing, stop and tell the
   user Node.js is required (the statusline is a Node script).
2. Determine the platform (`process.platform` / `$env:OS`). The claudectl
   protocol steps apply to Windows only.

## Step 1 — Preserve what the user already has

1. Read `~/.claude/settings.json`. If it contains a `statusLine` key, save the
   exact current value to `~/.claude/clickable-statusline.prev-settings.json`
   (create the file with the JSON value; skip if that backup file already
   exists — never overwrite an existing backup on re-install).
2. **Windows:** run the register script BEFORE copying the statusline — it
   caches the currently-live `~/.claude/statusline.js` (once) as
   `statusline.js.pre-claudectl.bak`, which is the uninstaller's restore point:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/statusline/claudectl-register.ps1"
   ```

   This registers `HKCU:\Software\Classes\claudectl` (user-level, no admin),
   deploys the handler files to `~/.claude`, and adds a Settings > Apps
   uninstall entry. The handler is deliberately read-only: its only action is
   showing an existing local fixed-drive path in Explorer; UNC paths are
   rejected before any filesystem probe (drive-by NTLM-leak protection).
3. **macOS/Linux:** if `~/.claude/statusline.js` exists and
   `~/.claude/statusline.js.pre-claudectl.bak` does not, copy the former to the
   latter (same restore-point convention, no protocol registration — the
   statusline emits plain `file://` links off-Windows).

## Step 2 — Deploy the statusline

Copy `${CLAUDE_PLUGIN_ROOT}/statusline/statusline.js` to
`~/.claude/statusline.js`, overwriting.

## Step 3 — Wire up settings.json

Merge into `~/.claude/settings.json` (preserve all other keys):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"<absolute home path>/.claude/statusline.js\""
  }
}
```

Write the user's real absolute home path — `${CLAUDE_PLUGIN_ROOT}` must NOT be
used here (settings.json does not expand it), and `~` expansion inside quoted
Windows commands is unreliable.

## Step 4 — Verify

Pipe a sample payload through the deployed script and confirm two lines render
(medal badge on line 1, at least two links on line 2):

```bash
echo '{"model":{"id":"claude-opus-5"},"effort":{"level":"high"},"rate_limits":{"five_hour":{"used_percentage":20,"resets_at":1753500000}},"context_window":{"total_input_tokens":1200,"total_output_tokens":345},"workspace":{"current_dir":"'$HOME'"},"transcript_path":"'$HOME'/.claude/t.jsonl"}' | node ~/.claude/statusline.js
```

On Windows, optionally verify the protocol without launching anything:

```powershell
$env:CLAUDECTL_DRYRUN=1; powershell -NoProfile -File "$env:USERPROFILE\.claude\claudectl-handler.ps1" "claudectl://open/C:/Users"
```

Expect `action=open path=C:\Users dir=True file=False`.

## Step 5 — Report

Tell the user: the statusline is active on the next statusline refresh (or
restart of Claude Code); links are Ctrl/Alt+click in hyperlink-aware terminals
(Windows Terminal, VS Code, iTerm2, WezTerm); uninstall via
`/clickable-statusline:uninstall` or (Windows) Settings > Apps > "Claude
Control Protocol (claudectl)".
