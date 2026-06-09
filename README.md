# Revisor

**Revisor** is an [Obsidian](https://obsidian.md) plugin for reviewing notes with **FSRS spaced repetition** — the same family of algorithm used by Anki. Mark any note for review, rate it when it comes due, and Revisor schedules the next review automatically.

All scheduling state lives in the note’s YAML frontmatter, so your vault stays portable and human-readable.

## Features

- **FSRS scheduling** via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-6)
- **Dedicated review pane** with blurred note content (reveal on click or Space)
- **Four rating buttons**: Again, Hard, Good, Easy — with keyboard shortcuts
- **Dataview-powered queue** of due notes, sorted by due date
- **Filtering** by tags or any Dataview source expression, with savable filters
- **Status bar & ribbon** shortcuts showing how many notes are due
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

Legacy fields such as `repeat: fsrs` or `review_time_of_day` are no longer written; they are removed when a note is reviewed again.

To **stop** reviewing a note, remove `due_at` and `fsrs` from frontmatter (or delete those properties in Obsidian’s property editor).

## Commands

| Command | Description |
|---------|-------------|
| **Repeat this note** | Add FSRS metadata and make the active note due now |
| **Review due notes** | Open the Revisor review pane |
| **Repeat: mark the note as Again / Hard / Good / Easy** | Rate the current note (only while the review pane is focused) |

## Review pane

### Layout

- **Top (fixed):** collapsible “*N* notes due” bar with filters
- **Middle (scrollable):** note title and content
- **Bottom (fixed):** Again / Hard / Good / Easy buttons (color-coded)

### Keyboard shortcuts

Works when the review pane is active and focus is not in an input field.

| Key | Blurred note | Revealed note |
|-----|--------------|---------------|
| **Space** | Reveal content | Rate **Good** |
| **1** | — | Rate **Again** |
| **2** | — | Rate **Hard** |
| **3** | — | Rate **Good** |
| **4** | — | Rate **Easy** |

### Filtering

Expand the due-count header to filter the queue:

- Type a tag (e.g. `#math`) or a Dataview expression (e.g. `#math OR #physics`)
- Click tag shortcuts to append filters
- **Save** named filters for reuse

Notes in the **Ignore folder path** (Settings) are excluded from the queue — useful for templates.

## Settings

| Setting | Description |
|---------|-------------|
| Show due count in status bar | Display “*N* notes due” in the status bar |
| Show ribbon icon | Show the clock icon in the left ribbon |
| Ignore folder path | Skip notes in this folder and subfolders |
| FSRS Settings | Retention, intervals, learning/relearning steps, fuzz |

## Development

```bash
npm install
npm run dev      # watch build → main.js
npm test         # unit tests
npm run build    # production build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/repeat-plugin/`.

## Credits

Revisor is maintained by **Anton Zaviyalov**. It is a fork/evolution of the [Obsidian Repeat plugin](https://github.com/prncc/obsidian-repeat-plugin), rewritten around **FSRS-only** scheduling.

FSRS algorithm: [open-spaced-repetition](https://github.com/open-spaced-repetition) · TypeScript implementation: [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)

## License

MIT — see [LICENSE](./LICENSE).
