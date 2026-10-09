const COLORS = {
  background: "#111210",
  grid: "rgba(239, 236, 225, 0.075)",
  text: "#8b8d86",
  textStrong: "#eeece5",
  buy: "#38b26f",
  buySoft: "rgba(56, 178, 111, 0.18)",
  sell: "#df6259",
  sellSoft: "rgba(223, 98, 89, 0.18)",
  line: "#eeece5",
  average: "#d9b65b",
  volume: "rgba(238, 236, 229, 0.12)",
  crosshair: "rgba(238, 236, 229, 0.45)",
  tooltip: "rgba(23, 24, 21, 0.97)"
};

export class VesperChart {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.callbacks = callbacks;
    this.bars = [];
    this.markers = [];
    this.costBasis = null;
    this.symbol = null;
    this.currency = null;
    this.chartType = "candles";
    this.viewStart = 0;
    this.viewEnd = 1;
    this.hoverIndex = null;
    this.hoverMarkerId = null;
    this.selectedMarkerId = null;
    this.geometry = null;
    this.drag = null;
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);

    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerleave", () => this.onPointerLeave());
    canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    canvas.addEventListener("click", (event) => this.onClick(event));
  }

  setData({ bars = [], markers = [], costBasis = null, symbol = null, currency = null, preserveView = false }) {
    const previousLength = this.bars.length;
    this.bars = bars.filter((bar) => Number.isFinite(Number(bar.close)));
    this.markers = markers.slice().sort((left, right) => dateValue(left.timestamp || left.time) - dateValue(right.timestamp || right.time));
    this.costBasis = Number.isFinite(Number(costBasis)) ? Number(costBasis) : null;
    this.symbol = symbol;
    this.currency = currency;
    if (!preserveView || previousLength !== this.bars.length) this.resetView();
    else this.clampView();
    this.draw();
  }

  setChartType(type) {
    this.chartType = type === "line" ? "line" : "candles";
    this.draw();
  }

  setSelectedMarker(id) {
    this.selectedMarkerId = id || null;
    this.draw();
  }

  setHoveredMarker(id, notify = false) {
    if (this.hoverMarkerId === id) return;
    this.hoverMarkerId = id || null;
    if (notify) this.callbacks.onMarkerHover?.(this.hoverMarkerId);
    this.draw();
  }

  focusMarker(id) {
    const markerIndex = this.markers.findIndex((marker) => marker.id === id);
    if (markerIndex < 0) return;
    const times = this.bars.map((bar) => dateValue(bar.time));
    const target = dateValue(this.markers[markerIndex].timestamp || this.markers[markerIndex].time);
    const barIndex = nearestIndex(times, target);
    if (barIndex < 0) return;
    const span = Math.max(18, Math.min(90, Math.round(this.bars.length * 0.18)));
    this.viewStart = Math.max(0, barIndex - span * 0.42);
    this.viewEnd = Math.min(this.bars.length, barIndex + span * 0.58);
    this.selectedMarkerId = id;
    this.clampView();
    this.draw();
  }

  resetView() {
    const count = this.bars.length;
    this.viewStart = count > 120 ? count - 90 : 0;
    this.viewEnd = count || 1;
    this.draw();
  }

  draw() {
    const context = this.context;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    const geometry = this.buildGeometry(rect.width, rect.height);
    this.geometry = geometry;
    if (geometry.visibleBars.length < 2) return;

    this.drawGrid(geometry);
    if (this.chartType === "line") this.drawLine(geometry);
    else this.drawCandles(geometry);
    this.drawVolume(geometry);
    this.drawCostBasis(geometry);
    this.drawMarkers(geometry);
    this.drawCrosshair(geometry);
  }

  buildGeometry(width, height) {
    const count = this.bars.length;
    this.clampView();
    const startIndex = Math.max(0, Math.floor(this.viewStart));
    const endIndex = Math.min(count, Math.max(startIndex + 2, Math.ceil(this.viewEnd)));
    const visibleBars = this.bars.slice(startIndex, endIndex);
    const padding = { top: 24, right: 70, bottom: 31, left: 12 };
    const volumeHeight = Math.max(42, Math.min(78, height * 0.16));
    const priceBottom = height - padding.bottom - volumeHeight - 8;
    const values = visibleBars.flatMap((bar) => [
      Number(bar.low ?? bar.close),
      Number(bar.high ?? bar.close)
    ]).filter(Number.isFinite);
    if (this.costBasis) values.push(this.costBasis);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const spread = Math.max(max - min, Math.abs(max) * 0.015, 0.01);
    min -= spread * 0.08;
    max += spread * 0.08;
    const plotWidth = Math.max(1, width - padding.left - padding.right);
    const xForIndex = (index) => padding.left + (index - startIndex) / Math.max(1, endIndex - startIndex - 1) * plotWidth;
    const y = (value) => padding.top + (max - Number(value)) / Math.max(max - min, 0.0001) * (priceBottom - padding.top);
    const maxVolume = Math.max(...visibleBars.map((bar) => Number(bar.volume || 0)), 1);
    return {
      width,
      height,
      padding,
      startIndex,
      endIndex,
      visibleBars,
      min,
      max,
      priceBottom,
      volumeTop: priceBottom + 8,
      volumeHeight,
      plotWidth,
      xForIndex,
      y,
      maxVolume
    };
  }

  drawGrid(geometry) {
    const context = this.context;
    context.save();
    context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textBaseline = "middle";
    context.textAlign = "left";
    for (let line = 0; line <= 5; line += 1) {
      const value = geometry.min + (geometry.max - geometry.min) * line / 5;
      const y = geometry.y(value);
      context.strokeStyle = COLORS.grid;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(geometry.padding.left, y);
      context.lineTo(geometry.width - geometry.padding.right, y);
      context.stroke();
      context.fillStyle = COLORS.text;
      context.fillText(formatAxisPrice(value), geometry.width - geometry.padding.right + 9, y);
    }

    const tickCount = Math.max(3, Math.min(6, Math.floor(geometry.width / 170)));
    context.textAlign = "center";
    for (let tick = 0; tick <= tickCount; tick += 1) {
      const index = Math.round(geometry.startIndex + (geometry.visibleBars.length - 1) * tick / tickCount);
      const bar = this.bars[index];
      if (!bar) continue;
      const x = geometry.xForIndex(index);
      context.strokeStyle = COLORS.grid;
      context.beginPath();
      context.moveTo(x, geometry.padding.top);
      context.lineTo(x, geometry.priceBottom);
      context.stroke();
      context.fillStyle = COLORS.text;
      context.fillText(formatAxisTime(bar.time), x, geometry.height - 12);
    }
    context.restore();
  }

  drawCandles(geometry) {
    const context = this.context;
    const candleStep = geometry.plotWidth / Math.max(1, geometry.visibleBars.length);
    const width = Math.max(1.2, Math.min(10, candleStep * 0.62));
    geometry.visibleBars.forEach((bar, offset) => {
      const index = geometry.startIndex + offset;
      const x = geometry.xForIndex(index);
      const open = Number(bar.open ?? bar.close);
      const close = Number(bar.close);
      const high = Number(bar.high ?? Math.max(open, close));
      const low = Number(bar.low ?? Math.min(open, close));
      const positive = close >= open;
      context.strokeStyle = positive ? COLORS.buy : COLORS.sell;
      context.fillStyle = positive ? COLORS.buy : COLORS.sell;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, geometry.y(high));
      context.lineTo(x, geometry.y(low));
      context.stroke();
      const bodyTop = Math.min(geometry.y(open), geometry.y(close));
      const bodyHeight = Math.max(1.5, Math.abs(geometry.y(open) - geometry.y(close)));
      context.fillRect(x - width / 2, bodyTop, width, bodyHeight);
    });
  }

  drawLine(geometry) {
    const context = this.context;
    const points = geometry.visibleBars.map((bar, offset) => ({
      x: geometry.xForIndex(geometry.startIndex + offset),
      y: geometry.y(bar.close)
    }));
    const gradient = context.createLinearGradient(0, geometry.padding.top, 0, geometry.priceBottom);
    gradient.addColorStop(0, "rgba(238, 236, 229, 0.15)");
    gradient.addColorStop(1, "rgba(238, 236, 229, 0)");
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.lineTo(points.at(-1).x, geometry.priceBottom);
    context.lineTo(points[0].x, geometry.priceBottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.strokeStyle = COLORS.line;
    context.lineWidth = 1.8;
    context.stroke();
  }

  drawVolume(geometry) {
    const context = this.context;
    const step = geometry.plotWidth / Math.max(1, geometry.visibleBars.length);
    const width = Math.max(1, Math.min(8, step * 0.62));
    geometry.visibleBars.forEach((bar, offset) => {
      const volume = Number(bar.volume || 0);
      if (!volume) return;
      const x = geometry.xForIndex(geometry.startIndex + offset);
      const barHeight = volume / geometry.maxVolume * geometry.volumeHeight;
      const positive = Number(bar.close) >= Number(bar.open ?? bar.close);
      context.fillStyle = positive ? COLORS.buySoft : COLORS.sellSoft;
      context.fillRect(
        x - width / 2,
        geometry.volumeTop + geometry.volumeHeight - barHeight,
        width,
        barHeight
      );
    });
  }

  drawCostBasis(geometry) {
    if (!this.costBasis || this.costBasis < geometry.min || this.costBasis > geometry.max) return;
    const context = this.context;
    const y = geometry.y(this.costBasis);
    context.save();
    context.setLineDash([5, 5]);
    context.strokeStyle = COLORS.average;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(geometry.padding.left, y);
    context.lineTo(geometry.width - geometry.padding.right, y);
    context.stroke();
    context.setLineDash([]);
    context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "right";
    context.fillStyle = COLORS.average;
    context.fillText(`AVG ${formatAxisPrice(this.costBasis)}`, geometry.width - geometry.padding.right - 8, y - 8);
    context.restore();
  }

  drawMarkers(geometry) {
    const context = this.context;
    const times = this.bars.map((bar) => dateValue(bar.time));
    const markerGeometry = [];
    for (const marker of this.markers) {
      const markerTime = dateValue(marker.timestamp || marker.time);
      const index = nearestIndex(times, markerTime);
      if (index < geometry.startIndex || index >= geometry.endIndex) continue;
      const bar = this.bars[index];
      if (!bar) continue;
      const x = geometry.xForIndex(index);
      const highY = geometry.y(bar.high ?? bar.close);
      const lowY = geometry.y(bar.low ?? bar.close);
      const active = marker.id === this.selectedMarkerId || marker.id === this.hoverMarkerId;
      const buy = marker.side === "BUY";
      const baseY = buy ? Math.min(geometry.priceBottom - 18, lowY + 18) : Math.max(geometry.padding.top + 18, highY - 18);
      const color = buy ? COLORS.buy : COLORS.sell;
      const size = active ? 10 : 8;

      context.save();
      context.strokeStyle = color;
      context.globalAlpha = active ? 1 : 0.88;
      context.lineWidth = active ? 1.8 : 1.2;
      context.beginPath();
      context.moveTo(x, buy ? lowY + 3 : highY - 3);
      context.lineTo(x, baseY + (buy ? -size : size));
      context.stroke();
      context.beginPath();
      if (buy) {
        context.moveTo(x, baseY - size * 0.75);
        context.lineTo(x - size * 0.7, baseY + size * 0.45);
        context.lineTo(x + size * 0.7, baseY + size * 0.45);
      } else {
        context.moveTo(x, baseY + size * 0.75);
        context.lineTo(x - size * 0.7, baseY - size * 0.45);
        context.lineTo(x + size * 0.7, baseY - size * 0.45);
      }
      context.closePath();
      context.fillStyle = color;
      context.fill();
      context.font = `700 ${active ? 11 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textAlign = "center";
      context.fillStyle = COLORS.textStrong;
      context.fillText(`${buy ? "B" : "S"} ${formatCompact(marker.quantity)}`, x, baseY + (buy ? 18 : -14));
      context.restore();
      markerGeometry.push({ marker, x, y: baseY, radius: active ? 15 : 11 });
    }
    geometry.markers = markerGeometry;
  }

  drawCrosshair(geometry) {
    if (this.hoverIndex === null || !geometry.visibleBars.length) return;
    const barIndex = Math.max(geometry.startIndex, Math.min(geometry.endIndex - 1, this.hoverIndex));
    const bar = this.bars[barIndex];
    if (!bar) return;
    const x = geometry.xForIndex(barIndex);
    const y = geometry.y(bar.close);
    const context = this.context;
    context.save();
    context.setLineDash([3, 4]);
    context.strokeStyle = COLORS.crosshair;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, geometry.padding.top);
    context.lineTo(x, geometry.height - geometry.padding.bottom);
    context.moveTo(geometry.padding.left, y);
    context.lineTo(geometry.width - geometry.padding.right, y);
    context.stroke();
    context.restore();

    const hoveredMarker = geometry.markers?.find((item) => item.marker.id === this.hoverMarkerId)?.marker;
    const lines = hoveredMarker
      ? [
          `${hoveredMarker.side} · ${formatNumber(hoveredMarker.quantity, 4)}`,
          `${formatMoney(hoveredMarker.executionPrice || hoveredMarker.price, this.currency)}`,
          formatDateTime(hoveredMarker.timestamp || hoveredMarker.time)
        ]
      : [
          formatDateTime(bar.time),
          `O ${formatNumber(bar.open, 2)}  H ${formatNumber(bar.high, 2)}`,
          `L ${formatNumber(bar.low, 2)}  C ${formatNumber(bar.close, 2)}`,
          `V ${formatCompact(bar.volume)}`
        ];
    drawTooltip(context, x, y, lines, geometry);
  }

  onPointerMove(event) {
    if (this.drag) {
      const geometry = this.geometry;
      if (!geometry) return;
      const deltaX = event.clientX - this.drag.clientX;
      const barsPerPixel = (this.viewEnd - this.viewStart) / Math.max(geometry.plotWidth, 1);
      const shift = deltaX * barsPerPixel;
      this.viewStart = this.drag.viewStart - shift;
      this.viewEnd = this.drag.viewEnd - shift;
      this.clampView();
      this.drag.moved = this.drag.moved || Math.abs(deltaX) > 3;
      this.canvas.classList.add("dragging");
      this.draw();
      return;
    }
    const point = this.eventPoint(event);
    const geometry = this.geometry;
    if (!geometry) return;
    this.hoverIndex = this.indexAtPoint(point);
    const marker = geometry.markers?.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= item.radius);
    const markerId = marker?.marker.id || null;
    if (markerId !== this.hoverMarkerId) {
      this.hoverMarkerId = markerId;
      this.callbacks.onMarkerHover?.(markerId);
    }
    this.draw();
  }

  onPointerLeave() {
    if (this.drag) return;
    this.hoverIndex = null;
    if (this.hoverMarkerId) {
      this.hoverMarkerId = null;
      this.callbacks.onMarkerHover?.(null);
    }
    this.draw();
  }

  onPointerDown(event) {
    const point = this.eventPoint(event);
    const marker = this.geometry?.markers?.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= item.radius);
    if (marker) return;
    this.drag = {
      clientX: event.clientX,
      viewStart: this.viewStart,
      viewEnd: this.viewEnd,
      moved: false
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  onPointerUp(event) {
    if (this.drag) {
      this.drag = null;
      this.canvas.classList.remove("dragging");
      this.canvas.releasePointerCapture?.(event.pointerId);
    }
  }

  onWheel(event) {
    if (!this.bars.length) return;
    event.preventDefault();
    const point = this.eventPoint(event);
    const geometry = this.geometry;
    if (!geometry) return;
    const cursorIndex = this.fractionAtPoint(point) * (geometry.endIndex - geometry.startIndex) + geometry.startIndex;
    const factor = event.deltaY < 0 ? 0.82 : 1.22;
    const currentSpan = this.viewEnd - this.viewStart;
    const nextSpan = Math.max(10, Math.min(this.bars.length, currentSpan * factor));
    const leftRatio = (cursorIndex - this.viewStart) / Math.max(currentSpan, 1);
    this.viewStart = cursorIndex - nextSpan * leftRatio;
    this.viewEnd = this.viewStart + nextSpan;
    this.clampView();
    this.draw();
  }

  onClick(event) {
    if (this.drag?.moved) return;
    const point = this.eventPoint(event);
    const marker = this.geometry?.markers?.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= item.radius);
    if (marker) {
      this.selectedMarkerId = marker.marker.id;
      this.callbacks.onMarkerSelect?.(marker.marker);
      this.draw();
    }
  }

  eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  fractionAtPoint(point) {
    const geometry = this.geometry;
    if (!geometry) return 0;
    return Math.max(0, Math.min(1, (point.x - geometry.padding.left) / geometry.plotWidth));
  }

  indexAtPoint(point) {
    const geometry = this.geometry;
    if (!geometry) return null;
    const index = geometry.startIndex + Math.round(this.fractionAtPoint(point) * Math.max(0, geometry.visibleBars.length - 1));
    return Math.max(0, Math.min(this.bars.length - 1, index));
  }

  clampView() {
    const count = this.bars.length;
    if (!count) {
      this.viewStart = 0;
      this.viewEnd = 1;
      return;
    }
    const minimumSpan = Math.min(10, count);
    let span = Math.max(minimumSpan, Math.min(count, this.viewEnd - this.viewStart));
    if (this.viewStart < 0) {
      this.viewStart = 0;
      this.viewEnd = span;
    }
    if (this.viewEnd > count) {
      this.viewEnd = count;
      this.viewStart = Math.max(0, count - span);
    }
  }
}

function drawTooltip(context, x, y, lines, geometry) {
  context.save();
  context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  const width = Math.max(...lines.map((line) => context.measureText(line).width)) + 20;
  const height = lines.length * 16 + 14;
  let left = x + 14;
  let top = y - height - 12;
  if (left + width > geometry.width - 8) left = x - width - 14;
  if (top < 8) top = y + 14;
  context.fillStyle = COLORS.tooltip;
  roundedRect(context, left, top, width, height, 6);
  context.fill();
  context.strokeStyle = "rgba(238,236,229,.12)";
  context.stroke();
  context.textAlign = "left";
  context.textBaseline = "top";
  lines.forEach((line, index) => {
    context.fillStyle = index === 0 ? COLORS.textStrong : COLORS.text;
    context.fillText(line, left + 10, top + 8 + index * 16);
  });
  context.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function nearestIndex(values, target) {
  if (!Number.isFinite(target) || !values.length) return -1;
  let low = 0;
  let high = values.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  return Math.abs(values[low] - target) < Math.abs(values[low - 1] - target) ? low : low - 1;
}

function dateValue(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAxisPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (Math.abs(number) >= 1000) return number.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  if (Math.abs(number) >= 10) return number.toFixed(2);
  return number.toFixed(3);
}

function formatAxisTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const span = Math.abs(Date.now() - date.getTime());
  return new Intl.DateTimeFormat("en-GB", span > 120 * 86_400_000
    ? { month: "short", year: "2-digit" }
    : span > 2 * 86_400_000
      ? { day: "2-digit", month: "short" }
      : { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatNumber(value, digits) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-GB", { maximumFractionDigits: digits })
    : "—";
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function formatMoney(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 2
  }).format(number);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
