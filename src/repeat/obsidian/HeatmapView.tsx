import { App, ItemView, WorkspaceLeaf } from 'obsidian';
import { DateTime } from 'luxon';

import { RepeatPluginSettings } from '../../settings';
import { ReviewLog, activityDayKey, dailyCountsFromLog } from '../activity';
import { HeatmapCalendar } from '../heatmap/HeatmapCalendar';
import { computeStatsFromCounts, computeDynamicLegendFromCounts } from '../heatmap/stats';
import {
  aggregateToday,
  aggregateCardCounts,
  aggregateFutureDue,
} from '../stats/aggregate';
import {
  renderTodayPanel,
  renderCardCountsPanel,
  renderFutureDuePanel,
} from '../stats/charts';
import { buildCardSnapshot } from '../stats/snapshot';

export const REVISOR_STATS_VIEW = 'revisor-stats-view';

export interface StatsViewPluginHost {
  settings: RepeatPluginSettings;
  reviewLog: ReviewLog;
  saveSettings(): Promise<void>;
  app: App;
}

class StatsView extends ItemView {
  private host: StatsViewPluginHost;
  private calendar: HeatmapCalendar | null = null;
  private sectionsRoot: HTMLElement | null = null;
  private selectedYear: number;

  constructor(leaf: WorkspaceLeaf, settings: RepeatPluginSettings, saveSettings: () => Promise<void>, pluginHost: StatsViewPluginHost) {
    super(leaf);
    this.host = pluginHost;
    this.selectedYear = DateTime.now().year;
  }

  getViewType() { return REVISOR_STATS_VIEW; }
  getDisplayText() { return 'Revisor stats'; }
  getIcon() { return 'bar-chart'; }

  async onOpen() {
    this.renderAll();
  }

  async onClose() {
    this.containerEl.empty();
  }

  private renderAll() {
    this.containerEl.empty();
    this.containerEl.addClass('revisor-stats-root');

    const dayStartsAt = this.host.settings.dayStartsAt;
    const log = this.host.reviewLog;
    const today = activityDayKey(DateTime.now(), dayStartsAt);
    const counts = dailyCountsFromLog(log, dayStartsAt);
    const stats = computeStatsFromCounts(counts, today);
    const cards = buildCardSnapshot(this.host.app);

    // ── Header ──
    const header = this.containerEl.createEl('div', { cls: 'revisor-stats-header' });
    header.createEl('span', { cls: 'revisor-stats-title', text: 'Revisor stats' });

    // ── Sections container ──
    this.sectionsRoot = this.containerEl.createEl('div', { cls: 'revisor-stats-sections' });

    // ── Today ──
    const todayData = aggregateToday(log, dayStartsAt);
    this.addPanel('Today', (el) => renderTodayPanel(el, todayData));

    // ── Streak row ──
    this.addPanel('Activity', (el) => {
      if (stats.activeDays === 0) {
        el.createEl('div', { cls: 'revisor-stats-empty', text: 'No review activity yet.' });
        return;
      }
      const row = el.createEl('div', { cls: 'revisor-hm-stats-row' });
      for (const [label, value] of [
        ['Current streak', `${stats.currentStreak} days`],
        ['Longest streak', `${stats.longestStreak} days`],
        ['Daily average', `${stats.dailyAverage}`],
        ['Days learned', `${stats.daysLearnedPct}%`],
        ['Total reviews', `${stats.totalReviews}`],
      ]) {
        const card = row.createEl('div', { cls: 'revisor-hm-stats-card' });
        card.createEl('div', { cls: 'revisor-hm-stats-value', text: value });
        card.createEl('div', { cls: 'revisor-hm-stats-label', text: label });
      }
    });

    // ── Calendar ──
    this.addPanel('Calendar', (el) => {
      const yearNav = el.createEl('div', { cls: 'revisor-hm-year-nav' });
      const prevBtn = yearNav.createEl('button', { cls: 'revisor-hm-nav-btn', text: '‹' });
      const label = yearNav.createEl('span', { cls: 'revisor-hm-year-label', text: String(this.selectedYear) });
      const nextBtn = yearNav.createEl('button', { cls: 'revisor-hm-nav-btn', text: '›' });

      const gridWrap = el.createEl('div', { cls: 'revisor-hm-grid-inner' });
      const legend = computeDynamicLegendFromCounts(counts);

      const renderCal = () => {
        label.setText(String(this.selectedYear));
        gridWrap.empty();
        this.calendar = new HeatmapCalendar(gridWrap, {
          counts,
          year: this.selectedYear,
          weekStart: 0,
          legend,
          today,
          onTooltip: (dk, c) => {
            const d = DateTime.fromISO(dk);
            if (c === 0) return `No reviews on ${d.toFormat('EEE, MMM d, yyyy')}`;
            return `${c} card${c === 1 ? '' : 's'} reviewed on ${d.toFormat('EEE, MMM d, yyyy')}`;
          },
        });
        this.calendar.render();
      };
      renderCal();

      prevBtn.addEventListener('click', () => { this.selectedYear--; renderCal(); });
      nextBtn.addEventListener('click', () => { this.selectedYear++; renderCal(); });
    });

    // ── Card Counts ──
    const cc = aggregateCardCounts(cards);
    this.addPanel('Card Counts', (el) => renderCardCountsPanel(el, cc));

    // ── Future Due ──
    const fd = aggregateFutureDue(cards);
    this.addPanel('Future Due', (el) => renderFutureDuePanel(el, fd));
  }

  private addPanel(title: string, render: (el: HTMLElement) => void) {
    if (!this.sectionsRoot) return;
    const section = this.sectionsRoot.createEl('div', { cls: 'revisor-stats-panel' });
    section.createEl('div', { cls: 'revisor-stats-panel-title', text: title });
    const body = section.createEl('div', { cls: 'revisor-stats-panel-body' });
    render(body);
  }
}

export default StatsView;
