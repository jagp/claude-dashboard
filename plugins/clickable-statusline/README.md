# clickable-statusline

A two-line Claude Code statusline where everything you'd want to jump to is a
**clickable link**, and the session's vital signs read off self-ordering glyphs
— no legend needed.

```
🏆●   ⌛ 80% [15:20]  |  📅 62% [7/28 4:37]  |  Σ 162345
⑂ f/statusline-plugin   🔗 PR #12   [📒] [📜] [🌳]
```

## What each piece means

**Line 1 — vitals**

| Piece | Meaning |
|-------|---------|
| 🥉 🥈 🥇 🏆 | Model as a medal ladder: haiku → sonnet → opus → fable (🎖️ = unknown model) |
| ○ ◐ ● ◉ ★ | Reasoning effort: low → medium → high → xhigh (ultracode) → max |
| ⌛ `80% [15:20]` | 5-hour rate-limit window: **remaining** % and the reset time |
| 📅 `62% [7/28 4:37]` | 7-day window, same format (any future window renders generically) |
| Σ `162345` | Exact session token count — raw digits, never abbreviated |

**Line 2 — navigation (every item is an OSC 8 hyperlink; Ctrl/Alt+click)**

| Link | Opens |
|------|-------|
| ⑂ `f/branch-name` | The branch/worktree folder in your file manager (branch names compact to `f/first-three-words`) |
| 🔗 `PR #12` | The pull request on GitHub |
| 🌐 / 🐛 / 📁 | Fallback links (repo, issues, cwd) so line 2 always has at least two |
| [📒] | The Claude Code logs folder for this session |
| [📜] | The session transcript file |
| [🌳] | The base branch on GitHub (or the trunk folder locally) |

## Why the Windows `claudectl://` protocol

VS Code's integrated terminal intercepts `file://` links and opens them in
Quick Open instead of Explorer. It **must** hand an unknown scheme to the OS,
so on Windows the statusline emits `claudectl://open/...` links and the
installer registers a user-level (no admin) protocol handler that opens
folders as Explorer windows and reveals files with `/select`. On macOS/Linux
the statusline emits plain `file://` links — no handler needed.

The handler is deliberately non-destructive: **its only action is showing an
existing local fixed-drive path in Explorer**. UNC paths (`\\host\share`) are
rejected before any filesystem probe, because a registered scheme is invocable
by any web page and probing a UNC path would auto-send NTLM credentials.

## Requirements

- **Node.js** (the statusline is a dependency-free CommonJS script)
- A **hyperlink-aware terminal**: Windows Terminal, VS Code integrated
  terminal, iTerm2, WezTerm
- Windows for the `claudectl://` Explorer integration (everything else is
  cross-platform)

## Install

```
/plugin marketplace add <path-or-git-url-of-this-repo>
/plugin install clickable-statusline@claude-dashboard
/clickable-statusline:install
```

The install skill:

1. Backs up your current `statusLine` setting and statusline script (once —
   re-installing never overwrites the original backup)
2. On Windows, registers `claudectl://` (HKCU, no admin) and adds a
   **Settings > Apps** entry ("Claude Control Protocol (claudectl)") so the
   OS-standard uninstall flow works too
3. Deploys `statusline.js` to `~/.claude/` and points
   `settings.json > statusLine` at it
4. Verifies by piping a sample payload through the deployed script

### Manual install

Copy `statusline/statusline.js` to `~/.claude/statusline.js`, then add to
`~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/absolute/path/to/home/.claude/statusline.js\""
  }
}
```

On Windows, additionally run
`powershell -NoProfile -ExecutionPolicy Bypass -File statusline/claudectl-register.ps1`.

## Uninstall

```
/clickable-statusline:uninstall
```

Restores the statusline and `statusLine` setting that were live before
install, removes the protocol registration and deployed files. On Windows,
**Settings > Apps > "Claude Control Protocol (claudectl)" > Uninstall** does
the same. Then `/plugin uninstall clickable-statusline` removes the plugin.

## Customizing the glyphs

Both badge scales live in one place at the top of `statusline.js`
(`MODEL_ICON`, `EFFORT_ICON`). `docs/customizing-glyphs.md` catalogs
ready-made alternative ramps (psychology 😴🙂🤔🧐🤯, caffeine, spiciness,
creature-size, gemstones, …) plus terminal-rendering caveats (avoid ZWJ
sequences; text-glyph ramps are the width-safe choice).

## Files

```
statusline/statusline.js           the statusline (deployed to ~/.claude)
statusline/claudectl-register.ps1  Windows protocol installer (idempotent, HKCU)
statusline/claudectl-handler.ps1   protocol handler — read-only, Explorer-only
statusline/claudectl-unregister.ps1  full reversal incl. statusline restore
statusline/claudectl.vbs           windowless launcher (no console flash)
skills/install, skills/uninstall   the /clickable-statusline:* skills
docs/customizing-glyphs.md         alternative glyph ramps + caveats
```
