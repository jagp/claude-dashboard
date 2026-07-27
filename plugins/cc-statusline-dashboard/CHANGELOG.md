# Changelog

All notable changes to the cc-statusline-dashboard plugin.

## 1.0.0 — 2026-07-25

Initial release.

- Two-line statusline (dependency-free Node script):
  - Model badge as a self-ordering medal ladder (🥉 haiku · 🥈 sonnet ·
    🥇 opus · 🏆 fable, 🎖️ unknown)
  - Reasoning-effort dial (○ ◐ ● ◉ ★), mirroring the model-picker UI
  - Rate-limit windows as **remaining** % with absolute reset stamps
    (⌛ 5-hour, 📅 7-day, unknown windows render generically)
  - Exact session token count (Σ, raw digits — never abbreviated)
  - OSC 8 clickable navigation: branch/worktree folder, PR, and
    repo/issues/cwd fallbacks so line 2 always has at least two links
  - Emoji control buttons: [📒] logs folder, [📜] transcript, [🌳] base branch
  - Compact gitflow branch display (`feature/a-b-c-d` → `f/a-b-c`)
- Windows `claudectl://` protocol suite (user-level, no admin):
  - Handler opens folders in Explorer and reveals files with `/select`;
    strictly read-only, rejects UNC paths before any filesystem probe
    (drive-by NTLM-leak protection)
  - Windowless VBS launcher (no console flash; quote-stripping hardening)
  - Idempotent register/unregister with a once-only statusline backup and a
    Windows Settings > Apps uninstall entry
- Cross-platform links: `claudectl://` on Windows, plain `file://` on
  macOS/Linux (where VS Code's terminal does not hijack them)
- `/cc-statusline-dashboard:install` and `/cc-statusline-dashboard:uninstall` skills
  (deploy + wire `settings.json > statusLine`, fully reversible)
- Glyph-ramp customization catalog (`docs/customizing-glyphs.md`)
