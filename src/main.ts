import {
  App,
  debounce,
  MarkdownView,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
} from 'obsidian';
import { DateTime } from 'luxon';
import { Rating } from 'ts-fsrs';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';
import { updateRepetitionMetadata } from './frontmatter';
import { getAPI } from 'obsidian-dataview';
import { serializeRepetition } from './repeat/serializers';
import { createInitialFsrsRepetition } from './repeat/fsrs';
import { FSRS_RATING_LABELS } from './repeat/choices';
import { parseRepetition } from './repeat/parsers';
import { buildQueueMetadata, QueueAction } from './repeat/queueActions';
import {
  createEmptyDailyStudy,
  DailyStudyState,
  extendDailyLimits,
  getCurrentStudyDayKey,
  normalizeDailyStudy,
  recordStudy,
} from './repeat/dailyStudy';
import { createSessionConfig, SessionStudyConfig } from './repeat/sessionStudy';
import { StudyCardKind } from './repeat/studyCardKind';
import {
  formatQueueBreakdown,
  getNotesDue,
  getQueueBreakdownStats,
  makeQueueContext,
} from './repeat/queries';
import TextInputModal from './repeat/obsidian/TextInputModal';

const COUNT_DEBOUNCE_MS = 5 * 1000;

interface PluginPersistedData extends RepeatPluginSettings {
  dailyStudy?: DailyStudyState;
}

export default class RepeatPlugin extends Plugin {
  settings: RepeatPluginSettings;
  dailyStudy: DailyStudyState;
  statusBarItem: HTMLElement | undefined;
  ribbonIcon: HTMLElement | undefined;
  activeRepeatView: RepeatView | undefined;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.updateNotesDueCount = debounce(
      this.updateNotesDueCount, COUNT_DEBOUNCE_MS).bind(this);
    this.manageStatusBarItem = this.manageStatusBarItem.bind(this);
    this.registerCommands = this.registerCommands.bind(this);
    this.makeRepeatRibbonIcon = this.makeRepeatRibbonIcon.bind(this);
  }

  setActiveRepeatView(view: RepeatView | undefined) {
    this.activeRepeatView = view;
  }

  getDailyStudy(): DailyStudyState {
    return this.normalizeDailyStudyState();
  }

  normalizeDailyStudyState(): DailyStudyState {
    this.dailyStudy = normalizeDailyStudy(
      this.dailyStudy,
      DateTime.now(),
      this.settings.dayStartsAt,
    );
    return this.dailyStudy;
  }

  async recordStudy(kind: StudyCardKind): Promise<void> {
    this.dailyStudy = recordStudy(this.normalizeDailyStudyState(), kind);
    await this.savePluginData();
  }

  async extendDailyLimits(newDelta: number, reviewDelta: number): Promise<void> {
    this.dailyStudy = extendDailyLimits(
      this.normalizeDailyStudyState(),
      newDelta,
      reviewDelta,
    );
    await this.savePluginData();
    this.activeRepeatView?.refreshAfterLimitChange();
  }

  makeQueueContext(session?: SessionStudyConfig) {
    return makeQueueContext(
      this.settings,
      this.normalizeDailyStudyState(),
      session || createSessionConfig(),
    );
  }

  applyReviewRating(rating: Rating) {
    this.activeRepeatView?.applyRating(rating);
  }

  applyReviewQueueAction(action: QueueAction) {
    this.activeRepeatView?.requestQueueAction(action);
  }

  async applyEditorQueueAction(action: 'unsuspend' | 'unbury') {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView?.file) {
      return;
    }
    const cache = this.app.metadataCache.getFileCache(markdownView.file);
    const repetition = parseRepetition(cache?.frontmatter || {});
    if (!repetition) {
      return;
    }
    if (action === 'unsuspend' && !repetition.suspended) {
      return;
    }
    if (action === 'unbury' && !repetition.buriedUntil) {
      return;
    }
    const metadata = buildQueueMetadata(action, repetition, this.settings);
    const content = await this.app.vault.read(markdownView.file);
    const newContent = updateRepetitionMetadata(content, metadata);
    await this.app.vault.modify(markdownView.file, newContent);
  }

  async activateRepeatNotesDueView() {
    this.app.workspace.detachLeavesOfType(REPEATING_NOTES_DUE_VIEW);

    await this.app.workspace.getLeaf(true).setViewState({
      type: REPEATING_NOTES_DUE_VIEW,
      active: true,
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(REPEATING_NOTES_DUE_VIEW)[0]
    );
  }

  async activateRepeatWithSession(overrides: Partial<SessionStudyConfig>) {
    await this.activateRepeatNotesDueView();
    this.activeRepeatView?.applySessionConfig(overrides);
  }

  async loadSettings() {
    const data = (await this.loadData() || {}) as PluginPersistedData;
    const { dailyStudy, ...settingsData } = data;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsData);
    const now = DateTime.now();
    this.dailyStudy = normalizeDailyStudy(
      dailyStudy,
      now,
      this.settings.dayStartsAt,
    );
    if (!dailyStudy) {
      this.dailyStudy = createEmptyDailyStudy(
        getCurrentStudyDayKey(now, this.settings.dayStartsAt),
      );
    }
  }

  async savePluginData() {
    const payload: PluginPersistedData = {
      ...this.settings,
      dailyStudy: this.dailyStudy,
    };
    await this.saveData(payload);
  }

  async saveSettings() {
    await this.savePluginData();
    if (!this.settings.showDueCountInStatusBar && this.statusBarItem) {
      this.statusBarItem.remove();
      this.statusBarItem = undefined;
    }
    if (this.settings.showDueCountInStatusBar) {
      this.makeStatusBarItem();
      this.updateNotesDueCount();
    }
    if (!this.settings.showRibbonIcon && this.ribbonIcon) {
      this.ribbonIcon.remove();
      this.ribbonIcon = undefined;
    }
    if (this.settings.showRibbonIcon && !this.ribbonIcon) {
      this.makeRepeatRibbonIcon();
    }
  }

  makeStatusBarItem() {
    if (this.settings.showDueCountInStatusBar && !this.statusBarItem) {
      this.statusBarItem = this.addStatusBarItem();
      this.statusBarItem.addClass('mod-clickable');
      this.statusBarItem.setText('Revisor');
      this.statusBarItem.addEventListener('click', () => {
        this.activateRepeatNotesDueView();
      });
    }
  }

  updateNotesDueCount() {
    if (this.settings.showDueCountInStatusBar && this.statusBarItem) {
      const context = this.makeQueueContext();
      const dueNoteCount = getNotesDue(
        getAPI(this.app),
        this.settings.ignoreFolderPath,
        undefined,
        undefined,
        context,
      )?.length;
      if (dueNoteCount != undefined) {
        if (this.settings.showQueueBreakdown) {
          const breakdown = getQueueBreakdownStats(
            getAPI(this.app),
            this.settings.ignoreFolderPath,
          );
          this.statusBarItem.setText(formatQueueBreakdown(breakdown));
        } else {
          this.statusBarItem.setText(`${dueNoteCount} notes due`);
        }
      }
    }
  }

  manageStatusBarItem() {
    this.makeStatusBarItem();

    const dv = getAPI(this.app);
    const onIndexReady = () => {
      this.updateNotesDueCount();
      setTimeout(() => {
        this.registerEvent(
          this.app.metadataCache.on(
            // @ts-ignore: event is added by DataView.
            'dataview:metadata-change',
            this.updateNotesDueCount
          )
        );
      }, COUNT_DEBOUNCE_MS);
    };

    if (dv?.index.initialized) {
      onIndexReady();
    } else {
      this.registerEvent(
        this.app.metadataCache.on(
          // @ts-ignore: event is added by DataView.
          'dataview:index-ready',
          onIndexReady)
      );
    }

    const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
    this.registerInterval(
      window.setInterval(this.updateNotesDueCount, FIVE_MINUTES_IN_MS)
    )
  }

  makeRepeatRibbonIcon() {
    if (this.settings.showRibbonIcon) {
      this.ribbonIcon = this.addRibbonIcon(
        'clock', 'Revisor: review due notes', () => {
          this.activateRepeatNotesDueView();
        }
      );
    }
  }

  promptExtendLimit(kind: 'new' | 'review') {
    const modal = new TextInputModal(
      this.app,
      kind === 'new' ? 'Extend new limit' : 'Extend review limit',
      'Increase by',
      '10',
      async (value) => {
        if (!value) return;
        const delta = parseInt(value, 10);
        if (!Number.isFinite(delta) || delta <= 0) {
          return;
        }
        if (kind === 'new') {
          await this.extendDailyLimits(delta, 0);
        } else {
          await this.extendDailyLimits(0, delta);
        }
      },
    );
    modal.open();
  }

  promptReviewAhead() {
    const modal = new TextInputModal(
      this.app,
      'Review ahead',
      'Days ahead',
      '7',
      async (value) => {
        if (!value) return;
        const days = parseInt(value, 10);
        if (!Number.isFinite(days) || days <= 0) {
          return;
        }
        await this.activateRepeatWithSession({
          customStudy: { kind: 'review-ahead', daysAhead: days },
        });
      },
    );
    modal.open();
  }

  registerCommands() {
    this.addCommand({
      id: 'setup-repeat-note',
      name: 'Repeat this note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView && !!markdownView.file) {
          if (!checking) {
            const { editor, file } = markdownView;
            const content = editor.getValue();
            const repetition = createInitialFsrsRepetition(this.settings);
            const newContent = updateRepetitionMetadata(
              content,
              serializeRepetition(repetition),
            );
            this.app.vault.modify(file, newContent);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'open-repeat-view',
      name: 'Review due notes',
      callback: () => {
        this.activateRepeatNotesDueView();
      },
    });

    ([
      [Rating.Again, 'again'],
      [Rating.Hard, 'hard'],
      [Rating.Good, 'good'],
      [Rating.Easy, 'easy'],
    ] as const).forEach(([rating, idSuffix]) => {
      this.addCommand({
        id: `mark-note-${idSuffix}`,
        name: `Repeat: mark the note as ${FSRS_RATING_LABELS[rating]}`,
        checkCallback: (checking: boolean) => {
          if (!this.activeRepeatView) {
            return false;
          }
          if (!checking) {
            this.applyReviewRating(rating);
          }
          return true;
        },
      });
    });

    ([
      ['bury', 'Bury'],
      ['suspend', 'Suspend'],
      ['forget', 'Forget'],
    ] as const).forEach(([action, name]) => {
      this.addCommand({
        id: `revisor-${action}-note`,
        name: `Revisor: ${name}`,
        checkCallback: (checking: boolean) => {
          if (!this.activeRepeatView?.hasCurrentNote()) {
            return false;
          }
          if (!checking) {
            this.applyReviewQueueAction(action);
          }
          return true;
        },
      });
    });

    this.addCommand({
      id: 'revisor-unsuspend-note',
      name: 'Revisor: Unsuspend note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView?.file) {
          return false;
        }
        const cache = this.app.metadataCache.getFileCache(markdownView.file);
        const repetition = parseRepetition(cache?.frontmatter || {});
        if (!repetition?.suspended) {
          return false;
        }
        if (!checking) {
          void this.applyEditorQueueAction('unsuspend');
        }
        return true;
      },
    });

    this.addCommand({
      id: 'revisor-unbury-note',
      name: 'Revisor: Unbury note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView?.file) {
          return false;
        }
        const cache = this.app.metadataCache.getFileCache(markdownView.file);
        const repetition = parseRepetition(cache?.frontmatter || {});
        if (!repetition?.buriedUntil) {
          return false;
        }
        if (!checking) {
          void this.applyEditorQueueAction('unbury');
        }
        return true;
      },
    });

    this.addCommand({
      id: 'revisor-study-new-only',
      name: 'Revisor: Study new notes only',
      callback: () => {
        void this.activateRepeatWithSession({ queueMode: 'new-only' });
      },
    });

    this.addCommand({
      id: 'revisor-study-reviews-only',
      name: 'Revisor: Study reviews only',
      callback: () => {
        void this.activateRepeatWithSession({ queueMode: 'reviews-only' });
      },
    });

    this.addCommand({
      id: 'revisor-custom-study-review-ahead',
      name: 'Revisor: Custom study — review ahead',
      callback: () => {
        this.promptReviewAhead();
      },
    });

    this.addCommand({
      id: 'revisor-custom-study-lapses',
      name: 'Revisor: Custom study — lapses only',
      callback: () => {
        void this.activateRepeatWithSession({
          customStudy: { kind: 'lapses-only' },
        });
      },
    });

    this.addCommand({
      id: 'revisor-custom-study-never-reviewed',
      name: 'Revisor: Custom study — never reviewed',
      callback: () => {
        void this.activateRepeatWithSession({
          customStudy: { kind: 'never-reviewed' },
        });
      },
    });

    this.addCommand({
      id: 'revisor-extend-review-limit',
      name: "Revisor: Extend today's review limit",
      callback: () => {
        this.promptExtendLimit('review');
      },
    });

    this.addCommand({
      id: 'revisor-extend-new-limit',
      name: "Revisor: Extend today's new limit",
      callback: () => {
        this.promptExtendLimit('new');
      },
    });

    this.addCommand({
      id: 'revisor-reset-study-session',
      name: 'Revisor: Reset study session',
      checkCallback: (checking: boolean) => {
        if (!this.activeRepeatView) {
          return false;
        }
        if (!checking) {
          this.activeRepeatView.resetSession();
        }
        return true;
      },
    });
  }

  async onload() {
    await this.loadSettings();
    this.makeRepeatRibbonIcon();
    this.manageStatusBarItem();
    this.registerCommands();
    this.registerView(
      REPEATING_NOTES_DUE_VIEW,
      (leaf) => new RepeatView(
        leaf,
        this.settings,
        this.saveSettings.bind(this),
        this,
      ),
    );
    this.addSettingTab(new RepeatPluginSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(REPEATING_NOTES_DUE_VIEW);
  }
}

class RepeatPluginSettingTab extends PluginSettingTab {
  plugin: RepeatPlugin;

  constructor(app: App, plugin: RepeatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Revisor Settings' });

    new Setting(containerEl)
      .setName('Show due count in status bar')
      .setDesc('Whether to display how many notes are due in Obsidian\'s status bar.')
      .addToggle(component => component
        .setValue(this.plugin.settings.showDueCountInStatusBar)
        .onChange(async (value) => {
          this.plugin.settings.showDueCountInStatusBar = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
        .setName('Show ribbon icon')
        .setDesc('Whether to display the ribbon icon that opens the Revisor pane.')
        .addToggle(component => component
          .setValue(this.plugin.settings.showRibbonIcon)
          .onChange(async (value) => {
            this.plugin.settings.showRibbonIcon = value;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
        .setName('Ignore folder path')
        .setDesc('Notes in this folder and its subfolders will not become due. Useful to avoid reviewing templates.')
        .addText((component) => component
          .setValue(this.plugin.settings.ignoreFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.ignoreFolderPath = value;
            await this.plugin.saveSettings();
          }));

      containerEl.createEl('h3', { text: 'FSRS Settings' });

      new Setting(containerEl)
        .setName('Desired retention')
        .setDesc('Target recall probability at the next review (0.7–0.95). Default: 0.9')
        .addSlider(component => component
          .setLimits(0.7, 0.95, 0.01)
          .setValue(this.plugin.settings.fsrsRequestRetention)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.fsrsRequestRetention = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Maximum interval (days)')
        .setDesc('Upper bound for FSRS review intervals.')
        .addText(component => component
          .setValue(String(this.plugin.settings.fsrsMaximumInterval))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (parsed > 0) {
              this.plugin.settings.fsrsMaximumInterval = parsed;
              await this.plugin.saveSettings();
            }
          }));

      new Setting(containerEl)
        .setName('Learning steps')
        .setDesc('Comma-separated durations for new cards, e.g. "1m, 10m".')
        .addText(component => component
          .setValue(this.plugin.settings.fsrsLearningSteps)
          .onChange(async (value) => {
            this.plugin.settings.fsrsLearningSteps = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Relearning steps')
        .setDesc('Comma-separated durations after a lapse, e.g. "10m".')
        .addText(component => component
          .setValue(this.plugin.settings.fsrsRelearningSteps)
          .onChange(async (value) => {
            this.plugin.settings.fsrsRelearningSteps = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Enable interval fuzz')
        .setDesc('Add small random variation to long FSRS intervals.')
        .addToggle(component => component
          .setValue(this.plugin.settings.fsrsEnableFuzz)
          .onChange(async (value) => {
            this.plugin.settings.fsrsEnableFuzz = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Enable short-term scheduling')
        .setDesc('Allow sub-day FSRS intervals alongside learning steps.')
        .addToggle(component => component
          .setValue(this.plugin.settings.fsrsEnableShortTerm)
          .onChange(async (value) => {
            this.plugin.settings.fsrsEnableShortTerm = value;
            await this.plugin.saveSettings();
          }));

      containerEl.createEl('h3', { text: 'Queue Settings' });

      new Setting(containerEl)
        .setName('Day starts at')
        .setDesc('When the review day rolls over. Used for bury-until calculation (e.g. 06:00).')
        .addText(component => component
          .setValue(this.plugin.settings.dayStartsAt)
          .onChange(async (value) => {
            if (/^\d{1,2}:\d{2}$/.test(value.trim())) {
              this.plugin.settings.dayStartsAt = value.trim();
              await this.plugin.saveSettings();
            }
          }));

      new Setting(containerEl)
        .setName('Confirm forget')
        .setDesc('Show a confirmation dialog before resetting FSRS progress.')
        .addToggle(component => component
          .setValue(this.plugin.settings.confirmForget)
          .onChange(async (value) => {
            this.plugin.settings.confirmForget = value;
            await this.plugin.saveSettings();
          }));

      containerEl.createEl('h3', { text: 'Daily Limits' });

      new Setting(containerEl)
        .setName('Max new notes per day')
        .setDesc('Daily cap on new notes. 0 = unlimited.')
        .addText(component => component
          .setValue(String(this.plugin.settings.maxNewPerDay))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed >= 0) {
              this.plugin.settings.maxNewPerDay = parsed;
              await this.plugin.saveSettings();
            }
          }));

      new Setting(containerEl)
        .setName('Max reviews per day')
        .setDesc('Daily cap on review and learning notes. 0 = unlimited.')
        .addText(component => component
          .setValue(String(this.plugin.settings.maxReviewsPerDay))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed >= 0) {
              this.plugin.settings.maxReviewsPerDay = parsed;
              await this.plugin.saveSettings();
            }
          }));

      new Setting(containerEl)
        .setName('New cards ignore review limit')
        .setDesc('When off, new notes are capped by remaining review slots (Anki default).')
        .addToggle(component => component
          .setValue(this.plugin.settings.newCardsIgnoreReviewLimit)
          .onChange(async (value) => {
            this.plugin.settings.newCardsIgnoreReviewLimit = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Show queue breakdown')
        .setDesc('Show new / learning / review counts in the status bar and filter header.')
        .addToggle(component => component
          .setValue(this.plugin.settings.showQueueBreakdown)
          .onChange(async (value) => {
            this.plugin.settings.showQueueBreakdown = value;
            await this.plugin.saveSettings();
          }));

  }
}
