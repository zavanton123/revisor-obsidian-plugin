import { DateTime } from 'luxon';

export type HeatmapCounts = Map<string, number>;

export interface HeatmapCalendarProps {
  counts: HeatmapCounts;
  year: number;
  weekStart: 0 | 1;
  legend: number[];
  today: string;
  onTooltip(date: string, count: number): string;
}

const CELL_SIZE = 11;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const LABEL_WIDTH = 30;
const HEADER_HEIGHT = 20;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export class HeatmapCalendar {
  private props: HeatmapCalendarProps;
  private svg: SVGElement;
  private tooltip: HTMLDivElement;
  private container: HTMLElement;

  constructor(
    container: HTMLElement,
    props: HeatmapCalendarProps,
  ) {
    this.props = props;
    this.container = container;
    this.svg = container.createSvg('svg');
    this.svg.classList.add('revisor-hm-svg');
    this.tooltip = container.createEl('div', { cls: 'revisor-hm-tooltip' });
    this.tooltip.style.display = 'none';
  }

  destroy() {
    this.svg.remove();
    this.tooltip.remove();
  }

  render() {
    this.svg.empty();

    const { counts, legend } = this.props;

    const svgWidth = this.computeGridWidth();
    const svgHeight = CELL_STEP * 7 + HEADER_HEIGHT;
    this.svg.setAttr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    this.svg.setAttr('width', String(svgWidth));
    this.svg.setAttr('height', String(svgHeight));
    this.svg.style.overflow = 'visible';

    const gridGroup = this.svg.createSvg('g');
    gridGroup.setAttr('transform', `translate(${LABEL_WIDTH}, ${HEADER_HEIGHT})`);

    this.renderMonthLabels();
    this.renderWeekdayLabels();
    this.renderDayCells(gridGroup);
  }

  private computeGridWidth(): number {
    const jan1 = DateTime.fromObject({ year: this.props.year, month: 1, day: 1 });
    const dec31 = DateTime.fromObject({ year: this.props.year, month: 12, day: 31 });
    const firstWeek = this.isoWeekForDate(jan1);
    const lastWeek = this.isoWeekForDate(dec31);
    let weeks = lastWeek - firstWeek + 1;
    if (weeks <= 0) weeks = 53;
    weeks = Math.max(weeks, 53);
    return LABEL_WIDTH + weeks * CELL_STEP;
  }

  private isoWeekForDate(date: DateTime): number {
    const jan4 = DateTime.fromObject({ year: date.year, month: 1, day: 4 });
    const thursdayOfFirstWeek = jan4.minus({ days: jan4.weekday - 4 });
    const diff = Math.floor(date.diff(thursdayOfFirstWeek, 'days').days);
    return Math.floor(diff / 7) + 1;
  }

  private bucketFor(count: number, legend: number[]): number {
    if (count <= 0) return 0;
    for (let i = 0; i < legend.length; i++) {
      if (count <= legend[i]) return i + 1;
    }
    return legend.length + 1;
  }

  private renderMonthLabels() {
    const monthsGroup = this.svg.createSvg('g');
    monthsGroup.setAttr('transform', `translate(${LABEL_WIDTH}, 0)`);

    let currentMonth = -1;

    for (let doy = 0; doy < 366; doy++) {
      const date = DateTime.fromObject(
        { year: this.props.year, month: 1, day: 1 },
      ).plus({ days: doy });
      if (date.year !== this.props.year) break;

      const month = date.month - 1;
      if (month !== currentMonth) {
        const col = this.colForDate(date);
        if (col < 0) continue;

        currentMonth = month;
        const label = monthsGroup.createSvg('text');
        label.setText(MONTH_NAMES[month]);
        label.setAttr('x', String(col * CELL_STEP));
        label.setAttr('y', '10');
        label.classList.add('revisor-hm-month-label');
      }
    }
  }

  private renderWeekdayLabels() {
    const start = this.props.weekStart;
    const short = ['', 'M', '', 'W', '', 'F', ''];
    for (let r = 0; r < 7; r++) {
      const dow = (r + start) % 7;
      const label = short[dow];
      if (!label) continue;

      const text = this.svg.createSvg('text');
      text.setText(label);
      text.setAttr('x', String(LABEL_WIDTH - 8));
      text.setAttr('y', String(HEADER_HEIGHT + r * CELL_STEP + 9));
      text.classList.add('revisor-hm-day-label');
    }
  }

  private colForDate(date: DateTime): number {
    const jan1 = DateTime.fromObject({ year: this.props.year, month: 1, day: 1 });
    const firstStart =
      this.props.weekStart === 0
        ? jan1.minus({ days: jan1.weekday % 7 })
        : jan1.minus({ days: (jan1.weekday + 6) % 7 });
    return Math.floor(date.diff(firstStart, 'days').days / 7);
  }

  private rowForDate(date: DateTime): number {
    if (this.props.weekStart === 0) {
      return date.weekday % 7;
    }
    return (date.weekday + 6) % 7;
  }

  private renderDayCells(gridGroup: SVGElement) {
    const { counts, legend } = this.props;
    const jan1 = DateTime.fromObject({ year: this.props.year, month: 1, day: 1 });

    for (let doy = 0; doy < 366; doy++) {
      const date = jan1.plus({ days: doy });
      if (date.year !== this.props.year) break;

      const dateKey = date.toISODate()!;
      const count = counts.get(dateKey) ?? 0;
      const level = this.bucketFor(count, legend);
      const col = this.colForDate(date);
      const row = this.rowForDate(date);

      if (col < 0 || row < 0) continue;

      const rect = gridGroup.createSvg('rect');
      rect.classList.add('revisor-hm-cell', `revisor-hm-q${level}`);
      rect.setAttr('width', String(CELL_SIZE));
      rect.setAttr('height', String(CELL_SIZE));
      rect.setAttr('x', String(col * CELL_STEP));
      rect.setAttr('y', String(row * CELL_STEP));
      rect.setAttr('rx', '2');
      rect.setAttr('ry', '2');
      rect.setAttr('data-date', dateKey);
      rect.setAttr('data-count', String(count));

      if (dateKey === this.props.today) {
        rect.classList.add('revisor-hm-today');
      }

      rect.addEventListener('mouseenter', () => {
        this.showTooltip(dateKey, count, rect);
      });
      rect.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    }
  }

  private showTooltip(dateKey: string, count: number, rect: SVGRectElement) {
    const text = this.props.onTooltip(dateKey, count);
    this.tooltip.setText(text);
    this.tooltip.style.display = 'block';

    const svgRect = this.svg.getBoundingClientRect();
    const cellRect = rect.getBoundingClientRect();
    this.tooltip.style.left = `${cellRect.left - svgRect.left + cellRect.width / 2}px`;
    this.tooltip.style.top = `${cellRect.top - svgRect.top - 30}px`;
  }

  private hideTooltip() {
    this.tooltip.style.display = 'none';
  }
}
