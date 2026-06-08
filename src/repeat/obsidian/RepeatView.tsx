import {
  Component,
  debounce,
  ItemView,
  setIcon,
  WorkspaceLeaf,
  TFile,
} from 'obsidian';
import { getAPI, DataviewApi } from 'obsidian-dataview';
import { Rating } from 'ts-fsrs';

import { determineFrontmatterBounds, updateRepetitionMetadata } from '../../frontmatter';
import { getRepeatChoices } from '../choices';
import { RepeatChoice } from '../repeatTypes';
import { getNextDueNote, getNotesDue, getTagsFromDueNotes, TagStats } from '../queries';
import { serializeRepetition } from '../serializers';
import { renderMarkdown, renderTitleElement } from '../../markdown';
import { RepeatPluginSettings } from '../../settings';
import TextInputModal from './TextInputModal';

const MODIFY_DEBOUNCE_MS = 1 * 1000;
const QUERY_DEBOUNCE_MS = 500;
export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

const RATING_BUTTON_CLASS: Record<Rating, string | undefined> = {
  [Rating.Manual]: undefined,
  [Rating.Again]: 'repeat-fsrs-again',
  [Rating.Hard]: 'repeat-fsrs-hard',
  [Rating.Good]: 'repeat-fsrs-good',
  [Rating.Easy]: 'repeat-fsrs-easy',
};

const RATING_BUTTON_COLOR: Record<Rating, string | undefined> = {
  [Rating.Manual]: undefined,
  [Rating.Again]: '#c0392b',
  [Rating.Hard]: '#e67e22',
  [Rating.Good]: '#27ae60',
  [Rating.Easy]: '#2980b9',
};

const RATING_KEY_MAP: Record<string, Rating> = {
  '1': Rating.Again,
  '2': Rating.Hard,
  '3': Rating.Good,
  '4': Rating.Easy,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable
    || target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT';
}

export interface RepeatViewPluginHost {
  setActiveRepeatView(view: RepeatView | undefined): void;
}

class RepeatView extends ItemView {
  buttonsContainer: HTMLElement;
  component: Component;
  currentChoices: RepeatChoice[] = [];
  currentDueFilePath: string | undefined;
  currentFile: TFile | undefined;
  dv: DataviewApi | undefined;
  icon = 'clock';
  indexPromise: Promise<null> | undefined;
  markdownContainer: HTMLElement | undefined;
  messageContainer: HTMLElement;
  pluginHost: RepeatViewPluginHost;
  previewContainer: HTMLElement;
  layoutContainer: HTMLElement;
  scrollContainer: HTMLElement;
  root: Element;
  settings: RepeatPluginSettings;

  filterContainer: HTMLElement;
  filterHeader: HTMLElement;
  filterContent: HTMLElement;
  filterToggleIcon: HTMLElement;
  queryInput: HTMLInputElement;
  tagShortcutsContainer: HTMLElement;
  savedFilterDropdown: HTMLSelectElement;
  filterCountEl: HTMLElement;
  filterErrorEl: HTMLElement;
  availableTags: TagStats[];
  displayedTagCount: number;
  saveSettings: () => Promise<void>;
  handleQueryChange: ReturnType<typeof debounce>;
  filterExpanded: boolean;
  handleKeyDown: (event: KeyboardEvent) => void;

  constructor(
    leaf: WorkspaceLeaf,
    settings: RepeatPluginSettings,
    saveSettings: () => Promise<void>,
    pluginHost: RepeatViewPluginHost,
  ) {
    super(leaf);
    this.addRepeatButton = this.addRepeatButton.bind(this);
    this.applyChoice = this.applyChoice.bind(this);
    this.applyRating = this.applyRating.bind(this);
    this.disableExternalHandlers = this.disableExternalHandlers.bind(this);
    this.enableExternalHandlers = this.enableExternalHandlers.bind(this);
    this.handleExternalModifyOrDelete = debounce(
      this.handleExternalModifyOrDelete,
      MODIFY_DEBOUNCE_MS).bind(this);
    this.handleExternalRename = debounce(
      this.handleExternalRename,
      MODIFY_DEBOUNCE_MS).bind(this);
    this.handleKeyDown = this.handleKeyDownImpl.bind(this);
    this.promiseMetadataChangeOrTimeOut = (
      this.promiseMetadataChangeOrTimeOut.bind(this));
    this.setMessage = this.setMessage.bind(this);
    this.setPage = this.setPage.bind(this);
    this.resetView = this.resetView.bind(this);
    this.unblurNote = this.unblurNote.bind(this);

    this.createFilterUI = this.createFilterUI.bind(this);
    this.refreshFilterUI = this.refreshFilterUI.bind(this);
    this.doHandleQueryChange = this.doHandleQueryChange.bind(this);
    this.handleQueryChange = debounce(this.doHandleQueryChange, QUERY_DEBOUNCE_MS);
    this.handleTagClick = this.handleTagClick.bind(this);
    this.handleClearQuery = this.handleClearQuery.bind(this);
    this.handleSaveFilter = this.handleSaveFilter.bind(this);
    this.handleLoadSavedFilter = this.handleLoadSavedFilter.bind(this);
    this.handleDeleteSavedFilter = this.handleDeleteSavedFilter.bind(this);
    this.handleShowMoreTags = this.handleShowMoreTags.bind(this);
    this.toggleFilterDrawer = this.toggleFilterDrawer.bind(this);
    this.filterExpanded = false;

    this.component = new Component();

    this.dv = getAPI(this.app);
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.pluginHost = pluginHost;
    this.availableTags = [];
    this.displayedTagCount = 6;

    this.root = this.containerEl.children[1];
    this.indexPromise = new Promise((resolve, reject) => {
      const resolver = () => resolve(null);
      if (!this.dv) {
        return reject(null);
      }
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:index-ready', resolver));
      if (this.dv.index.initialized) {
        this.app.metadataCache.off('dataview:index-ready', resolver);
        resolve(null);
      }
    });

    this.resetView();
    this.setMessage('Loading...');
  }

  getViewType() {
    return REPEATING_NOTES_DUE_VIEW;
  }

  getDisplayText() {
    return 'Revisor';
  }

  async onOpen() {
    this.pluginHost.setActiveRepeatView(this);
    this.containerEl.setAttr('tabindex', '-1');
    this.registerDomEvent(document, 'keydown', this.handleKeyDown, { capture: true });
    if (!this.dv) {
      this.setMessage(
        'Revisor requires DataView Plugin to work. ' +
        'Make sure that the DataView Plugin is installed and enabled.'
      );
      return;
    }
    this.enableExternalHandlers();
    this.setPage();
  }

  async onClose() {
    this.pluginHost.setActiveRepeatView(undefined);
    this.disableExternalHandlers();
  }

  isActiveView(): boolean {
    return this.app.workspace.activeLeaf?.view === this;
  }

  handleKeyDownImpl(event: KeyboardEvent) {
    if (!this.isActiveView() || isTypingTarget(event.target)) {
      return;
    }

    const isBlurred = this.markdownContainer?.classList.contains('repeat-markdown_blurred');

    if (isBlurred) {
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        event.stopPropagation();
        this.unblurNote();
      }
      return;
    }

    if (!this.currentFile) {
      return;
    }

    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      this.applyRating(Rating.Good);
      return;
    }

    const rating = RATING_KEY_MAP[event.key];
    if (rating) {
      event.preventDefault();
      event.stopPropagation();
      this.applyRating(rating);
    }
  }

  unblurNote() {
    this.markdownContainer?.classList.remove('repeat-markdown_blurred');
  }

  applyRating(rating: Rating) {
    if (!this.currentFile) {
      return;
    }
    const choice = this.currentChoices.find((c) => c.rating === rating);
    if (choice) {
      this.applyChoice(choice, this.currentFile);
    }
  }

  async applyChoice(choice: RepeatChoice, file: TFile) {
    this.resetView();
    const markdown = await this.app.vault.read(file);
    const newMarkdown = updateRepetitionMetadata(
      markdown, serializeRepetition(choice.nextRepetition));
    this.currentDueFilePath = file.path;
    await this.app.vault.modify(file, newMarkdown);
    await this.promiseMetadataChangeOrTimeOut();
    this.setPage();
  }

  enableExternalHandlers() {
    this.registerEvent(
      this.app.vault.on('modify', this.handleExternalModifyOrDelete));
    this.registerEvent(
      this.app.vault.on('delete', this.handleExternalModifyOrDelete));
    this.registerEvent(
      this.app.vault.on('rename', this.handleExternalRename));
  }

  disableExternalHandlers () {
    this.app.vault.off('modify', this.handleExternalModifyOrDelete);
    this.app.vault.off('delete', this.handleExternalModifyOrDelete);
    this.app.vault.off('rename', this.handleExternalRename);
  }

  async promiseMetadataChangeOrTimeOut() {
    let resolver: (...data: any) => any;
    return new Promise((resolve) => {
      resolver = (_, eventFile, previousPath) => {
        if (eventFile?.path === this.currentDueFilePath
            || previousPath === this.currentDueFilePath) {
          resolve(null);
        }
      };
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:metadata-change', resolver));
      setTimeout(resolve, 100);
    }).then(() => {
      this.app.metadataCache.off('dataview:metadata-change', resolver);
    });
  }

  async handleExternalModifyOrDelete(file: TFile) {
    if (file.path === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetView();
      this.setPage();
    }
  }

  async handleExternalRename(file: TFile, oldFilePath: string) {
    if (oldFilePath === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetView();
      this.setPage();
    }
  }

  async setPage() {
    await this.indexPromise;
    this.setMessage('');
    this.messageContainer.style.display = 'none';

    const page = getNextDueNote(
      this.dv,
      this.settings.ignoreFolderPath,
      undefined,
      this.settings.filterQuery || undefined);
    if (!page) {
      const totalDue = getNotesDue(
        this.dv,
        this.settings.ignoreFolderPath,
      )?.length || 0;

      if (totalDue > 0 && this.settings.filterQuery) {
        this.setMessage(`No notes matching filter. ${totalDue} other notes are due.`);
      } else {
        this.setMessage('All done for now!');
      }
      this.currentChoices = [];
      this.currentFile = undefined;
      this.markdownContainer = undefined;
      this.refreshFilterUI();
      this.buttonsContainer.createEl('button', {
        text: 'Refresh',
      },
      (buttonElement) => {
        buttonElement.onclick = () => {
          this.resetView();
          this.setPage();
        }
      });
      return;
    }

    this.refreshFilterUI();
    const dueFilePath = (page?.file as any).path;
    this.currentDueFilePath = dueFilePath;
    const choices = getRepeatChoices(page.repetition as any, this.settings);
    this.currentChoices = choices;
    const matchingMarkdowns = this.app.vault.getMarkdownFiles()
      .filter((file) => file?.path === dueFilePath);
    if (!matchingMarkdowns) {
      this.setMessage(
        `Error: Could not find due note ${dueFilePath}. ` +
        'Reopen this view to retry.');
      return;
    }
    const file = matchingMarkdowns[0];
    this.currentFile = file;

    choices.forEach(choice => this.addRepeatButton(choice, file));

    renderTitleElement(
      this.previewContainer,
      file,
      this.app.vault);

    this.markdownContainer = createEl('div', {
      cls: 'repeat-note-content repeat-markdown_blurred',
    });
    const onBlurredClick = (event: Event) => {
      event.preventDefault();
      this.unblurNote();
    };
    this.markdownContainer.addEventListener(
      'click', onBlurredClick, { once: true });

    this.previewContainer.appendChild(this.markdownContainer);

    const markdown = await this.app.vault.cachedRead(file);
    const delimitedFrontmatterBounds = determineFrontmatterBounds(markdown, true);
    await renderMarkdown(
      this.app,
      markdown.slice(
        delimitedFrontmatterBounds ? delimitedFrontmatterBounds[1] : 0),
      this.markdownContainer,
      file.path,
      this.component,
      this.app.vault);

    this.containerEl.focus();
  }

  resetView() {
    this.layoutContainer?.remove();
    this.layoutContainer = this.root.createEl('div', { cls: 'repeat-view-layout' });
    this.createFilterUI();
    this.scrollContainer = this.layoutContainer.createEl('div', { cls: 'repeat-scroll' });
    this.messageContainer = this.scrollContainer.createEl('div', { cls: 'repeat-message' });
    this.messageContainer.style.display = 'none';
    this.previewContainer = this.scrollContainer.createEl('div', { cls: 'repeat-embedded_note' });
    this.buttonsContainer = this.layoutContainer.createEl('div', { cls: 'repeat-buttons' });
    this.currentDueFilePath = undefined;
    this.currentFile = undefined;
    this.currentChoices = [];
    this.markdownContainer = undefined;
  }

  createFilterUI() {
    this.filterContainer = this.layoutContainer.createEl('div', { cls: 'repeat-filter' });

    this.filterHeader = this.filterContainer.createEl('div', { cls: 'repeat-filter-header' });
    this.filterHeader.addEventListener('click', this.toggleFilterDrawer);

    this.filterToggleIcon = this.filterHeader.createEl('span', {
      cls: 'repeat-filter-toggle-icon',
    });
    setIcon(this.filterToggleIcon, 'chevron-right');

    this.filterCountEl = this.filterHeader.createEl('span', {
      cls: 'repeat-filter-count'
    });

    this.filterContent = this.filterContainer.createEl('div', {
      cls: 'repeat-filter-content'
    });
    this.filterContent.style.display = 'none';

    const queryRow = this.filterContent.createEl('div', { cls: 'repeat-filter-row' });

    this.queryInput = queryRow.createEl('input', {
      cls: 'repeat-filter-query-input',
      attr: {
        type: 'text',
        placeholder: 'Filter: #tag or Dataview expression...',
        value: this.settings.filterQuery || '',
      }
    });
    this.queryInput.value = this.settings.filterQuery || '';
    this.queryInput.addEventListener('input', () => this.handleQueryChange());
    this.queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleQueryChange();
        this.handleQueryChange.cancel?.();
      }
    });

    const clearBtn = queryRow.createEl('button', {
      cls: 'repeat-filter-btn',
      text: 'Clear',
    });
    clearBtn.addEventListener('click', this.handleClearQuery);

    this.tagShortcutsContainer = this.filterContent.createEl('div', {
      cls: 'repeat-filter-tags'
    });

    const savedFilterRow = this.filterContent.createEl('div', { cls: 'repeat-filter-row' });

    this.savedFilterDropdown = savedFilterRow.createEl('select', {
      cls: 'repeat-filter-dropdown'
    });
    this.savedFilterDropdown.addEventListener('change', this.handleLoadSavedFilter);

    const saveBtn = savedFilterRow.createEl('button', {
      cls: 'repeat-filter-btn',
      text: 'Save',
    });
    saveBtn.addEventListener('click', this.handleSaveFilter);

    const deleteBtn = savedFilterRow.createEl('button', {
      cls: 'repeat-filter-btn repeat-filter-btn-danger',
      text: 'Delete',
    });
    deleteBtn.addEventListener('click', this.handleDeleteSavedFilter);

    this.filterErrorEl = this.filterContent.createEl('div', {
      cls: 'repeat-filter-error'
    });
    this.filterErrorEl.style.display = 'none';
  }

  toggleFilterDrawer() {
    this.filterExpanded = !this.filterExpanded;
    this.filterContent.style.display = this.filterExpanded ? 'block' : 'none';
    setIcon(this.filterToggleIcon, this.filterExpanded ? 'chevron-down' : 'chevron-right');
    this.filterContainer.toggleClass('repeat-filter-expanded', this.filterExpanded);
  }

  renderTagShortcuts() {
    this.tagShortcutsContainer.empty();
    const tagsToShow = this.availableTags.slice(0, this.displayedTagCount);
    const hiddenCount = this.availableTags.length - this.displayedTagCount;

    tagsToShow.forEach(({ tag, count }) => {
      const tagBtn = this.tagShortcutsContainer.createEl('button', {
        cls: 'repeat-filter-tag',
        text: `${tag} (${count})`,
      });
      tagBtn.addEventListener('click', () => this.handleTagClick(tag));
    });

    if (hiddenCount > 0) {
      const moreLink = this.tagShortcutsContainer.createEl('button', {
        cls: 'repeat-filter-tag-more',
        text: `+${hiddenCount} more`,
      });
      moreLink.addEventListener('click', this.handleShowMoreTags);
    }
  }

  handleShowMoreTags() {
    this.displayedTagCount += 6;
    this.renderTagShortcuts();
  }

  refreshFilterUI() {
    this.availableTags = getTagsFromDueNotes(
      this.dv,
      this.settings.ignoreFolderPath,
      undefined,
    ) || [];

    this.displayedTagCount = 6;

    this.renderTagShortcuts();

    this.savedFilterDropdown.empty();
    const defaultOption = this.savedFilterDropdown.createEl('option', {
      text: 'Load saved filter...',
      attr: { value: '' }
    });
    defaultOption.disabled = true;

    const matchingFilterIndex = this.settings.savedFilters.findIndex(
      f => f.query === this.settings.filterQuery
    );

    if (matchingFilterIndex === -1) {
      defaultOption.selected = true;
    }

    this.settings.savedFilters.forEach((filter, index) => {
      const option = this.savedFilterDropdown.createEl('option', {
        text: filter.name,
        attr: { value: index.toString() }
      });
      if (index === matchingFilterIndex) {
        option.selected = true;
      }
    });

    this.updateFilterCount();
  }

  updateFilterCount() {
    const filterQuery = this.settings.filterQuery;

    const totalCount = getNotesDue(
      this.dv,
      this.settings.ignoreFolderPath,
      undefined,
    )?.length || 0;

    if (filterQuery) {
      try {
        const filteredCount = getNotesDue(
          this.dv,
          this.settings.ignoreFolderPath,
          undefined,
          filterQuery
        )?.length || 0;

        const matchingFilter = this.settings.savedFilters.find(
          f => f.query === filterQuery
        );

        if (matchingFilter) {
          this.filterCountEl.textContent = `${matchingFilter.name}: ${filteredCount} matching, ${totalCount} total`;
        } else {
          this.filterCountEl.textContent = `${filteredCount} matching, ${totalCount} total`;
        }
        this.filterErrorEl.style.display = 'none';
      } catch (e) {
        this.filterCountEl.textContent = `${totalCount} notes due`;
        this.filterErrorEl.textContent = `Invalid filter: ${e.message || 'Check your query syntax'}`;
        this.filterErrorEl.style.display = 'block';
      }
    } else {
      this.filterCountEl.textContent = `${totalCount} notes due`;
      this.filterErrorEl.style.display = 'none';
    }
  }

  doHandleQueryChange() {
    const newQuery = this.queryInput.value.trim();
    if (newQuery !== this.settings.filterQuery) {
      this.settings.filterQuery = newQuery;
      this.saveSettings();
      this.updateFilterCount();
      this.buttonsContainer.empty();
      this.previewContainer.empty();
      this.setPage();
    }
  }

  handleTagClick(tag: string) {
    const currentQuery = this.queryInput.value.trim();
    if (currentQuery) {
      this.queryInput.value = `${currentQuery} OR ${tag}`;
    } else {
      this.queryInput.value = tag;
    }
    this.handleQueryChange();
  }

  async handleClearQuery() {
    this.queryInput.value = '';
    this.settings.filterQuery = '';
    await this.saveSettings();
    this.updateFilterCount();
    this.buttonsContainer.empty();
      this.previewContainer.empty();
      this.setPage();
  }

  async handleSaveFilter() {
    const currentQuery = this.settings.filterQuery;
    if (!currentQuery) {
      return;
    }

    const modal = new TextInputModal(
      this.app,
      'Save Filter',
      'Filter name',
      '',
      async (name) => {
        if (!name) return;

        const existingIndex = this.settings.savedFilters.findIndex(f => f.name === name);
        if (existingIndex >= 0) {
          this.settings.savedFilters[existingIndex].query = currentQuery;
        } else {
          this.settings.savedFilters.push({ name, query: currentQuery });
        }

        await this.saveSettings();
        this.refreshFilterUI();
      }
    );
    modal.open();
  }

  async handleLoadSavedFilter(event: Event) {
    const select = event.target as HTMLSelectElement;
    const filterIndex = parseInt(select.value);

    if (isNaN(filterIndex)) return;

    const filter = this.settings.savedFilters[filterIndex];
    if (filter) {
      this.queryInput.value = filter.query;
      this.settings.filterQuery = filter.query;
      await this.saveSettings();
      this.updateFilterCount();
      this.buttonsContainer.empty();
      this.previewContainer.empty();
      this.setPage();
    }
  }

  async handleDeleteSavedFilter() {
    const select = this.savedFilterDropdown;
    const filterIndex = parseInt(select.value);

    if (isNaN(filterIndex)) return;

    const filter = this.settings.savedFilters[filterIndex];
    if (filter) {
      const shouldClearQuery = this.settings.filterQuery === filter.query;

      this.settings.savedFilters.splice(filterIndex, 1);

      if (shouldClearQuery) {
        this.settings.filterQuery = '';
        this.queryInput.value = '';
      }

      await this.saveSettings();

      if (shouldClearQuery) {
        this.buttonsContainer.empty();
      this.previewContainer.empty();
      this.setPage();
      } else {
        this.refreshFilterUI();
      }
    }
  }

  setMessage(message: string) {
    this.messageContainer.style.display = 'block';
    this.messageContainer.setText(message);
  }

  async addRepeatButton(
    choice: RepeatChoice,
    file: TFile,
  ) {
    const buttonClasses = ['repeat-button'];
    const ratingClass = RATING_BUTTON_CLASS[choice.rating];
    const ratingColor = RATING_BUTTON_COLOR[choice.rating];
    if (ratingClass) {
      buttonClasses.push(ratingClass);
    }
    return this.buttonsContainer.createEl('button', {
        text: choice.text,
        cls: buttonClasses.join(' '),
      },
      (buttonElement) => {
        if (ratingColor) {
          buttonElement.style.backgroundColor = ratingColor;
          buttonElement.style.borderColor = ratingColor;
          buttonElement.style.color = '#fff';
        }
        buttonElement.onclick = () => this.applyChoice(choice, file);
      });
  }
}

export default RepeatView;
