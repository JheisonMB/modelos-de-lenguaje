import { ERAS, EVENTS, GAPS, CANDIDATES, EVIDENCE, SOURCES, PARAMS, WAU, WAU_SOURCES, WAU_NOTE, COST } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (value, digits = 1) => value.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const int = (value) => value.toLocaleString('es');
const eraVar = (id) => `var(--e${id})`;
const MONTH_FMT = new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' });
const canHover = window.matchMedia('(hover: hover)').matches;

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function onResize(callback) {
  let frame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(callback);
  });
}

const toMonths = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return year * 12 + (month - 1) + (day ? (day - 1) / 31 : 0.5);
};
const yearFrac = (date) => {
  const [year, month] = date.split('-').map(Number);
  return year + (month - 1) / 12 + 0.04;
};
const monthLabel = (date) => {
  const [year, month] = date.split('-').map(Number);
  return MONTH_FMT.format(new Date(year, month - 1, 1));
};

/* ───────── tooltip ───────── */
const tooltip = $('#tooltip');
function showTooltip(event, title, detail) {
  tooltip.replaceChildren(el('b', null, title), el('span', null, detail));
  tooltip.hidden = false;
  const rect = event.currentTarget?.getBoundingClientRect?.();
  const x = event.clientX ?? (rect ? rect.left + rect.width / 2 : 0);
  const y = event.clientY ?? (rect ? rect.top : 0);
  const width = tooltip.offsetWidth;
  tooltip.style.left = `${Math.min(window.innerWidth - width - 12, Math.max(12, x - width / 2))}px`;
  tooltip.style.top = `${Math.max(12, y - tooltip.offsetHeight - 14)}px`;
}
const hideTooltip = () => { tooltip.hidden = true; };
function bindTooltip(node, title, detail) {
  node.addEventListener('pointermove', (event) => showTooltip(event, title, detail));
  node.addEventListener('pointerleave', hideTooltip);
  node.addEventListener('focus', (event) => showTooltip(event, title, detail));
  node.addEventListener('blur', hideTooltip);
}

/* ───────── timeline ───────── */
const TL_START = toMonths('2017-01');
const TL_END = toMonths('2027-01');
const tlPct = (date) => ((toMonths(date) - TL_START) / (TL_END - TL_START)) * 100;
const isNarrow = () => window.matchMedia('(max-width: 719.98px)').matches;

let filter = 'all';
let openAnchor = null;

function popMarkup(event) {
  const pop = el('div', 'tl-pop');
  pop.hidden = true;
  pop.append(el('p', 'tp-date', event.label), el('p', 'tp-title', event.title), el('p', 'tp-text', event.text));
  if (event.src) {
    const link = el('a', 'tp-src', 'fuente ↗');
    link.href = event.src;
    link.target = '_blank';
    link.rel = 'noopener';
    pop.append(link);
  }
  return pop;
}

function anchorFor(event, index) {
  const anchor = el('div', 'tl-anchor');
  const dot = el('button', 'tl-dot');
  dot.type = 'button';
  dot.dataset.index = index;
  dot.style.setProperty('--c', eraVar(event.era));
  if (event.key) dot.classList.add('is-key');
  dot.setAttribute('aria-label', `${event.label}: ${event.title}`);
  dot.setAttribute('aria-expanded', 'false');
  anchor.append(dot, popMarkup(event));
  return anchor;
}

function renderHorizontal(body) {
  const wrap = el('div', 'tl-hwrap');
  const erans = el('div', 'tl-erans');
  const plot = el('div', 'tl-plot');
  const xaxis = el('div', 'tl-xaxis');
  ERAS.forEach((era) => {
    const band = el('div', 'tl-band');
    band.style.left = `${tlPct(era.from)}%`;
    band.style.width = `${Math.max(0, tlPct(era.to) - tlPct(era.from))}%`;
    band.style.setProperty('--c', eraVar(era.id));
    plot.append(band);
    const number = el('p', 'tl-eran', String(era.id));
    number.style.left = `${(tlPct(era.from) + tlPct(era.to)) / 2}%`;
    erans.append(number);
  });
  plot.append(el('div', 'tl-axis'));
  for (let year = 2017; year <= 2026; year++) {
    const tick = el('p', 'tl-tick', String(year));
    tick.style.left = `${tlPct(`${year}-01`)}%`;
    xaxis.append(tick);
  }
  wrap.append(erans, plot, xaxis);
  body.append(wrap);

  const width = plot.clientWidth || 1000;
  const maxLanes = 5, laneGap = 40;
  const offsets = Array.from({ length: maxLanes }, (_, k) => (k - (maxLanes - 1) / 2) * laneGap);
  const laneOrder = offsets.map((_, k) => k).sort((a, b) => Math.abs(offsets[a]) - Math.abs(offsets[b]));
  const lastX = offsets.map(() => -Infinity);
  EVENTS.forEach((event, index) => {
    const cx = (tlPct(event.date) / 100) * width;
    let lane = laneOrder.find((k) => cx - lastX[k] >= 40);
    if (lane === undefined) lane = laneOrder[0];
    lastX[lane] = cx;
    const anchor = anchorFor(event, index);
    anchor.style.left = `${tlPct(event.date)}%`;
    anchor.style.top = `calc(50% + ${offsets[lane]}px)`;
    plot.append(anchor);
  });
}

function renderVertical(body) {
  const wrap = el('div', 'tl-vwrap');
  ERAS.forEach((era) => {
    const block = el('section', 'tve');
    block.style.setProperty('--c', eraVar(era.id));
    const head = el('div', 'tve-head');
    head.append(el('span', 'tve-num', String(era.id)), el('h3', 'tve-name', era.name), el('span', 'tve-yr', era.years));
    block.append(head);
    const list = el('ol', 'tve-list');
    EVENTS.filter((event) => event.era === era.id).forEach((event) => {
      const index = EVENTS.indexOf(event);
      const item = el('li', 'tve-item');
      item.append(anchorFor(event, index), el('p', 'tve-date', event.label), el('p', 'tve-title', event.title));
      list.append(item);
    });
    block.append(list);
    wrap.append(block);
  });
  body.append(wrap);
}

function clampPop(pop) {
  pop.style.setProperty('--dx', '0px');
  const bounds = $('#timeline').getBoundingClientRect();
  const rect = pop.getBoundingClientRect();
  let dx = 0;
  if (rect.left < bounds.left + 8) dx = bounds.left + 8 - rect.left;
  else if (rect.right > bounds.right - 8) dx = bounds.right - 8 - rect.right;
  pop.style.setProperty('--dx', `${Math.round(dx)}px`);
}

function closePop() {
  if (!openAnchor) return;
  $('.tl-dot', openAnchor).setAttribute('aria-expanded', 'false');
  $('.tl-pop', openAnchor).hidden = true;
  openAnchor = null;
}
function closePopIf(anchor) {
  if (openAnchor === anchor) closePop();
}

function openPop(anchor) {
  if (openAnchor && openAnchor !== anchor) closePop();
  const pop = $('.tl-pop', anchor);
  pop.hidden = false;
  $('.tl-dot', anchor).setAttribute('aria-expanded', 'true');
  openAnchor = anchor;
  clampPop(pop);
}

function bindDots() {
  $$('#tl-body .tl-anchor').forEach((anchor) => {
    const dot = $('.tl-dot', anchor);
    dot.addEventListener('click', (event) => { event.preventDefault(); openPop(anchor); });
    dot.addEventListener('focus', () => openPop(anchor));
    if (canHover) {
      anchor.addEventListener('pointerenter', () => openPop(anchor));
      anchor.addEventListener('pointerleave', () => closePopIf(anchor));
    }
    anchor.addEventListener('focusout', () => {
      requestAnimationFrame(() => { if (!anchor.contains(document.activeElement)) closePopIf(anchor); });
    });
  });
}

function applyFilter() {
  $$('#tl-body .tl-dot').forEach((dot) => {
    const event = EVENTS[Number(dot.dataset.index)];
    dot.classList.toggle('is-dim', filter !== 'all' && !event.tags.includes(filter));
  });
}

function renderTimeline() {
  closePop();
  const body = $('#tl-body');
  const narrow = isNarrow();
  body.replaceChildren();
  body.classList.toggle('tl-v', narrow);
  body.classList.toggle('tl-h', !narrow);
  if (narrow) renderVertical(body);
  else renderHorizontal(body);
  bindDots();
  applyFilter();
}

/* ───────── eras list ───────── */
function renderEras() {
  $('#eras').replaceChildren(...ERAS.map((era) => {
    const item = el('div', 'era-item');
    const swatch = el('span', 'era-sw');
    swatch.style.setProperty('--c', eraVar(era.id));
    const text = el('div');
    text.append(el('p', 'era-name', era.name), el('p', 'era-years', era.years), el('p', 'era-thesis', era.thesis));
    item.append(swatch, text);
    return item;
  }));
}

/* ───────── charts ───────── */
const CHART_DRAW = { params: drawParams, wau: drawWau, cost: drawCost, gap: drawGap };

function renderCharts() {
  const cards = [
    { key: 'params', title: 'Parámetros por modelo',
      src: 'Parámetros totales en millones, escala logarítmica (cada marca es ×10). El hueco punteado son los parámetros activos de una mezcla de expertos.' },
    { key: 'wau', title: 'Usuarios semanales de ChatGPT',
      src: WAU_SOURCES, note: WAU_NOTE },
    { key: 'cost', title: 'El costo de inferencia',
      src: COST.src },
    { key: 'gap', title: 'Brecha abierto–cerrado',
      src: 'Stanford HAI, AI Index 2025. Ventaja del líder sobre el siguiente en Chatbot Arena, en puntos porcentuales.' },
  ];
  $('#charts').replaceChildren(...cards.map((card) => {
    const figure = el('figure', 'chart-card');
    figure.dataset.chart = card.key;
    figure.append(el('h3', 'cc-title', card.title), el('div', 'cc-plot'));
    figure.append(el('p', 'cc-src', card.src));
    if (card.note) figure.append(el('p', 'cc-src cc-note', card.note));
    return figure;
  }));
  drawAllCharts();
}

function addMark(svg, attrs, title, detail) {
  const hit = svgEl('circle', { class: 'hit', cx: attrs.cx, cy: attrs.cy, r: (Number(attrs.r) || 5) + 6 });
  hit.setAttribute('tabindex', '0');
  const mark = svgEl('circle', attrs);
  mark.setAttribute('pointer-events', 'none');
  bindTooltip(hit, title, detail);
  svg.append(hit, mark);
}

function drawAllCharts() {
  $$('.chart-card').forEach((figure) => {
    const host = $('.cc-plot', figure);
    const width = Math.max(240, Math.round(host.clientWidth || 320));
    CHART_DRAW[figure.dataset.chart](host, width, 230);
  });
}

function drawParams(host, W, H) {
  host.replaceChildren();
  const m = { l: 58, r: 16, t: 14, b: 28 };
  const plotW = W - m.l - m.r, plotH = H - m.t - m.b;
  const x0 = 2017.6, x1 = 2026.95;
  const xOf = (date) => m.l + ((yearFrac(date) - x0) / (x1 - x0)) * plotW;
  const lo = Math.log10(80), hi = Math.log10(2.4e6);
  const yOf = (value) => m.t + (1 - (Math.log10(value) - lo) / (hi - lo)) * plotH;
  const svg = svgEl('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Parámetros de modelos de lenguaje en escala logarítmica' });

  for (const [value, label] of [[1e2, '100 M'], [1e3, '1 mil M'], [1e4, '10 mil M'], [1e5, '100 mil M'], [1e6, '1 billón']]) {
    const y = yOf(value);
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }));
    svg.append(svgEl('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end', class: 'lbl-muted' }, label));
  }
  svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: m.t + plotH, y2: m.t + plotH, class: 'axis' }));
  for (const year of [2018, 2020, 2022, 2024, 2026]) {
    svg.append(svgEl('text', { x: xOf(`${year}-01`), y: H - 8, 'text-anchor': 'middle', class: 'lbl-muted' }, String(year)));
  }
  PARAMS.forEach((point) => {
    const cx = xOf(point.date), cy = yOf(point.m);
    if (point.active) {
      const ay = yOf(point.active);
      svg.append(svgEl('line', { x1: cx, x2: cx, y1: cy, y2: ay, class: 'conn' }));
      addMark(svg, { class: 'mark', cx, cy: ay, r: 6, fill: 'none', stroke: 'var(--ink3)', 'stroke-width': 1.4, 'stroke-dasharray': '2 2' }, point.name, `${int(point.active)} M activos`);
    }
    const attrs = point.reported
      ? { class: 'mark', cx, cy, r: 6, fill: 'none', stroke: eraVar(point.era), 'stroke-width': 2.4, 'stroke-dasharray': '3 2' }
      : { class: 'mark', cx, cy, r: 6, fill: eraVar(point.era), stroke: 'var(--bg)', 'stroke-width': 2 };
    addMark(svg, attrs, point.name, `${int(point.m)} M${point.active ? ` · ${int(point.active)} M activos` : ''}${point.reported ? ' · autorreportado' : ''}`);
  });
  const first = PARAMS[0], last = PARAMS.at(-1);
  svg.append(svgEl('text', { x: xOf(first.date) + 10, y: yOf(first.m) - 8, class: 'lbl halo' }, first.name));
  svg.append(svgEl('text', { x: xOf(last.date) - 10, y: yOf(last.m) - 8, 'text-anchor': 'end', class: 'lbl halo' }, last.name));
  host.append(svg);
}

function drawWau(host, W, H) {
  host.replaceChildren();
  const m = { l: 56, r: 16, t: 16, b: 28 };
  const plotW = W - m.l - m.r, plotH = H - m.t - m.b;
  const domainStart = 2022.7, domainEnd = 2026.6;
  const xOf = (date) => m.l + ((yearFrac(date) - domainStart) / (domainEnd - domainStart)) * plotW;
  const yOf = (value) => m.t + (1 - value / 1000) * plotH;
  const svg = svgEl('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Usuarios activos semanales de ChatGPT, en millones' });
  for (const value of [0, 250, 500, 750, 1000]) {
    const y = yOf(value);
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }));
    svg.append(svgEl('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end', class: 'lbl-muted' }, value === 0 ? '0' : `${int(value)} M`));
  }
  svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: m.t + plotH, y2: m.t + plotH, class: 'axis' }));
  for (const year of [2023, 2024, 2025, 2026]) {
    svg.append(svgEl('text', { x: xOf(`${year}-01`), y: H - 8, 'text-anchor': 'middle', class: 'lbl-muted' }, String(year)));
  }
  const path = WAU.map((point, index) => `${index ? 'L' : 'M'}${xOf(point.date)} ${yOf(point.m)}`).join(' ');
  svg.append(svgEl('path', { d: path, fill: 'none', stroke: eraVar(3), 'stroke-width': 2 }));
  WAU.forEach((point) => {
    addMark(svg, { class: 'mark', cx: xOf(point.date), cy: yOf(point.m), r: 5, fill: eraVar(3), stroke: 'var(--bg)', 'stroke-width': 2 }, `${int(point.m)} M usuarios semanales`, monthLabel(point.date));
  });
  const first = WAU[0], last = WAU.at(-1);
  svg.append(svgEl('text', { x: xOf(first.date) + 8, y: yOf(first.m) - 9, class: 'lbl halo' }, `${int(first.m)} M · ${monthLabel(first.date)}`));
  svg.append(svgEl('text', { x: xOf(last.date) - 8, y: yOf(last.m) - 10, 'text-anchor': 'end', class: 'lbl halo' }, `${int(last.m)} M · ${monthLabel(last.date)}`));
  host.append(svg);
}

function drawCost(host) {
  host.replaceChildren();
  const lo = Math.log10(0.01), hi = Math.log10(100);
  const pct = (value) => ((Math.log10(value) - lo) / (hi - lo)) * 100;
  const word = (value) => `US$ ${fmt(value, value < 1 ? 2 : 0)}`;
  const big = (value, label) => {
    const node = el('div', 'cost-big', word(value));
    node.append(el('small', null, label));
    return node;
  };
  const pair = el('div', 'cost-pair');
  pair.append(big(COST.from.value, COST.from.label), el('div', 'cost-arrow', '→'), big(COST.to.value, COST.to.label));
  const track = (value, className, label) => {
    const node = el('div', 'log-track');
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', `${label}: ${word(value)} por millón de tokens`);
    const bar = el('div', `log-bar ${className}`);
    bar.style.width = `${pct(value)}%`;
    node.append(bar);
    bindTooltip(node, label, `${word(value)} por millón de tokens`);
    return node;
  };
  const scale = el('div', 'log-scale');
  for (const [value, label] of [[0.01, '0,01'], [0.1, '0,1'], [1, '1'], [10, '10'], [100, '100']]) {
    const tick = el('span', null, label);
    tick.style.left = `${pct(value)}%`;
    scale.append(tick);
  }
  const wrap = el('div', 'cost');
  wrap.append(
    pair,
    el('p', 'log-row', 'antes'), track(COST.from.value, 'from', COST.from.label),
    el('p', 'log-row', 'después'), track(COST.to.value, 'to', COST.to.label),
    scale,
    el('div', 'ratio', `${COST.ratio}× más barato · escala logarítmica (US$ por millón de tokens)`),
  );
  host.append(wrap);
}

function drawGap(host, W, H) {
  host.replaceChildren();
  const group = GAPS.arena;
  const legend = el('div', 'legend-inline');
  const beforeKey = el('span');
  beforeKey.append(el('i', 'dot-before'), document.createTextNode(` antes (${group.before})`));
  const afterKey = el('span');
  afterKey.append(el('i', 'dot-after'), document.createTextNode(` después (${group.after})`));
  legend.append(beforeKey, afterKey);

  const svgH = H - 26;
  const m = { l: 12, r: 26, t: 20, b: 26 };
  const plotW = W - m.l - m.r, plotH = svgH - m.t - m.b;
  const xOf = (value) => m.l + (value / group.max) * plotW;
  const svg = svgEl('svg', { class: 'chart', viewBox: `0 0 ${W} ${svgH}`, width: W, height: svgH, role: 'img', 'aria-label': group.title });
  for (let tick = 0; tick <= group.max; tick += 3) {
    const x = xOf(tick);
    svg.append(svgEl('line', { x1: x, x2: x, y1: m.t, y2: m.t + plotH, class: 'grid' }));
    svg.append(svgEl('text', { x, y: svgH - 8, 'text-anchor': 'middle', class: 'lbl-muted' }, String(tick)));
  }
  const rowH = plotH / group.rows.length;
  group.rows.forEach((row, index) => {
    const cy = m.t + rowH * index + rowH * 0.72;
    svg.append(svgEl('text', { x: m.l, y: cy - rowH * 0.42, class: 'lbl-strong' }, row.label));
    svg.append(svgEl('line', { x1: xOf(row.after), x2: xOf(row.before), y1: cy, y2: cy, class: 'conn-thick' }));
    addMark(svg, { class: 'mark', cx: xOf(row.before), cy, r: 6, fill: 'var(--ink3)', stroke: 'var(--bg)', 'stroke-width': 2 }, row.label, `antes: ${fmt(row.before)} % · ${group.before}`);
    addMark(svg, { class: 'mark', cx: xOf(row.after), cy, r: 6.5, fill: eraVar(5), stroke: 'var(--bg)', 'stroke-width': 2 }, row.label, `después: ${fmt(row.after)} % · ${group.after}`);
    svg.append(svgEl('text', { x: xOf(row.before), y: cy - 14, 'text-anchor': 'middle', class: 'lbl-muted halo' }, `${fmt(row.before)} %`));
    svg.append(svgEl('text', { x: xOf(row.after), y: cy - 14, 'text-anchor': 'middle', class: 'lbl-strong halo' }, `${fmt(row.after)} %`));
  });
  host.append(legend, svg);
}

/* ───────── dials ───────── */
function softmax(logits, temperature) {
  const scaled = logits.map((logit) => logit / temperature);
  const peak = Math.max(...scaled);
  const exps = scaled.map((value) => Math.exp(value - peak));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

function samplingDistribution() {
  const temperature = Number($('#t').value), topP = Number($('#p').value), topK = Number($('#k').value);
  const raw = softmax(CANDIDATES.map(([, logit]) => logit), temperature);
  let cumulative = 0;
  const kept = raw.map((probability, index) => {
    const keep = index < topK && cumulative < topP - 1e-9;
    cumulative += probability;
    return keep;
  });
  const keptTotal = raw.reduce((sum, probability, index) => sum + (kept[index] ? probability : 0), 0);
  return raw.map((probability, index) => ({ word: CANDIDATES[index][0], raw: probability, kept: kept[index], final: kept[index] ? probability / keptTotal : 0 }));
}

function renderBars() {
  $('#t-out').value = fmt(Number($('#t').value), 2);
  $('#p-out').value = fmt(Number($('#p').value), 2);
  $('#k-out').value = $('#k').value;
  const bars = $('#bars');
  const distribution = samplingDistribution();
  if (!bars.children.length) {
    for (const { word } of distribution) {
      const row = el('div', 'bar-row');
      const track = el('div', 'bar-track');
      track.append(el('div', 'bar-fill'));
      row.append(el('span', 'w', word), track, el('span', 'v'));
      bars.append(row);
    }
  }
  [...bars.children].forEach((row, index) => {
    const { kept, final, raw } = distribution[index];
    row.classList.toggle('is-cut', !kept);
    $('.bar-fill', row).style.width = `${(kept ? final : raw) * 100}%`;
    $('.v', row).textContent = kept ? `${Math.round(final * 100)}%` : 'fuera';
  });
}

function drawSamples() {
  const distribution = samplingDistribution();
  const samples = Array.from({ length: 12 }, () => {
    let threshold = Math.random();
    for (const { word, final } of distribution) {
      threshold -= final;
      if (threshold <= 0) return word;
    }
    return distribution.find(({ kept }) => kept).word;
  });
  $('#samples').replaceChildren(...samples.map((word, index) => {
    const chip = el('span', null, word);
    chip.style.animationDelay = `${index * 30}ms`;
    return chip;
  }));
}

function initDials() {
  for (const id of ['t', 'p', 'k']) $(`#${id}`).addEventListener('input', renderBars);
  $('#sample').addEventListener('click', drawSamples);
  renderBars();
  drawSamples();
}

/* ───────── loro ───────── */
const BEAM = { cx: 210, cy: 70, half: 150 };

function drawBalance() {
  const svg = $('#balance');
  svg.replaceChildren();
  svg.append(svgEl('path', { d: 'M196 196 L224 196 L214 72 L206 72 Z', fill: 'var(--border-strong)' }));
  svg.append(svgEl('rect', { x: 150, y: 194, width: 120, height: 6, rx: 3, fill: 'var(--ink3)' }));
  svg.append(svgEl('line', { class: 'beam', x1: BEAM.cx - BEAM.half, x2: BEAM.cx + BEAM.half, y1: BEAM.cy, y2: BEAM.cy, stroke: 'var(--ink)', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  svg.append(svgEl('circle', { cx: BEAM.cx, cy: BEAM.cy, r: 7, fill: 'var(--ink)' }));
  for (const side of ['parrot', 'beyond']) {
    const anchorX = side === 'parrot' ? BEAM.cx - BEAM.half : BEAM.cx + BEAM.half;
    const pan = svgEl('g', { class: 'pan', 'data-side': side });
    pan.append(svgEl('line', { x1: anchorX, x2: anchorX - 40, y1: BEAM.cy, y2: BEAM.cy + 62, stroke: 'var(--ink3)' }));
    pan.append(svgEl('line', { x1: anchorX, x2: anchorX + 40, y1: BEAM.cy, y2: BEAM.cy + 62, stroke: 'var(--ink3)' }));
    pan.append(svgEl('path', { d: `M${anchorX - 52} ${BEAM.cy + 62} Q${anchorX} ${BEAM.cy + 96} ${anchorX + 52} ${BEAM.cy + 62} Z`, fill: 'var(--surface-2)', stroke: 'var(--ink)', 'stroke-width': 2 }));
    pan.append(svgEl('g', { class: 'weights' }));
    pan.append(svgEl('text', { x: anchorX, y: BEAM.cy + 116, 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)', 'text-anchor': 'middle' }, side === 'parrot' ? 'Es un loro' : 'Hay algo más'));
    svg.append(pan);
  }
  updateBalance();
}

function updateBalance() {
  const active = (side) => $$(`.evd[data-side="${side}"][aria-pressed="true"]`).length;
  const parrot = active('parrot'), beyond = active('beyond');
  const angleDeg = Math.max(-16, Math.min(16, (parrot - beyond) * -5));
  const radians = (angleDeg * Math.PI) / 180;
  $('#balance .beam').style.transform = `rotate(${angleDeg}deg)`;
  for (const pan of $$('#balance .pan')) {
    const direction = pan.dataset.side === 'parrot' ? -1 : 1;
    const dx = direction * BEAM.half * (Math.cos(radians) - 1);
    const dy = direction * BEAM.half * Math.sin(radians);
    pan.style.transform = `translate(${dx}px, ${dy}px)`;
    const count = pan.dataset.side === 'parrot' ? parrot : beyond;
    const anchorX = pan.dataset.side === 'parrot' ? BEAM.cx - BEAM.half : BEAM.cx + BEAM.half;
    $('.weights', pan).replaceChildren(...Array.from({ length: count }, (_, index) =>
      svgEl('rect', { x: anchorX - 34 + index * 18, y: BEAM.cy + 50, width: 14, height: 12, rx: 2, fill: 'var(--ink)' })));
  }
  renderVerdict(parrot, beyond);
}

function renderVerdict(parrot, beyond) {
  const total = EVIDENCE.length;
  let title, body;
  if (parrot + beyond === 0) {
    title = '¿Hacia dónde se inclina?';
    body = 'Pulsa las tarjetas de evidencia. Cada una agrega peso a un lado del debate.';
  } else if (parrot + beyond === total) {
    title = 'No murió: se volvió más preciso';
    body = 'La versión fuerte, «no hay nada dentro, solo estadística de superficie», no resiste la evidencia de interpretabilidad: hay representaciones internas y planificación. La versión débil, «su razonamiento es frágil y su explicación no siempre es fiel a su cómputo», sigue abierta. La pregunta útil ya no es si el modelo entiende, sino dónde y cuándo se le puede confiar.';
  } else if (parrot > beyond) {
    title = 'Por ahora: loro';
    body = 'Con esta evidencia, la tesis de 2021 resiste: fallos que una comprensión real no cometería. Falta mirar el otro platillo.';
  } else if (beyond > parrot) {
    title = 'Por ahora: algo más que un loro';
    body = 'Con esta evidencia, hay estructura interna y planificación que la repetición no explica. Falta mirar el otro platillo.';
  } else {
    title = 'Empate parcial';
    body = `Llevas ${parrot + beyond} de ${total} evidencias. Activa el resto para ver el veredicto.`;
  }
  const head = el('div');
  head.append(el('p', 'vk', 'Veredicto'), el('p', 'vt', title));
  $('#verdict').replaceChildren(head, el('p', null, body));
}

function initParrot() {
  for (const side of ['parrot', 'beyond']) {
    $(`#ev-${side}`).replaceChildren(...EVIDENCE.filter((item) => item.side === side).map((item) => {
      const card = el('button', 'evd');
      card.type = 'button';
      card.dataset.side = side;
      card.setAttribute('aria-pressed', 'false');
      card.append(el('div', 't', item.title), el('div', 'm', item.meta), el('p', null, item.text));
      card.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
        updateBalance();
      });
      const wrapper = el('div');
      wrapper.append(card);
      if (item.src) {
        const link = el('a', 'evd-src', 'fuente ↗');
        link.href = item.src;
        link.target = '_blank';
        link.rel = 'noopener';
        wrapper.append(link);
      }
      return wrapper;
    }));
  }
  $('#ev-all').addEventListener('click', () => {
    const cards = $$('.evd');
    const allOn = cards.every((card) => card.getAttribute('aria-pressed') === 'true');
    cards.forEach((card) => card.setAttribute('aria-pressed', String(!allOn)));
    $('#ev-all').textContent = allOn ? 'Activar todas' : 'Desactivar todas';
    updateBalance();
  });
  drawBalance();
}

/* ───────── footer ───────── */
function renderSources() {
  $('#sources').replaceChildren(...SOURCES.map(([label, href]) => {
    const link = el('a', null, label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    const item = el('li');
    item.append(link);
    return item;
  }));
}

/* ───────── boot ───────── */
function setTopbarHeight() {
  document.documentElement.style.setProperty('--topbar-h', `${Math.round($('.topbar').offsetHeight)}px`);
}

function initTimeline() {
  $$('.filters .chip').forEach((chip) => chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    $$('.filters .chip').forEach((other) => {
      const active = other === chip;
      other.classList.toggle('is-active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    applyFilter();
    closePop();
  }));
  renderTimeline();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openAnchor) {
    const dot = $('.tl-dot', openAnchor);
    closePop();
    dot.focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (openAnchor && !openAnchor.contains(event.target)) closePop();
});

initTimeline();
renderEras();
renderCharts();
initDials();
initParrot();
renderSources();
setTopbarHeight();

const narrowQuery = window.matchMedia('(max-width: 719.98px)');
narrowQuery.addEventListener('change', renderTimeline);
onResize(() => {
  setTopbarHeight();
  renderTimeline();
  drawAllCharts();
});
