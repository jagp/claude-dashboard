#!/usr/bin/env node
// Claude Code status line — reads live session JSON from stdin and prints two lines.
// Docs: https://code.claude.com/docs/en/statusline
// Plain CommonJS, no deps. Must always print (and never throw), or the bar hides.
//
// Layout:
//   line 1:  <model><effort>   ⌛ <rem5h>% [<reset>]  |  📅 <rem7d>% [<reset>]  |  Σ <exact session tokens>
//   line 2:  ⑂ <short branch>   🔗 PR #<n>   [📒] [📜] [🌳]
//
// Model = a medal ladder (haiku 🥉 · sonnet 🥈 · opus 🥇 · fable 🏆); the
// ranking reads straight off the glyphs. Σ is the exact token count (raw
// digits, no abbreviation). Branches show as f/first-three-words.
//
// Line 2 always carries at least two links — when the session has no worktree
// or PR it pads from repo → issues → cwd fallbacks — plus the emoji controls
// (📒 logs folder · 📜 transcript · 🌳 base branch). Every link is an OSC 8
// hyperlink (Ctrl+click). NOTE: local-path links use file:// so a passthrough
// terminal (Windows Terminal, WezTerm) opens the OS Explorer; VS Code's
// integrated terminal intercepts file:// and reveals the path inside VS Code
// instead. True OS-Explorer-from-VS-Code needs a custom protocol handler or an
// extension (see docs/HOTSTART.md, Layer A/C).

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

// Model tier, least → most capable. A podium/medal ladder: the emojis form a
// self-ordering ranking (bronze → silver → gold → trophy), so the difference
// between them *is* the relationship — no legend needed. Chosen to stay clear
// of the circle ramp used for effort so the two badges never blur together.
const MODEL_ICON = { haiku: "🥉", sonnet: "🥈", opus: "🥇", fable: "🏆" };
// Unknown/future model: a generic medal — "a ranked model, tier unclassified".
const MODEL_FALLBACK = "🎖️";

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

// --- session token total -----------------------------------------------------

// Full fidelity — the exact count as raw digits, never abbreviated or grouped:
// 950 → "950", 162_000 → "162000", 1_234_567 → "1234567". Only the Σ prefix,
// no separators or unit suffixes.
function tokenSegment(cw) {
  const total = (cw?.total_input_tokens || 0) + (cw?.total_output_tokens || 0);
  return total > 0 ? `Σ ${total}` : null;
}

// --- clickable links (OSC 8) ------------------------------------------------

// Ctrl/Cmd/Alt+click opens the URL in a hyperlink-aware terminal (Windows
// Terminal, VS Code, iTerm2, WezTerm). ST ("\x1b\\") terminators parse more
// reliably through ConPTY than BEL. Link text is underlined + cyan so it
// visibly reads as clickable; 24;39 restores just underline/color, not all SGR.
const ST = "\x1b\\";
function osc8(url, text) {
  return `\x1b]8;;${url}${ST}\x1b[4;36m${text}\x1b[24;39m\x1b]8;;${ST}`;
}

// A link dressed as a button: dim brackets around the clickable label.
function button(url, text) {
  return `\x1b[2m[\x1b[22m${osc8(url, text)}\x1b[2m]\x1b[22m`;
}

// "C:\a b\c" → "C:/a%20b/c". Every segment percent-encoded (spaces, #, etc.
// silently kill clickability in Windows Terminal) but the drive colon kept —
// encoding it also breaks linkification.
function encodeWinPath(p) {
  const s = String(p).replace(/\\/g, "/");
  const m = s.match(/^([A-Za-z]:)(.*)$/);
  const drive = m ? m[1] : "";
  const rest = m ? m[2] : s;
  return drive + rest.split("/").map(encodeURIComponent).join("/");
}

// Opens the path with the OS handler — Explorer for folders, default app for
// files (in a passthrough terminal; VS Code's integrated terminal reveals the
// path in VS Code itself rather than launching the OS Explorer — see note in
// the header).

function fileUrl(p) {
  const enc = encodeWinPath(p);
  return "file://" + (enc.startsWith("/") ? "" : "/") + enc;
}

const dirname = (p) => String(p).replace(/[\\/][^\\/]*$/, "");

// Compact a gitflow branch for display: collapse the "type/" prefix to its
// initial (feature/ → f/, hotfix/ → h/, release/ → r/, …) and keep only the
// first three hyphen/underscore-separated words of the rest.
//   feature/statusline-fidelity-emoji-links → f/statusline-fidelity-emoji
//   develop                                  → develop
function shortBranch(b) {
  if (!b) return b;
  const slash = b.indexOf("/");
  let prefix = "";
  let rest = b;
  if (slash !== -1) {
    prefix = b.slice(0, slash).charAt(0) + "/"; // feature → "f/"
    rest = b.slice(slash + 1);
  }
  const words = rest.split(/[-_]/).filter(Boolean).slice(0, 3).join("-");
  return prefix + words;
}

// --- render -----------------------------------------------------------------

function render(d) {
  const badge = `${modelIcon(d?.model)}${EFFORT_ICON[d?.effort?.level] || EFFORT_FALLBACK}`;
  const segs = [usageLine(d?.rate_limits)];
  const tok = tokenSegment(d?.context_window);
  if (tok) segs.push(tok);
  const line1 = `${badge}   ${segs.join("  |  ")}`;

  // Navigation line: branch/worktree → open the folder via the OS handler
  // (Explorer/Finder in a passthrough terminal); PR → GitHub.
  const ws = d?.workspace;
  const wt = d?.worktree;
  const wtPath = wt?.path || ws?.current_dir;
  const branch = wt?.branch || ws?.git_worktree;
  const wtName = wt?.name || ws?.git_worktree;
  const repo = ws?.repo;
  const repoUrl =
    repo?.owner && repo?.name
      ? `https://${repo.host || "github.com"}/${repo.owner}/${repo.name}`
      : null;

  const nav = [];
  if (branch && wtPath) {
    nav.push(osc8(fileUrl(wtPath), `⑂ ${shortBranch(branch)}`));
  } else if (wtPath) {
    const base = wtPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
    nav.push(osc8(fileUrl(wtPath), `📂 ${base}`));
  }
  if (wt && wtName && branch && wtName !== branch && wtPath) {
    nav.push(osc8(fileUrl(wtPath), `📂 ${wtName}`));
  }
  if (d?.pr?.number != null && d?.pr?.url) {
    nav.push(osc8(d.pr.url, `🔗 PR #${d.pr.number}`));
  }

  // Pad so line 2 always shows at least two links: repo → issues → cwd.
  const fallbacks = [];
  if (repoUrl) {
    fallbacks.push(osc8(repoUrl, `🌐 ${repo.owner}/${repo.name}`));
    fallbacks.push(osc8(repoUrl + "/issues", "🐛 issues"));
  }
  if (wtPath) fallbacks.push(osc8(fileUrl(wtPath), "📁 cwd"));
  while (nav.length < 2 && fallbacks.length) nav.push(fallbacks.shift());

  // Controls, rendered as clickable emojis in dim brackets: [📒] logs folder →
  // Explorer (a ledger/logbook, not a wooden log — kept clear of the 🌳 branch
  // metaphor), [📜] transcript file → OS default app, [🌳] base branch → its
  // GitHub tree (or the trunk folder when there's no repo).
  const buttons = [];
  const tp = d?.transcript_path;
  if (tp) {
    const logsDir = dirname(tp);
    if (logsDir) buttons.push(button(fileUrl(logsDir), "📒"));
    buttons.push(button(fileUrl(tp), "📜"));
  }
  const baseBranch = wt?.original_branch || branch;
  if (baseBranch) {
    const basePath = wt?.original_cwd || ws?.project_dir || wtPath;
    const target = repoUrl
      ? `${repoUrl}/tree/${baseBranch.split("/").map(encodeURIComponent).join("/")}`
      : basePath
        ? fileUrl(basePath)
        : null;
    if (target) buttons.push(button(target, "🌳"));
  }

  const line2Parts = [...nav];
  if (buttons.length) line2Parts.push(buttons.join(" "));
  return line2Parts.length ? `${line1}\n${line2Parts.join("   ")}` : line1;
}
