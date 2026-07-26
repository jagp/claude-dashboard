---
name: uninstall
description: This skill should be used when the user asks to "uninstall the clickable statusline", "remove the statusline plugin", "restore my old statusline", "unregister claudectl", or runs /clickable-statusline:uninstall. Restores the pre-install statusline and settings and removes the Windows claudectl:// protocol.
allowed-tools: Read, Write, Edit, Bash
---

# Uninstall the clickable statusline

Fully reverse `/clickable-statusline:install`: restore whatever statusline was
live before, restore the previous `statusLine` setting, and on Windows remove
the `claudectl://` protocol registration and its deployed files.

## Step 1 — Windows: run the unregister script

Prefer the deployed copy (it self-deletes safely); fall back to the plugin's
copy if the deployed one is missing:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\claudectl-unregister.ps1"
```

The script restores `~/.claude/statusline.js` from
`statusline.js.pre-claudectl.bak` (if the cache exists), removes
`HKCU:\Software\Classes\claudectl` and the Settings > Apps entry, and deletes
the deployed handler files. It is idempotent — safe to run twice.

## Step 2 — macOS/Linux: restore the statusline file

If `~/.claude/statusline.js.pre-claudectl.bak` exists, move it over
`~/.claude/statusline.js`. If no backup exists (there was no statusline before
install), delete `~/.claude/statusline.js`.

## Step 3 — Restore settings.json

1. If `~/.claude/clickable-statusline.prev-settings.json` exists, set the
   `statusLine` key in `~/.claude/settings.json` back to that saved value,
   then delete the backup file.
2. Otherwise remove the `statusLine` key entirely (there was none before
   install).
3. Preserve every other key in settings.json.

## Step 4 — Verify and report

- Windows: confirm `HKCU:\Software\Classes\claudectl` no longer exists
  (`Test-Path 'HKCU:\Software\Classes\claudectl'` → False).
- Confirm settings.json parses as valid JSON after the edit.
- Tell the user the previous statusline (or no statusline) is back on the next
  refresh, and that the plugin itself can be removed with
  `/plugin uninstall clickable-statusline`.
