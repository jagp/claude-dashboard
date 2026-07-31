NB# Possible Controls

| id                    | glyph                                | hover tooltip                                | click action                                                  | layer |
| --------------------- | ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------- | ----- |
| `badge`               | `█◉` (model+effort ramp, as shipped) | model, effort, context %, cost, session name | copy session id                                               | A     |
| `usage5h` / `usage7d` | `⌛` / `📅`                          | exact %, reset stamps, cost readout          | — (display)                                                   | —     |
| `branch`              | `⑂`                                  | ahead/behind, dirty state, path              | open folder in VS Code                                        | C     |
| `pr`                  | `🔗`                                 | PR title + CI status (via `gh`, cached ~60s) | open PR in browser                                            | C     |
| `newSession`          | `🆕`                                 | preset list                                  | 1 preset → launch; several → QuickPick                        | C     |
| `transcript`          | `🧾`                                 | transcript path                              | open transcript file in editor                                | C     |
| `logs`                | `📜`                                 | log folder path                              | open Claude Code logs folder                                  | C     |
| `closeTerminal`       | `❌`                                 | "close this session's terminal"              | kill the matched terminal                                     | A     |
| `wrapUp`              | `🗑️`                                 | worktree path + dirty warning                | typed confirm → close terminal + `git worktree remove`        | A+C   |
| `keys`                | `⌨`                                  | top keybinds quick list                      | open full cheat sheet (markdown preview, sectioned by screen) | A     |
