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

function cleanAssetLabel() {
  return String(data.assetName || "Asset").replace(/\s+(close|price)$/i, "").trim();
}

function cleanTriggerLabel() {
  return String(data.triggerName || data.indicatorName || "Trigger").trim();
}

function resolveStudiesHref() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/index.html") return "docs/index.html";
  return "../";
}

function showTooltip(html, event) {
  tooltip.innerHTML = html;
  positionTooltip(event.clientX, event.clientY);
  tooltip.style.opacity = "1";
}

function showTooltipAtNode(html, node) {
  const box = node.getBoundingClientRect();
  tooltip.innerHTML = html;
  positionTooltip(box.left + box.width / 2, box.top);
  tooltip.style.opacity = "1";
}

function positionTooltip(anchorX, anchorY) {
  const margin = 16;
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const width = tooltip.offsetWidth || 320;
  const height = tooltip.offsetHeight || 120;
  const minX = margin + width / 2;
  const maxX = window.innerWidth - margin - width / 2;
  const minY = margin + height + 12;
  const maxY = window.innerHeight - margin;
  const x = Math.min(Math.max(anchorX, minX), Math.max(minX, maxX));
  const y = Math.min(Math.max(anchorY, minY), Math.max(minY, maxY));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
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

function drawHorizontalAxisTicks(root, yScale, ticks, plot, formatter) {
  ticks.forEach((tick) => {
    const y = yScale(tick);
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

function drawVerticalAxisTicks(root, xScale, ticks, plot) {
  ticks.forEach((tick) => {
    const x = xScale(tick.value);
    addText(root, tick.label, {
      class: "axis",
      x,
      y: plot.bottom + 22,
      "text-anchor": "middle",
    });
  });
}

function svgExportStyles() {
  return `
    .axis, .axis text, .axis-label, .legend text {
      fill: #657063;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 620;
    }
    .grid-line { stroke: #e6eae2; stroke-width: 1; }
    .axis-line { stroke: #b9c0b4; stroke-width: 1; }
  `;
}

function parseViewBox(svgNode) {
  const viewBox = svgNode.getAttribute("viewBox");
  if (viewBox) {
    const [, , width, height] = viewBox.split(/\s+/).map(Number);
    if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };
  }
  return {
    width: Math.max(1, svgNode.clientWidth || 1200),
    height: Math.max(1, svgNode.clientHeight || 640),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

let watermarkImagePromise;

function getWatermarkImage() {
  if (!watermarkImagePromise) {
    watermarkImagePromise = (async () => {
      const sources = [
        "dc-logo-wnb.png",
        "../dc-logo-wnb.png",
        "DC_Logo_BnW.png",
        "../DC_Logo_BnW.png",
      ];
      for (const source of sources) {
        try {
          return await loadImage(source);
        } catch {
          // Try the next local/exported watermark path.
        }
      }
      return null;
    })();
  }
  return watermarkImagePromise;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export chart image."));
    }, "image/png");
  });
}

async function drawSourceFooter(ctx, canvas, footerTop, footerHeightPx, scale) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, footerTop, canvas.width, footerHeightPx);
  ctx.strokeStyle = "#d9ded5";
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(0, footerTop + 0.5 * scale);
  ctx.lineTo(canvas.width, footerTop + 0.5 * scale);
  ctx.stroke();

  const pad = 18 * scale;
  ctx.save();
  ctx.fillStyle = "#151515";
  ctx.font = `${13 * scale}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("studies.dailychartbook.com", pad, footerTop + footerHeightPx / 2);
  ctx.restore();

  const watermark = await getWatermarkImage();
  if (watermark) {
    const maxWidth = Math.min(150 * scale, canvas.width * 0.22);
    const maxHeight = 36 * scale;
    const ratio = Math.min(maxWidth / watermark.naturalWidth, maxHeight / watermark.naturalHeight);
    const watermarkWidth = watermark.naturalWidth * ratio;
    const watermarkHeight = watermark.naturalHeight * ratio;
    ctx.drawImage(
      watermark,
      canvas.width - watermarkWidth - pad,
      footerTop + (footerHeightPx - watermarkHeight) / 2,
      watermarkWidth,
      watermarkHeight
    );
  } else {
    ctx.save();
    ctx.fillStyle = "#151515";
    ctx.font = `${13 * scale}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Daily Chartbook", canvas.width - pad, footerTop + footerHeightPx / 2);
    ctx.restore();
  }
}

function exportHeadingForButton(button) {
  const panel = button.closest(".panel");
  return {
    kicker: panel?.querySelector(".panel-heading .section-kicker")?.textContent.trim() || "",
    title: panel?.querySelector(".panel-heading h2")?.textContent.trim() || "",
  };
}

function exportHeadingHeight(heading) {
  return heading?.kicker || heading?.title ? 76 : 0;
}

function drawExportHeading(ctx, heading, x, y, width, height) {
  if (!height) return;
  ctx.save();
  ctx.fillStyle = "#167c62";
  ctx.font = "800 12px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (heading.kicker) ctx.fillText(heading.kicker.toUpperCase(), x, y + 16, width);
  ctx.fillStyle = "#1d211c";
  ctx.font = "850 23px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(heading.title || heading.kicker, x, y + 36, width);
  ctx.strokeStyle = "#d9ded5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + height - 0.5);
  ctx.lineTo(x + width, y + height - 0.5);
  ctx.stroke();
  ctx.restore();
}

async function svgToPngBlob(svgNode, heading = {}) {
  const { width, height } = parseViewBox(svgNode);
  const scale = 2;
  const footerHeight = 58;
  const headingHeight = exportHeadingHeight(heading);
  const clone = svgNode.cloneNode(true);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("xmlns", SVG_NS);

  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = svgExportStyles();
  clone.insertBefore(style, clone.firstChild);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const chartImage = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil((headingHeight + height + footerHeight) * scale);
    const chartHeight = Math.ceil(height * scale);
    const chartTop = Math.ceil(headingHeight * scale);
    const footerTop = chartTop + chartHeight;
    const footerHeightPx = footerHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    drawExportHeading(ctx, heading, 18, 0, width - 36, headingHeight);
    ctx.restore();
    ctx.drawImage(chartImage, 0, chartTop, canvas.width, chartHeight);

    await drawSourceFooter(ctx, canvas, footerTop, footerHeightPx, scale);

    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function writePngToClipboard(blobPromise) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard copy is not available in this browser context.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}

function tableToTsv(table) {
  return Array.from(table.rows)
    .map((row) => Array.from(row.cells)
      .map((cell) => cell.textContent.replace(/\s+/g, " ").trim())
      .join("\t"))
    .join("\n");
}

function tableColumnMetrics(table) {
  const rows = Array.from(table.rows);
  const columnCount = Math.max(...rows.map((row) => row.cells.length), 0);
  const widths = Array(columnCount).fill(92);
  const rowHeights = rows.map((row) => {
    let rowHeight = 38;
    Array.from(row.cells).forEach((cell, idx) => {
      const rect = cell.getBoundingClientRect();
      widths[idx] = Math.max(widths[idx], Math.ceil(rect.width || (idx === 0 ? 210 : 92)));
      rowHeight = Math.max(rowHeight, Math.ceil(rect.height || 38));
    });
    return rowHeight;
  });
  return { rows, widths, rowHeights, width: widths.reduce((sum, width) => sum + width, 0), height: rowHeights.reduce((sum, height) => sum + height, 0) };
}

function drawCellText(ctx, text, x, y, width, height, align = "center") {
  const inset = 10;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, width - 2, height - 2);
  ctx.clip();
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const textX = align === "left" ? x + inset : x + width / 2;
  ctx.fillText(text, textX, y + height / 2, Math.max(1, width - inset * 2));
  ctx.restore();
}

function drawExportTable(ctx, table, x, y, metrics) {
  const line = "#d9ded5";
  let currentY = y;
  metrics.rows.forEach((row, rowIdx) => {
    let currentX = x;
    const rowHeight = metrics.rowHeights[rowIdx];
    Array.from(row.cells).forEach((cell, cellIdx) => {
      const width = metrics.widths[cellIdx];
      const isHeader = cell.tagName === "TH";
      const isFirstColumn = cellIdx === 0;
      const text = cell.textContent.replace(/\s+/g, " ").trim();
      const positive = cell.classList.contains("positive-fill");
      const negative = cell.classList.contains("negative-fill");
      const isSignalDateCell = isFirstColumn && cell.parentElement?.classList.contains("signal-row");
      const weight = isHeader || cell.classList.contains("benchmark-win") || (isFirstColumn && !isSignalDateCell) ? 700 : 500;

      ctx.fillStyle = isHeader ? "#167c62" : positive ? "#c6efce" : negative ? "#ffc7ce" : "#ffffff";
      ctx.fillRect(currentX, currentY, width, rowHeight);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.strokeRect(currentX, currentY, width, rowHeight);
      ctx.fillStyle = isHeader ? "#ffffff" : positive ? "#115c3f" : negative ? "#8b1a16" : "#1d211c";
      ctx.font = `${weight} ${isHeader ? 12 : 13}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      drawCellText(ctx, text, currentX, currentY, width, rowHeight, isFirstColumn && !isSignalDateCell ? "left" : "center");
      currentX += width;
    });
    currentY += rowHeight;
  });
}

function drawSummaryCallouts(ctx, callouts, x, y, width, height) {
  const gap = 12;
  const cardWidth = (width - gap * (callouts.length - 1)) / callouts.length;
  callouts.forEach((callout, idx) => {
    const cardX = x + idx * (cardWidth + gap);
    const label = callout.querySelector(".summary-callout-label")?.textContent.trim() || "";
    const value = callout.querySelector(".summary-callout-value")?.textContent.trim() || "";
    const detail = callout.querySelector(".summary-callout-detail")?.textContent.trim() || "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cardX, y, cardWidth, height);
    ctx.fillStyle = "#167c62";
    ctx.fillRect(cardX, y, 3, height);
    ctx.fillStyle = "#657063";
    ctx.font = "700 11px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label.toUpperCase(), cardX + 14, y + 8, cardWidth - 24);
    ctx.fillStyle = "#1d211c";
    ctx.font = "800 21px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(value, cardX + 14, y + 31, cardWidth - 24);
    ctx.fillStyle = "#657063";
    ctx.font = "500 12px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(detail, cardX + 14, y + 59, cardWidth - 24);
  });
}

async function tableSectionToPngBlob(target, heading = {}) {
  const table = target.matches("table") ? target : target.querySelector("table");
  if (!table) throw new Error("Table is not ready yet.");
  const scale = 2;
  const footerHeight = 58;
  const pad = 18;
  const headingHeight = exportHeadingHeight(heading);
  const callouts = target.querySelectorAll(".summary-callout");
  const metrics = tableColumnMetrics(table);
  const calloutHeight = callouts.length ? 84 : 0;
  const gap = callouts.length ? 16 : 0;
  const contentWidth = metrics.width + pad * 2;
  const contentHeight = headingHeight + pad + calloutHeight + gap + metrics.height + pad;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(contentWidth * scale);
  canvas.height = Math.ceil((contentHeight + footerHeight) * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  drawExportHeading(ctx, heading, pad, 0, metrics.width, headingHeight);
  if (callouts.length) {
    drawSummaryCallouts(ctx, Array.from(callouts), pad, headingHeight + pad, metrics.width, calloutHeight);
  }
  drawExportTable(ctx, table, pad, headingHeight + pad + calloutHeight + gap, metrics);
  ctx.restore();
  await drawSourceFooter(ctx, canvas, contentHeight * scale, footerHeight * scale, scale);
  return await canvasToBlob(canvas);
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      const blob = new Blob([text], { type: "text/plain" });
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch {
      // Try the simpler text API next.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to the older copy command when browser permissions are fussy.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Text clipboard copy is not available in this browser context.");
}

function setShareButtonState(button, label, stateClass = "is-copied") {
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.classList.remove("is-copied", "is-error");
  button.classList.add(stateClass);
  button.textContent = label;
  window.setTimeout(() => {
    button.classList.remove("is-copied", "is-error");
    button.textContent = button.dataset.label;
  }, 1600);
}

async function copyChartImage(button) {
  const container = document.querySelector(button.dataset.copyImage);
  const svgNode = container?.querySelector("svg");
  if (!svgNode) throw new Error("Chart is not ready yet.");
  await writePngToClipboard(svgToPngBlob(svgNode, exportHeadingForButton(button)));
}

async function copyTable(button) {
  const table = document.querySelector(button.dataset.copyTable);
  if (!table) throw new Error("Table is not ready yet.");
  await writeTextToClipboard(tableToTsv(table));
}

async function copyTableImage(button) {
  const target = document.querySelector(button.dataset.copyTableImage);
  if (!target) throw new Error("Table is not ready yet.");
  await writePngToClipboard(tableSectionToPngBlob(target, exportHeadingForButton(button)));
}

function setupShareButtons() {
  document.querySelectorAll(".share-button").forEach((button) => {
    if (button.dataset.shareReady) return;
    button.dataset.shareReady = "true";
    button.dataset.label = button.textContent;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        if (button.dataset.copyImage) await copyChartImage(button);
        else if (button.dataset.copyTableImage) await copyTableImage(button);
        else if (button.dataset.copyTable) await copyTable(button);
        setShareButtonState(button, "Copied");
      } catch (error) {
        console.error(error);
        setShareButtonState(button, "Copy failed", "is-error");
      } finally {
        button.disabled = false;
      }
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
    ${data.indicatorName || cleanTriggerLabel()}: ${fmtNumber(signal.indicator, 3)}<br>
    ${extra}
    ${resultLine ? `<br>${resultLine}` : ""}`;
}

function extractTitleCriterion() {
  const match = String(data.title || "").match(/Backtest:\s*(.*?)(?:\s*\(|$)/i);
  return match ? match[1].trim() : "";
}

function extractCooldown() {
  const match = String(data.title || "").match(/(\d+)[-\s]*(?:trading\s*)?day\s+cooldown/i);
  return match ? Number(match[1]) : null;
}

function criterionSentence() {
  const asset = cleanAssetLabel();
  const criterion = extractTitleCriterion();
  const directional = criterion.match(/price\s*(≥|>=|>|≤|<=|<)?\s*([\d.]+)%\s*(above|below)\s*(.+)/i);
  if (directional) {
    const operator = directional[1] || ">";
    const threshold = directional[2];
    const direction = directional[3].toLowerCase();
    const indicator = directional[4].trim();
    const operatorText = {
      "≥": "at least",
      ">=": "at least",
      ">": "more than",
      "≤": "at most",
      "<=": "at most",
      "<": "less than",
    }[operator] || "more than";
    return `The signal triggers when ${asset} price is ${operatorText} ${threshold}% ${direction} its ${indicator}.`;
  }
  if (criterion) return `The signal trigger is defined as: ${criterion}.`;
  return `The signal trigger is based on ${data.indicatorName}.`;
}

function renderParameterDescription() {
  const target = document.getElementById("parameter-description");
  if (data.criteriaDescription) {
    target.textContent = data.criteriaDescription;
    return;
  }
  const cooldown = extractCooldown();
  const completed = data.signals.filter((signal) => signal.completed12M).length;
  const cooldownText = cooldown
    ? ` After a trigger, the study waits ${cooldown} trading days before counting another signal.`
    : "";
  target.textContent = `${criterionSentence()}${cooldownText} The sample includes n=${data.signals.length} signals from ${fmtDate(data.dateRange.start)} to ${fmtDate(data.dateRange.end)}; ${completed} have full 12-month forward windows. Forward returns are compared with all trading days in the dataset.`;
}

function setupBackLinks() {
  document.querySelectorAll(".back-link").forEach((link) => {
    link.setAttribute("href", resolveStudiesHref());
  });
}

function renderHeader() {
  document.getElementById("study-title").textContent = data.title;
  document.getElementById("ai-description").textContent = data.aiDescription;
  document.getElementById("trigger-title").textContent = `${data.assetName} with signal triggers`;

  const meta = document.getElementById("study-meta");
  meta.replaceChildren(
    el("span", { class: "meta-pill" }, `Asset: ${cleanAssetLabel()}`),
    el("span", { class: "meta-pill" }, `n=${data.signals.length}`),
    el("span", { class: "meta-pill" }, `Trigger: ${cleanTriggerLabel()}`),
    el("span", { class: "meta-pill" }, `${fmtDate(data.dateRange.start)} - ${fmtDate(data.dateRange.end)}`),
    el("span", { class: "meta-pill" }, `${data.dateRange.tradingDays.toLocaleString()} trading days`)
  );
}

function currentSummaryReturnMetric() {
  return document.querySelector("[data-summary-return-metric].is-active")?.dataset.summaryReturnMetric || "average";
}

function comparisonPointForHorizon(horizon) {
  return data.comparison.find((point) => point.horizon === horizon) || null;
}

function returnCardForMetric(card, metric) {
  const point = comparisonPointForHorizon(card.horizon);
  if (!point) return card;
  const isMedian = metric === "median";
  return {
    ...card,
    kind: isMedian ? "medianReturn" : "averageReturn",
    label: `${card.horizon} ${isMedian ? "median" : "avg."} return`,
    value: isMedian ? point.signalMedian : point.signalAverage,
    baseline: isMedian ? point.allMedian : point.allAverage,
    sampleSize: point.signalCount ?? card.sampleSize,
  };
}

function drawdownCardForMetric(card, metric) {
  if (metric !== "median") return card;
  return {
    ...card,
    label: "Median max drawdown",
    value: card.median,
    baseline: getStat("Median All-Dataset Return", "12M MaxDD"),
  };
}

function setupSummaryReturnMetricToggle() {
  const buttons = Array.from(document.querySelectorAll("[data-summary-return-metric]"));
  if (!buttons.length || buttons[0].dataset.metricToggleReady) return;
  buttons.forEach((button) => {
    button.dataset.metricToggleReady = "true";
    button.addEventListener("click", () => {
      buttons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });
      renderCards();
    });
  });
}

function renderCards() {
  const grid = document.getElementById("summary-cards");
  const featureGrid = document.getElementById("summary-feature-cards");
  const metric = currentSummaryReturnMetric();
  const isMedian = metric === "median";
  const summaryTitle = document.getElementById("summary-returns-title");
  if (summaryTitle) summaryTitle.textContent = isMedian ? "Median returns vs all-day baseline" : "Average returns vs all-day baseline";
  grid.replaceChildren();
  featureGrid.replaceChildren();
  data.cards.forEach((card) => {
    if (card.kind === "averageReturn") {
      card = returnCardForMetric(card, metric);
    } else if (card.kind === "drawdown") {
      card = drawdownCardForMetric(card, metric);
    }
    const node = el("div", { class: `stat-card card-${card.kind}` });
    node.appendChild(el("div", { class: "stat-label" }, card.label));

    let valueText = "";
    let detailText = "";
    let valueClass = "stat-value";
    if (card.kind === "count") {
      valueText = String(card.value);
      detailText = card.detail;
    } else if (card.kind === "medianReturn" || card.kind === "averageReturn") {
      valueText = fmtPct(card.value);
      const baselineLabel = card.kind === "averageReturn" ? "all-day avg." : "all-day median";
      detailText = `n=${card.sampleSize}; ${baselineLabel} ${fmtPct(card.baseline)}`;
      valueClass += ` ${signClass(card.value)}`;
      if (typeof card.baseline === "number" && card.value > card.baseline) valueClass += " stat-value-benchmark";
    } else if (card.kind === "hitRate") {
      valueText = fmtHit(card.value);
      detailText = `n=${card.sampleSize}; all-day hit ${fmtHit(card.baseline)}`;
      if (typeof card.baseline === "number" && card.value > card.baseline) valueClass += " stat-value-benchmark";
    } else if (card.kind === "drawdown") {
      valueText = fmtPct(card.value);
      detailText = `n=${card.sampleSize}; ${isMedian ? "all-day median" : "all-day avg."} ${fmtPct(card.baseline)}`;
      if (typeof card.baseline === "number" && card.value > card.baseline) valueClass += " stat-value-benchmark";
    } else {
      valueText = fmtPct(card.value);
      detailText = `median ${fmtPct(card.median)}; n=${card.sampleSize}`;
    }

    node.appendChild(el("div", { class: valueClass }, valueText));
    node.appendChild(el("div", { class: "stat-detail" }, detailText));
    if (card.kind === "count" || card.kind === "drawdown") {
      featureGrid.appendChild(node);
    } else {
      grid.appendChild(node);
    }
  });
}

function renderTriggerChart() {
  const container = document.getElementById("trigger-chart");
  const width = 1160;
  const height = 430;
  const margin = { top: 28, right: 24, bottom: 48, left: 78 };
  const plot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Asset series with signal markers" });

  const timed = data.series.map((point) => ({ ...point, time: new Date(`${point.date}T00:00:00`).getTime() }));
  const xDomain = [timed[0].time, timed[timed.length - 1].time];
  const xScale = linearScale(xDomain, [plot.left, plot.right]);
  const assetValues = timed.map((point) => point.asset).filter((value) => value > 0);
  const assetDomain = [Math.max(Math.min(...assetValues) * 0.92, 0.000001), Math.max(...assetValues) * 1.05];
  const assetY = logScale(assetDomain, [plot.bottom, plot.top]);
  const ticks = yearTicks(data.series);

  drawVerticalAxisTicks(root, xScale, ticks, plot);
  drawHorizontalAxisTicks(root, assetY, niceTicks(assetDomain, 4), plot, (value) => value >= 100 ? value.toFixed(0) : value.toFixed(1));

  root.appendChild(svg("rect", {
    x: plot.left,
    y: plot.top,
    width: plot.right - plot.left,
    height: plot.bottom - plot.top,
    fill: "none",
    stroke: "#aeb7aa",
    "stroke-width": 1,
  }));

  root.appendChild(svg("path", {
    d: pathFromPoints(timed, xScale, assetY, "time", "asset"),
    fill: "none",
    stroke: "#151515",
    "stroke-width": 1.8,
  }));

  data.signals.forEach((signal) => {
    const time = new Date(`${signal.date}T00:00:00`).getTime();
    const x = xScale(time);
    const circle = svg("circle", {
      cx: x,
      cy: assetY(signal.asset),
      r: 5.6,
      fill: "#ff1d18",
      stroke: "#9d0000",
      "stroke-width": 1.4,
      tabindex: 0,
    });
    circle.addEventListener("mousemove", (event) => showTooltip(signalTooltip(signal), event));
    circle.addEventListener("mouseleave", hideTooltip);
    root.appendChild(circle);
  });

  addText(root, data.assetName, { class: "axis-label", x: 18, y: (plot.top + plot.bottom) / 2, "text-anchor": "middle", transform: `rotate(-90 18 ${(plot.top + plot.bottom) / 2})` });
  addText(root, "Date", { class: "axis-label", x: (plot.left + plot.right) / 2, y: height - 8, "text-anchor": "middle" });

  const legend = svg("g", { class: "legend", transform: `translate(${plot.left + 12} ${plot.top + 18})` });
  legend.appendChild(svg("line", { x1: 0, x2: 28, y1: 0, y2: 0, stroke: "#151515", "stroke-width": 2 }));
  addText(legend, data.assetName, { x: 40, y: 5 });
  legend.appendChild(svg("circle", { cx: 15, cy: 30, r: 5.6, fill: "#ff1d18", stroke: "#9d0000", "stroke-width": 1.4 }));
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
      `<strong>${point.horizon}</strong>${options.signalTooltipLabel || "Signal"}: ${options.formatter(barValue)}<br>${options.baselineTooltipLabel || "All days"}: ${options.formatter(lineValue)}<br>n=${point.signalCount}`,
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
      `<strong>${point.horizon}</strong>${options.baselineTooltipLabel || "All days"}: ${options.formatter(point.y)}<br>${options.signalTooltipLabel || "Signal"}: ${options.formatter(point.signal)}<br>n=${point.signalCount}`,
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

function currentReturnMetric() {
  return document.querySelector("[data-return-metric].is-active")?.dataset.returnMetric || "average";
}

function setupReturnMetricToggle() {
  const buttons = Array.from(document.querySelectorAll("[data-return-metric]"));
  if (!buttons.length || buttons[0].dataset.metricToggleReady) return;
  buttons.forEach((button) => {
    button.dataset.metricToggleReady = "true";
    button.addEventListener("click", () => {
      buttons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });
      renderForwardReturns();
    });
  });
}

function renderForwardReturns() {
  const metric = currentReturnMetric();
  const isMedian = metric === "median";
  const title = document.getElementById("forward-returns-title");
  if (title) title.textContent = isMedian ? "Median signal vs baseline" : "Average signal vs baseline";
  renderComboChart("forward-returns-chart", {
    label: isMedian ? "Median forward returns" : "Average forward returns",
    barKey: isMedian ? "signalMedian" : "signalAverage",
    lineKey: isMedian ? "allMedian" : "allAverage",
    barLabel: isMedian ? "Signal median" : "Signal avg.",
    lineLabel: isMedian ? "All-day median" : "All-day avg.",
    signalTooltipLabel: isMedian ? "Signal median" : "Signal avg.",
    baselineTooltipLabel: isMedian ? "All-day median" : "All-day avg.",
    yLabel: "Return",
    formatter: (value) => fmtPct(value),
    domain: comparisonDomain(isMedian ? "signalMedian" : "signalAverage", isMedian ? "allMedian" : "allAverage", true),
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

function setupSignalHighlightSelect() {
  const select = document.getElementById("signal-highlight-select");
  if (!select) return;
  const currentValue = select.value;
  const options = [
    { value: "", label: `${performanceAggregateLabel()} signal` },
    ...data.signals.map((signal) => ({
      value: signal.date,
      label: `${signal.date} (${fmtPct(signal.values["12M"])})`,
    })),
  ];
  select.replaceChildren(...options.map((option) => el("option", { value: option.value }, option.label)));
  if (options.some((option) => option.value === currentValue)) select.value = currentValue;
  if (select.dataset.signalSelectReady) return;
  select.dataset.signalSelectReady = "true";
  select.addEventListener("change", renderSignalPerformance);
}

function currentPerformanceMetric() {
  return document.querySelector("[data-performance-metric].is-active")?.dataset.performanceMetric || "median";
}

function performanceAggregateLabel() {
  return currentPerformanceMetric() === "average" ? "Average" : "Median";
}

function updateSignalAggregateOptionLabel() {
  const option = document.querySelector("#signal-highlight-select option[value='']");
  if (option) option.textContent = `${performanceAggregateLabel()} signal`;
}

function aggregatePerformancePoints(metric) {
  if (metric === "median") {
    return data.medianPerformance.map((point) => ({ x: point.day, y: point.return }));
  }

  const maxLength = Math.max(0, ...data.signals.map((signal) => signal.performance.length));
  const points = [];
  for (let day = 0; day < maxLength; day += 1) {
    const values = data.signals
      .map((signal) => signal.performance[day]?.return)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    if (!values.length) continue;
    points.push({ x: day, y: values.reduce((sum, value) => sum + value, 0) / values.length });
  }
  return points;
}

function setupPerformanceMetricToggle() {
  const buttons = Array.from(document.querySelectorAll("[data-performance-metric]"));
  if (!buttons.length || buttons[0].dataset.performanceToggleReady) return;
  buttons.forEach((button) => {
    button.dataset.performanceToggleReady = "true";
    button.addEventListener("click", () => {
      buttons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });
      updateSignalAggregateOptionLabel();
      renderSignalPerformance();
    });
  });
}

function renderSignalPerformance() {
  const container = document.getElementById("signal-performance-chart");
  const selectedDate = document.getElementById("signal-highlight-select")?.value || "";
  const selectedSignal = data.signals.find((signal) => signal.date === selectedDate);
  const aggregateMetric = currentPerformanceMetric();
  const aggregateLabel = performanceAggregateLabel();
  const aggregatePoints = aggregatePerformancePoints(aggregateMetric);
  const width = 1160;
  const height = 430;
  const margin = { top: 26, right: 32, bottom: 58, left: 72 };
  const plot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Signal performance for 12 months after each trigger" });
  const values = data.signals.flatMap((signal) => signal.performance.map((point) => point.return)).concat(aggregatePoints.map((point) => point.y));
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

  const selectedLayers = [];
  const hoverLayers = [];
  data.signals.forEach((signal, idx) => {
    const color = palette[idx % palette.length];
    const points = signal.performance.map((point) => ({ x: point.day, y: point.return, date: point.date }));
    const path = pathFromPoints(points, xScale, yScale);
    const isHighlighted = signal.date === selectedDate;
    const visiblePath = svg("path", {
      d: path,
      fill: "none",
      stroke: color,
      "stroke-width": isHighlighted ? 4.2 : selectedDate ? 1.25 : 1.8,
      "stroke-linecap": "round",
      "pointer-events": "none",
      opacity: isHighlighted ? 0.98 : selectedDate ? 0.2 : 0.58,
    });
    if (isHighlighted) selectedLayers.push(visiblePath);
    else root.appendChild(visiblePath);

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
    if (!selectedDate || isHighlighted) hoverLayers.push(hoverPath);
  });

  const aggregatePath = pathFromPoints(aggregatePoints, xScale, yScale);
  root.appendChild(svg("path", {
    d: aggregatePath,
    fill: "none",
    stroke: "#151515",
    "stroke-width": selectedDate ? 3.2 : 4,
    "stroke-linecap": "round",
    opacity: selectedDate ? 0.72 : 1,
  }));

  selectedLayers.forEach((layer) => root.appendChild(layer));

  hoverLayers.forEach((layer) => root.appendChild(layer));
  const aggregateHoverPath = svg("path", {
    d: aggregatePath,
    fill: "none",
    stroke: "transparent",
    "stroke-width": 16,
    "pointer-events": "stroke",
  });
  aggregateHoverPath.addEventListener("mousemove", (event) => {
    if (!aggregatePoints.length) return;
    const svgPoint = root.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const cursor = svgPoint.matrixTransform(root.getScreenCTM().inverse());
    const day = Math.max(0, Math.min(aggregatePoints.length - 1, Math.round(xScale.invert(cursor.x))));
    const nearest = aggregatePoints[day] || aggregatePoints[aggregatePoints.length - 1];
    showTooltip(`<strong>${aggregateLabel} signal</strong>Day ${nearest.x}: ${fmtPct(nearest.y)}`, event);
  });
  aggregateHoverPath.addEventListener("mouseleave", hideTooltip);
  root.appendChild(aggregateHoverPath);

  const legend = svg("g", { class: "legend", transform: `translate(${plot.left} ${height - 16})` });
  legend.appendChild(svg("line", { x1: 0, x2: 30, y1: 0, y2: 0, stroke: "#151515", "stroke-width": 4 }));
  addText(legend, `${aggregateLabel} signal`, { x: 38, y: 4 });
  if (selectedSignal) {
    const selectedIndex = data.signals.indexOf(selectedSignal);
    const x = 172;
    legend.appendChild(svg("line", { x1: x, x2: x + 30, y1: 0, y2: 0, stroke: palette[selectedIndex % palette.length], "stroke-width": 4 }));
    addText(legend, `Highlighted: ${selectedSignal.date}`, { x: x + 38, y: 4 });
  } else {
    addText(legend, "Select a trigger above to highlight one path", { x: 172, y: 4 });
  }
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
        r: 4.68,
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
  if (typeof value === "number" && shouldPercent(rowLabel, header) && !isContextPercentHeader(header)) {
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
  if (rowLabel.includes("N (signals with forward data)")) return false;
  if (header.includes("%")) return true;
  if (header.includes("MaxDD")) return true;
  if (data.horizons.includes(header)) return !rowLabel.includes("Z-Score");
  return rowLabel.includes("Hit Rate") || rowLabel.includes("Return");
}

function isContextPercentHeader(header) {
  return Boolean(header && header.includes("%"));
}

function formatTableCell(value, rowLabel, header) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (rowLabel.includes("N (signals with forward data)")) return value.toFixed(0);
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
    const rowLabel = String(row.label ?? row.values[0] ?? "");
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

function setupHelpButtons() {
  const helpText = {
    distribution: "<strong>How to read it</strong>The box shows the middle 50% of signal returns for each horizon, with the center line marking the median. Red dots are individual signal outcomes; hover a dot to see the trigger date and market data.",
    "results-table": "<strong>Bold formatting</strong>Signal return and hit-rate cells are bold when they are greater than the comparable all-dataset result for the same horizon. Z-scores are bold when their absolute value is 2 or greater.",
  };

  document.querySelectorAll(".help-button").forEach((button) => {
    const key = button.getAttribute("data-help");
    const content = helpText[key];
    if (!content) return;
    button.addEventListener("mousemove", (event) => showTooltip(content, event));
    button.addEventListener("focus", () => showTooltipAtNode(content, button));
    button.addEventListener("click", () => showTooltipAtNode(content, button));
    button.addEventListener("mouseleave", hideTooltip);
    button.addEventListener("blur", hideTooltip);
  });
}

function reportBugMailto(button) {
  const email = button.dataset.reportEmail || "dailychartbook@pm.me";
  const subject = button.dataset.reportSubject || "Daily Chartbook Studies bug report";
  const body = `Page: ${window.location.href}\n\nWhat happened?\n`;
  return {
    email,
    href: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

function setReportBugFallback(button, email) {
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  window.setTimeout(async () => {
    if (document.hidden) return;
    let label = email;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      label = "Email copied";
    } catch {
      // Showing the address is the fallback when clipboard access is unavailable.
    }
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = button.dataset.label;
    }, 2200);
  }, 900);
}

function setupReportBugButtons() {
  document.querySelectorAll("[data-report-bug-button]").forEach((button) => {
    if (button.dataset.reportBugReady) return;
    button.dataset.reportBugReady = "true";
    button.addEventListener("click", () => {
      const { email, href } = reportBugMailto(button);
      setReportBugFallback(button, email);
      window.location.href = href;
    });
  });
}

function renderAll() {
  if (!data) {
    document.body.replaceChildren(el("main", {}, "Run scripts/build_dashboard_data.py to generate dashboard-data.js."));
    return;
  }
  setupBackLinks();
  renderHeader();
  renderParameterDescription();
  setupSummaryReturnMetricToggle();
  renderCards();
  renderTriggerChart();
  setupReturnMetricToggle();
  renderForwardReturns();
  renderHitRates();
  setupPerformanceMetricToggle();
  setupSignalHighlightSelect();
  renderSignalPerformance();
  renderDistribution();
  renderSummaryMatrix();
  renderTable();
  setupHelpButtons();
  setupShareButtons();
  setupReportBugButtons();
}

renderAll();
window.addEventListener("scroll", hideTooltip, { passive: true });
