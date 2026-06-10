import { ItemView, WorkspaceLeaf } from 'obsidian';
import { DateTime } from 'luxon';

import { RepeatPluginSettings } from '../../settings';
import { ReviewActivityLog, activityDayKey } from '../activity';
import { HeatmapCalendar } from '../heatmap/HeatmapCalendar';
import { computeStats, computeDynamicLegend } from '../heatmap/stats';

export const REVISOR_STATS_VIEW = 'revisor-stats-view';

export interface StatsViewPluginHost {
  settings: RepeatPluginSettings;
  activity: ReviewActivityLog;
  saveSettings(): Promise<void>;
}

class HeatmapView extends ItemView {
  private host: StatsViewPluginHost;
  private calendar: HeatmapCalendar | null = null;
  private headerEl: HTMLElement | null = null;
  private gridContainer: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private yearNavEl: HTMLElement | null = null;
  private selectedYear: number;

  constructor(leaf: WorkspaceLeaf, settings: RepeatPluginSettings, saveSettings: () => Promise<void>, pluginHost: StatsViewPluginHost) {
    super(leaf);
    this.host = pluginHost;
    this.selectedYear = DateTime.now().year;
  }

  getViewType() {
    return REVISOR_STATS_VIEW;
  }

  getDisplayText() {
    return 'Revisor stats';
  }

  getIcon() {
    return 'calendar';
  }

  async onOpen() {
    this.containerEl.empty();
    this.containerEl.addClass('revisor-hm-container');

    this.headerEl = this.containerEl.createEl('div', { cls: 'revisor-hm-header' });

    const titleEl = this.headerEl.createEl('span', {
      cls: 'revisor-hm-title',
      text: 'Revisor stats',
    });

    this.yearNavEl = this.headerEl.createEl('div', { cls: 'revisor-hm-year-nav' });
    this.renderYearNav();

    this.gridContainer = this.containerEl.createEl('div', { cls: 'revisor-hm-grid' });

    this.statsEl = this.containerEl.createEl('div', { cls: 'revisor-hm-stats' });

    this.renderAll();
  }

  async onClose() {
    this.containerEl.empty();
  }

  private renderYearNav() {
    if (!this.yearNavEl) return;
    this.yearNavEl.empty();

    const prevBtn = this.yearNavEl.createEl('button', { cls: 'revisor-hm-nav-btn' });
    prevBtn.setText('‹');

    const yearLabel = this.yearNavEl.createEl('span', {
      cls: 'revisor-hm-year-label',
      text: String(this.selectedYear),
    });

    const nextBtn = this.yearNavEl.createEl('button', { cls: 'revisor-hm-nav-btn' });
    nextBtn.setText('›');

    prevBtn.addEventListener('click', () => {
      this.selectedYear -= 1;
      this.renderAll();
    });
    nextBtn.addEventListener('click', () => {
      this.selectedYear += 1;
      this.renderAll();
    });

    const dataBounds = this.getDataBounds();
    if (dataBounds.firstYear) {
      prevBtn.disabled = this.selectedYear <= dataBounds.firstYear;
    }
    if (dataBounds.lastYear) {
      nextBtn.disabled = this.selectedYear >= dataBounds.lastYear;
    }
  }

  private getDataBounds(): { firstYear: number | null; lastYear: number | null } {
    const keys = Object.keys(this.host.activity);
    let firstYear: number | null = null;
    let lastYear: number | null = null;
    for (const key of keys) {
      const d = DateTime.fromISO(key);
      if (!d.isValid) continue;
      const y = d.year;
      if (firstYear === null || y < firstYear) firstYear = y;
      if (lastYear === null || y > lastYear) lastYear = y;
    }
    return { firstYear, lastYear };
  }

  private renderAll() {
    this.renderYearNav();
    this.renderGrid();
    this.renderStats();
  }

  private renderGrid() {
    if (!this.gridContainer) return;
    this.gridContainer.empty();

    if (this.calendar) {
      this.calendar.destroy();
      this.calendar = null;
    }

    const today = DateTime.now().toISODate()!;
    const legend = computeDynamicLegend(this.host.activity);
    const counts = new Map<string, number>();

    for (const [key, day] of Object.entries(this.host.activity)) {
      counts.set(key, day.reviews + day.newCards);
    }

    const wrapper = this.gridContainer.createEl('div', {
      cls: 'revisor-hm-grid-inner',
    });

    this.calendar = new HeatmapCalendar(wrapper, {
      counts,
      year: this.selectedYear,
      weekStart: 0,
      legend,
      today,
      onTooltip: (dateKey, count) => {
        const d = DateTime.fromISO(dateKey);
        const dayName = d.toFormat('EEE');
        const dateStr = d.toFormat('MMMM d, yyyy');
        if (count === 0) return `No reviews on ${dayName} ${dateStr}`;
        const item = count === 1 ? 'card' : 'cards';
        return `${count} ${item} reviewed on ${dayName} ${dateStr}`;
      },
    });

    this.calendar.render();
  }

  private renderStats() {
    if (!this.statsEl) return;
    this.statsEl.empty();

    const today = activityDayKey(DateTime.now(), this.host.settings.dayStartsAt);
    const stats = computeStats(this.host.activity, today);

    if (stats.activeDays === 0) {
      this.statsEl.createEl('div', {
        cls: 'revisor-hm-stats-empty',
        text: 'No review activity yet. Start reviewing to see your stats!',
      });
      return;
    }

    const items = [
      { label: 'Current streak', value: `${stats.currentStreak} days` },
      { label: 'Longest streak', value: `${stats.longestStreak} days` },
      { label: 'Daily average', value: `${stats.dailyAverage}` },
      { label: 'Days learned', value: `${stats.daysLearnedPct}%` },
      { label: 'Total reviews', value: `${stats.totalReviews}` },
      { label: 'Total new cards', value: `${stats.totalCards}` },
    ];

    const row = this.statsEl.createEl('div', { cls: 'revisor-hm-stats-row' });
    for (const item of items) {
      const card = row.createEl('div', { cls: 'revisor-hm-stats-card' });
      card.createEl('div', { cls: 'revisor-hm-stats-value', text: item.value });
      card.createEl('div', { cls: 'revisor-hm-stats-label', text: item.label });
    }
  }
}

export default HeatmapView;
