import {
  TodayData, ReviewsData, CardCountsData, FutureDueData,
  ButtonsData, HourlyData, RetentionData, HistogramData,
} from './aggregate';

const CHART_H = 130;
const CHART_W = 740;
const PAD_L = 48;
const PAD_R = 10;
const PAD_T = 5;
const PAD_B = 25;

function svgWrap(el: HTMLElement): SVGSVGElement {
  const svg = el.createSvg('svg');
  svg.setAttr('viewBox', `0 0 ${CHART_W} ${CHART_H}`);
  svg.style.width = '100%';
  svg.style.maxHeight = `${CHART_H}px`;
  return svg;
}

function addBar(svg: SVGSVGElement, x: number, w: number, y: number, h: number, cls: string) {
  const rect = svg.createSvg('rect');
  rect.setAttr('x', String(x));
  rect.setAttr('width', String(Math.max(0.5, w)));
  rect.setAttr('y', String(y));
  rect.setAttr('height', String(Math.max(0, h)));
  rect.setAttr('rx', '1');
  rect.classList.add(cls);
  return rect;
}

function addText(svg: SVGSVGElement, x: number, y: number, text: string, cls: string, anchor = 'middle') {
  const t = svg.createSvg('text');
  t.setAttr('x', String(x));
  t.setAttr('y', String(y));
  t.setText(text);
  t.classList.add(cls);
  t.style.textAnchor = anchor;
  return t;
}

function addLine(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number, cls: string) {
  const line = svg.createSvg('line');
  line.setAttr('x1', String(x1)); line.setAttr('y1', String(y1));
  line.setAttr('x2', String(x2)); line.setAttr('y2', String(y2));
  line.classList.add(cls);
  return line;
}

function barColor(kind: string): string {
  const map: Record<string, string> = {
    learn: 'revisor-chart-learn',
    relearn: 'revisor-chart-relearn',
    young: 'revisor-chart-young',
    mature: 'revisor-chart-mature',
  };
  return map[kind] ?? 'revisor-chart-mature';
}

// ── Today ──

export function renderTodayPanel(el: HTMLElement, d: TodayData) {
  el.empty();
  if (d.total === 0) {
    el.createEl('div', { cls: 'revisor-stats-empty', text: 'No reviews today yet.' });
    return;
  }
  const row = el.createEl('div', { cls: 'revisor-stats-today-row' });
  for (const [label, value] of [
    ['Reviews', `${d.total}`],
    ['Time', `${Math.round(d.totalTimeMs / 1000 / 60)}m`],
    ['Again', `${d.againPercent}%`],
    ['Mature correct', `${d.maturePercent}%`],
    ['Learn/Relearn', `${d.learn + d.relearn}`],
    ['Young/Mature', `${d.young + d.mature}`],
  ]) {
    const card = row.createEl('div', { cls: 'revisor-hm-stats-card' });
    card.createEl('div', { cls: 'revisor-hm-stats-value', text: value });
    card.createEl('div', { cls: 'revisor-hm-stats-label', text: label });
  }
}

// ── Reviews ──

export function renderReviewsPanel(el: HTMLElement, d: ReviewsData) {
  el.empty();
  if (d.totalReviews === 0) { el.createEl('div', { cls: 'revisor-stats-empty', text: 'No review data.' }); return; }
  const svg = svgWrap(el);
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const barW = Math.max(1, plotW / d.dailyBars.length - 1);
  const maxTotal = Math.max(1, d.dailyBars.reduce((m, b) => Math.max(m, b.learn + b.relearn + b.young + b.mature), 0), d.cumulative[d.cumulative.length - 1]);
  const maxCum = d.cumulative[d.cumulative.length - 1] || 1;

  const kinds = ['mature', 'young', 'relearn', 'learn'] as const;

  for (let i = 0; i < d.dailyBars.length; i++) {
    const x = PAD_L + i * barW;
    let bottom = CHART_H - PAD_B;
    for (const k of kinds) {
      const v = d.dailyBars[i][k];
      const h = (v / maxTotal) * plotH;
      if (h > 0) addBar(svg, x, barW, bottom - h, h, barColor(k));
      bottom -= h;
    }
  }

  // cumulative line on right axis
  let firstCum = true;
  for (let i = 0; i < d.cumulative.length; i++) {
    const x = PAD_L + i * barW + barW / 2;
    const y = CHART_H - PAD_B - (d.cumulative[i] / maxCum) * plotH;
    if (!firstCum) {
      addLine(svg, prevCX!, prevCY!, x, y, 'revisor-chart-cumline');
    }
    firstCum = false;
    var prevCX = x;
    var prevCY = y;
  }

  addText(svg, CHART_W / 2, CHART_H - 2, `${d.daysStudied} of ${d.dayRange} days studied · ${d.totalReviews} total`, 'revisor-chart-label');
}

// ── Card Counts ──

export function renderCardCountsPanel(el: HTMLElement, d: CardCountsData) {
  el.empty();
  if (d.total === 0) { el.createEl('div', { cls: 'revisor-stats-empty', text: 'No cards.' }); return; }
  const rows: [string, number, string][] = [
    ['New', d.newCount, '#5b9bd5'], ['Learning', d.learning, '#f4a460'], ['Relearning', d.relearning, '#e8a838'],
    ['Young', d.young, '#7bc67e'], ['Mature', d.mature, '#2e7d32'], ['Suspended', d.suspended, '#ffcc02'],
    ['Buried', d.buried, '#bdbdbd'],
  ];
  const table = el.createEl('table', { cls: 'revisor-stats-table' });
  for (const [label, count, color] of rows) {
    if (count === 0 && ['Suspended', 'Buried'].includes(label)) continue;
    const tr = table.createEl('tr');
    const td1 = tr.createEl('td');
    td1.createEl('span', { cls: 'revisor-stats-dot', attr: { style: `background:${color}` } });
    td1.createEl('span', { text: ` ${label}` });
    tr.createEl('td', { text: String(count) });
    tr.createEl('td', { text: `${Math.round(count / d.total * 100)}%` });
  }
}

// ── Future Due ──

export function renderFutureDuePanel(el: HTMLElement, d: FutureDueData) {
  el.empty();
  if (d.totalDue === 0) { el.createEl('div', { cls: 'revisor-stats-empty', text: 'No future due cards.' }); return; }
  const svg = svgWrap(el);
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const days = [...d.dueByDay.keys()].sort((a, b) => a - b);
  if (days.length === 0) return;
  const maxVal = Math.max(1, ...d.dueByDay.values());
  const barW = Math.max(1, plotW / days.length - 1);

  for (let i = 0; i < days.length; i++) {
    const v = d.dueByDay.get(days[i]) ?? 0;
    const x = PAD_L + i * barW;
    const h = (v / maxVal) * plotH;
    if (h > 0) addBar(svg, x, barW, CHART_H - PAD_B - h, h, 'revisor-chart-learn');
  }

  addText(svg, CHART_W / 2, CHART_H - 2, `${d.totalDue} due · ${d.dueTomorrow} tomorrow · load ${d.dailyLoad}/day`, 'revisor-chart-label');
}

// ── Buttons ──

export function renderButtonsPanel(el: HTMLElement, d: ButtonsData) {
  el.empty();
  if (d.totalEvents === 0) { el.createEl('div', { cls: 'revisor-stats-empty', text: 'No data.' }); return; }
  const svg = svgWrap(el);
  const groups = [
    { label: 'Learning', data: d.learning, color: 'revisor-chart-learn' },
    { label: 'Young', data: d.young, color: 'revisor-chart-young' },
    { label: 'Mature', data: d.mature, color: 'revisor-chart-mature' },
  ];
  const maxVal = Math.max(1, ...groups.flatMap(g => g.data));
  const groupW = (CHART_W - PAD_L - PAD_R) / 3;
  const btns = ['Again', 'Hard', 'Good', 'Easy'];

  groups.forEach((g, gi) => {
    const gx = PAD_L + gi * groupW;
    const barW = Math.max(2, groupW / 5 - 2);
    for (let b = 0; b < 4; b++) {
      const x = gx + b * barW * 1.2;
      const h = (g.data[b] / maxVal) * (CHART_H - PAD_T - PAD_B);
      addBar(svg, x, barW, CHART_H - PAD_B - h, Math.max(1, h), g.color);
    }
    addText(svg, gx + groupW / 2, CHART_H - 2, g.label, 'revisor-chart-label');
  });
}

// ── Hourly ──

export function renderHourlyPanel(el: HTMLElement, d: HourlyData) {
  el.empty();
  const maxVal = Math.max(1, ...d.perHour.map(h => h.total));
  const svg = svgWrap(el);
  const plotW = CHART_W - PAD_L - PAD_R;
  const barW = Math.max(1, plotW / 24 - 1);

  for (let h = 0; h < 24; h++) {
    const x = PAD_L + h * barW;
    const height = (d.perHour[h].total / maxVal) * (CHART_H - PAD_T - PAD_B);
    if (height > 0) addBar(svg, x, barW, CHART_H - PAD_B - height, height, 'revisor-chart-mature');
  }

  // success rate line
  const maxRate = 100;
  const ratePlotH = CHART_H - PAD_T - PAD_B;
  for (let h = 1; h < 24; h++) {
    const pRate = d.perHour[h - 1].total > 0 ? d.perHour[h - 1].correct / d.perHour[h - 1].total * 100 : 0;
    const cRate = d.perHour[h].total > 0 ? d.perHour[h].correct / d.perHour[h].total * 100 : 0;
    const x1 = PAD_L + (h - 1) * barW;
    const x2 = PAD_L + h * barW;
    const y1 = CHART_H - PAD_B - (pRate / maxRate) * ratePlotH;
    const y2 = CHART_H - PAD_B - (cRate / maxRate) * ratePlotH;
    addLine(svg, x1, y1, x2, y2, 'revisor-chart-cumline');
  }

  addText(svg, PAD_L, CHART_H - 2, '0', 'revisor-chart-label', 'start');
  addText(svg, PAD_L + (CHART_W - PAD_L - PAD_R) / 2, CHART_H - 2, '12', 'revisor-chart-label');
  addText(svg, CHART_W - PAD_R, CHART_H - 2, '23', 'revisor-chart-label', 'end');
}

// ── True Retention ──

export function renderTrueRetentionPanel(el: HTMLElement, d: RetentionData) {
  el.empty();
  const table = el.createEl('table', { cls: 'revisor-stats-table' });
  const hdr = table.createEl('tr');
  hdr.createEl('th', { text: '' });
  hdr.createEl('th', { text: 'Young' });
  hdr.createEl('th', { text: 'Mature' });
  hdr.createEl('th', { text: 'Total' });

  const periods: Array<keyof RetentionData> = ['today', 'yesterday', 'week', 'month', 'year'];
  for (const p of periods) {
    const data = d[p];
    const yTotal = data.youngPass + data.youngFail;
    const mTotal = data.maturePass + data.matureFail;
    const allTotal = yTotal + mTotal;
    if (allTotal === 0) continue;
    const yPct = yTotal > 0 ? Math.round(data.youngPass / yTotal * 100) : 0;
    const mPct = mTotal > 0 ? Math.round(data.maturePass / mTotal * 100) : 0;
    const aPct = allTotal > 0 ? Math.round((data.youngPass + data.maturePass) / allTotal * 100) : 0;

    const tr = table.createEl('tr');
    tr.createEl('td', { text: p.charAt(0).toUpperCase() + p.slice(1) });
    tr.createEl('td', { text: `${yPct}%` });
    tr.createEl('td', { text: `${mPct}%` });
    tr.createEl('td', { text: `${aPct}%` });
  }
}

// ── Histogram (Intervals / Stability / Difficulty / Retrievability / Added) ──

export function renderIntervalsPanel(el: HTMLElement, d: HistogramData) {
  renderHistogram(el, d, 'days');
}
export function renderStabilityPanel(el: HTMLElement, d: HistogramData) {
  renderHistogram(el, d, 'days');
}
export function renderDifficultyPanel(el: HTMLElement, d: HistogramData) {
  renderHistogram(el, d, '%');
}
export function renderRetrievabilityPanel(el: HTMLElement, d: HistogramData) {
  renderHistogram(el, d, '%');
}
export function renderAddedPanel(el: HTMLElement, d: HistogramData) {
  renderHistogram(el, d, 'days ago');
}

function renderHistogram(el: HTMLElement, d: HistogramData, unit: string) {
  el.empty();
  if (d.values.length === 0) { el.createEl('div', { cls: 'revisor-stats-empty', text: 'No data.' }); return; }

  const bins = computeBins(d.values, 50);
  const maxCount = Math.max(1, ...bins.map(b => b.count));

  const svg = svgWrap(el);
  const plotW = CHART_W - PAD_L - PAD_R;
  const barW = Math.max(1, plotW / bins.length - 1);

  for (let i = 0; i < bins.length; i++) {
    const h = (bins[i].count / maxCount) * (CHART_H - PAD_T - PAD_B);
    const x = PAD_L + i * barW;
    if (h > 0) addBar(svg, x, barW, CHART_H - PAD_B - h, Math.max(1, h), 'revisor-chart-mature');
  }

  addText(svg, CHART_W / 2, CHART_H - 2, `Median ${d.median} ${unit} · ${d.values.length} cards`, 'revisor-chart-label');
}

function computeBins(sorted: number[], maxBins: number): { min: number; max: number; count: number }[] {
  if (sorted.length === 0) return [];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [{ min, max, count: sorted.length }];

  const binW = Math.max(1, Math.ceil((max - min) / maxBins));
  const bins: { min: number; max: number; count: number }[] = [];
  for (let edge = min; edge <= max; edge += binW) {
    bins.push({ min: edge, max: edge + binW - 1, count: 0 });
  }

  let bi = 0;
  for (const v of sorted) {
    while (bi < bins.length - 1 && v > bins[bi].max) bi++;
    bins[bi].count++;
  }
  return bins;
}
