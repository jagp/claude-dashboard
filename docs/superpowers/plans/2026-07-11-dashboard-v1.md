# Claude Dashboard v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v1 dashboard — enriched statusline (Tier 0), session-state sensor, config-driven control buttons, and the `claudectl://` protocol actuator (Tier 1) — per `docs/superpowers/specs/2026-07-11-claude-dashboard-design.md`.

**Architecture:** Statusline = sensor + v1 display (single deployable file, receives full session JSON per tick). `claudectl://` handler = actuator (registry-registered, allowlisted verbs). Launch logic isolated in `src/launch.js` so the future ConPTY bridge replaces one module.

**Tech Stack:** Plain Node.js (CommonJS, zero npm deps), built-in `node:test`, PowerShell 5.1 install scripts, Windows `HKCU` registry.

## Global Constraints

- Node.js ≥ 20 (built-in `node:test` runner). No npm dependencies, ever, in v1.
- All source is CommonJS (`require`), matching the shipped statusline.
- Statusline invariant: **never throw, always print** — any internal failure falls back to simpler output.
- `~/.claude` is resolved as `process.env.CLAUDE_DASHBOARD_DIR || path.join(os.homedir(), ".claude")` everywhere, so tests can redirect to a temp dir.
- Handler: verbs come from a hard-coded allowlist; child processes are spawned with **argument arrays, never concatenated shell strings**; no destructive verbs exist in v1.
- Registry work is `HKCU\Software\Classes\claudectl` only (no admin).
- Run all commands from the repo root. Tests: `node --test test/`.

---

### Task 1: Scaffold + golden-test baseline

Move the shipped statusline into `src/`, the payload sample into fixtures, and pin current behavior with a golden test before changing anything.

**Files:**
- Create: `src/statusline.js` (copy of `statusline.current.js`, then export seam)
- Create: `test/fixtures/payload-sample.json` (copy of `statusline-payload-sample.json`)
- Test: `test/statusline.test.js`
- Modify: `statusline.current.js`, `statusline-payload-sample.json` (delete — superseded)

**Interfaces:**
- Produces: `src/statusline.js` runnable via stdin (`node src/statusline.js < payload.json`) AND requireable: `module.exports = { render }` where `render(payloadObject) -> string`.

- [ ] **Step 1: Copy files into structure**

```bash
mkdir -p src test/fixtures
git mv statusline.current.js src/statusline.js
git mv statusline-payload-sample.json test/fixtures/payload-sample.json
```

- [ ] **Step 2: Add module seam to `src/statusline.js`**

Wrap the stdin pump so requiring the file doesn't consume stdin, and export `render`. Replace lines 10–21 (the stdin block) with:

```js
if (require.main === module) {
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
} else {
  module.exports = { render };
}
```

(`render` is already hoisted as a function declaration; no other edits.)

- [ ] **Step 3: Write the golden test**

```js
// test/statusline.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SL = path.join(__dirname, "..", "src", "statusline.js");
const FIXTURE = path.join(__dirname, "fixtures", "payload-sample.json");

function run(env = {}) {
  return execFileSync("node", [SL], {
    input: fs.readFileSync(FIXTURE),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("golden: two rows, usage + nav", () => {
  const out = run();
  const rows = out.trimEnd().split("\n");
  assert.equal(rows.length, 2);
  assert.match(rows[0], /⌛ 95%/);           // 100 - 5 used
  assert.match(rows[0], /📅 68%/);           // 100 - 32 used
  assert.match(rows[1], /worktree-ado-task-board/);
  assert.match(rows[1], /PR #1/);
});

test("garbage stdin never breaks the bar", () => {
  const out = execFileSync("node", [SL], { input: "not json", encoding: "utf8" });
  assert.equal(out, "status\n");
});
```

- [ ] **Step 4: Run tests — both must pass (behavior unchanged)**

Run: `node --test test/`
Expected: `pass 2`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: move statusline into src/ with module seam and golden tests"
```

---

### Task 2: Tier 0 enrichment — transcript link, original-project link, context gauge, cost

**Files:**
- Modify: `src/statusline.js` (inside `render`, and `usageLine` call site)
- Test: `test/statusline.test.js` (extend)

**Interfaces:**
- Consumes: `render(payload)`, `osc8(url, text)`, `fileToVscodeUrl(winPath)` from Task 1.
- Produces: row 1 gains `⛁ <ctx>%` and `$<cost>`; row 2 gains `🧾 log` and (in worktrees) `⌂ <original base dir>`.

- [ ] **Step 1: Write failing tests**

Append to `test/statusline.test.js`:

```js
test("tier0: context gauge and cost on row 1", () => {
  const rows = run().trimEnd().split("\n");
  assert.match(rows[0], /⛁ 84%/);            // remaining_percentage
  assert.match(rows[0], /\$2\.75/);           // total_cost_usd rounded to cents
});

test("tier0: transcript and original-project links on row 2", () => {
  const rows = run().trimEnd().split("\n");
  assert.match(rows[1], /🧾 log/);
  assert.match(rows[1], /vscode:\/\/file\/C:\/Users\/jared\/.claude\/projects/);
  assert.match(rows[1], /⌂ dev-strap/);       // worktree.original_cwd basename
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/` — Expected: the two new tests FAIL (strings absent).

- [ ] **Step 3: Implement in `render`**

In `src/statusline.js`, replace the `line1` assignment and extend the nav block:

```js
  const extras = [];
  const ctx = d?.context_window?.remaining_percentage;
  if (ctx != null) extras.push(`⛁ ${Math.round(ctx)}%`);
  const usd = d?.cost?.total_cost_usd;
  if (usd != null) extras.push(`$${usd.toFixed(2)}`);
  const line1 = `${badge}   ${usage}${extras.length ? "  |  " + extras.join("  ") : ""}`;
```

After the PR link push in the nav block, add:

```js
  if (d?.transcript_path) {
    nav.push(osc8(fileToVscodeUrl(d.transcript_path), "🧾 log"));
  }
  const orig = wt?.original_cwd;
  if (orig) {
    const origBase = orig.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
    nav.push(osc8(fileToVscodeUrl(orig), `⌂ ${origBase}`));
  }
```

- [ ] **Step 4: Run tests** — `node --test test/` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: tier-0 statusline enrichment (transcript, origin, context, cost)"
```

---

### Task 3: Sensor — per-session state snapshots with history

**Files:**
- Modify: `src/statusline.js`
- Test: `test/statusline.test.js` (extend)

**Interfaces:**
- Produces: on every render, `<dashDir>/dashboard/state/<session_id>.json` containing `{ updated: <ms>, payload: <full payload>, history: [{ts, context, cost}, …] }` (history capped at 50). `dashDir` = `CLAUDE_DASHBOARD_DIR` env or `~/.claude`. Mission Control (v2) reads exactly this shape.

- [ ] **Step 1: Write failing test**

```js
test("sensor: writes state snapshot with capped history", () => {
  const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "dash-"));
  run({ CLAUDE_DASHBOARD_DIR: tmp });
  run({ CLAUDE_DASHBOARD_DIR: tmp }); // second tick appends history
  const file = path.join(tmp, "dashboard", "state",
    "703a3fc1-4e73-45f1-8b3d-9d1caf23e0b5.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(state.payload.session_id, "703a3fc1-4e73-45f1-8b3d-9d1caf23e0b5");
  assert.equal(state.history.length, 2);
  assert.equal(state.history[0].cost, 2.7537265);
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/` — Expected: FAIL (no file written).

- [ ] **Step 3: Implement**

Add to `src/statusline.js` (top: `const fs = require("node:fs"); const os = require("node:os"); const path = require("node:path");`):

```js
function dashDir() {
  return process.env.CLAUDE_DASHBOARD_DIR || path.join(os.homedir(), ".claude");
}

// Sensor: the statusline is a free heartbeat — persist a snapshot per tick.
// Display always wins: every failure here is swallowed.
function writeSensor(d) {
  try {
    if (!d?.session_id || !/^[\w-]+$/.test(d.session_id)) return;
    const dir = path.join(dashDir(), "dashboard", "state");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, d.session_id + ".json");
    let history = [];
    try { history = JSON.parse(fs.readFileSync(file, "utf8")).history || []; } catch {}
    history.push({
      ts: Date.now(),
      context: d.context_window?.used_percentage ?? null,
      cost: d.cost?.total_cost_usd ?? null,
    });
    const tmpFile = file + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify({ updated: Date.now(), payload: d, history: history.slice(-50) }));
    fs.renameSync(tmpFile, file); // atomic-enough: readers never see a partial file
  } catch {}
}
```

First line inside `render(d)`: `writeSensor(d);`

- [ ] **Step 4: Run tests** — `node --test test/` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sensor writes per-session state snapshots with history"
```

---

### Task 4: Config-driven controls row (`dashboard.json`)

**Files:**
- Modify: `src/statusline.js`
- Create: `config/dashboard.example.json`
- Test: `test/statusline.test.js` (extend)

**Interfaces:**
- Consumes: `dashDir()` from Task 3.
- Produces: `resolvePlaceholders(template, payload) -> string|null` (null if any `{dotted.path}` missing); a third output row rendered from `<dashDir>/dashboard.json` — shape `{ "controls": [{ "icon", "label", "url" }] }`.

- [ ] **Step 1: Create `config/dashboard.example.json`**

```json
{
  "controls": [
    { "icon": "🆕", "label": "new", "url": "claudectl://new-session?dir={workspace.project_dir}" },
    { "icon": "🧾", "label": "log", "url": "vscode://file/{transcript_path}" },
    { "icon": "📋", "label": "sid", "url": "claudectl://copy?text={session_id}" }
  ]
}
```

- [ ] **Step 2: Write failing tests**

```js
test("controls: renders third row from dashboard.json", () => {
  const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "dash-"));
  fs.copyFileSync(path.join(__dirname, "..", "config", "dashboard.example.json"),
    path.join(tmp, "dashboard.json"));
  const rows = run({ CLAUDE_DASHBOARD_DIR: tmp }).trimEnd().split("\n");
  assert.equal(rows.length, 3);
  assert.match(rows[2], /🆕 new/);
  assert.match(rows[2], /claudectl:\/\/copy\?text=703a3fc1/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("controls: skips entries with unresolvable placeholders, hides row if none", () => {
  const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "dash-"));
  fs.writeFileSync(path.join(tmp, "dashboard.json"),
    JSON.stringify({ controls: [{ icon: "x", label: "x", url: "claudectl://open?path={no.such.field}" }] }));
  const rows = run({ CLAUDE_DASHBOARD_DIR: tmp }).trimEnd().split("\n");
  assert.equal(rows.length, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run to verify failure** — Expected: both FAIL (always 2 rows).

- [ ] **Step 4: Implement**

```js
function resolvePlaceholders(template, payload) {
  let missing = false;
  const out = String(template).replace(/\{([\w.]+)\}/g, (_, p) => {
    const v = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), payload);
    if (v == null) { missing = true; return ""; }
    return String(v);
  });
  return missing ? null : out;
}

// The v1 "self-design" surface: users compose their own buttons in
// <dashDir>/dashboard.json. Any failure hides the row, never the bar.
function controlsLine(d) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dashDir(), "dashboard.json"), "utf8"));
    const parts = [];
    for (const c of cfg.controls || []) {
      const url = resolvePlaceholders(c.url || "", d);
      if (!url) continue;
      parts.push(osc8(url, `${c.icon || "▷"} ${c.label || ""}`.trim()));
    }
    return parts.length ? parts.join("   ") : null;
  } catch { return null; }
}
```

End of `render`, replace the return with:

```js
  const rows = [line1];
  if (nav.length) rows.push(nav.join("   "));
  const controls = controlsLine(d);
  if (controls) rows.push(controls);
  return rows.join("\n");
```

Also export the new seam: `module.exports = { render, resolvePlaceholders };`

- [ ] **Step 5: Run tests** — `node --test test/` — Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: config-driven controls row from dashboard.json"
```

---

### Task 5: Handler — URL parsing, allowlist, validation (no OS side effects yet)

**Files:**
- Create: `src/claudectl-handler.js`
- Test: `test/handler.test.js`

**Interfaces:**
- Produces: `parseCommand(rawUrl) -> { verb, params }` (throws `Error` with reason on wrong scheme / unknown verb / invalid params); `VERBS` map `{ [verb]: { confirm: boolean, validate(params), run(params, deps) } }`. Verbs: `new-session`, `open`, `copy`. Task 6 fills in `run` bodies.

- [ ] **Step 1: Write failing tests**

```js
// test/handler.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { parseCommand } = require("../src/claudectl-handler.js");

test("parses verb and params", () => {
  const c = parseCommand("claudectl://copy?text=abc123");
  assert.equal(c.verb, "copy");
  assert.equal(c.params.text, "abc123");
});

test("rejects unknown verbs (allowlist)", () => {
  assert.throws(() => parseCommand("claudectl://format-disk?x=1"), /unknown verb/);
});

test("rejects wrong scheme", () => {
  assert.throws(() => parseCommand("https://copy?text=x"), /scheme/);
});

test("open/new-session require an existing directory or file", () => {
  assert.throws(() => parseCommand("claudectl://open?path=C:\\no\\such\\dir-xyz"), /does not exist/);
  assert.throws(() => parseCommand("claudectl://new-session?dir=C:\\no\\such\\dir-xyz"), /does not exist/);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement skeleton**

```js
#!/usr/bin/env node
// claudectl:// protocol actuator. SECURITY: any web page can invoke this
// scheme — trust lives HERE. Hard allowlist, validated params, array-args
// spawns only, confirmation before anything that spawns a process.
const fs = require("node:fs");

const VERBS = {
  "new-session": {
    confirm: true,
    validate(p) { mustExist(p.dir, "dir"); },
    run(p, deps) { deps.launchSession(p); },
  },
  "open": {
    confirm: false,
    validate(p) { mustExist(p.path, "path"); },
    run(p, deps) { deps.shellOpen(p.path); },
  },
  "copy": {
    confirm: false,
    validate(p) { if (!p.text) throw new Error("copy: missing text"); },
    run(p, deps) { deps.setClipboard(p.text); },
  },
};

function mustExist(v, name) {
  if (!v) throw new Error(`missing ${name}`);
  if (!fs.existsSync(v)) throw new Error(`${name} does not exist: ${v}`);
}

function parseCommand(rawUrl) {
  const u = new URL(rawUrl);
  if (u.protocol !== "claudectl:")
    throw new Error(`wrong scheme: ${u.protocol}`);
  const verb = u.host || u.pathname.replace(/^\/+/, "");
  if (!Object.prototype.hasOwnProperty.call(VERBS, verb))
    throw new Error(`unknown verb: ${verb}`);
  const params = Object.fromEntries(u.searchParams);
  VERBS[verb].validate(params);
  return { verb, params };
}

module.exports = { parseCommand, VERBS };
```

- [ ] **Step 4: Run tests** — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: claudectl handler with allowlisted, validated verbs"
```

---

### Task 6: Handler — real effects (`copy`, `open`, `new-session`) + launch module

**Files:**
- Create: `src/launch.js`
- Modify: `src/claudectl-handler.js` (main entry, deps, confirm, log)
- Test: `test/handler.test.js` (extend)

**Interfaces:**
- Consumes: `parseCommand`, `VERBS` from Task 5.
- Produces: `src/launch.js` exports `launchSession({ dir, model }) -> void` (spawns detached `wt.exe -d <dir> -- claude [--model <model>]`, falling back to `cmd /c start powershell -NoExit -Command claude`). Handler exports `main(argv, deps?) -> exitCode` and, when run as a script, executes `main(process.argv)`. Every invocation appends a line to `%LOCALAPPDATA%\claudectl\invocations.log`. **Note:** `effort` param is accepted but ignored in v1 (no public CLI flag); logged so nothing is silent.

- [ ] **Step 1: Write failing tests (deps injected — no real spawns)**

```js
const { main } = require("../src/claudectl-handler.js");

function fakeDeps() {
  const calls = [];
  return {
    calls,
    launchSession: (p) => calls.push(["launch", p]),
    shellOpen: (p) => calls.push(["open", p]),
    setClipboard: (t) => calls.push(["copy", t]),
    confirmAction: () => true,
    notifyError: (m) => calls.push(["error", m]),
    log: () => {},
  };
}

test("main dispatches copy without confirmation", () => {
  const deps = fakeDeps();
  const code = main(["node", "handler", "claudectl://copy?text=hi"], deps);
  assert.equal(code, 0);
  assert.deepEqual(deps.calls, [["copy", "hi"]]);
});

test("main refuses new-session when user declines confirm", () => {
  const deps = { ...fakeDeps(), confirmAction: () => false };
  const code = main(["node", "handler", `claudectl://new-session?dir=${encodeURIComponent(__dirname)}`], deps);
  assert.equal(code, 0);
  assert.equal(deps.calls.length, 0); // nothing launched
});

test("main reports unknown verb via notifyError, exit 1", () => {
  const deps = fakeDeps();
  const code = main(["node", "handler", "claudectl://nuke?x=1"], deps);
  assert.equal(code, 1);
  assert.equal(deps.calls[0][0], "error");
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (`main` not exported).

- [ ] **Step 3: Implement `src/launch.js`**

```js
// Session launcher — deliberately the ONLY place that starts Claude.
// The future ConPTY bridge (spec §7.1) replaces this module, nothing else.
const { spawn, spawnSync } = require("node:child_process");

function hasWt() {
  try { return spawnSync("where", ["wt"], { stdio: "ignore" }).status === 0; }
  catch { return false; }
}

function launchSession({ dir, model }) {
  const claudeArgs = ["claude"];
  if (model) claudeArgs.push("--model", model);
  let child;
  if (hasWt()) {
    child = spawn("wt.exe", ["-d", dir, "--", ...claudeArgs], { detached: true, stdio: "ignore" });
  } else {
    child = spawn("cmd.exe", ["/c", "start", "powershell", "-NoExit", "-Command", claudeArgs.join(" ")],
      { cwd: dir, detached: true, stdio: "ignore" });
  }
  child.unref();
}

module.exports = { launchSession };
```

- [ ] **Step 4: Implement real deps + `main` in the handler**

Append to `src/claudectl-handler.js`:

```js
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { launchSession } = require("./launch.js");

const realDeps = {
  launchSession,
  shellOpen: (p) => spawnSync("explorer.exe", [p]),
  setClipboard: (t) =>
    spawnSync("powershell", ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
      { input: t }),
  confirmAction: (msg) => {
    const r = spawnSync("powershell", ["-NoProfile", "-Command",
      `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${msg.replace(/'/g, "''")}','claudectl','YesNo','Question')`],
      { encoding: "utf8" });
    return /Yes/.test(r.stdout || "");
  },
  notifyError: (msg) => {
    spawnSync("powershell", ["-NoProfile", "-Command",
      `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${msg.replace(/'/g, "''")}','claudectl error','OK','Error')`]);
  },
  log: (line) => {
    try {
      const dir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "claudectl");
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, "invocations.log"), `${new Date().toISOString()} ${line}\n`);
    } catch {}
  },
};

function main(argv, deps = realDeps) {
  const rawUrl = argv[2];
  try {
    const { verb, params } = parseCommand(rawUrl);
    deps.log(`${verb} ${JSON.stringify(params)}`);
    if (VERBS[verb].confirm &&
        !deps.confirmAction(`Run "${verb}" with ${JSON.stringify(params)}?`)) {
      deps.log(`${verb} declined`);
      return 0;
    }
    VERBS[verb].run(params, deps);
    return 0;
  } catch (e) {
    deps.log(`REJECTED ${rawUrl}: ${e.message}`);
    deps.notifyError(e.message);
    return 1;
  }
}

module.exports = { parseCommand, VERBS, main };
if (require.main === module) process.exitCode = main(process.argv);
```

- [ ] **Step 5: Run tests** — `node --test test/` — Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: handler effects (copy/open/new-session) with confirm gate and log"
```

---

### Task 7: Install / uninstall / deploy scripts + end-to-end verification

**Files:**
- Create: `install/install.ps1`, `install/uninstall.ps1`, `install/deploy-statusline.ps1`
- Create: `README.md` (usage + E2E checklist)

**Interfaces:**
- Consumes: `src/claudectl-handler.js` (registered as the scheme handler), `src/statusline.js` (deployed to `~/.claude/statusline.js`).

- [ ] **Step 1: Write `install/install.ps1`**

```powershell
# Registers claudectl:// for the current user (no admin). Idempotent.
$ErrorActionPreference = "Stop"
$handler = (Resolve-Path (Join-Path $PSScriptRoot "..\src\claudectl-handler.js")).Path
$node = (Get-Command node).Source
$key = "HKCU:\Software\Classes\claudectl"
New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $key -Name "(default)" -Value "URL:Claude Control"
Set-ItemProperty -Path $key -Name "URL Protocol" -Value ""
Set-ItemProperty -Path "$key\shell\open\command" -Name "(default)" `
  -Value "`"$node`" `"$handler`" `"%1`""
Write-Host "claudectl:// registered -> $handler"
```

- [ ] **Step 2: Write `install/uninstall.ps1`**

```powershell
$ErrorActionPreference = "Stop"
Remove-Item -Path "HKCU:\Software\Classes\claudectl" -Recurse -Force -Confirm:$false
Write-Host "claudectl:// unregistered"
```

- [ ] **Step 3: Write `install/deploy-statusline.ps1`**

```powershell
# Deploys the statusline (backs up the current one first).
$ErrorActionPreference = "Stop"
$src = (Resolve-Path (Join-Path $PSScriptRoot "..\src\statusline.js")).Path
$dest = Join-Path $env:USERPROFILE ".claude\statusline.js"
if (Test-Path $dest) { Copy-Item $dest "$dest.bak" -Force }
Copy-Item $src $dest -Force
Write-Host "statusline deployed to $dest (backup: $dest.bak)"
```

- [ ] **Step 4: Verify registration**

Run: `powershell -File install/install.ps1` then
`powershell -Command "(Get-ItemProperty 'HKCU:\Software\Classes\claudectl\shell\open\command').'(default)'"`
Expected: the node + handler command line. Run install again — Expected: no error (idempotent).

- [ ] **Step 5: Write `README.md` with the E2E checklist**

Contents: what the project is (2 paragraphs, link spec), install steps, and this manual checklist:

```markdown
## E2E verification (manual, VS Code terminal)
1. `install/install.ps1` then `install/deploy-statusline.ps1`; copy
   `config/dashboard.example.json` to `~/.claude/dashboard.json`.
2. Open a Claude Code session — statusline shows 3 rows.
3. Ctrl+click 🧾 log → transcript opens in VS Code.
4. Ctrl+click 📋 sid → clipboard holds the session id.
5. Ctrl+click 🆕 new → confirm dialog names the right dir → Yes →
   new terminal running `claude` appears. Decline → nothing happens.
6. From a browser address bar, visit `claudectl://new-session?dir=C:\` →
   confirm dialog appears (proves the gate guards web-page invocation).
7. Check `%LOCALAPPDATA%\claudectl\invocations.log` — every click above logged.
```

- [ ] **Step 6: Walk the checklist yourself; then commit**

```bash
git add -A && git commit -m "feat: install/uninstall/deploy scripts and E2E checklist"
```

---

## Self-review notes

- **Spec coverage:** §4 → Task 2; §3 sensor → Task 3; §5.4 → Task 4; §5.2/5.3 → Tasks 5–6; §5.1 → Task 7; §11 testing → Tasks 1–6 test steps. §6–§9 are design-only (no v1 tasks by intent). Mission Control mockup (§8) ships with the spec itself (`docs/mockups/mission-control.html`), not as a plan task.
- **Effort param:** spec lists `&effort=` on `new-session`; v1 accepts and logs but doesn't forward it (no public CLI flag) — recorded in Task 6 Interfaces.
- **Type consistency check:** `render`, `resolvePlaceholders`, `dashDir`, `parseCommand`, `VERBS`, `main`, `launchSession` — names match across tasks.
