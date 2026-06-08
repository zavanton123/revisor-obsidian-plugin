import {
  App,
  debounce,
  MarkdownView,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
} from 'obsidian';
import { Rating } from 'ts-fsrs';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';
import { updateRepetitionMetadata } from './frontmatter';
import { getAPI } from 'obsidian-dataview';
import { getNotesDue } from './repeat/queries';
import { serializeRepetition } from './repeat/serializers';
import { createInitialFsrsRepetition } from './repeat/fsrs';
import { FSRS_RATING_LABELS } from './repeat/choices';

const COUNT_DEBOUNCE_MS = 5 * 1000;

export default class RepeatPlugin extends Plugin {
  settings: RepeatPluginSettings;
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

  applyReviewRating(rating: Rating) {
    this.activeRepeatView?.applyRating(rating);
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
      const dueNoteCount = getNotesDue(
        getAPI(this.app),
        this.settings.ignoreFolderPath,
      )?.length;
      if (dueNoteCount != undefined) {
        this.statusBarItem.setText(`${dueNoteCount} notes due`);
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

  }
}
