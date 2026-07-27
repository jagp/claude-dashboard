# claude-dashboard

Statusline and session tooling for [Claude Code](https://code.claude.com).
This repo is a **Claude Code plugin marketplace**; its first plugin,
**cc-statusline-dashboard**, turns the status bar into a two-line dashboard where
every destination is a clickable link.

```
🏆●   ⌛ 80% [15:20]  |  📅 62% [7/28 4:37]  |  Σ 162345
⑂ f/cc-statusline-dashboard   🔗 PR #12   [📒] [📜] [🌳]
```

- **Medal model badge** (🥉 haiku → 🏆 fable) and **effort dial** (○–★) — the
  ordering reads straight off the glyphs, no legend needed
- **Rate-limit windows** as remaining % with their reset stamps
- **Exact session token count** — raw digits, never abbreviated
- **Clickable everything** (OSC 8, Ctrl/Alt+click): branch folder, PR,
  logs folder, transcript, base branch
- **Windows `claudectl://` protocol** so folder links open in Explorer even
  from VS Code's integrated terminal (which hijacks `file://` links);
  macOS/Linux use plain `file://` links

## Install

```
/plugin marketplace add <path-or-git-url-of-this-repo>
/plugin install cc-statusline-dashboard@claude-dashboard
/cc-statusline-dashboard:install
```

Requirements: Node.js, a hyperlink-aware terminal (Windows Terminal, VS Code,
iTerm2, WezTerm). The Explorer integration is Windows-only; everything else is
cross-platform.

Full details — what each glyph means, how the protocol handler stays
non-destructive, manual install steps — in
[`plugins/cc-statusline-dashboard/README.md`](plugins/cc-statusline-dashboard/README.md).

## Uninstall

`/cc-statusline-dashboard:uninstall` restores whatever statusline was live before
install. On Windows, **Settings > Apps > "Claude Control Protocol (claudectl)"**
does the same via the OS-standard flow.

## Customizing

Both glyph scales live in one place at the top of `statusline.js`. A catalog of
ready-made alternative ramps (psychology 😴🙂🤔🧐🤯, caffeine, creature-size,
gemstones, …) plus terminal-rendering caveats:
[`plugins/cc-statusline-dashboard/docs/customizing-glyphs.md`](plugins/cc-statusline-dashboard/docs/customizing-glyphs.md).

## Repo layout

```
.claude-plugin/marketplace.json     marketplace listing
plugins/cc-statusline-dashboard/    the installable plugin (single source of truth)
  statusline/                       statusline.js + claudectl protocol scripts
  skills/install, skills/uninstall  the /cc-statusline-dashboard:* skills
  docs/customizing-glyphs.md        glyph-ramp catalog
  CHANGELOG.md · LICENSE · README.md
docs/superpowers/                   design spec & implementation plan for the
                                    interactive dashboard this grew out of
```

## Roadmap

The statusline is display-plus-links by design — Tier 0 of a larger idea: an
interactive, self-designable session dashboard (new-session launcher,
config-driven buttons, Mission Control). The design spec and v1 plan live in
[`docs/superpowers/`](docs/superpowers/).

## License

[MIT](LICENSE)
