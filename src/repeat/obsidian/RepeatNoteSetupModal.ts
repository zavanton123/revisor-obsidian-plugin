import { DateTime } from 'luxon';
import { App, Modal, Setting } from 'obsidian';
import { createInitialFsrsRepetition } from '../fsrs';
import { Repetition } from '../repeatTypes';
import { summarizeDueAtWithPrefix } from '../utils';
import { RepeatPluginSettings } from '../../settings';

const formatDateTimeForPicker = (dt: DateTime) => (
  [
    dt.toFormat('yyyy-MM-dd'),
    'T',
    dt.toFormat('HH:mm')
  ].join('')
);

class RepeatNoteSetupModal extends Modal {
  result: Repetition;
  summary: string;
  datetimePickerEl: HTMLInputElement | undefined;
  dueAtSummaryEl: HTMLElement | undefined;
  onSubmit: (result: Repetition) => void;
  settings: RepeatPluginSettings;

  constructor(
    app: App,
    onSubmit: (result: Repetition) => void,
    settings: RepeatPluginSettings,
    initialValue?: Repetition,
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.updateResult = this.updateResult.bind(this);
    this.settings = settings;

    this.result = initialValue
      ? { ...initialValue }
      : createInitialFsrsRepetition(settings);

    if (!this.result.repeatDueAt) {
      this.result.repeatDueAt = DateTime.now();
    }
    this.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);
  }

  updateResult(key: string, value: any) {
    this.result[key] = value;
    this.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);

    if (this.datetimePickerEl) {
      this.datetimePickerEl.value = formatDateTimeForPicker(
        this.result.repeatDueAt);
    }
    this.dueAtSummaryEl?.setText(this.summary);
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.empty();
    contentEl.addClass('repeat-setup_modal');

    const timeOfDayEl = new Setting(contentEl)
      .setName('Review time of day')
      .addDropdown((dropdown) => {
        dropdown.addOption('AM', `in the morning at ${this.settings.morningReviewTime}`);
        dropdown.addOption('PM', `in the evening at ${this.settings.eveningReviewTime}`);
        dropdown.setValue(this.result.repeatTimeOfDay);
        dropdown.onChange((value) => {
          this.updateResult('repeatTimeOfDay', value);
        });
      });

    const nextRepeatEl = new Setting(contentEl)
      .setName('Next repeat')
      .setDesc(this.summary)
      .addText((datetimePicker) => {
        datetimePicker.inputEl.type = 'datetime-local';
        datetimePicker.inputEl.addClass('repeat-date_picker');
        const pickerValue = formatDateTimeForPicker(this.result.repeatDueAt);
        datetimePicker.inputEl.value = pickerValue;
        this.datetimePickerEl = datetimePicker.inputEl;
        datetimePicker.onChange((value) => {
          const parsedValue = DateTime.fromISO(value);
          // @ts-ignore: .invalid is added by luxon.
          if (parsedValue.invalid) {
            console.error('Repeat Plugin: Could not parse datetime from picker.');
            return;
          }
          this.result.repeatDueAt = parsedValue;
          this.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);
          this.dueAtSummaryEl?.setText(this.summary);
        });
      });
    this.dueAtSummaryEl = nextRepeatEl?.descEl;

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Set Up Repetition')
          .setCta()
          .onClick(() => {
            const final = { ...this.result };
            if (!final.fsrs) {
              final.fsrs = createInitialFsrsRepetition(this.settings).fsrs;
            }
            this.close();
            this.onSubmit(final);
          }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default RepeatNoteSetupModal;
