const data = window.BACKTEST_DATA;
const tooltip = document.getElementById("tooltip");
const SVG_NS = "http://www.w3.org/2000/svg";

const palette = ["#167c62", "#b0791c", "#3f6f9f", "#b3261e", "#6f5c9d", "#4b7d39", "#9f5d3f"];

function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== null && value !== undefined) node.setAttribute(key, value);
  });
  children.forEach((child) => node.appendChild(child));
  return node;
}

function el(tag, attrs = {}, text = "") {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  });
  if (text !== "") node.textContent = text;
  return node;
}

function fmtPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function fmtPctPlain(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtHit(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return value >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`;
}

function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(digits);
}

function signClass(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "value-zero";
  return value > 0 ? "value-positive" : "value-negative";
}

function fmtDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function showTooltip(html, event) {
  tooltip.innerHTML = html;
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
  tooltip.style.opacity = "1";
}

function hideTooltip() {
  tooltip.style.opacity = "0";
}

function linearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = (value) => r0 + ((value - d0) / span) * (r1 - r0);
  scale.invert = (value) => d0 + ((value - r0) / (r1 - r0)) * span;
  return scale;
}

function logScale(domain, range) {
  const safeDomain = [Math.max(domain[0], 0.000001), Math.max(domain[1], 0.000002)];
  const [d0, d1] = safeDomain.map(Math.log);
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value) => r0 + ((Math.log(Math.max(value, 0.000001)) - d0) / span) * (r1 - r0);
}

function valueExtent(values, options = {}) {
  const clean = values.filter((value) => value !== null && value !== undefined && Number.isFinite(value));
  if (!clean.length) return [0, 1];
  let min = Math.min(...clean);
  let max = Math.max(...clean);
  if (options.includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const nudge = Math.abs(min) || 1;
    min -= nudge * 0.1;
    max += nudge * 0.1;
  }
  const pad = (max - min) * (options.pad ?? 0.08);
  return [min - pad, max + pad];
}

function niceTicks(domain, count = 5) {
  const [min, max] = domain;
  const ticks = [];
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ticks;
  if (count <= 1) return [min];
  for (let i = 0; i < count; i += 1) {
    ticks.push(min + ((max - min) * i) / (count - 1));
  }
  return ticks;
}

function yearTicks(points, stepOverride) {
  const start = new Date(`${points[0].date}T00:00:00`);
  const end = new Date(`${points[points.length - 1].date}T00:00:00`);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const span = endYear - startYear;
  const step = stepOverride || (span > 18 ? 4 : span > 10 ? 3 : span > 5 ? 2 : 1);
  const first = Math.ceil(startYear / step) * step;
  const ticks = [];
  for (let year = first; year <= endYear; year += step) {
    ticks.push({ label: String(year), value: new Date(`${year}-01-01T00:00:00`).getTime() });
  }
  return ticks;
}

function pathFromPoints(points, xScale, yScale, xKey = "x", yKey = "y") {
  let path = "";
  let started = false;
  points.forEach((point) => {
    const x = xScale(point[xKey]);
    const yValue = point[yKey];
    if (yValue === null || yValue === undefined || !Number.isFinite(yValue)) {
      started = false;
      return;
    }
    const y = yScale(yValue);
    path += `${started ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    started = true;
  });
  return path;
}

function appendAxisLabel(root, text, x, y, rotate = false) {
  root.appendChild(
    svg("text", {
      class: "axis-label",
      x,
      y,
      "text-anchor": "middle",
      transform: rotate ? `rotate(-90 ${x} ${y})` : null,
    }, [document.createTextNode(text)])
  );
}

function textNode(text) {
  return document.createTextNode(text);
}

function addText(root, text, attrs) {
  root.appendChild(svg("text", attrs, [textNode(text)]));
}

function drawHorizontalGrid(root, yScale, ticks, plot, formatter) {
  ticks.forEach((tick) => {
    const y = yScale(tick);
    root.appendChild(svg("line", { class: "grid-line", x1: plot.left, x2: plot.right, y1: y, y2: y }));
    addText(root, formatter(tick), {
      class: "axis",
      x: plot.left - 8,
      y: y + 4,
      "text-anchor": "end",
    });
  });
}

function drawVerticalGrid(root, xScale, ticks, plot) {
  ticks.forEach((tick) => {
    const x = xScale(tick.value);
    root.appendChild(svg("line", { class: "grid-line", x1: x, x2: x, y1: plot.top, y2: plot.bottom }));
    addText(root, tick.label, {
      class: "axis",
      x,
      y: plot.bottom + 22,
      "text-anchor": "middle",
    });
  });
}

function signalTooltip(signal, extra = "") {
  const resultLine = data.horizons
    .filter((horizon) => signal.values[horizon] !== null && signal.values[horizon] !== undefined)
    .map((horizon) => `${horizon}: ${fmtPct(signal.values[horizon])}`)
    .join(" | ");
  return `<strong>${fmtDate(signal.date)}</strong>
    ${data.assetName}: ${fmtPrice(signal.asset)}<br>
    ${data.indicatorName}: ${fmtNumber(signal.indicator, 3)}<br>
    ${extra}
    ${resultLine ? `<br>${resultLine}` : ""}`;
}

function renderHeader() {
  document.getElementById("study-title").textContent = data.title;
  document.getElementById("ai-description").textContent = data.aiDescription;
  document.getElementById("trigger-title").textContent = `${data.assetName} and ${data.indicatorName} with signal triggers`;

  const meta = document.getElementById("study-meta");
  meta.replaceChildren(
    el("span", { class: "meta-pill" }, `${data.assetName} asset`),
    el("span", { class: "meta-pill" }, `${data.indicatorName} trigger`),
    el("span", { class: "meta-pill" }, `${fmtDate(data.dateRange.start)} - ${fmtDate(data.dateRange.end)}`),
    el("span", { class: "meta-pill" }, `${data.dateRange.tradingDays.toLocaleString()} trading days`)
  );
}

function renderCards() {
  const grid = document.getElementById("summary-cards");
  grid.replaceChildren();
  data.cards.forEach((card) => {
    const node = el("div", { class: `stat-card card-${card.kind}` });
    node.appendChild(el("div", { class: "stat-label" }, card.label));

    let valueText = "";
    let detailText = "";
    let valueClass = "stat-value";
    if (card.kind === "count") {
      valueText = String(card.value);
      detailText = card.detail;
    } else if (card.kind === "medianReturn") {
      valueText = fmtPct(card.value);
      detailText = `n=${card.sampleSize}; all-day median ${fmtPct(card.baseline)}`;
      valueClass += ` ${signClass(card.value)}`;
      if (card.value > card.baseline) valueClass += " stat-value-benchmark";
    } else if (card.kind === "hitRate") {
      valueText = fmtHit(card.value);
      detailText = `n=${card.sampleSize}; all-day hit ${fmtHit(card.baseline)}`;
      if (card.value > card.baseline) valueClass += " stat-value-benchmark";
    } else {
      valueText = fmtPct(card.value);
      detailText = `median ${fmtPct(card.median)}; n=${card.sampleSize}`;
    }

    node.appendChild(el("div", { class: valueClass }, valueText));
    node.appendChild(el("div", { class: "stat-detail" }, detailText));
    grid.appendChild(node);
  });
}

function renderTriggerChart() {
  const container = document.getElementById("trigger-chart");
  const width = 1160;
  const height = 620;
  const margin = { top: 28, right: 24, bottom: 44, left: 78 };
  const gap = 40;
  const panelHeight = (height - margin.top - margin.bottom - gap) / 2;
  const topPlot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: margin.top + panelHeight };
  const bottomPlot = { left: margin.left, right: width - margin.right, top: topPlot.bottom + gap, bottom: topPlot.bottom + gap + panelHeight };
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Asset and trigger series with signal markers" });

  const timed = data.series.map((point) => ({ ...point, time: new Date(`${point.date}T00:00:00`).getTime() }));
  const xDomain = [timed[0].time, timed[timed.length - 1].time];
  const xScale = linearScale(xDomain, [topPlot.left, topPlot.right]);
  const assetDomain = valueExtent(timed.map((point) => point.asset).filter((value) => value > 0), { pad: 0.04 });
  const indicatorDomain = valueExtent(timed.map((point) => point.indicator).filter((value) => value > 0), { pad: 0.04 });
  const assetY = logScale(assetDomain, [topPlot.bottom, topPlot.top]);
  const indicatorY = logScale(indicatorDomain, [bottomPlot.bottom, bottomPlot.top]);
  const ticks = yearTicks(data.series);

  drawVerticalGrid(root, xScale, ticks, { ...topPlot, bottom: bottomPlot.bottom });
  drawHorizontalGrid(root, assetY, niceTicks(assetDomain, 3), topPlot, (value) => value >= 100 ? value.toFixed(0) : value.toFixed(1));
  drawHorizontalGrid(root, indicatorY, niceTicks(indicatorDomain, 3), bottomPlot, (value) => value.toFixed(2));

  [topPlot, bottomPlot].forEach((plot) => {
    root.appendChild(svg("rect", {
      x: plot.left,
      y: plot.top,
      width: plot.right - plot.left,
      height: plot.bottom - plot.top,
      fill: "none",
      stroke: "#aeb7aa",
      "stroke-width": 1,
    }));
  });

  root.appendChild(svg("path", {
    d: pathFromPoints(timed, xScale, assetY, "time", "asset"),
    fill: "none",
    stroke: "#151515",
    "stroke-width": 1.8,
  }));
  root.appendChild(svg("path", {
    d: pathFromPoints(timed, xScale, indicatorY, "time", "indicator"),
    fill: "none",
    stroke: "#151515",
    "stroke-width": 1.8,
  }));

  data.signals.forEach((signal) => {
    const time = new Date(`${signal.date}T00:00:00`).getTime();
    const x = xScale(time);
    [
      { y: assetY(signal.asset), panel: "asset" },
      { y: indicatorY(signal.indicator), panel: "indicator" },
    ].forEach(({ y, panel }) => {
      const circle = svg("circle", {
        cx: x,
        cy: y,
        r: 7,
        fill: "#ff1d18",
        stroke: "#9d0000",
        "stroke-width": 1.4,
        tabindex: 0,
      });
      circle.addEventListener("mousemove", (event) => showTooltip(signalTooltip(signal, panel === "asset" ? "" : ""), event));
      circle.addEventListener("mouseleave", hideTooltip);
      root.appendChild(circle);
    });
  });

  addText(root, data.assetName, { class: "axis-label", x: 18, y: (topPlot.top + topPlot.bottom) / 2, "text-anchor": "middle", transform: `rotate(-90 18 ${(topPlot.top + topPlot.bottom) / 2})` });
  addText(root, data.indicatorName, { class: "axis-label", x: 18, y: (bottomPlot.top + bottomPlot.bottom) / 2, "text-anchor": "middle", transform: `rotate(-90 18 ${(bottomPlot.top + bottomPlot.bottom) / 2})` });
  addText(root, "Date", { class: "axis-label", x: (bottomPlot.left + bottomPlot.right) / 2, y: height - 8, "text-anchor": "middle" });

  const legend = svg("g", { class: "legend", transform: `translate(${topPlot.left + 12} ${topPlot.top + 18})` });
  legend.appendChild(svg("line", { x1: 0, x2: 28, y1: 0, y2: 0, stroke: "#151515", "stroke-width": 2 }));
  addText(legend, data.assetName, { x: 40, y: 5 });
  legend.appendChild(svg("circle", { cx: 15, cy: 30, r: 7, fill: "#ff1d18", stroke: "#9d0000", "stroke-width": 1.4 }));
  addText(legend, "Signal", { x: 40, y: 35 });
  root.appendChild(legend);

  container.replaceChildren(root);
}

function comparisonDomain(keyA, keyB, includeZero = true) {
  return valueExtent(data.comparison.flatMap((point) => [point[keyA], point[keyB]]), { includeZero, pad: 0.14 });
}

function renderComboChart(containerId, options) {
  const container = document.getElementById(containerId);
  const width = 760;
  const height = 330;
  const margin = { top: 22, right: 36, bottom: 56, left: 64 };
  const plot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": options.label });

  const domain = options.domain;
  const yScale = linearScale(domain, [plot.bottom, plot.top]);
  const xStep = (plot.right - plot.left) / data.comparison.length;
  const barWidth = Math.min(46, xStep * 0.48);
  const zeroY = yScale(0);

  drawHorizontalGrid(root, yScale, niceTicks(domain, 5), plot, options.formatter);
  root.appendChild(svg("line", { class: "axis-line", x1: plot.left, x2: plot.right, y1: zeroY, y2: zeroY }));

  const linePoints = [];
  data.comparison.forEach((point, idx) => {
    const x = plot.left + xStep * idx + xStep / 2;
    const barValue = point[options.barKey];
    const lineValue = point[options.lineKey];
    const y = yScale(barValue);
    const bar = svg("rect", {
      x: x - barWidth / 2,
      y: Math.min(y, zeroY),
      width: barWidth,
      height: Math.max(2, Math.abs(y - zeroY)),
      rx: 3,
      fill: barValue >= 0 ? "#167c62" : "#d84235",
    });
    bar.addEventListener("mousemove", (event) => showTooltip(
      `<strong>${point.horizon}</strong>Signal: ${options.formatter(barValue)}<br>All days: ${options.formatter(lineValue)}<br>n=${point.signalCount}`,
      event
    ));
    bar.addEventListener("mouseleave", hideTooltip);
    root.appendChild(bar);

    if (lineValue !== null && lineValue !== undefined) {
      linePoints.push({ x, y: lineValue, horizon: point.horizon, signal: barValue, signalCount: point.signalCount });
    }

    addText(root, point.horizon, { class: "axis", x, y: plot.bottom + 26, "text-anchor": "middle" });
  });

  root.appendChild(svg("path", {
    d: pathFromPoints(linePoints, (point) => point, yScale, "x", "y"),
    fill: "none",
    stroke: "#151515",
    "stroke-width": 2.5,
  }));
  linePoints.forEach((point) => {
    const dot = svg("circle", { cx: point.x, cy: yScale(point.y), r: 4.6, fill: "#151515" });
    dot.addEventListener("mousemove", (event) => showTooltip(
      `<strong>${point.horizon}</strong>All days: ${options.formatter(point.y)}<br>Signal: ${options.formatter(point.signal)}<br>n=${point.signalCount}`,
      event
    ));
    dot.addEventListener("mouseleave", hideTooltip);
    root.appendChild(dot);
  });

  const legend = svg("g", { class: "legend", transform: `translate(${plot.left} ${plot.top + 4})` });
  legend.appendChild(svg("rect", { x: 0, y: -9, width: 22, height: 10, rx: 2, fill: "#167c62" }));
  addText(legend, options.barLabel, { x: 30, y: 0 });
  legend.appendChild(svg("line", { x1: 170, x2: 196, y1: -4, y2: -4, stroke: "#151515", "stroke-width": 2.5 }));
  addText(legend, options.lineLabel, { x: 204, y: 0 });
  root.appendChild(legend);

  appendAxisLabel(root, options.yLabel, 18, (plot.top + plot.bottom) / 2, true);
  container.replaceChildren(root);
}

function renderForwardReturns() {
  renderComboChart("forward-returns-chart", {
    label: "Average forward returns",
    barKey: "signalAverage",
    lineKey: "allAverage",
    barLabel: "Signal avg.",
    lineLabel: "All-day avg.",
    yLabel: "Return",
    formatter: (value) => fmtPct(value),
    domain: comparisonDomain("signalAverage", "allAverage", true),
  });
}

function renderHitRates() {
  renderComboChart("hit-rate-chart", {
    label: "Hit rates comparison",
    barKey: "signalHitRate",
    lineKey: "allHitRate",
    barLabel: "Signal hit rate",
    lineLabel: "All-day hit rate",
    yLabel: "Hit rate",
    formatter: (value) => fmtHit(value),
    domain: [0, 1],
  });
}

function renderSignalPerformance() {
  const container = document.getElementById("signal-performance-chart");
  const width = 1160;
  const height = 430;
  const margin = { top: 26, right: 32, bottom: 58, left: 72 };
  const plot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Signal performance for 12 months after each trigger" });
  const values = data.signals.flatMap((signal) => signal.performance.map((point) => point.return)).concat(data.medianPerformance.map((point) => point.return));
  const yDomain = valueExtent(values, { includeZero: true, pad: 0.12 });
  const xScale = linearScale([0, 252], [plot.left, plot.right]);
  const yScale = linearScale(yDomain, [plot.bottom, plot.top]);
  const xTicks = [
    { day: 0, label: "0" },
    { day: 21, label: "1M" },
    { day: 63, label: "3M" },
    { day: 126, label: "6M" },
    { day: 189, label: "9M" },
    { day: 252, label: "12M" },
  ];

  drawHorizontalGrid(root, yScale, niceTicks(yDomain, 6), plot, (value) => fmtPct(value));
  xTicks.forEach((tick) => {
    const x = xScale(tick.day);
    root.appendChild(svg("line", { class: "grid-line", x1: x, x2: x, y1: plot.top, y2: plot.bottom }));
    addText(root, tick.label, { class: "axis", x, y: plot.bottom + 26, "text-anchor": "middle" });
  });
  root.appendChild(svg("line", { class: "axis-line", x1: plot.left, x2: plot.right, y1: yScale(0), y2: yScale(0) }));

  data.signals.forEach((signal, idx) => {
    const color = palette[idx % palette.length];
    const points = signal.performance.map((point) => ({ x: point.day, y: point.return, date: point.date }));
    const path = pathFromPoints(points, xScale, yScale);
    root.appendChild(svg("path", {
      d: path,
      fill: "none",
      stroke: color,
      "stroke-width": 1.8,
      opacity: 0.58,
    }));
    const hoverPath = svg("path", {
      d: path,
      fill: "none",
      stroke: "transparent",
      "stroke-width": 14,
      "pointer-events": "stroke",
    });
    hoverPath.addEventListener("mousemove", (event) => {
      const svgPoint = root.createSVGPoint();
      svgPoint.x = event.clientX;
      svgPoint.y = event.clientY;
      const cursor = svgPoint.matrixTransform(root.getScreenCTM().inverse());
      const day = Math.max(0, Math.min(points.length - 1, Math.round(xScale.invert(cursor.x))));
      const nearest = points[day] || points[points.length - 1];
      showTooltip(signalTooltip(signal, `<br>Day ${nearest.x}: ${fmtPct(nearest.y)}<br>Path date: ${fmtDate(nearest.date)}`), event);
    });
    hoverPath.addEventListener("mouseleave", hideTooltip);
    root.appendChild(hoverPath);
  });

  const medianPath = pathFromPoints(data.medianPerformance.map((point) => ({ x: point.day, y: point.return })), xScale, yScale);
  root.appendChild(svg("path", {
    d: medianPath,
    fill: "none",
    stroke: "#151515",
    "stroke-width": 4,
    "stroke-linecap": "round",
  }));

  const legend = svg("g", { class: "legend", transform: `translate(${plot.left} ${height - 16})` });
  legend.appendChild(svg("line", { x1: 0, x2: 30, y1: 0, y2: 0, stroke: "#151515", "stroke-width": 4 }));
  addText(legend, "Median signal", { x: 38, y: 4 });
  data.signals.slice(0, 7).forEach((signal, idx) => {
    const x = 172 + idx * 118;
    legend.appendChild(svg("line", { x1: x, x2: x + 22, y1: 0, y2: 0, stroke: palette[idx % palette.length], "stroke-width": 2 }));
    addText(legend, signal.date, { x: x + 28, y: 4 });
  });
  root.appendChild(legend);

  appendAxisLabel(root, "Forward return", 18, (plot.top + plot.bottom) / 2, true);
  container.replaceChildren(root);
}

function renderDistribution() {
  const container = document.getElementById("distribution-chart");
  const width = 1160;
  const height = 430;
  const margin = { top: 26, right: 32, bottom: 58, left: 72 };
  const plot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Return distribution by horizon" });
  const allValues = data.distribution.flatMap((bucket) => bucket.values.map((point) => point.value));
  const yDomain = valueExtent(allValues, { includeZero: true, pad: 0.14 });
  const yScale = linearScale(yDomain, [plot.bottom, plot.top]);
  const xStep = (plot.right - plot.left) / data.distribution.length;

  drawHorizontalGrid(root, yScale, niceTicks(yDomain, 6), plot, (value) => fmtPct(value));
  root.appendChild(svg("line", { class: "axis-line", x1: plot.left, x2: plot.right, y1: yScale(0), y2: yScale(0) }));

  data.distribution.forEach((bucket, idx) => {
    const center = plot.left + xStep * idx + xStep / 2;
    const boxWidth = Math.min(54, xStep * 0.44);
    const box = bucket.box;
    addText(root, bucket.horizon, { class: "axis", x: center, y: plot.bottom + 26, "text-anchor": "middle" });

    if (box.min !== null && box.q1 !== null && box.q3 !== null && box.max !== null) {
      root.appendChild(svg("line", { x1: center, x2: center, y1: yScale(box.min), y2: yScale(box.max), stroke: "#87917f", "stroke-width": 1.2 }));
      root.appendChild(svg("line", { x1: center - boxWidth / 3, x2: center + boxWidth / 3, y1: yScale(box.min), y2: yScale(box.min), stroke: "#87917f", "stroke-width": 1.2 }));
      root.appendChild(svg("line", { x1: center - boxWidth / 3, x2: center + boxWidth / 3, y1: yScale(box.max), y2: yScale(box.max), stroke: "#87917f", "stroke-width": 1.2 }));
      root.appendChild(svg("rect", {
        x: center - boxWidth / 2,
        y: yScale(box.q3),
        width: boxWidth,
        height: Math.max(2, yScale(box.q1) - yScale(box.q3)),
        fill: "#dcefe8",
        stroke: "#167c62",
        "stroke-width": 1.4,
      }));
      root.appendChild(svg("line", { x1: center - boxWidth / 2, x2: center + boxWidth / 2, y1: yScale(box.median), y2: yScale(box.median), stroke: "#151515", "stroke-width": 2.4 }));
    }

    bucket.values.forEach((point, pointIdx) => {
      const jitter = ((pointIdx % 5) - 2) * 7;
      const dot = svg("circle", {
        cx: center + jitter,
        cy: yScale(point.value),
        r: 5.2,
        fill: "#ff1d18",
        stroke: "#9d0000",
        "stroke-width": 1,
        opacity: 0.86,
      });
      dot.addEventListener("mousemove", (event) => showTooltip(
        `<strong>${bucket.horizon} on ${fmtDate(point.date)}</strong>
        Return: ${fmtPct(point.value)}<br>
        ${data.assetName}: ${fmtPrice(point.asset)}<br>
        ${data.indicatorName}: ${fmtNumber(point.indicator, 3)}`,
        event
      ));
      dot.addEventListener("mouseleave", hideTooltip);
      root.appendChild(dot);
    });
  });

  appendAxisLabel(root, "Forward return", 18, (plot.top + plot.bottom) / 2, true);
  container.replaceChildren(root);
}

function getStat(rowName, header) {
  const row = data.statsRows?.[rowName];
  const value = row ? row[header] : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function benchmarkFor(rowLabel, header) {
  if (rowLabel === "Median Signal Return") return getStat("Median All-Dataset Return", header);
  if (rowLabel === "Average Signal Return") return getStat("Average All-Dataset Return", header);
  if (rowLabel === "Signal Hit Rate") return getStat("All-Dataset Hit Rate", header);
  return null;
}

function isBenchmarkWin(rowLabel, header, value) {
  const baseline = benchmarkFor(rowLabel, header);
  return typeof value === "number" && baseline !== null && value > baseline;
}

function isZScoreAlert(rowLabel, value) {
  return rowLabel === "Signal Z-Score" && typeof value === "number" && Math.abs(value) >= 2;
}

function percentFillClass(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value >= 0 ? "positive-fill" : "negative-fill";
}

function addCellClasses(td, value, rowLabel, header) {
  if (typeof value === "number" && shouldPercent(rowLabel, header)) {
    td.classList.add(percentFillClass(value));
  }
  if (isBenchmarkWin(rowLabel, header, value) || isZScoreAlert(rowLabel, value)) {
    td.classList.add("benchmark-win");
  }
}

function comparisonValue(point, key) {
  const value = point[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function renderSummaryMatrix() {
  const container = document.getElementById("summary-matrix");
  const completed = data.signals.filter((signal) => signal.completed12M).length;
  const strongestZ = data.comparison
    .filter((point) => comparisonValue(point, "zScore") !== null)
    .reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.zScore) > Math.abs(best.zScore) ? point : best;
    }, null);
  const bestMedianEdge = data.comparison
    .filter((point) => comparisonValue(point, "signalMedian") !== null && comparisonValue(point, "allMedian") !== null)
    .reduce((best, point) => {
      const edge = point.signalMedian - point.allMedian;
      if (!best) return { ...point, edge };
      return edge > best.edge ? { ...point, edge } : best;
    }, null);
  const peakHit = data.comparison
    .filter((point) => comparisonValue(point, "signalHitRate") !== null)
    .reduce((best, point) => (!best || point.signalHitRate > best.signalHitRate ? point : best), null);

  const callouts = el("div", { class: "summary-callouts" });
  [
    ["Completed windows", `${completed} of ${data.signals.length}`, "12-month forward sample"],
    ["Strongest Z-score", strongestZ ? `${strongestZ.horizon} ${fmtNumber(strongestZ.zScore, 2)}` : "n/a", "|Z| >= 2 is emphasized"],
    ["Best median edge", bestMedianEdge ? `${bestMedianEdge.horizon} ${fmtPct(bestMedianEdge.edge)}` : "n/a", "signal median minus all-day median"],
    ["Peak signal hit", peakHit ? `${peakHit.horizon} ${fmtHit(peakHit.signalHitRate)}` : "n/a", peakHit ? `all-day hit ${fmtHit(peakHit.allHitRate)}` : ""],
  ].forEach(([label, value, detail]) => {
    const card = el("div", { class: "summary-callout" });
    card.appendChild(el("div", { class: "summary-callout-label" }, label));
    card.appendChild(el("div", { class: "summary-callout-value" }, value));
    card.appendChild(el("div", { class: "summary-callout-detail" }, detail));
    callouts.appendChild(card);
  });

  const table = el("table", { class: "summary-table" });
  const thead = el("thead");
  const headRow = el("tr");
  ["Metric", ...data.comparison.map((point) => point.horizon)].forEach((header) => {
    headRow.appendChild(el("th", {}, header));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  [
    ["Median Signal Return", "signalMedian", "return"],
    ["Median All-Dataset Return", "allMedian", "return"],
    ["Average Signal Return", "signalAverage", "return"],
    ["Average All-Dataset Return", "allAverage", "return"],
    ["Signal Hit Rate", "signalHitRate", "hit"],
    ["All-Dataset Hit Rate", "allHitRate", "hit"],
    ["Signal Z-Score", "zScore", "z"],
  ].forEach(([rowLabel, key, type]) => {
    const tr = el("tr", { class: rowLabel.startsWith("Signal") || rowLabel.startsWith("Median Signal") || rowLabel.startsWith("Average Signal") ? "summary-signal-row" : "" });
    tr.appendChild(el("td", {}, rowLabel));
    data.comparison.forEach((point) => {
      const value = point[key];
      const text = type === "hit" ? fmtHit(value) : type === "z" ? fmtNumber(value, 2) : fmtPct(value);
      const td = el("td", {}, text);
      if (type === "return") td.classList.add(percentFillClass(value));
      if (rowLabel === "Median Signal Return" && point.signalMedian > point.allMedian) td.classList.add("benchmark-win");
      if (rowLabel === "Average Signal Return" && point.signalAverage > point.allAverage) td.classList.add("benchmark-win");
      if (rowLabel === "Signal Hit Rate" && point.signalHitRate > point.allHitRate) td.classList.add("benchmark-win");
      if (rowLabel === "Signal Z-Score" && Math.abs(point.zScore) >= 2) td.classList.add("benchmark-win", "z-alert");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const tableWrap = el("div", { class: "summary-table-wrap" });
  tableWrap.appendChild(table);
  container.replaceChildren(callouts, tableWrap);
}

function shouldPercent(rowLabel, header) {
  if (!header || header === "Signal Date") return false;
  if (header.includes("MaxDD")) return true;
  if (data.horizons.includes(header)) return !rowLabel.includes("Z-Score");
  return rowLabel.includes("Hit Rate") || rowLabel.includes("Return");
}

function formatTableCell(value, rowLabel, header) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (shouldPercent(rowLabel, header)) return fmtPctPlain(value);
    if (rowLabel.includes("Z-Score")) return value.toFixed(2);
    return fmtNumber(value, 2);
  }
  if (header === "Signal Date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return String(value);
}

function renderTable() {
  const table = document.getElementById("results-table");
  table.replaceChildren();
  const thead = el("thead");
  const headRow = el("tr");
  data.resultTable.headers.forEach((header) => headRow.appendChild(el("th", {}, header)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  data.resultTable.rows.forEach((row) => {
    const tr = el("tr", { class: `${row.kind}-row` });
    const rowLabel = String(row.values[0] ?? "");
    row.values.forEach((value, idx) => {
      const header = data.resultTable.headers[idx];
      const text = formatTableCell(value, rowLabel, header);
      const td = el("td", {}, text);
      addCellClasses(td, value, rowLabel, header);
      if (row.kind === "note" && idx > 0) td.textContent = "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

function renderAll() {
  if (!data) {
    document.body.replaceChildren(el("main", {}, "Run scripts/build_dashboard_data.py to generate dashboard-data.js."));
    return;
  }
  renderHeader();
  renderCards();
  renderTriggerChart();
  renderForwardReturns();
  renderHitRates();
  renderSignalPerformance();
  renderDistribution();
  renderSummaryMatrix();
  renderTable();
}

renderAll();
window.addEventListener("scroll", hideTooltip, { passive: true });
