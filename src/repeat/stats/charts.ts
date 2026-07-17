import {
  TodayData, CardCountsData, FutureDueData,
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
