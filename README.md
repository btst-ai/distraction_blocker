# 🥷 Gōrudo — Protect Your Goals 🧘

> **Gōrudo (ゴール道)** means *"Goal Path"* — your intentional journey to achieving what matters.

Gōrudo is a **Manifest V3 Chrome extension** that blocks distracting websites and wraps that enforcement in a full **goal-setting, daily timeline, break management, and vocabulary-learning system**. Every break is a conscious choice, backed by a light friction challenge. All data stays local — no accounts, no servers, no tracking.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Gorudo-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/gorudo/nhccoddpkgalplfmondeiodekcoecafo)
![Version](https://img.shields.io/badge/version-1.3-green)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange)

---

## ✨ Features

### 🎯 Goal-Driven Focus
- Set daily goals and track progress with a single click to mark them complete
- Goals are sortable by priority using ▲/▼ buttons — push high-priority items to the top
- Completed goals float to the top of the list for celebration and visibility
- The extension requires **at least 3 goals** before allowing a break — no goals, no break
- Yesterday's completed goal count is shown in the header to carry momentum forward

### 🛡️ Smart Website Blocking
- Block any site by domain — blocked during focus time, unlocked during breaks
- Organize blocked sites into **categories** (Social, Video, News, Sports, Games, Shopping…)
- **Whitelist exceptions**: allow specific subdomains even when the parent domain is blocked (e.g. `music.youtube.com` when `youtube.com` is blocked)
- **No-Go Zone**: a permanent list that is *never* unlocked, even during breaks — removing a site from it requires a 15-minute wait to prevent impulsive decisions
- Redirect blocked pages to a random "no" GIF or an Amnesty International donation page
- Real-time block statistics with daily totals and a top-3 most-blocked-sites leaderboard

### ☕ Mindful Breaks
- Take a break in two steps: choose duration → complete a challenge → break starts
- **Select which categories to unlock** per break (or unlock everything)
- Optional **periodic "on-break" reminders** notify you at a set interval so you don't lose track of time
- **Break warning notification** fires N minutes before your break ends (configurable)
- Extend breaks with one-click snooze buttons (+1/+2/+5/+10 min)
- **Even-numbered extensions** (2nd, 4th, …) require a light mini-challenge before extending, adding progressive accountability friction
- The snooze button emoji gets progressively more judgmental the more you extend

### 📚 Vocabulary Challenges
Before each break (and on break extensions), choose one of:
- **📚 Vocabulary** — click 10 words to reveal their translation; optional pronunciation guide for non-Latin scripts
- **🔢 Maths** — solve a quick arithmetic problem
- **🎵 Other** — wait through a short timed pause

**11 language pairs built-in:**

| | | | |
|---|---|---|---|
| 🇫🇷 French | 🇩🇪 German | 🇪🇸 Spanish | 🇮🇹 Italian |
| 🇸🇦 Arabic | 🇰🇷 Korean | 🇯🇵 Japanese | 🇺🇦 Ukrainian |
| 🇵🇹 Portuguese | 🇻🇳 Vietnamese | 🇫🇷🇬🇷 French/Greek | |

You can also add your own words, bulk-import via CSV, and create fully custom dictionaries.

### ⏱️ Cooldown System
- A configurable cooldown period enforces focus time between breaks
- Reset the cooldown early by completing a **harder challenge** (30 words / difficult math / longer pause)

### 📆 Daily Timeline
- Every break and goal completion is logged with a timestamp
- Break items are color-coded by duration relative to your default break length (blue → yellow → orange → red)
- Goal completions use progressively celebratory medals: 🥉 🥈 🥇 🏆 🎖️ 👑 🚀 ♾️

---

## 🖥️ Extension Popup Structure

```
Header        ← Status, active break controls, snooze buttons
──────────────
Previous Goals ← Re-add yesterday's unfinished goals
Today's Goals  ← Add, reorder, complete, remove
Today's Timeline ← Visual log of breaks & completions
Blocks Today  ← Stats + top blocked sites
Take a Break  ← Cooldown timer / break flow
──────────────
Focus Saboteurs      (collapsible) ← Blocked sites by category
Discipline Exemptions (collapsible) ← Always-allowed whitelist
NO-GO ZONE           (collapsible) ← Never-unlocked sites
──────────────
Settings      ← Break/cooldown durations, challenge type, language, redirect
               Advanced Dictionary (collapsible)
```

---

## ⚙️ Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| Break Duration | 5 min | How long each break lasts |
| Time Between Breaks | 25 min | Cooldown enforced after each break |
| Warning Before Break Ends | 2 min | Notification N minutes before break ends |
| Periodic Reminders | 10 min | Notify at an interval while on break (toggle available on the break start screen) |
| Validation Step | Vocabulary | Challenge type: Vocabulary / Maths / Other |
| Language | 🇫🇷 French | Vocabulary language pair |
| Redirect Blocked Sites | GIF | Redirect target: random GIF or Amnesty donation |

---

## 🔒 Privacy

- **All data is stored locally** in `chrome.storage.local` — goals, blocked sites, vocabulary stats, timeline
- **No external servers** — the extension never makes outbound network requests (vocabulary CSV files are bundled)
- **Works completely offline**
- Only standard Chrome extension APIs are used: `storage`, `alarms`, `notifications`, `webNavigation`, `tabs`

---

## 🛠️ Development

### Prerequisites
- Python 3.x (for the build script)
- Google Chrome

### Repository Structure

```
distraction_blocker/
├── src/
│   ├── manifest.json          # Extension manifest template
│   ├── background/
│   │   └── background.js      # Service worker: blocking, state, alarms, messaging
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.css          # Styles (retro pixel aesthetic)
│   │   └── popup.js           # All UI logic and chrome.runtime messaging
│   ├── data/
│   │   └── voc_*.csv          # Vocabulary files (11 language pairs)
│   └── assets/
│       ├── icons/             # Extension icons (16/48/128px)
│       └── images/            # Challenge images (rickroll GIF, etc.)
├── scripts/
│   ├── build.py               # Dev/prod build script
│   ├── config.py              # Master blocklist & category config
│   ├── update_vocab_csvs.py   # Vocabulary maintenance
│   └── fix_arabic_transcriptions.py
├── docs/
│   ├── BUILD.md
│   ├── chrome-store-description.md
│   └── chrome-store-privacy-justifications.md
└── dist/                      # Generated build output (gitignored)
    ├── dev/                   # Full blocklist, debug logs, "Gorudo Dev"
    └── prod/                  # Public blocklist, logs stripped, "Gorudo"
```

### Building

**Development build** — full blocklist, `console.log` retained, named "Gorudo Dev":
```bash
python3 scripts/build.py dev
# Output: dist/dev/
```

**Production build** — minimal public blocklist, all logs stripped, named "Gorudo":
```bash
python3 scripts/build.py prod
# Output: dist/prod/
```

### Loading in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select `dist/dev/` (for development) or `dist/prod/` (for production)

### Blocklist Configuration (`scripts/config.py`)

The master blocklist is a single list of `(domain, category, is_public)` tuples. The build script derives all environment-specific lists from it:

- `DEV_BLOCKED_SITES` — all entries
- `PUBLIC_BLOCKED_SITES` — only `is_public=True` entries
- `SITE_CATEGORIES` — domain → category mapping injected into `background.js` at build time

### Architecture Notes

- **Blocking** is implemented via `chrome.tabs.update` redirects, triggered by `webNavigation` events (`onBeforeNavigate`, `onCommitted`, `onHistoryStateUpdated`) and `chrome.tabs.onUpdated`. This catches standard navigations, history API changes (SPAs), and hash changes.
- **State** is persisted in `chrome.storage.local` with a `backup_state` copy and storage-quota error notifications.
- **All alarm and notification listeners** wrap their logic in `initializeState().then(...)` to prevent data races when the service worker wakes from sleep.
- The popup communicates with the service worker entirely through `chrome.runtime.sendMessage` — no shared memory.

---

## 🚀 The Gōrudo Way

Gōrudo is not about punishment or hard restrictions. It's about three things:

1. **Intentional choices** — every break is a conscious decision, backed by a 10-word vocabulary check or a quick math problem
2. **Self-accountability** — you set the rules, you follow them; the extension just holds the door closed
3. **Progress tracking** — see your daily timeline, celebrate completions, carry your wins into tomorrow

**Start your path. 🥷 Protect your goals 🧘**

---

## 📋 Changelog

### v1.3
- **Settings cleanup**: removed the periodic reminder enable/disable checkbox from the Settings panel — the toggle now lives exclusively on the break start screen, where it's actually relevant
- **Yesterday's goal count**: the Today's Goals header now shows how many goals you completed the previous day (e.g. *"3 achieved yesterday"*) to carry momentum forward
- **Icon fix**: prod build was incorrectly using the green dev icon for the 48px and 128px toolbar sizes; restored the correct red prod icons across all sizes

### v1.2
- Goals section rework, break notifications, periodic reminders, bug fixes & config refactor

### v1.1
- Initial public release

---

*Gōrudo is open source. All feedback and contributions welcome.*
