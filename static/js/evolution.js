// Evolution panel: one CMA-ES campaign record, generation by generation. Left, every sampled
// genotype on the plane of the first two principal components of the samples, with the
// distribution mean moving across it; right, the best fitness so far against the two
// reference levels of the paper's curve figure. Capture mode and reduced motion show the end.
(function () {
  var root = document.querySelector(".ev");
  if (!root || !root.getAttribute("data-src")) { return; }
  var canvas = root.querySelector("canvas");
  if (!canvas) { return; }
  var GEN_SECONDS = 0.12; // one generation per this many seconds while the run plays
  var HOLD_SECONDS = 3.5; // the end state stays this long before the loop restarts
  var SETTLE_SECONDS = 0.5; // a new generation's samples settle over this time
  var DOT = 1.7;
  var FITNESS_MAX = 3; // rad/s, the top of the fitness axis
  var css = getComputedStyle(document.documentElement);
  var tok = function (name) { return css.getPropertyValue(name).trim(); };
  var hex = function (value) {
    var m = /^#([0-9a-f]{6})$/i.exec(value);
    if (!m) { return [200, 200, 200]; }
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  };
  var mix = function (a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); };
  var rgba = function (c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
  var COLOR = { text: hex(tok("--text")), muted: hex(tok("--muted")), accent: hex(tok("--accent")) };
  var LINE = tok("--line") || "rgba(255,255,255,0.16)";
  var LINE_STRONG = tok("--line-strong") || "rgba(255,255,255,0.4)";
  var MONO = tok("--font-mono") || "monospace";
  var data = null, visible = false, start = null, endFrozen = false;
  var isFrozen = document.body.classList.contains("is-capture") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    return dpr;
  }
  function font(px, dpr) { return "400 " + Math.round(px * dpr) + "px " + MONO; }
  function measured(f) { return f > -800; }
  // Timeline: generations play in order, the end state holds, then the loop restarts.
  function stateAt(seconds) {
    var G = data.generations, total = G * GEN_SECONDS + HOLD_SECONDS;
    var t = seconds % total;
    var shown = Math.min(G, Math.floor(t / GEN_SECONDS) + 1);
    var age = t - (shown - 1) * GEN_SECONDS;
    return { shown: shown, settle: Math.min(1, age / SETTLE_SECONDS) };
  }
  function layout(W, H, dpr) {
    var pad = 14 * dpr, gap = 22 * dpr;
    if (W >= 1.25 * H) {
      var side = H - 2 * pad;
      return {
        plane: { x: pad, y: pad, w: side, h: side },
        curve: { x: pad + side + gap, y: pad, w: W - 2 * pad - side - gap, h: side }
      };
    }
    var half = (H - 2 * pad - gap) / 2;
    return {
      plane: { x: pad, y: pad, w: W - 2 * pad, h: half },
      curve: { x: pad, y: pad + half + gap, w: W - 2 * pad, h: half }
    };
  }
  function drawPlane(ctx, box, shown, settle, dpr) {
    var P = data.population, grid = data.grid, xy = data.xy, fit = data.fitness;
    var side = Math.min(box.w, box.h), ox = box.x + (box.w - side) / 2, oy = box.y + (box.h - side) / 2;
    var X = function (v) { return ox + v / grid * side; };
    var Y = function (v) { return oy + (1 - v / grid) * side; };
    var best = data.best.fitness;
    ctx.lineWidth = 1;
    ctx.strokeStyle = LINE;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    ctx.font = font(10.5, dpr);
    ctx.fillStyle = rgba(COLOR.muted, 1);
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("LATENT SPACE \u00b7 BEST OF FIVE TRIALS", box.x + 10 * dpr, box.y + 9 * dpr);
    var rad = DOT * dpr, bestIndex = -1, bestValue = -Infinity;
    // rejected designs first, dim; then measured designs, brighter the fitter
    ctx.beginPath();
    for (var i = 0; i < shown * P; i++) {
      if (measured(fit[i])) { continue; }
      var x = X(xy[2 * i]), y = Y(xy[2 * i + 1]);
      ctx.moveTo(x + rad * 0.8, y); ctx.arc(x, y, rad * 0.8, 0, Math.PI * 2);
    }
    ctx.fillStyle = rgba(COLOR.muted, 0.22);
    ctx.fill();
    for (var g = 0; g < shown; g++) {
      var alpha = g === shown - 1 ? 0.35 + 0.55 * settle : 0.9;
      for (var k = 0; k < P; k++) {
        var j = g * P + k, f = fit[j];
        if (!measured(f)) { continue; }
        if (f > bestValue) { bestValue = f; bestIndex = j; }
        var t = Math.max(0, Math.min(1, f / best));
        var px = X(xy[2 * j]), py = Y(xy[2 * j + 1]);
        ctx.beginPath();
        ctx.arc(px, py, rad * (0.9 + 0.6 * t), 0, Math.PI * 2);
        ctx.fillStyle = rgba(mix(COLOR.muted, COLOR.text, 0.25 + 0.75 * t), alpha);
        ctx.fill();
      }
    }
    // the distribution mean moving across the latent space
    ctx.beginPath();
    for (var m = 0; m < shown; m++) {
      var mx = X(data.mean_xy[2 * m]), my = Y(data.mean_xy[2 * m + 1]);
      if (m === 0) { ctx.moveTo(mx, my); } else { ctx.lineTo(mx, my); }
    }
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = LINE_STRONG;
    ctx.stroke();
    var cx = X(data.mean_xy[2 * (shown - 1)]), cy = Y(data.mean_xy[2 * (shown - 1) + 1]);
    ctx.beginPath(); ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
    ctx.lineWidth = 1 * dpr; ctx.strokeStyle = rgba(COLOR.text, 1); ctx.stroke();
    // the best design so far
    if (bestIndex >= 0) {
      ctx.beginPath(); ctx.arc(X(xy[2 * bestIndex]), Y(xy[2 * bestIndex + 1]), 5.5 * dpr, 0, Math.PI * 2);
      ctx.lineWidth = 1 * dpr; ctx.strokeStyle = rgba(COLOR.accent, 1); ctx.stroke();
      ctx.font = font(10.5, dpr);
      ctx.textBaseline = "bottom"; ctx.textAlign = "left";
      ctx.fillStyle = rgba(COLOR.muted, 1);
      ctx.fillText("BEST SO FAR  " + data.appendages[bestIndex] + " APPENDAGES  " + data.joints[bestIndex] + " JOINTS", box.x + 10 * dpr, box.y + box.h - 9 * dpr);
    }
  }
  function drawCurve(ctx, box, shown, dpr) {
    var G = data.generations, P = data.population, fit = data.fitness, bsf = data.best_so_far;
    var left = box.x + 34 * dpr, right = box.x + box.w - 12 * dpr;
    var top = box.y + 30 * dpr, bottom = box.y + box.h - 26 * dpr;
    var X = function (g) { return left + g / G * (right - left); };
    var Y = function (f) { return bottom - Math.max(0, Math.min(FITNESS_MAX, f)) / FITNESS_MAX * (bottom - top); };
    ctx.lineWidth = 1;
    ctx.strokeStyle = LINE;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    ctx.font = font(10.5, dpr);
    ctx.fillStyle = rgba(COLOR.muted, 1);
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.fillText("BEST FITNESS SO FAR  (RAD/S)", box.x + 10 * dpr, box.y + 9 * dpr);
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(COLOR.text, 1);
    ctx.fillText("GENERATION " + shown + " / " + G, box.x + box.w - 10 * dpr, box.y + 9 * dpr);
    // axes as hairlines with mono tick labels
    ctx.strokeStyle = LINE_STRONG; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
    ctx.font = font(9.5, dpr);
    ctx.fillStyle = rgba(COLOR.muted, 1);
    for (var f = 0; f <= FITNESS_MAX; f++) {
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(String(f), left - 6 * dpr, Y(f));
      ctx.beginPath(); ctx.moveTo(left - 3 * dpr, Y(f)); ctx.lineTo(left, Y(f)); ctx.stroke();
    }
    for (var g = 0; g <= G; g += 25) {
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(String(g), X(g), bottom + 6 * dpr);
      ctx.beginPath(); ctx.moveTo(X(g), bottom); ctx.lineTo(X(g), bottom + 3 * dpr); ctx.stroke();
    }
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("GENERATION", right, bottom + 6 * dpr + 12 * dpr);
    // the paper's reference levels, dashed hairlines
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    data.references.forEach(function (ref, r) {
      var y = Y(ref.value);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.textBaseline = r === 0 ? "bottom" : "top";
      ctx.fillText(ref.label.toUpperCase() + "  " + ref.value.toFixed(2), right - 2 * dpr, y + (r === 0 ? -3 : 3) * dpr);
    });
    ctx.setLineDash([]);
    // every generation's best design, faint; the best so far as a step line
    ctx.beginPath();
    for (var q = 0; q < shown; q++) {
      var gb = -Infinity;
      for (var k = 0; k < P; k++) { if (fit[q * P + k] > gb) { gb = fit[q * P + k]; } }
      if (!measured(gb)) { continue; }
      var dx = X(q + 0.5), dy = Y(gb);
      ctx.moveTo(dx + 1.2 * dpr, dy); ctx.arc(dx, dy, 1.2 * dpr, 0, Math.PI * 2);
    }
    ctx.fillStyle = rgba(COLOR.muted, 0.55);
    ctx.fill();
    ctx.beginPath();
    for (var s = 0; s < shown; s++) {
      var x0 = X(s), x1 = X(s + 1), y = Y(bsf[s]);
      if (s === 0) { ctx.moveTo(x0, y); } else { ctx.lineTo(x0, y); }
      ctx.lineTo(x1, y);
    }
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = rgba(COLOR.text, 1); ctx.stroke();
    var ex = X(shown), ey = Y(bsf[shown - 1]);
    ctx.beginPath(); ctx.arc(ex, ey, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = rgba(COLOR.accent, 1); ctx.fill();
    ctx.font = font(10.5, dpr);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(COLOR.accent, 1);
    var lx = Math.min(ex + 8 * dpr, right - 34 * dpr);
    ctx.fillText(bsf[shown - 1].toFixed(2), lx, ey - (ey < top + 12 * dpr ? -10 * dpr : 0));
  }
  function draw(seconds) {
    var dpr = sizeCanvas();
    var ctx = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var state = isFrozen || endFrozen ? { shown: data.generations, settle: 1 } : stateAt(seconds);
    var boxes = layout(W, H, dpr);
    drawPlane(ctx, boxes.plane, state.shown, state.settle, dpr);
    drawCurve(ctx, boxes.curve, state.shown, dpr);
  }
  function frame(now) {
    if (!visible && !isFrozen) { return; }
    if (start === null) { start = now; }
    draw((now - start) / 1000);
    if (!isFrozen) { window.requestAnimationFrame(frame); }
  }
  function setup(payload) {
    data = payload;
    var begin = function () {
      if (isFrozen) {
        draw(0);
        window.addEventListener("resize", function () { draw(0); });
        return;
      }
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var was = visible;
            visible = entry.isIntersecting;
            if (visible && !was) { start = null; window.requestAnimationFrame(frame); }
          });
        }, { threshold: 0.2 }).observe(root);
      } else {
        visible = true; window.requestAnimationFrame(frame);
      }
    };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(begin, begin); } else { begin(); }
  }
  fetch(root.getAttribute("data-src")).then(function (r) { return r.json(); }).then(setup);
})();
