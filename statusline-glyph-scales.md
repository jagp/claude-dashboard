# Statusline glyph scales

A palette of ordered glyph ramps for the statusline badges. The design rule for
every scale: **the ordering must read straight off the differences between the
glyphs** — no legend required (the "1‑2‑3‑4" test). Swap any ramp in one place
in `statusline.current.js` (`MODEL_ICON` / `EFFORT_ICON` and their fallbacks).

Two badges use these scales:

- **Model** — 4 tiers: `haiku · sonnet · opus · fable` (least → most capable).
- **Effort** — 5 stops: `low · medium · high · xhigh · max`
  (`xhigh` = ultracode). A scale needs **five** glyphs, monotonic.

Keep the two badges in **different visual families** so they never blur (they
sit adjacent on line 1).

---

## In use / history

| Badge  | Status   | low / haiku | medium / sonnet | high / opus | xhigh / fable | max | fallback |
|--------|----------|:--:|:--:|:--:|:--:|:--:|:--:|
| Effort | **live** | ○ | ◐ | ● | ◉ | ★ | · |
| Model  | **live** | 🥉 | 🥈 | 🥇 | 🏆 | — | 🎖️ |
| Model  | retired  | ▂ | ▄ | ▆ | █ | — | ▁ |

Effort is currently a **text-glyph circle ramp** (empty → half → full → double →
star), mirroring the model-picker UI. Model moved from a block-height ramp
(`▂▄▆█`) to the medal ladder (`🥉🥈🥇🏆`).

---

## Alternative effort ramps (5 stops)

Ordered `low → medium → high → xhigh → max`.

| Theme | low | medium | high | xhigh | max | The idea |
|-------|:--:|:--:|:--:|:--:|:--:|----------|
| **Psychology** (cognitive load) | 😴 | 🙂 | 🤔 | 🧐 | 🤯 | asleep → relaxed → pondering → scrutinizing → mind‑blown. On‑the‑nose for "how hard is it thinking." |
| **Caffeine** | 🥛 | 🍵 | ☕ | 🥤 | ⚡ | milk → tea → coffee → energy drink → jolt. Effort = stimulant dose. |
| **Spiciness / heat** | 🧊 | 🌡️ | 🌶️ | 🔥 | 🌋 | ice → warm → chili → fire → volcano. Effort = temperature. |
| **Age / wisdom** | 👶 | 🧒 | 🧑 | 🧓 | 🧙 | baby → child → adult → elder → sage. Effort = accumulated mastery. |
| **Robotic escalation** | 🔩 | 🤖 | 🦾 | 🧠 | 🛸 | bolt → robot → bionic → cognition → transcendent AI. |
| **Love / warmth** | 🤍 | 💛 | 🧡 | ❤️ | 💖 | color‑temperature ramp of hearts, ending sparkling. (`❤️‍🔥` burning‑heart is a punchier max but is a ZWJ sequence — see caveats.) |
| **Weather / storm energy** | 🌤️ | ⛅ | 🌧️ | ⛈️ | 🌪️ | fair → cloudy → rain → thunderstorm → tornado. Effort = atmospheric energy. |
| **Velocity / propulsion** | 🚶 | 🚲 | 🚗 | ✈️ | 🚀 | walk → bike → car → plane → rocket. Effort = speed/power. |
| **Moon (waxing)** | 🌑 | 🌒 | 🌓 | 🌔 | 🌕 | clean 5‑step fill — but geometrically the *same family* as the live circle ramp, so low novelty. Listed for completeness. |

### Text-glyph ramps (width‑safe, no emoji rendering risk)

Same monospace family as the live effort scale — safest across terminals.

| Theme | low | medium | high | xhigh | max | The idea |
|-------|:--:|:--:|:--:|:--:|:--:|----------|
| **Circles** (live) | ○ | ◐ | ● | ◉ | ★ | empty → half → full → double → star. |
| **Bars / height** | ▁ | ▃ | ▅ | ▇ | █ | rising block — reads as a gauge. |
| **Braille fill** | ⠁ | ⠃ | ⠇ | ⠧ | ⠿ | dots filling a cell, densest = max. |
| **Shade blocks** | ░ | ▒ | ▓ | █ | ⬛ | increasing ink density. |

---

## Alternative model ramps (4 tiers)

Ordered `haiku → sonnet → opus → fable`. (The live scale is medals.)

| Theme | haiku | sonnet | opus | fable | The idea |
|-------|:--:|:--:|:--:|:--:|----------|
| **Medals** (live) | 🥉 | 🥈 | 🥇 | 🏆 | bronze → silver → gold → trophy; a self‑ordering ranking. |
| **Creature size** | 🐁 | 🐇 | 🦊 | 🐘 | bigger animal = more capable model. |
| **Literary form** (plays on the *names*) | 🍃 | 📜 | 🎼 | 📖 | haiku (tiny poem) → sonnet (scroll) → opus (grand score) → fable (tale). Semantic to what each name *means*. |
| **Gemstones** | 🪨 | 🔶 | 🔷 | 💎 | rock → amber → sapphire → diamond; increasing value. |
| **Celestial** | ✨ | ⭐ | 🌟 | ☀️ | spark → star → glowing star → sun; increasing luminosity. |

---

## Rendering caveats

- **Avoid ZWJ sequences** for badges: `❤️‍🔥` (burning heart), `🧑‍🦱`, `🏳️‍🌈`, etc.
  join multiple codepoints with a zero‑width joiner and can split into two
  glyphs or tofu under ConPTY / Windows Terminal. Prefer single‑codepoint
  emoji. (The live badges `🥇 📒 📜 🌳 🔗 📅 ⌛` are all confirmed working here.)
- **Variation‑selector emoji** (those needing `U+FE0F` to render in color —
  `🌡️ ⛅ 🌤️ ❤️`) usually work but occasionally render narrow/monochrome in
  older terminals. Test before shipping.
- **Width**: emoji are double‑width. Model badge is already emoji; if effort
  goes emoji too, line 1 opens with two emoji (e.g. `🥇🤯`) — fine, just a wider
  badge. Text‑glyph effort keeps the badge one emoji + one narrow glyph.
- **Keep the families distinct** — don't pair, say, medals (model) with moon
  circles (effort) that echo the medal shapes; the two badges should be
  instantly separable.

---

## How to apply

In `statusline.current.js`:

```js
// Effort — pick a row above; 5 stops, monotonic.
const EFFORT_ICON = { low: "😴", medium: "🙂", high: "🤔", xhigh: "🧐", max: "🤯" };
const EFFORT_FALLBACK = "·";
```

Then redeploy: `cp statusline.current.js ~/.claude/statusline.js` (the live file
`settings.json` runs). The bar re‑renders on the next tick.

**Recommendation:** for the clearest "how hard is it working" read, the
**Psychology** ramp (`😴🙂🤔🧐🤯`) is the most literal; **Caffeine** and
**Spiciness** are strong runners‑up. If width‑safety matters most, stay on a
text‑glyph ramp (**Bars** `▁▃▅▇█` reads as a gauge and pairs cleanly with the
emoji model medals).
