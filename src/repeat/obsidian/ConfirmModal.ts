import { App, Modal, Setting } from 'obsidian';

class ConfirmModal extends Modal {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;

  constructor(
    app: App,
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
  ) {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', { text: this.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Cancel')
          .onClick(() => this.close()))
      .addButton((btn) =>
        btn
          .setButtonText(this.confirmLabel)
          .setCta()
          .setWarning()
          .onClick(() => {
            this.close();
            this.onConfirm();
          }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default ConfirmModal;
