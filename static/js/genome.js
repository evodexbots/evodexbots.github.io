// Genome panel of section 04: a grammar tree of the decoder's steps for design
// d06. One column per decoding step lists the candidate tokens of that step;
// the tokens the grammar masks out are struck through, the chosen one is
// filled and joined to the previous choice by a hairline. The body view
// advances one growth frame per finished segment. Plain script, no framework.
// Data: static/data/genome_d06.json (materials/genome); frames:
// static/images/growth/d06_NNN.webp (materials/hero), the design still as the
// fallback when the frames are missing.
(function () {
  "use strict";
  var TOKENS_PER_SECOND = 6;
  var HOLD_END_MS = 2000;
  var HOLD_START_MS = 600;
  var MAX_STEP_MS = 100;
  var FRAME_COUNT = 60;
  var FRAME_DIGITS = 3;
  var FRAME_ROOT = 10; // the frame of the finished root; the segments share the frames after it
  var STILL_PROGRESS = 0.4; // the state shown in capture mode and under reduced motion
  var COLUMNS_MAX = 7; // decoding steps in view on a wide panel
  var COLUMNS_MIN = 3; // decoding steps in view on a phone
  var COLUMN_MIN_WIDTH = 100;
  var COLUMN_GAP = 12;
  var COLUMNS_BEHIND = 4; // decoded steps kept in view left of the current one
  var BINS_PER_PAGE = 9; // candidate bins listed per column, the page holding the chosen bin
  var VALUE_STEP_CONTROLS = ["appendage begin", "appendage next", "end"];
  var TICK_MIN_SHARE = 0.3; // shortest tick, as a share of the row height
  var TICK_SHARE = 0.62; // tick width, as a share of the token pitch
  var ROW_HEIGHT = 24;
  var ROW_GAP = 12;
  var MIN_PITCH = 3; // pixels per token before the stream wraps into rows
  var FALLBACK_WIDTH = 600;
  var BAR_PITCH = 10;
  var BAR_WIDTH = 7;
  var BAR_HEIGHT = 64;
  var BAR_BASE = 70;
  var BAR_MIN_OPACITY = 0.3;
  var RESIZE_DELAY_MS = 150;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var panel = document.querySelector("[data-genome-panel]");
  if (!panel) { return; }

  var frameA = role("frame");
  var frameB = role("frame-2");
  var barcodeSvg = role("barcode");
  var chain = role("chain");
  var track = role("track");
  var streamSvg = role("stream");
  var fieldEl = role("field");
  var countEl = role("count");
  var playBtn = role("play");
  var scrub = role("scrub");
  var scrubDone = role("done");
  var scrubHead = role("head");
  if (!frameA || !frameB || !barcodeSvg || !chain || !track || !streamSvg || !fieldEl || !playBtn || !scrub) { return; }

  var isCapture = document.body.classList.contains("is-capture");
  var isReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tokens = [];
  var steps = [];
  var controls = [];
  var growth = [];
  var count = 0;
  var columns = [];
  var links = [];
  var path = null;
  var columnsInView = COLUMNS_MAX;
  var pitch = COLUMN_MIN_WIDTH;
  var ticks = [];
  var playhead = null;
  var frames = [];
  var hasFrames = false;
  var shownFrame = -1;
  var isAFront = true;
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
  var resizeTimer = 0;

  function role(name) {
    return panel.querySelector('[data-role="' + name + '"]');
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function svgElement(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function pad(number) {
    var text = String(number);
    while (text.length < FRAME_DIGITS) { text = "0" + text; }
    return text;
  }

  // ---------- the genome: 32 bars, positive up and negative down ----------
  function drawBarcode(z) {
    clear(barcodeSvg);
    var width = z.length * BAR_PITCH;
    barcodeSvg.setAttribute("viewBox", "0 0 " + width + " " + (BAR_BASE * 2));
    var largest = z.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0) || 1;
    z.forEach(function (value, i) {
      var share = Math.abs(value) / largest;
      var height = Math.max(1, share * BAR_HEIGHT);
      barcodeSvg.appendChild(svgElement("rect", {
        class: "gp-bar",
        x: i * BAR_PITCH + (BAR_PITCH - BAR_WIDTH) / 2,
        y: value >= 0 ? BAR_BASE - height : BAR_BASE,
        width: BAR_WIDTH,
        height: height,
        "fill-opacity": BAR_MIN_OPACITY + (1 - BAR_MIN_OPACITY) * share
      }));
    });
    barcodeSvg.appendChild(svgElement("line", { class: "gp-base", x1: 0, x2: width, y1: BAR_BASE, y2: BAR_BASE }));
  }

  // ---------- the grammar tree: one column of candidate tokens per decoding step ----------
  function controlLabel(name) {
    if (name.indexOf("appendage begin") === 0) {
      var spoke = name.slice("appendage begin".length).trim();
      return spoke ? "begin spoke " + spoke : "begin";
    }
    return name === "appendage next" ? "next" : name;
  }

  function isControlLegal(step, name) {
    return step.legal_controls.some(function (legal) { return legal.indexOf(name) === 0; });
  }

  function box(label, isLegal) {
    return element("span", "gp-box " + (isLegal ? "is-legal" : "is-masked"), label);
  }

  function buildColumn(step) {
    var isControlStep = step.bins === 0;
    var col = element("div", "gp-col is-next");
    col.appendChild(element("span", "gp-col-name", isControlStep ? "control" : step.name));
    col.appendChild(element("span", "gp-col-token", "token " + step.index));
    var boxes = element("div", "gp-boxes");
    var chosen = null;
    if (isControlStep) {
      controls.forEach(function (name, k) {
        var node = box(controlLabel(name), isControlLegal(step, name));
        if (k === step.chosen) { node.classList.add("is-chosen"); chosen = node; }
        boxes.appendChild(node);
      });
      boxes.appendChild(element("span", "gp-gap"));
      boxes.appendChild(box("bins", step.legal_bins > 0));
    } else {
      var first = Math.floor(step.chosen / BINS_PER_PAGE) * BINS_PER_PAGE;
      var last = Math.min(step.bins, first + BINS_PER_PAGE);
      if (first > 0) { boxes.appendChild(element("span", "gp-box gp-more", "···")); }
      for (var b = first; b < last; b++) {
        var node = box(step.candidates ? step.candidates[b] : String(b + 1), b < step.legal_bins);
        if (b === step.chosen) { node.classList.add("is-chosen"); chosen = node; }
        boxes.appendChild(node);
      }
      if (last < step.bins) { boxes.appendChild(element("span", "gp-box gp-more", "···")); }
      boxes.appendChild(element("span", "gp-gap"));
      VALUE_STEP_CONTROLS.forEach(function (name) {
        boxes.appendChild(box(controlLabel(name), isControlLegal(step, name)));
      });
    }
    col.appendChild(boxes);
    return { el: col, chosen: chosen, step: step };
  }

  function buildChain() {
    clear(track);
    columns = steps.map(function (step) {
      var column = buildColumn(step);
      track.appendChild(column.el);
      return column;
    });
    path = svgElement("svg", { class: "gp-path" });
    track.appendChild(path);
  }

  function layoutChain() {
    var width = chain.clientWidth || FALLBACK_WIDTH;
    columnsInView = Math.max(COLUMNS_MIN, Math.min(COLUMNS_MAX, Math.floor(width / COLUMN_MIN_WIDTH)));
    pitch = width / columnsInView;
    track.style.width = (columns.length * pitch) + "px";
    columns.forEach(function (column, i) {
      column.el.style.left = (i * pitch) + "px";
      column.el.style.width = (pitch - COLUMN_GAP) + "px";
    });
    drawLinks();
  }

  function drawLinks() {
    clear(path);
    var origin = track.getBoundingClientRect();
    var previous = null;
    links = columns.map(function (column) {
      if (!column.chosen) { previous = null; return null; }
      var rect = column.chosen.getBoundingClientRect();
      var point = { x1: rect.left - origin.left, x2: rect.right - origin.left, y: (rect.top + rect.bottom) / 2 - origin.top };
      var link = null;
      if (previous) {
        link = svgElement("line", { class: "gp-link", x1: previous.x2, y1: previous.y, x2: point.x1, y2: point.y });
        path.appendChild(link);
      }
      previous = point;
      return link;
    });
  }

  // ---------- the token stream: one tick per token, the whole sequence ----------
  function kindClass(token) {
    if (token.kind === "root") { return "is-root"; }
    if (token.kind === "segment") { return "is-app"; }
    if (token.kind === "control") { return token.field === "appendage begin" ? "is-app-begin" : "is-app-next"; }
    return token.kind === "begin" ? "is-begin" : "is-end";
  }

  function drawStream() {
    clear(streamSvg);
    var width = streamSvg.clientWidth || panel.clientWidth || FALLBACK_WIDTH;
    var perRow = Math.max(1, Math.min(count, Math.floor(width / MIN_PITCH)));
    var rows = Math.ceil(count / perRow);
    perRow = Math.ceil(count / rows);
    var tokenPitch = width / perRow;
    var tickWidth = Math.max(1, Math.floor(tokenPitch * TICK_SHARE));
    var height = rows * ROW_HEIGHT + (rows - 1) * ROW_GAP;
    streamSvg.setAttribute("viewBox", "0 0 " + width + " " + height);
    streamSvg.setAttribute("height", height);
    for (var r = 0; r < rows; r++) {
      var y = r * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT + 0.5;
      streamSvg.appendChild(svgElement("line", { class: "gp-row-line", x1: 0, x2: width, y1: y, y2: y }));
    }
    ticks = tokens.map(function (token, i) {
      var row = Math.floor(i / perRow);
      var col = i % perRow;
      var top = row * (ROW_HEIGHT + ROW_GAP);
      var share = token.bins ? TICK_MIN_SHARE + (1 - TICK_MIN_SHARE) * (token.bin + 1) / token.bins : 1;
      var h = ROW_HEIGHT * share;
      var rect = svgElement("rect", {
        class: "gp-tick " + kindClass(token),
        x: col * tokenPitch + (tokenPitch - tickWidth) / 2,
        y: top + ROW_HEIGHT - h,
        width: tickWidth,
        height: h,
        "data-index": i
      });
      streamSvg.appendChild(rect);
      return { el: rect, x: col * tokenPitch + tokenPitch / 2, top: top };
    });
    playhead = svgElement("line", { class: "gp-playhead", x1: 0, x2: 0, y1: 0, y2: ROW_HEIGHT });
    streamSvg.appendChild(playhead);
  }

  // ---------- labels in the paper's words ----------
  function binText(token) {
    if (typeof token.value === "string") { return token.value; }
    return "bin " + (token.bin + 1) + " / " + token.bins;
  }

  function labelParts(token) {
    if (token.kind === "begin" || token.kind === "end") { return [token.field]; }
    if (token.kind === "root") {
      var where = token.spoke ? "root spoke " + token.spoke : "root";
      var what = token.part === "spoke" && token.spoke ? token.name : token.part + " " + token.name;
      return [where, what, binText(token)];
    }
    if (token.kind === "control") {
      if (token.field === "appendage begin") {
        return ["appendage begin", "appendage " + token.appendage, "root spoke " + token.spoke];
      }
      return ["appendage next", "appendage " + token.appendage, "segment " + token.segment];
    }
    return ["appendage " + token.appendage, "segment " + token.segment, token.part + " " + token.name, binText(token)];
  }

  function writeField(token) {
    clear(fieldEl);
    var parts = labelParts(token);
    parts.forEach(function (text, i) {
      var span = document.createElement("span");
      span.textContent = text;
      if (i === parts.length - 1 && parts.length > 1 && token.kind !== "control") { span.className = "gp-bin"; }
      fieldEl.appendChild(span);
    });
  }

  // ---------- the body: one frame per finished growth step, crossfaded ----------
  function frameFor(index) {
    var finished = growth.filter(function (step) { return step.token_end <= index; }).length;
    if (finished === 0) { return 0; }
    var perStep = (FRAME_COUNT - 1 - FRAME_ROOT) / Math.max(1, growth.length - 1);
    return Math.min(FRAME_COUNT - 1, Math.round(FRAME_ROOT + (finished - 1) * perStep));
  }

  function showFrame(index) {
    if (!hasFrames || index === shownFrame) { return; }
    var frame = frames[index];
    if (!frame || !frame.complete || frame.naturalWidth === 0) { return; }
    shownFrame = index;
    var front = isAFront ? frameA : frameB;
    var back = isAFront ? frameB : frameA;
    back.src = frame.src;
    back.classList.add("is-shown");
    front.classList.remove("is-shown");
    isAFront = !isAFront;
  }

  // ---------- state ----------
  function setProgress(value, isForced) {
    progress = Math.min(1, Math.max(0, value));
    var index = Math.round(progress * (count - 1));
    scrubDone.style.width = (progress * 100) + "%";
    scrubHead.style.left = (progress * 100) + "%";
    scrub.setAttribute("aria-valuenow", String(index));
    if (index === lastIndex && !isForced) { return; }
    track.classList.toggle("is-jump", lastIndex < 0 || Math.abs(index - lastIndex) > columnsInView);
    lastIndex = index;
    var current = index - 1;
    columns.forEach(function (column, i) {
      column.el.classList.toggle("is-past", i < current);
      column.el.classList.toggle("is-now", i === current);
      column.el.classList.toggle("is-next", i > current);
    });
    links.forEach(function (link, i) {
      if (link) { link.classList.toggle("is-lit", i <= current); }
    });
    var behind = Math.min(COLUMNS_BEHIND, columnsInView - 2);
    var offset = Math.max(0, Math.min(columns.length - columnsInView, current - behind)) * pitch;
    track.style.transform = "translateX(" + (-offset) + "px)";
    ticks.forEach(function (tick, i) {
      tick.el.classList.toggle("is-on", i <= index);
      tick.el.classList.toggle("is-now", i === index);
    });
    var tick = ticks[index];
    if (tick && playhead) {
      playhead.setAttribute("x1", tick.x);
      playhead.setAttribute("x2", tick.x);
      playhead.setAttribute("y1", tick.top - ROW_GAP / 2);
      playhead.setAttribute("y2", tick.top + ROW_HEIGHT + ROW_GAP / 2);
    }
    showFrame(frameFor(index));
    writeField(tokens[index]);
    if (countEl) { countEl.textContent = (index + 1) + " / " + count; }
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
        var next = progress + (dt / 1000) * TOKENS_PER_SECOND / (count - 1);
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

  function relayout() {
    layoutChain();
    drawStream();
    setProgress(progress, true);
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
      var step = 1 / (count - 1);
      if (event.key === "ArrowLeft") { setProgress(progress - step); }
      else if (event.key === "ArrowRight") { setProgress(progress + step); }
      else if (event.key === "Home") { setProgress(0); }
      else if (event.key === "End") { setProgress(1); }
      else if (event.key === " " || event.key === "Enter") { wantsPlay = !isPlaying; syncPlayback(); }
      else { return; }
      event.preventDefault();
    });
    streamSvg.addEventListener("click", function (event) {
      var index = event.target && event.target.getAttribute("data-index");
      if (index !== null && index !== undefined) { setProgress(Number(index) / (count - 1)); }
    });
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relayout, RESIZE_DELAY_MS);
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

  // ---------- growth frames, with the design still as the fallback ----------
  function framePath(index) {
    return panel.getAttribute("data-frames") + pad(index) + ".webp";
  }

  function refreshFrame() {
    showFrame(frameFor(Math.round(progress * (count - 1))));
  }

  function loadFrames() {
    var first = new Image();
    first.onload = function () {
      hasFrames = true;
      frames[0] = first;
      for (var i = 1; i < FRAME_COUNT; i++) {
        var image = new Image();
        image.onload = refreshFrame;
        image.src = framePath(i);
        frames[i] = image;
      }
      refreshFrame();
    };
    first.onerror = function () { hasFrames = false; };
    first.src = framePath(0);
  }

  // ---------- start ----------
  function start(data) {
    tokens = data.tokens;
    steps = data.steps;
    controls = data.controls;
    growth = data.growth;
    count = tokens.length;
    if (count < 2 || steps.length !== count - 1) { return; }
    frameA.classList.add("is-shown");
    drawBarcode(data.z_unit || data.z);
    buildChain();
    layoutChain();
    drawStream();
    scrub.setAttribute("aria-valuemax", String(count - 1));
    loadFrames();
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
      if (!response.ok) { throw new Error("genome data " + response.status); }
      return response.json();
    })
    .then(start)
    .catch(function () { panel.classList.add("is-failed"); });
})();
