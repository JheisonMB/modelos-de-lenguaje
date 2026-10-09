import { ERAS, TAGS, EVENTS, PLAYERS, GAPS, CANDIDATES, EFFORT, CONTEXT, EVIDENCE, SOURCES } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (value, digits = 1) => value.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const eraColor = (eraId) => `var(--e${eraId})`;

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function htmlEl(tag, { className, text, attrs = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function onResize(callback) {
  let frame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(callback);
  });
}

/* ───────── tooltip ───────── */
const tooltip = $('#tooltip');
function showTooltip(event, title, detail) {
  tooltip.replaceChildren(htmlEl('b', { text: title }), htmlEl('span', { text: detail }));
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

/* ───────── theme ───────── */
function initTheme() {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('theme');
    if (saved) root.dataset.theme = saved;
  } catch { /* storage unavailable: follow the OS */ }
  $('#theme-toggle').addEventListener('click', () => {
    const isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* ignore */ }
    redrawCharts();
  });
}

/* ───────── 01 timeline ───────── */
const timeline = { filter: 'all', selected: 0 };
const toMonths = (date) => {
  const [year, month] = date.split('-').map(Number);
  return year * 12 + (month - 1) + (date.split('-')[2] ? Number(date.split('-')[2]) / 31 : 0.5);
};
const isVisible = (event) => timeline.filter === 'all' || event.tags.includes(timeline.filter);

function renderEras() {
  const container = $('#eras');
  container.replaceChildren();
  for (const era of ERAS) {
    const meta = htmlEl('div', { className: 'era-meta' }, [
      htmlEl('div', { className: 'era-num', text: `Etapa ${era.id}` }),
      htmlEl('div', { className: 'era-name', text: era.name }),
      htmlEl('div', { className: 'era-years', text: era.years }),
      htmlEl('div', { className: 'era-thesis', text: era.thesis }),
    ]);
    const events = htmlEl('div', { className: 'events' });
    EVENTS.forEach((event, index) => {
      if (event.era !== era.id) return;
      const tags = htmlEl('div', { className: 'tags' }, event.tags.map((tag) =>
        htmlEl('span', { className: `tag ${tag}`, text: TAGS[tag] })));
      const date = htmlEl('div', { className: 'd' }, [document.createTextNode(event.label)]);
      if (event.key) date.append(htmlEl('span', { className: 'star', text: '★ clave', attrs: { 'aria-label': 'hito clave' } }));
      const card = htmlEl('button', { className: `ev${event.key ? ' key' : ''}`, attrs: { type: 'button', 'data-index': index } }, [
        date,
        htmlEl('h4', { text: event.title }),
        htmlEl('p', { text: event.text }),
      ]);
      if (event.tags.length) card.append(tags);
      card.addEventListener('click', () => selectEvent(index));
      events.append(card);
    });
    const section = htmlEl('section', { className: 'era', attrs: { style: `--c:${eraColor(era.id)}`, 'data-era': era.id } }, [meta, events]);
    container.append(section);
  }
}

function drawRail() {
  const svg = $('#rail');
  svg.replaceChildren();
  const width = Math.max(760, svg.clientWidth);
  const height = 118, pad = 18, mid = 50;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const start = toMonths('2017-01'), end = toMonths('2027-01');
  const x = (date) => pad + ((toMonths(date) - start) / (end - start)) * (width - pad * 2);

  for (const era of ERAS) {
    const x0 = x(era.from), x1 = x(era.to);
    svg.append(svgEl('rect', { x: x0, y: mid - 26, width: Math.max(0, x1 - x0 - 2), height: 52, rx: 6, fill: eraColor(era.id), 'fill-opacity': 0.13 }));
    svg.append(svgEl('rect', { x: x0, y: mid - 26, width: Math.max(0, x1 - x0 - 2), height: 3, rx: 1.5, fill: eraColor(era.id) }));
  }
  svg.append(svgEl('line', { x1: pad, x2: width - pad, y1: mid, y2: mid, stroke: 'var(--border-strong)', 'stroke-width': 1 }));
  for (let year = 2017; year <= 2026; year++) {
    const tx = x(`${year}-01`);
    svg.append(svgEl('line', { x1: tx, x2: tx, y1: mid + 26, y2: mid + 32, stroke: 'var(--ink4)' }));
    svg.append(svgEl('text', { x: tx + 3, y: mid + 46, 'font-size': 12, 'font-family': 'DM Mono', fill: 'var(--ink3)' }, String(year)));
  }

  const laneOffsets = [0, -15, 15];
  const laneLastX = [-Infinity, -Infinity, -Infinity];
  EVENTS.forEach((event, index) => {
    const cx = x(event.date);
    const lane = laneOffsets.findIndex((_, laneIndex) => cx - laneLastX[laneIndex] > 15);
    const chosenLane = lane === -1 ? 0 : lane;
    laneLastX[chosenLane] = cx;
    const group = svgEl('g', { class: 'ev-dot', tabindex: 0, role: 'button', 'aria-label': `${event.label}: ${event.title}`, 'data-index': index });
    group.append(svgEl('circle', { cx, cy: mid + laneOffsets[chosenLane], r: 14, fill: 'transparent' }));
    group.append(svgEl('circle', { class: 'mark', cx, cy: mid + laneOffsets[chosenLane], r: event.key ? 7 : 5, fill: eraColor(event.era), stroke: 'var(--surface)', 'stroke-width': 2 }));
    group.addEventListener('click', () => selectEvent(index));
    group.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); selectEvent(index); }
    });
    bindTooltip(group, event.title, `${event.label} · ${event.who}`);
    svg.append(group);
  });
  applyFilter();
}

function renderDetail() {
  const event = EVENTS[timeline.selected];
  const detail = $('#detail');
  detail.style.setProperty('--c', eraColor(event.era));
  const era = ERAS.find((candidate) => candidate.id === event.era);
  const children = [
    htmlEl('div', { className: 'd', text: `${event.label} · Etapa ${era.id}: ${era.name}` }),
    htmlEl('h3', { text: event.title }),
    htmlEl('div', { className: 'who', text: event.who }),
    htmlEl('p', { text: event.text }),
    htmlEl('div', { className: 'why-label', text: 'Por qué importa' }),
    htmlEl('p', { className: 'why', text: event.why }),
  ];
  if (event.tags.length) {
    children.push(htmlEl('div', { className: 'tags' }, event.tags.map((tag) => htmlEl('span', { className: `tag ${tag}`, text: TAGS[tag] }))));
  }
  if (event.src) {
    children.push(htmlEl('a', { className: 'src', text: 'Ver fuente ↗', attrs: { href: event.src, target: '_blank', rel: 'noopener' } }));
  }
  const prev = htmlEl('button', { className: 'btn', text: '← Anterior', attrs: { type: 'button' } });
  const next = htmlEl('button', { className: 'btn', text: 'Siguiente →', attrs: { type: 'button' } });
  prev.addEventListener('click', () => stepEvent(-1));
  next.addEventListener('click', () => stepEvent(1));
  children.push(htmlEl('div', { className: 'nav' }, [prev, next]));
  detail.replaceChildren(...children);
}

function stepEvent(direction) {
  const visible = EVENTS.map((event, index) => (isVisible(event) ? index : -1)).filter((index) => index >= 0);
  const position = visible.indexOf(timeline.selected);
  const nextPosition = (position + direction + visible.length) % visible.length;
  selectEvent(visible[nextPosition]);
}

function selectEvent(index) {
  timeline.selected = index;
  $$('.ev').forEach((card) => card.classList.toggle('is-selected', Number(card.dataset.index) === index));
  $$('#rail .ev-dot').forEach((dot) => dot.classList.toggle('is-selected', Number(dot.dataset.index) === index));
  renderDetail();
}

function applyFilter() {
  $$('.ev').forEach((card) => card.classList.toggle('is-hidden', !isVisible(EVENTS[card.dataset.index])));
  $$('.era').forEach((era) => era.classList.toggle('is-empty', !$$('.ev:not(.is-hidden)', era).length));
  $$('#rail .ev-dot').forEach((dot) => dot.classList.toggle('is-dim', !isVisible(EVENTS[dot.dataset.index])));
  if (!isVisible(EVENTS[timeline.selected])) {
    timeline.selected = EVENTS.findIndex(isVisible);
  }
  selectEvent(timeline.selected);
}

function initTimeline() {
  renderEras();
  drawRail();
  $$('.filters .chip').forEach((chip) => chip.addEventListener('click', () => {
    timeline.filter = chip.dataset.filter;
    $$('.filters .chip').forEach((other) => other.classList.toggle('is-active', other === chip));
    applyFilter();
  }));
}

/* ───────── 02 players + gaps ───────── */
function drawPlayersAxis() {
  const svg = $('#players-axis');
  svg.replaceChildren();
  const width = svg.clientWidth || 480, height = 96, pad = 24, base = 74;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const x = (year) => pad + ((year - 2009) / (2024.5 - 2009)) * (width - pad * 2);
  svg.append(svgEl('line', { x1: pad, x2: width - pad, y1: base, y2: base, stroke: 'var(--border-strong)' }));
  for (const year of [2010, 2015, 2020, 2023]) {
    svg.append(svgEl('text', { x: x(year), y: base + 18, 'font-size': 11, 'font-family': 'DM Mono', fill: 'var(--ink3)', 'text-anchor': 'middle' }, String(year)));
  }
  const chatgpt = x(2022.9);
  svg.append(svgEl('line', { x1: chatgpt, x2: chatgpt, y1: 6, y2: base, stroke: 'var(--ink3)', 'stroke-dasharray': '3 3' }));
  svg.append(svgEl('text', { x: chatgpt - 6, y: 14, 'font-size': 11, fill: 'var(--ink3)', 'text-anchor': 'end' }, 'ChatGPT ▸'));

  const stacks = new Map();
  for (const player of PLAYERS) {
    const level = stacks.get(player.year) ?? 0;
    stacks.set(player.year, level + 1);
    const cx = x(player.year + 0.5), cy = base - 9 - level * 11;
    const dot = svgEl('circle', { cx, cy, r: 5, fill: 'var(--ink)', stroke: 'var(--surface)', 'stroke-width': 2, tabindex: 0 });
    bindTooltip(dot, player.name, `${player.year} · ${player.models}`);
    svg.append(dot);
    if (player.year !== 2023) {
      svg.append(svgEl('text', { x: cx, y: cy - 10, 'font-size': 11.5, fill: 'var(--ink2)', 'text-anchor': 'middle' }, player.name.split(' ')[0]));
    }
  }
  const count2023 = stacks.get(2023) ?? 0;
  svg.append(svgEl('text', { x: x(2023.5) + 12, y: base - 30, 'font-size': 12, 'font-weight': 600, fill: 'var(--ink)' }, `×${count2023}`));
}

function renderRoster() {
  $('#roster').replaceChildren(...PLAYERS.map((player) => htmlEl('div', { className: 'player' }, [
    htmlEl('span', { className: `y${player.year === 2023 ? ' y23' : ''}`, text: String(player.year) }),
    htmlEl('div', {}, [htmlEl('b', { text: player.name }), htmlEl('span', { text: `${player.models} · ${player.country}` })]),
  ])));
}

const gapCharts = [];
function drawGaps() {
  const container = $('#gaps');
  container.replaceChildren();
  gapCharts.length = 0;
  const width = container.clientWidth || 480;
  for (const group of Object.values(GAPS)) {
    container.append(htmlEl('div', { className: 'gap-title', text: `${group.title} · ${group.before} → ${group.after}` }));
    const compact = width < 520;
    const rowHeight = compact ? 46 : 32, labelWidth = compact ? 34 : Math.min(150, width * 0.34), right = 40, top = 6;
    const height = top + group.rows.length * rowHeight + 22;
    const svg = svgEl('svg', { class: 'gap-svg', viewBox: `0 0 ${width} ${height}`, height });
    const x = (value) => labelWidth + (value / group.max) * (width - labelWidth - right);
    for (let tick = 0; tick <= group.max; tick += group.max / 4) {
      svg.append(svgEl('line', { x1: x(tick), x2: x(tick), y1: top, y2: height - 20, stroke: 'var(--border)' }));
      svg.append(svgEl('text', { x: x(tick), y: height - 6, 'font-size': 10.5, 'font-family': 'DM Mono', fill: 'var(--ink4)', 'text-anchor': 'middle' }, fmt(tick, 0)));
    }
    group.rows.forEach((row, index) => {
      const rowCenter = top + index * rowHeight + rowHeight / 2;
      const cy = compact ? rowCenter + 8 : rowCenter;
      const rowGroup = svgEl('g', { class: 'row', tabindex: 0 });
      rowGroup.append(svgEl('rect', { class: 'row-bg', x: 0, y: rowCenter - rowHeight / 2 + 2, width, height: rowHeight - 4, rx: 6, fill: 'transparent' }));
      rowGroup.append(svgEl('text', { x: 4, y: compact ? cy - 12 : cy + 4, 'font-size': 13, fill: 'var(--ink2)' }, row.label));
      const connector = svgEl('line', { class: 'connector', x1: x(row.after), x2: x(row.before), y1: cy, y2: cy, stroke: 'var(--border-strong)', 'stroke-width': 2 });
      rowGroup.append(connector);
      rowGroup.append(svgEl('circle', { cx: x(row.before), cy, r: 6, fill: 'var(--before)', stroke: 'var(--surface)', 'stroke-width': 2 }));
      rowGroup.append(svgEl('text', { x: x(row.before) + 10, y: cy + 4, 'font-size': 11.5, 'font-family': 'DM Mono', fill: 'var(--ink3)' }, fmt(row.before)));
      const afterDot = svgEl('circle', { cx: x(row.after), cy, r: 6, fill: 'var(--after)', stroke: 'var(--surface)', 'stroke-width': 2 });
      const afterLabel = svgEl('text', { x: Math.max(x(row.after) - 10, 30), y: cy + 4, 'font-size': 11.5, 'font-family': 'DM Mono', 'font-weight': 500, fill: 'var(--ink)', 'text-anchor': 'end' }, fmt(row.after));
      rowGroup.append(afterDot, afterLabel);
      bindTooltip(rowGroup, `${fmt(row.before)} → ${fmt(row.after)}`, `${row.label} · se redujo ${fmt(row.before - row.after)}`);
      svg.append(rowGroup);
      gapCharts.push({ row, x, afterDot, afterLabel, connector });
    });
    container.append(svg);
  }
}

function playGaps() {
  const duration = 1400, startTime = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const progress = ease(Math.min(1, (now - startTime) / duration));
    for (const { row, x, afterDot, afterLabel, connector } of gapCharts) {
      const value = row.before + (row.after - row.before) * progress;
      afterDot.setAttribute('cx', x(value));
      afterLabel.setAttribute('x', Math.max(x(value) - 10, 30));
      afterLabel.textContent = fmt(value);
      connector.setAttribute('x1', x(value));
    }
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ───────── 03 dials ───────── */
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
      bars.append(htmlEl('div', { className: 'bar-row' }, [
        htmlEl('span', { className: 'w', text: word }),
        htmlEl('div', { className: 'bar-track' }, [htmlEl('div', { className: 'bar-fill' })]),
        htmlEl('span', { className: 'v' }),
      ]));
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
    const chip = htmlEl('span', { text: word });
    chip.style.animationDelay = `${index * 30}ms`;
    return chip;
  }));
}

function renderEffort(level) {
  const data = EFFORT.levels[level];
  $$('.segmented button').forEach((button) => button.setAttribute('aria-checked', String(button.dataset.effort === level)));
  $('#effort-q').textContent = EFFORT.question;
  const thinking = data.thinking.length
    ? data.thinking.map((line, index) => {
      const item = htmlEl('li', { text: line });
      item.style.animationDelay = `${index * 120}ms`;
      return item;
    })
    : [htmlEl('li', { className: 'none', text: 'Sin pensamiento: responde de inmediato.' })];
  $('#effort-thinking').replaceChildren(...thinking);
  $('#effort-answer').replaceChildren(
    document.createTextNode('Respuesta: '),
    htmlEl('b', { text: data.answer }),
    htmlEl('span', { className: data.correct ? 'ok' : 'bad', text: data.correct ? '✓ correcta' : '✗ incorrecta' }),
  );
  $('#effort-meter').style.width = `${Math.max(2, (data.tokens / 240) * 100)}%`;
  $('#effort-meta').textContent = `≈ ${data.tokens} · ${data.seconds}`;
}

function renderContext() {
  const container = $('#context');
  const logMin = Math.log10(256), logMax = Math.log10(1_000_000);
  container.replaceChildren(...CONTEXT.map((model) => {
    const column = htmlEl('div', { className: 'col' });
    column.dataset.height = `${8 + ((Math.log10(model.tokens) - logMin) / (logMax - logMin)) * 120}px`;
    column.style.height = '0px';
    const wrapper = htmlEl('div', { className: 'ctx-col', attrs: { tabindex: 0 } }, [
      htmlEl('b', { text: model.label }), column, htmlEl('span', { text: model.name }), htmlEl('span', { text: String(model.year) }),
    ]);
    bindTooltip(wrapper, `${model.tokens.toLocaleString('es')} tokens`, `${model.name} · ${model.year}`);
    return wrapper;
  }));
  const grow = () => $$('.col', container).forEach((column) => { column.style.height = column.dataset.height; });
  if (!('IntersectionObserver' in window)) return grow();
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { grow(); observer.disconnect(); }
  }, { threshold: 0.3 });
  observer.observe(container);
}

function initDials() {
  for (const id of ['t', 'p', 'k']) $(`#${id}`).addEventListener('input', renderBars);
  $('#sample').addEventListener('click', drawSamples);
  $$('.segmented button').forEach((button) => button.addEventListener('click', () => renderEffort(button.dataset.effort)));
  renderBars();
  drawSamples();
  renderEffort('medium');
  renderContext();
}

/* ───────── 04 parrot ───────── */
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
  const angle = Math.max(-16, Math.min(16, (parrot - beyond) * -5));
  const radians = (angle * Math.PI) / 180;
  $('#balance .beam').style.transform = `rotate(${angle}deg)`;
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
  $('#verdict').replaceChildren(
    htmlEl('div', {}, [htmlEl('div', { className: 'vk', text: 'Veredicto' }), htmlEl('div', { className: 'vt', text: title })]),
    htmlEl('p', { text: body }),
  );
}

function initParrot() {
  for (const side of ['parrot', 'beyond']) {
    $(`#ev-${side}`).replaceChildren(...EVIDENCE.filter((item) => item.side === side).map((item) => {
      const children = [htmlEl('div', { className: 't', text: item.title }), htmlEl('div', { className: 'm', text: item.meta }), htmlEl('p', { text: item.text })];
      const card = htmlEl('button', { className: 'evd', attrs: { type: 'button', 'aria-pressed': 'false', 'data-side': side } }, children);
      card.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
        updateBalance();
      });
      const wrapper = htmlEl('div', {}, [card]);
      if (item.src) wrapper.append(htmlEl('a', { className: 'evd-src', text: 'fuente ↗', attrs: { href: item.src, target: '_blank', rel: 'noopener' } }));
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

/* ───────── footer + nav ───────── */
function renderSources() {
  $('#sources').replaceChildren(...SOURCES.map(([label, href]) =>
    htmlEl('li', {}, [htmlEl('a', { text: label, attrs: { href, target: '_blank', rel: 'noopener' } })])));
}

function initNavHighlight() {
  if (!('IntersectionObserver' in window)) return;
  const links = $$('.nav-links a');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((link) => link.classList.toggle('is-current', link.getAttribute('href') === `#${entry.target.id}`));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((section) => observer.observe(section));
}

function redrawCharts() {
  drawRail();
  drawPlayersAxis();
  drawGaps();
}

initTheme();
initTimeline();
drawPlayersAxis();
renderRoster();
drawGaps();
$('#gap-play').addEventListener('click', playGaps);
initDials();
initParrot();
renderSources();
initNavHighlight();
onResize(redrawCharts);
