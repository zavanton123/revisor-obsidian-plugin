# Revisor

**Revisor** is an [Obsidian](https://obsidian.md) plugin for reviewing notes with **FSRS spaced repetition** — the same family of algorithm used by Anki. Mark any note for review, rate it when it comes due, and Revisor schedules the next review automatically.

All scheduling state lives in the note's YAML frontmatter, so your vault stays portable and human-readable.

## Features

- **FSRS scheduling** via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-6)
- **Dedicated review pane** with blurred note content (reveal on click or Space)
- **Four rating buttons**: Again, Hard, Good, Easy — with keyboard shortcuts
- **Undo last review** (`u`) — restore previous `due_at` + `fsrs` after a mis-click
- **Queue actions**: bury (hide until tomorrow), suspend, forget (reset FSRS), unsuspend, unbury
- **Dataview-powered queue** of due notes with **random order** in the review pane
- **Filtering** by tags or any Dataview source expression, with savable filters
- **Status bar & ribbon** shortcuts showing how many notes are due
- **Queue breakdown** — when empty, shows buried, suspended, and not-yet-due counts
- **Review stats dashboard** — Anki-style stats screen with activity heatmap, today summary, reviews graph, card counts, future due, answer buttons, hourly breakdown, true retention, and FSRS distribution graphs
- **Persistent review log** — each rating is recorded for stats (from install forward; undo removes the matching entry)
- **Plain frontmatter** — no proprietary database; edit schedules by hand if needed

## Requirements

- [Obsidian](https://obsidian.md) 1.1.0+
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) (required — Revisor uses it to find due notes)

## Installation

### Community plugins

1. Install **Dataview** from Community plugins.
2. Install **Revisor** (plugin ID: `repeat-plugin`) from Community plugins, or add this repo via [BRAT](https://github.com/TfTHacker/obsidian42-brat).

### Manual install

1. Download the latest release zip (or build locally — see [Development](#development)).
2. Extract the `repeat-plugin` folder into `<vault>/.obsidian/plugins/`.
3. Enable **Revisor** under **Settings → Community plugins**.

## Quick start

1. Open any note and run **`Repeat this note`** from the command palette.
   Revisor adds FSRS metadata to the note and makes it due immediately.
2. Open the review pane via the **clock ribbon icon**, the status bar, or **`Review due notes`**.
3. Reveal the note (**Space** or click), read it, then rate it with a button or keyboard shortcut.
4. Mis-clicked? Press **`u`** to undo.

## How FSRS works here

Revisor implements **Free Spaced Repetition Scheduler (FSRS)**. After each review you pick one of four grades:

| Grade | Meaning |
|-------|---------|
| **Again** | You forgot; interval resets toward learning steps |
| **Hard** | Recalled with difficulty; shorter next interval |
| **Good** | Normal recall; standard FSRS interval |
| **Easy** | Effortless recall; longer next interval |

The scheduler updates **stability** and **difficulty** for the card and computes the next **`due_at`** timestamp. Intervals grow as you consistently rate Good/Easy and shrink after Again/Hard.

Configurable in **Settings → Revisor → FSRS Settings**:

| Setting | Default | Description |
|---------|---------|-------------|
| Desired retention | 0.9 | Target recall probability at the next review (0.7–0.95) |
| Maximum interval (days) | 36500 | Upper bound on review spacing |
| Learning steps | `1m, 10m` | Steps for new cards before graduating |
| Relearning steps | `10m` | Steps after a lapse |
| Enable interval fuzz | on | Small random variation on long intervals |
| Enable short-term scheduling | on | Sub-day intervals alongside learning steps |

Long-term due dates are snapped to **6:00 AM** local time when the interval exceeds one week.

## Queue management

Revisor supports Anki-style queue actions directly from the review pane or editor:

| Action | Effect | Where |
|--------|--------|-------|
| **Bury** | Delay until next review day (configurable rollover) | Review pane |
| **Suspend** | Remove from queue until you unsuspend | Review pane |
| **Forget** | Reset FSRS progress; note becomes due now | Review pane |
| **Unsuspend** | Clear the suspended flag | Editor or command palette |
| **Unbury** | Clear the buried flag | Editor or command palette |

These work through frontmatter flags: `revisor_suspended: true` and `revisor_buried_until: <ISO timestamp>`. They keep the underlying `due_at` and `fsrs` intact — unsuspending or unburying a note restores its original schedule.

The empty state in the review pane shows a breakdown: how many notes are buried, suspended, or not yet due.

## Undo last review

Pressing **`u`** in the review pane restores the previous `due_at` and `fsrs` state of the last reviewed note and brings it back on screen. Works for ratings and all queue actions.

| Detail | Behavior |
|--------|----------|
| Scope | Up to 30 review steps per pane session |
| Lifetime | Cleared when you close the review pane |
| Alert | Brief notice on success; nothing on empty stack |
| Stats | Undo also removes the matching entry from the review activity log |

Also available as **Revisor: Undo last review** in the command palette.

## Frontmatter

Revisor stores state in YAML frontmatter. A typical note looks like:

```yaml
---
due_at: 2026-06-08T10:30:00.000+03:00
fsrs: '{"state":"learning","stability":2.5,"difficulty":5,"scheduled_days":0,"learning_steps":1,"reps":1,"lapses":0,"last_review":"2026-06-08T10:30:00.000+03:00"}'
---
```

| Field | Description |
|-------|-------------|
| `due_at` | ISO timestamp when the note becomes due |
| `fsrs` | JSON blob with FSRS card state (stability, difficulty, reps, lapses, etc.) |
| `revisor_suspended` | `true` if the note is suspended (optional) |
| `revisor_buried_until` | ISO timestamp; note is hidden until this time passes (optional) |

Legacy fields such as `repeat: fsrs` or `review_time_of_day` are no longer written; they are removed when a note is reviewed again.

To **stop** reviewing a note, remove `due_at` and `fsrs` from frontmatter (or delete those properties in Obsidian's property editor).

## Commands

| Command | Description |
|---------|-------------|
| **Repeat this note** | Add FSRS metadata; note due now |
| **Review due notes** | Open the Revisor review pane |
| **Repeat: mark the note as Again / Hard / Good / Easy** | Rate the current note |
| **Revisor: Bury** | Hide note until next review day |
| **Revisor: Suspend** | Remove note from queue |
| **Revisor: Forget** | Reset FSRS progress; due now |
| **Revisor: Undo last review** | Restore previous `due_at` + `fsrs` |
| **Revisor: Unsuspend note** | Clear suspended flag (from editor) |
| **Revisor: Unbury note** | Clear buried flag (from editor) |
| **Show stats** | Open the Revisor stats dashboard |

## Stats dashboard

Run **Show stats** from the command palette to open a full-width stats screen modeled on Anki's statistics view.

### Panels

| Panel | What it shows |
|-------|----------------|
| **Today** | Reviews today, again %, mature correct %, learn/young/mature breakdown |
| **Activity** | Current streak, longest streak, daily average, days learned % |
| **Calendar** | GitHub-style heatmap of review activity by day (year navigation) |
| **Reviews** | Stacked review history by card phase |
| **Card counts** | New / learning / young / mature / suspended / buried |
| **Future due** | Forecast of upcoming due notes |
| **Answer buttons** | Again / Hard / Good / Easy counts by learning phase |
| **Hourly breakdown** | Reviews and success rate by hour of day |
| **True retention** | Young / mature retention by period |
| **Intervals / Stability / Difficulty / Retrievability / Added** | FSRS and scheduling distributions |

Stats are computed from a **persistent review event log** stored in plugin data (`data.json`). Each rating appends an event; undo removes it. History accumulates from when you install or upgrade to 0.4.0 — older reviews are not backfilled unless you had prior daily activity data (migrated automatically).

## Review pane

### Layout

- **Top (fixed):** collapsible "*N* notes due" bar with filters
- **Middle (scrollable):** centered note title, note content (wide layout), open-note link in the bottom bar
- **Bottom (fixed):** Again / Hard / Good / Easy buttons (color-coded), with a link icon in the bottom-right corner to open the current note

### Keyboard shortcuts

Works when the review pane is active and focus is not in an input field.

| Key | Action |
|-----|--------|
| **Space** | Reveal content (blurred) / Rate **Good** (revealed) |
| **1** | Rate **Again** |
| **2** | Rate **Hard** |
| **3** | Rate **Good** |
| **4** | Rate **Easy** |
| **u** | Undo last review |

### Filtering

Expand the due-count header to filter the queue:

- Type a tag (e.g. `#math`) or a Dataview expression (e.g. `#math OR #physics`)
- Click tag shortcuts to append filters
- **Save** named filters for reuse

Notes in the **Ignore folder path** (Settings) are excluded from the queue — useful for templates.

### Queue order

The review pane picks the **next due note at random** among all notes matching your filter. Counts, tag shortcuts, and the status bar still reflect the full due queue sorted by `due_at`; only which card appears next is randomized. Learning cards that remain due after a rating can appear again in the same session.

## Settings

| Setting | Description |
|---------|-------------|
| Show due count in status bar | Display "*N* notes due" in the status bar |
| Show ribbon icon | Show the clock icon in the left ribbon |
| Ignore folder path | Skip notes in this folder and subfolders |
| Day starts at | When "bury until tomorrow" rolls over (default `06:00`) |
| Confirm forget | Show confirmation dialog before resetting FSRS progress |
| FSRS Settings | Retention, intervals, learning/relearning steps, fuzz |

## Development

```bash
npm install
npm run dev      # watch build → main.js
npm test         # unit tests
npm run build    # production build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/repeat-plugin/`.

## Changelog

### 0.5.0

- **Random review order** — the review pane shows due notes in random order instead of always picking the earliest `due_at`

### 0.4.0

- **Stats dashboard** with heatmap, today summary, reviews graph, card counts, future due, answer buttons, hourly breakdown, true retention, and FSRS distribution panels
- **Persistent review log** for stats (with undo support and legacy activity migration)
- **Review pane UI**: wider note content, larger centered title, balanced spacing, open-note link moved to bottom bar

### 0.3.0

- Queue actions: bury, suspend, forget, unsuspend, unbury
- Undo last review (`u`)
- Filtering with saved filters and tag shortcuts

## Credits

Revisor is maintained by **Anton Zaviyalov**. It is a fork/evolution of the [Obsidian Repeat plugin](https://github.com/prncc/obsidian-repeat-plugin), rewritten around **FSRS-only** scheduling.

FSRS algorithm: [open-spaced-repetition](https://github.com/open-spaced-repetition) · TypeScript implementation: [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)

## License

MIT — see [LICENSE](./LICENSE).
