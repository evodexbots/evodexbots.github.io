// Interpolation panel of slide 03-2: the 5 x 5 slerp grid between the four evolved
// manipulators (the paper's interpolation figure), a playhead that walks the grid from
// the corners inward, and the current decoded design over its latent barcode. Plain
// script, no framework. The data comes from static/data/interp.json (see
// materials/interp); the tiles and the large views from
// static/images/interp/{tiles,big}/r<row>c<col>.webp.
(function () {
  "use strict";
  var CELLS_PER_SECOND = 1.6;
  var HOLD_END_MS = 1800;
  var HOLD_START_MS = 700;
  var MAX_STEP_MS = 100;
  var STILL_PROGRESS = 0.4; // the state shown in capture mode and under reduced motion
  var UNIT = 100; // overlay units per grid cell
  var RING_RADIUS = 46;
  var HEAD_RADIUS = 4;
  var NOW_INSET = 1;
  var BAR_PITCH = 10;
  var BAR_WIDTH = 8;
  var BAR_HEIGHT = 16;
  var BAR_GAP = 4;
  var BAR_LEFT = 16; // room for the + and - marks of the two rows
  var BAR_MIN_OPACITY = 0.08;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var panel = document.querySelector("[data-interp-panel]");
  if (!panel) { return; }

  var gridEl = role("grid");
  var overlay = role("overlay");
  var bigEl = role("big");
  var barcodeSvg = role("barcode");
  var cellEl = role("cell");
  var playBtn = role("play");
  var scrub = role("scrub");
  var scrubDone = role("done");
  var scrubHead = role("head");
  if (!gridEl || !overlay || !bigEl || !barcodeSvg || !playBtn || !scrub) { return; }

  var isCapture = document.body.classList.contains("is-capture");
  var isReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var data = null;
  var size = 0;
  var cells = []; // cell records by row * size + col
  var path = []; // cell indices the playhead visits, in order
  var steps = 0;
  var firstVisit = [];
  var tiles = [];
  var bars = [];
  var bigImgs = Array.prototype.slice.call(bigEl.querySelectorAll("img"));
  var frontIndex = 0;
  var shownCell = -1;
  var pathLine = null;
  var nowRect = null;
  var headDot = null;
  var progress = 0;
  var lastIndex = -1;
  var isPlaying = false;
  var wantsPlay = !isReducedMotion;
  var isInView = false;
  var isDragging = false;
  var wasPlaying = false;
  var rafId = 0;
  var lastTime = null;
  var holdUntil = 0;

  function role(name) {
    return panel.querySelector('[data-role="' + name + '"]');
  }

  function svgElement(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function cellIndex(row, col) {
    return row * size + col;
  }

  function centre(cell) {
    return { x: (cell % size) * UNIT + UNIT / 2, y: Math.floor(cell / size) * UNIT + UNIT / 2 };
  }

  function cornerName(cell) {
    for (var i = 0; i < data.corners.length; i++) {
      var corner = data.corners[i];
      if (cellIndex(corner.row, corner.col) === cell) { return corner.name; }
    }
    return "";
  }

  // ---------- the path: every ring from the outside in, each closed where it began ----------
  function spiral() {
    var visits = [];
    for (var ring = 0; ring * 2 < size; ring++) {
      var lo = ring, hi = size - 1 - ring;
      if (lo === hi) { visits.push(cellIndex(lo, lo)); break; }
      var r, c;
      for (c = lo; c < hi; c++) { visits.push(cellIndex(lo, c)); }
      for (r = lo; r < hi; r++) { visits.push(cellIndex(r, hi)); }
      for (c = hi; c > lo; c--) { visits.push(cellIndex(hi, c)); }
      for (r = hi; r > lo; r--) { visits.push(cellIndex(r, lo)); }
      visits.push(cellIndex(lo, lo));
    }
    return visits;
  }

  // ---------- the grid: one tile per cell, the corner names around it, the overlay ----------
  function tilePath(cell) {
    return panel.getAttribute("data-tiles") + cells[cell].label + ".webp";
  }

  function bigPath(cell) {
    return panel.getAttribute("data-big") + cells[cell].label + ".webp";
  }

  function buildTiles() {
    gridEl.style.setProperty("--ip-size", String(size));
    tiles = cells.map(function (cell, i) {
      var tile = document.createElement("div");
      tile.className = "ip-tile";
      tile.setAttribute("data-index", String(i));
      var image = document.createElement("img");
      image.src = tilePath(i);
      image.alt = "";
      tile.appendChild(image);
      gridEl.insertBefore(tile, overlay);
      return tile;
    });
  }

  function buildCorners() {
    var wrap = gridEl.parentNode;
    var ordered = data.corners.slice().sort(function (a, b) { return (a.row - b.row) || (a.col - b.col); });
    ordered.forEach(function (corner) {
      var label = document.createElement("span");
      label.className = "ip-corner" + (corner.col > 0 ? " is-right" : "");
      label.textContent = corner.name;
      if (corner.row === 0) { wrap.insertBefore(label, gridEl); } else { wrap.appendChild(label); }
    });
  }

  function buildOverlay() {
    clear(overlay);
    overlay.setAttribute("viewBox", "0 0 " + size * UNIT + " " + size * UNIT);
    data.corners.forEach(function (corner) {
      var p = centre(cellIndex(corner.row, corner.col));
      overlay.appendChild(svgElement("circle", { class: "ip-ring", cx: p.x, cy: p.y, r: RING_RADIUS }));
    });
    pathLine = svgElement("polyline", { class: "ip-path", points: "" });
    nowRect = svgElement("rect", { class: "ip-now", x: 0, y: 0, width: UNIT - 2 * NOW_INSET, height: UNIT - 2 * NOW_INSET });
    headDot = svgElement("circle", { class: "ip-head-dot", cx: 0, cy: 0, r: HEAD_RADIUS });
    overlay.appendChild(pathLine);
    overlay.appendChild(nowRect);
    overlay.appendChild(headDot);
  }

  // ---------- the barcode: the positive row above the negative row, alpha by magnitude ----------
  function buildBarcode() {
    clear(barcodeSvg);
    var dim = data.latent_dim;
    var width = BAR_LEFT + dim * BAR_PITCH;
    var height = 2 * BAR_HEIGHT + BAR_GAP;
    barcodeSvg.setAttribute("viewBox", "0 0 " + width + " " + height);
    ["+", "−"].forEach(function (mark, rowIndex) {
      var text = svgElement("text", { class: "ip-bar-mark", x: 0, y: rowIndex * (BAR_HEIGHT + BAR_GAP) + BAR_HEIGHT * 0.78 });
      text.textContent = mark;
      barcodeSvg.appendChild(text);
    });
    bars = [];
    for (var i = 0; i < dim; i++) {
      var column = [];
      for (var rowIndex = 0; rowIndex < 2; rowIndex++) {
        var rect = svgElement("rect", {
          class: "ip-bar",
          x: BAR_LEFT + i * BAR_PITCH + (BAR_PITCH - BAR_WIDTH) / 2,
          y: rowIndex * (BAR_HEIGHT + BAR_GAP),
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          rx: 1,
          "fill-opacity": BAR_MIN_OPACITY
        });
        barcodeSvg.appendChild(rect);
        column.push(rect);
      }
      bars.push(column);
    }
  }

  function drawBarcode(cell) {
    var record = cells[cell];
    var color = "rgb(" + record.color.join(",") + ")";
    record.z.forEach(function (value, i) {
      var share = Math.min(1, Math.abs(value) / data.latent_max);
      var strong = BAR_MIN_OPACITY + (1 - BAR_MIN_OPACITY) * share;
      bars[i][0].setAttribute("fill", color);
      bars[i][1].setAttribute("fill", color);
      bars[i][0].setAttribute("fill-opacity", value > 0 ? strong : BAR_MIN_OPACITY);
      bars[i][1].setAttribute("fill-opacity", value < 0 ? strong : BAR_MIN_OPACITY);
    });
  }

  // ---------- the large view: two stacked images, cross-faded on every cell change ----------
  function preloadBig() {
    cells.forEach(function (_, i) {
      var image = new Image();
      image.src = bigPath(i);
    });
  }

  function showBig(cell) {
    if (cell === shownCell || bigImgs.length < 2) { return; }
    shownCell = cell;
    var front = bigImgs[frontIndex];
    var back = bigImgs[1 - frontIndex];
    back.src = bigPath(cell);
    back.classList.add("is-front");
    front.classList.remove("is-front");
    frontIndex = 1 - frontIndex;
  }

  function writeCell(cell) {
    if (!cellEl) { return; }
    var record = cells[cell];
    var name = cornerName(cell);
    var where = "row " + record.row + " · col " + record.col;
    cellEl.textContent = name ? name + " · " + where : where;
  }

  // ---------- state ----------
  function setProgress(value, isForced) {
    progress = Math.min(1, Math.max(0, value));
    var position = progress * steps;
    var index = Math.min(steps, Math.round(position));
    scrubDone.style.width = (progress * 100) + "%";
    scrubHead.style.left = (progress * 100) + "%";
    scrub.setAttribute("aria-valuenow", String(index));
    var from = Math.min(steps, Math.floor(position));
    var to = Math.min(steps, from + 1);
    var share = position - from;
    var a = centre(path[from]);
    var b = centre(path[to]);
    var hx = a.x + (b.x - a.x) * share;
    var hy = a.y + (b.y - a.y) * share;
    headDot.setAttribute("cx", hx);
    headDot.setAttribute("cy", hy);
    var points = [];
    for (var i = 0; i <= from; i++) {
      var p = centre(path[i]);
      points.push(p.x + "," + p.y);
    }
    points.push(hx + "," + hy);
    pathLine.setAttribute("points", points.join(" "));
    if (index === lastIndex && !isForced) { return; }
    lastIndex = index;
    var cell = path[index];
    tiles.forEach(function (tile, k) {
      tile.classList.toggle("is-seen", firstVisit[k] <= index);
      tile.classList.toggle("is-now", k === cell);
    });
    var c = centre(cell);
    nowRect.setAttribute("x", c.x - UNIT / 2 + NOW_INSET);
    nowRect.setAttribute("y", c.y - UNIT / 2 + NOW_INSET);
    showBig(cell);
    drawBarcode(cell);
    writeCell(cell);
  }

  // ---------- playback ----------
  function tick(now) {
    if (!isPlaying) { rafId = 0; return; }
    if (lastTime === null) { lastTime = now; }
    var dt = Math.min(MAX_STEP_MS, now - lastTime);
    lastTime = now;
    if (now >= holdUntil) {
      if (progress >= 1) {
        setProgress(0);
        holdUntil = now + HOLD_START_MS;
      } else {
        var next = progress + (dt / 1000) * CELLS_PER_SECOND / steps;
        if (next >= 1) {
          setProgress(1);
          holdUntil = now + HOLD_END_MS;
        } else {
          setProgress(next);
        }
      }
    }
    rafId = window.requestAnimationFrame(tick);
  }

  function play() {
    if (isPlaying) { return; }
    isPlaying = true;
    panel.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Pause");
    lastTime = null;
    rafId = window.requestAnimationFrame(tick);
  }

  function pause() {
    isPlaying = false;
    panel.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Play");
    if (rafId) { window.cancelAnimationFrame(rafId); }
    rafId = 0;
  }

  function syncPlayback() {
    if (wantsPlay && isInView && !isDragging) { play(); } else { pause(); }
  }

  // ---------- controls ----------
  function scrubTo(event) {
    var rect = scrub.getBoundingClientRect();
    if (rect.width > 0) { setProgress((event.clientX - rect.left) / rect.width); }
  }

  function endDrag(event) {
    if (!isDragging) { return; }
    isDragging = false;
    if (scrub.hasPointerCapture && scrub.hasPointerCapture(event.pointerId)) {
      scrub.releasePointerCapture(event.pointerId);
    }
    wantsPlay = wasPlaying;
    syncPlayback();
  }

  function bindControls() {
    playBtn.addEventListener("click", function () {
      wantsPlay = !isPlaying;
      if (wantsPlay && progress >= 1) { setProgress(0); }
      syncPlayback();
    });
    scrub.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      wasPlaying = wantsPlay;
      isDragging = true;
      pause();
      if (scrub.setPointerCapture) { scrub.setPointerCapture(event.pointerId); }
      scrubTo(event);
    });
    scrub.addEventListener("pointermove", function (event) {
      if (isDragging) { scrubTo(event); }
    });
    scrub.addEventListener("pointerup", endDrag);
    scrub.addEventListener("pointercancel", endDrag);
    scrub.addEventListener("keydown", function (event) {
      var step = 1 / steps;
      if (event.key === "ArrowLeft") { setProgress(progress - step); }
      else if (event.key === "ArrowRight") { setProgress(progress + step); }
      else if (event.key === "Home") { setProgress(0); }
      else if (event.key === "End") { setProgress(1); }
      else if (event.key === " " || event.key === "Enter") { wantsPlay = !isPlaying; syncPlayback(); }
      else { return; }
      event.preventDefault();
    });
    gridEl.addEventListener("click", function (event) {
      var tile = event.target && event.target.closest ? event.target.closest(".ip-tile") : null;
      if (!tile) { return; }
      var cell = Number(tile.getAttribute("data-index"));
      if (firstVisit[cell] >= 0) { setProgress(firstVisit[cell] / steps); }
    });
  }

  function watchViewport() {
    if (!("IntersectionObserver" in window)) {
      isInView = true;
      syncPlayback();
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        isInView = entry.isIntersecting;
        syncPlayback();
      });
    }, { threshold: 0.2 });
    observer.observe(panel);
  }

  // ---------- start ----------
  function start(payload) {
    data = payload;
    size = data.size;
    if (!size || !data.cells || data.cells.length !== size * size) { return; }
    cells = new Array(size * size);
    data.cells.forEach(function (cell) { cells[cellIndex(cell.row, cell.col)] = cell; });
    path = spiral();
    steps = path.length - 1;
    firstVisit = cells.map(function (_, i) { return path.indexOf(i); });
    buildTiles();
    buildCorners();
    buildOverlay();
    buildBarcode();
    preloadBig();
    scrub.setAttribute("aria-valuemax", String(steps));
    if (isCapture) {
      setProgress(STILL_PROGRESS, true);
      return;
    }
    setProgress(isReducedMotion ? STILL_PROGRESS : 0, true);
    bindControls();
    watchViewport();
  }

  window.fetch(panel.getAttribute("data-json"))
    .then(function (response) {
      if (!response.ok) { throw new Error("interpolation data " + response.status); }
      return response.json();
    })
    .then(start)
    .catch(function () { panel.classList.add("is-failed"); });
})();
