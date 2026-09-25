// Latent space panel: every hand of the topology probe, as built and rotated, under the four
// embeddings; the rotated copies fly from their originals to where each embedding puts them.
(function () {
  var root = document.querySelector(".lp");
  if (!root || !root.getAttribute("data-src")) { return; }
  var PHASES = [["in", 0.8], ["fly", 1.6], ["hold", 1.4], ["back", 1.2], ["rest", 0.6]];
  var TOTAL = PHASES.reduce(function (s, p) { return s + p[1]; }, 0);
  var DOT = 1.15;
  var LINK_ALPHA = 0.28;
  var HOVER_RADIUS = 14;
  // The figure's palette, one colour per topology in the probe's order (the paper's "earth" palette).
  var FIGURE_PALETTE = [[38, 70, 83], [42, 157, 143], [233, 196, 106], [244, 162, 97], [231, 111, 81]];
  var css = getComputedStyle(document.documentElement);
  var tok = function (name) { return css.getPropertyValue(name).trim(); };
  var hex = function (value) {
    var m = /^#([0-9a-f]{6})$/i.exec(value);
    if (!m) { return [200, 200, 200]; }
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  };
  var mix = function (a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); };
  var rgba = function (c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
  var COLOR = { data: hex(tok("--data")), accent: hex(tok("--accent")), text: hex(tok("--text")), muted: hex(tok("--muted")) };
  var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var panels = Array.prototype.slice.call(root.querySelectorAll(".lp-panel"));
  var readout = root.parentNode.querySelector(".lp-readout");
  var data = null, palette = [], hover = -1, visible = false, start = null;
  var isFrozen = document.body.classList.contains("is-capture") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function topologyColor(t) {
    var base = FIGURE_PALETTE[t % FIGURE_PALETTE.length];
    return mix(base, COLOR.text, 0.18); // lifted a little so the dark teal reads on black
  }
  function sizeCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    return dpr;
  }
  function phaseAt(seconds) {
    var t = seconds % TOTAL, acc = 0;
    for (var i = 0; i < PHASES.length; i++) {
      if (t < acc + PHASES[i][1]) { return { name: PHASES[i][0], t: (t - acc) / PHASES[i][1] }; }
      acc += PHASES[i][1];
    }
    return { name: "rest", t: 0 };
  }
  function draw(seconds) {
    var phase = isFrozen ? { name: "hold", t: 0.5 } : phaseAt(seconds);
    var p = phase.name === "fly" ? ease(phase.t) : phase.name === "hold" ? 1 : phase.name === "back" ? 1 - ease(phase.t) : 0;
    var fade = phase.name === "in" ? phase.t : 1;
    var n = data.hands, grid = data.grid;
    data.arms.forEach(function (arm, k) {
      var canvas = panels[k].querySelector("canvas");
      var dpr = sizeCanvas(canvas);
      var ctx = canvas.getContext("2d");
      var W = canvas.width, H = canvas.height, side = Math.min(W, H), ox = (W - side) / 2, oy = (H - side) / 2;
      ctx.clearRect(0, 0, W, H);
      var c = arm.clean, r = arm.rotated;
      var X = function (v) { return ox + v / grid * side; };
      var Y = function (v) { return oy + (1 - v / grid) * side; };
      if (p > 0) {
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var x0 = X(c[2 * i]), y0 = Y(c[2 * i + 1]);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 + (X(r[2 * i]) - x0) * p, y0 + (Y(r[2 * i + 1]) - y0) * p);
        }
        ctx.lineWidth = 0.8 * dpr;
        ctx.strokeStyle = rgba(COLOR.muted, LINK_ALPHA * Math.min(1, p * 2));
        ctx.stroke();
      }
      var rad = DOT * dpr;
      for (var t = 0; t < palette.length; t++) {
        ctx.beginPath();
        for (var j = 0; j < n; j++) {
          if (data.topology[j] !== t) { continue; }
          var x = X(c[2 * j]), y = Y(c[2 * j + 1]);
          ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2);
        }
        ctx.fillStyle = rgba(palette[t], 0.9 * fade);
        ctx.fill();
        if (p > 0) {
          ctx.beginPath();
          for (var q = 0; q < n; q++) {
            if (data.topology[q] !== t) { continue; }
            var cx = X(c[2 * q]), cy = Y(c[2 * q + 1]);
            var hx = cx + (X(r[2 * q]) - cx) * p, hy = cy + (Y(r[2 * q + 1]) - cy) * p;
            ctx.moveTo(hx + rad, hy); ctx.arc(hx, hy, rad, 0, Math.PI * 2);
          }
          ctx.lineWidth = 0.9 * dpr;
          ctx.strokeStyle = rgba(palette[t], 0.9);
          ctx.stroke();
        }
      }
      if (hover >= 0) {
        var ring = 5 * dpr;
        ctx.lineWidth = 1.2 * dpr;
        ctx.strokeStyle = rgba(COLOR.data, 1);
        ctx.beginPath(); ctx.arc(X(c[2 * hover]), Y(c[2 * hover + 1]), ring, 0, Math.PI * 2); ctx.stroke();
        if (p > 0) {
          var ex = X(c[2 * hover]) + (X(r[2 * hover]) - X(c[2 * hover])) * p;
          var ey = Y(c[2 * hover + 1]) + (Y(r[2 * hover + 1]) - Y(c[2 * hover + 1])) * p;
          ctx.beginPath(); ctx.arc(ex, ey, ring, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X(c[2 * hover]), Y(c[2 * hover + 1])); ctx.lineTo(ex, ey); ctx.stroke();
        }
      }
    });
  }
  function frame(now) {
    if (!visible && !isFrozen) { return; }
    if (start === null) { start = now; }
    draw((now - start) / 1000);
    if (!isFrozen) { window.requestAnimationFrame(frame); }
  }
  function nearest(canvas, arm, ex, ey) {
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.width, H = canvas.height, side = Math.min(W, H), ox = (W - side) / 2, oy = (H - side) / 2;
    var px = ex * dpr, py = ey * dpr, best = -1, bestD = HOVER_RADIUS * dpr;
    for (var i = 0; i < data.hands; i++) {
      var x = ox + arm.clean[2 * i] / data.grid * side, y = oy + (1 - arm.clean[2 * i + 1] / data.grid) * side;
      var d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  function setup(payload) {
    data = payload;
    palette = data.topology_names.map(function (_, t) { return topologyColor(t); });
    var key = root.querySelector(".lp-key-topologies");
    if (key) {
      key.innerHTML = data.topology_names.map(function (name, t) {
        return '<span><i style="background:' + rgba(palette[t], 1) + '"></i>' + name + "</span>";
      }).join("");
    }
    panels.forEach(function (panel, k) {
      var canvas = panel.querySelector("canvas");
      canvas.addEventListener("mousemove", function (e) {
        var box = canvas.getBoundingClientRect();
        var hit = nearest(canvas, data.arms[k], e.clientX - box.left, e.clientY - box.top);
        if (hit !== hover) {
          hover = hit;
          if (readout) { readout.textContent = hit >= 0 ? data.topology_names[data.topology[hit]] : ""; }
          if (isFrozen) { draw(0); }
        }
      });
      canvas.addEventListener("mouseleave", function () { hover = -1; if (readout) { readout.textContent = ""; } if (isFrozen) { draw(0); } });
    });
    if (isFrozen) { draw(0); return; }
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
  }
  fetch(root.getAttribute("data-src")).then(function (r) { return r.json(); }).then(setup);
})();
