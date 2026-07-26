# claude-dashboard

Statusline and session-control tooling for Claude Code. This repo doubles as a
**plugin marketplace** — the shipped statusline is packaged as an installable
plugin.

## Install the statusline plugin

```
/plugin marketplace add <path-or-git-url-of-this-repo>
/plugin install clickable-statusline@claude-dashboard
/clickable-statusline:install
```

See [`plugins/clickable-statusline/README.md`](plugins/clickable-statusline/README.md)
for what it looks like, how the Windows `claudectl://` protocol works, and how
to customize the glyph scales.

## Repo layout

```
.claude-plugin/marketplace.json     marketplace listing
plugins/clickable-statusline/       the installable plugin
statusline.current.js               working copy of the statusline (dev)
claudectl-*.ps1, claudectl.vbs      working copies of the protocol scripts (dev)
statusline-glyph-scales.md          glyph ramp catalog (source of the plugin's docs)
docs/HOTSTART.md                    dashboard project brief (future interactive work)
```

The `plugins/` tree is the distributable; the root-level scripts are the
development working copies.
