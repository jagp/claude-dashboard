#!/usr/bin/env node
// Claude Code status line — reads live session JSON from stdin and prints one line.
// Docs: https://code.claude.com/docs/en/statusline
// Plain CommonJS, no deps. Must always print (and never throw), or the bar hides.
//
// Layout:
//   line 1:  <model><effort>   ⌛ <rem5h>% [<reset>]  |  📅 <rem7d>% [<reset>]
//   line 2:  ⑂ <branch>   📂 <worktree>   🔗 PR #<n>      (OSC 8 clickable links)

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let line = "status";
  try {
    line = render(JSON.parse(raw));
  } catch {
    // Leave the fallback; never throw out of the status command.
  }
  process.stdout.write(line + "\n");
});

// --- glyph scales (swap any of these in one place) --------------------------

// Model complexity, simple → complex. A block-height ramp, distinct from the
// circle ramp used for effort so the two badges never blur together.
const MODEL_ICON = { haiku: "▂", sonnet: "▄", opus: "▆", fable: "█" };
const MODEL_FALLBACK = "▁";

// Reasoning effort, mirroring the model-picker UI: empty → half → full →
// double → star.
const EFFORT_ICON = {
  low: "○",
  medium: "◐",
  high: "●",
  xhigh: "◉", // ultracode reports as xhigh
  max: "★",
};
const EFFORT_FALLBACK = "·";

function modelIcon(model) {
  const s = `${model?.id || ""} ${model?.display_name || ""}`.toLowerCase();
  for (const key of ["fable", "opus", "sonnet", "haiku"]) {
    if (s.includes(key)) return MODEL_ICON[key];
  }
  return MODEL_FALLBACK;
}

// --- rate-limit windows -----------------------------------------------------

const pad2 = (n) => String(n).padStart(2, "0");
const hm = (dt) => `${dt.getHours()}:${pad2(dt.getMinutes())}`;          // 15:20
const mdhm = (dt) => `${dt.getMonth() + 1}/${dt.getDate()} ${hm(dt)}`;   // 7/11 4:37

// One window → "<icon> <remaining>% [<reset>]". Remaining = 100 − consumed.
// No countdown — just the absolute reset stamp, per request.
function windowSegment(icon, win, fmt) {
  if (!win || win.used_percentage == null) return null;
  const rem = Math.max(0, 100 - Math.round(win.used_percentage));
  let reset = "";
  if (win.resets_at != null) reset = ` [${fmt(new Date(win.resets_at * 1000))}]`;
  return `${icon} ${rem}%${reset}`;
}

function usageLine(rl) {
  if (!rl) return "usage n/a";
  const parts = [];
  const five = windowSegment("⌛", rl.five_hour, hm);
  const seven = windowSegment("📅", rl.seven_day, mdhm);
  if (five) parts.push(five);
  if (seven) parts.push(seven);
  // Any future window (e.g. a Fable/model cap) renders generically by its key.
  for (const key of Object.keys(rl)) {
    if (key === "five_hour" || key === "seven_day") continue;
    const seg = windowSegment(key, rl[key], mdhm);
    if (seg) parts.push(seg);
  }
  return parts.length ? parts.join("  |  ") : "usage n/a";
}

// --- clickable links (OSC 8) ------------------------------------------------

// Cmd/Ctrl/Alt+click opens the URL in a hyperlink-aware terminal (VS Code,
// iTerm2, WezTerm). On plain terminals the label still shows, just not clickable.
function osc8(url, text) {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

function fileToVscodeUrl(winPath) {
  return "vscode://file/" + winPath.replace(/\\/g, "/").replace(/ /g, "%20");
}

// --- render -----------------------------------------------------------------

function render(d) {
  const badge = `${modelIcon(d?.model)}${EFFORT_ICON[d?.effort?.level] || EFFORT_FALLBACK}`;
  const usage = usageLine(d?.rate_limits);
  const line1 = `${badge}   ${usage}`;

  // Navigation line: branch/worktree → open the folder in VS Code; PR → GitHub.
  const wt = d?.worktree;
  const wtPath = wt?.path || d?.workspace?.current_dir;
  const branch = wt?.branch || d?.workspace?.git_worktree;
  const wtName = wt?.name || d?.workspace?.git_worktree;

  const nav = [];
  if (branch && wtPath) {
    nav.push(osc8(fileToVscodeUrl(wtPath), `⑂ ${branch}`));
  } else if (wtPath) {
    const base = wtPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
    nav.push(osc8(fileToVscodeUrl(wtPath), `📂 ${base}`));
  }
  if (wt && wtName && branch && wtName !== branch) {
    nav.push(osc8(fileToVscodeUrl(wtPath), `📂 ${wtName}`));
  }
  if (d?.pr?.number != null && d?.pr?.url) {
    nav.push(osc8(d.pr.url, `🔗 PR #${d.pr.number}`));
  }

  return nav.length ? `${line1}\n${nav.join("   ")}` : line1;
}
