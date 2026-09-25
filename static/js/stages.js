// Framework slide tiles. Embed: the latent map of the probe wrapped onto a slowly turning
// sphere (the genome lies on a hypersphere), dots for the hands as built, rings for their
// rotated copies. Evolve: the CMA-ES samples appearing generation by generation on the plane
// of the first two principal components, the mean path and the best design so far.
(function () {
  var embed = document.querySelector(".stage-embed");
  var evolve = document.querySelector(".stage-evolve");
  if (!embed && !evolve) { return; }
  var css = getComputedStyle(document.documentElement);
  var tok = function (name) { return css.getPropertyValue(name).trim(); };
  var hex = function (value) {
    var m = /^#([0-9a-f]{6})$/i.exec(value);
    if (!m) { return [200, 200, 200]; }
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  };
  var mix = function (a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); };
  var rgba = function (c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
  var COLOR = { text: hex(tok("--text")), muted: hex(tok("--muted")), accent: hex(tok("--accent")), data: hex(tok("--data")) };
  var LINE = tok("--line") || "rgba(255,255,255,0.16)";
  // The figure's five topology colours, lifted a little so they read on black.
  var TOPOLOGY = [[38, 70, 83], [42, 157, 143], [233, 196, 106], [244, 162, 97], [231, 111, 81]]
    .map(function (c) { return mix(c, COLOR.text, 0.18); });
  var isFrozen = document.body.classList.contains("is-capture") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function sizeCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    return dpr;
  }
  function run(root, draw) {
    var visible = false, start = null;
    function frame(now) {
      if (!visible && !isFrozen) { return; }
      if (start === null) { start = now; }
      draw((now - start) / 1000);
      if (!isFrozen) { window.requestAnimationFrame(frame); }
    }
    if (isFrozen) { draw(0); return; }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var was = visible;
          visible = entry.isIntersecting;
          if (visible && !was) { start = null; window.requestAnimationFrame(frame); }
        });
      }, { threshold: 0.2 }).observe(root);
    } else { visible = true; window.requestAnimationFrame(frame); }
  }

  // ---- embed: the probe on a sphere -------------------------------------------------
  function setupEmbed(data) {
    var canvas = embed.querySelector("canvas");
    var arm = data.arms[0], grid = data.grid, n = data.hands;
    var SPREAD = 2.3; // radians of longitude and latitude the map covers on the sphere
    var TURN = 2 * Math.PI / 36; // radians per second about the vertical axis
    var TILT = 0.42; // the sphere leans toward the viewer by this angle
    var FROZEN_ANGLE = 0.5;
    var DOT = 1.3, RING = 2.2;
    function unit(x, y) { // map coordinates to a point on the unit sphere
      var lon = (x / grid - 0.5) * SPREAD, lat = (y / grid - 0.5) * SPREAD;
      return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
    }
    var clean = [], rotated = [];
    for (var i = 0; i < n; i++) {
      clean.push(unit(arm.clean[2 * i], arm.clean[2 * i + 1]));
      rotated.push(unit(arm.rotated[2 * i], arm.rotated[2 * i + 1]));
    }
    function draw(seconds) {
      var dpr = sizeCanvas(canvas), ctx = canvas.getContext("2d");
      var W = canvas.width, H = canvas.height, R = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;
      var a = isFrozen ? FROZEN_ANGLE : seconds * TURN;
      var ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(TILT), st = Math.sin(TILT);
      function view(p) { // turn about y, then tilt about x; z toward the viewer
        var x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca, y = p[1];
        var y2 = y * ct - z * st, z2 = y * st + z * ct;
        return [cx + x * R, cy - y2 * R, z2];
      }
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 0.7 * dpr;
      ctx.strokeStyle = LINE;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      var k, j, p, q;
      for (k = -75; k <= 75; k += 25) { // parallels
        var lat = k * Math.PI / 180, first = true;
        ctx.beginPath();
        for (j = 0; j <= 72; j++) {
          var lon = j / 72 * Math.PI * 2;
          p = view([Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]);
          if (p[2] < 0) { first = true; continue; }
          if (first) { ctx.moveTo(p[0], p[1]); first = false; } else { ctx.lineTo(p[0], p[1]); }
        }
        ctx.stroke();
      }
      for (k = 0; k < 12; k++) { // meridians
        var lon0 = k * Math.PI / 6, first2 = true;
        ctx.beginPath();
        for (j = 0; j <= 72; j++) {
          var lat2 = -Math.PI / 2 + j / 72 * Math.PI;
          p = view([Math.cos(lat2) * Math.sin(lon0), Math.sin(lat2), Math.cos(lat2) * Math.cos(lon0)]);
          if (p[2] < 0) { first2 = true; continue; }
          if (first2) { ctx.moveTo(p[0], p[1]); first2 = false; } else { ctx.lineTo(p[0], p[1]); }
        }
        ctx.stroke();
      }
      ctx.lineWidth = 0.6 * dpr;
      ctx.strokeStyle = rgba(COLOR.muted, 0.25);
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        p = view(clean[i]); q = view(rotated[i]);
        if (p[2] < 0 || q[2] < 0) { continue; }
        ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
      for (var t = 0; t < TOPOLOGY.length; t++) {
        ctx.fillStyle = rgba(TOPOLOGY[t], 0.9);
        ctx.strokeStyle = rgba(TOPOLOGY[t], 0.9);
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (data.topology[i] !== t) { continue; }
          p = view(clean[i]);
          if (p[2] < 0) { continue; }
          var r = DOT * dpr * (0.6 + 0.4 * p[2]);
          ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (data.topology[i] !== t) { continue; }
          q = view(rotated[i]);
          if (q[2] < 0) { continue; }
          var rr = RING * dpr * (0.6 + 0.4 * q[2]);
          ctx.moveTo(q[0] + rr, q[1]); ctx.arc(q[0], q[1], rr, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    }
    run(embed, draw);
  }

  // ---- evolve: the samples generation by generation ---------------------------------
  function setupEvolve(data) {
    var canvas = evolve.querySelector("canvas");
    var GEN_SECONDS = 0.12, HOLD_SECONDS = 3.0, SETTLE = 0.5;
    var G = data.generations, P = data.population, grid = data.grid, xy = data.xy, fit = data.fitness;
    var top = 0;
    for (var i = 0; i < fit.length; i++) { if (fit[i] > top) { top = fit[i]; } }
    var low = COLOR.data, high = COLOR.accent;
    var lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (i = 0; i < xy.length; i += 2) {
      lo[0] = Math.min(lo[0], xy[i]); hi[0] = Math.max(hi[0], xy[i]);
      lo[1] = Math.min(lo[1], xy[i + 1]); hi[1] = Math.max(hi[1], xy[i + 1]);
    }
    var span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 1.12;
    var mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    function draw(seconds) {
      var dpr = sizeCanvas(canvas), ctx = canvas.getContext("2d");
      var W = canvas.width, H = canvas.height, side = Math.min(W, H);
      var X = function (v) { return W / 2 + (v - mid[0]) / span * side; };
      var Y = function (v) { return H / 2 - (v - mid[1]) / span * side; };
      var total = G * GEN_SECONDS + HOLD_SECONDS;
      var t = isFrozen ? G * GEN_SECONDS : seconds % total;
      var shown = Math.min(G, Math.floor(t / GEN_SECONDS) + 1);
      var settle = Math.min(1, (t - (shown - 1) * GEN_SECONDS) / SETTLE);
      ctx.clearRect(0, 0, W, H);
      var bestIndex = -1, bestFit = -Infinity, j, g;
      for (g = 0; g < shown; g++) {
        var isNew = g === shown - 1, alpha = isNew ? settle : 1;
        for (j = 0; j < P; j++) {
          i = g * P + j;
          var x = X(xy[2 * i]), y = Y(xy[2 * i + 1]);
          if (fit[i] < 0) {
            ctx.fillStyle = rgba(COLOR.muted, 0.28 * alpha);
            ctx.beginPath(); ctx.arc(x, y, 1.0 * dpr, 0, Math.PI * 2); ctx.fill();
            continue;
          }
          if (fit[i] > bestFit) { bestFit = fit[i]; bestIndex = i; }
          ctx.fillStyle = rgba(mix(low, high, Math.min(1, fit[i] / top)), 0.85 * alpha);
          ctx.beginPath(); ctx.arc(x, y, 1.7 * dpr, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.lineWidth = 1.0 * dpr;
      ctx.strokeStyle = rgba(COLOR.text, 0.85);
      ctx.beginPath();
      for (g = 0; g < shown; g++) {
        var mx = X(data.mean_xy[2 * g]), my = Y(data.mean_xy[2 * g + 1]);
        if (g === 0) { ctx.moveTo(mx, my); } else { ctx.lineTo(mx, my); }
      }
      ctx.stroke();
      var cx = X(data.mean_xy[2 * (shown - 1)]), cy = Y(data.mean_xy[2 * (shown - 1) + 1]);
      ctx.beginPath(); ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2); ctx.stroke();
      if (bestIndex >= 0) {
        ctx.strokeStyle = rgba(COLOR.accent, 1);
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath(); ctx.arc(X(xy[2 * bestIndex]), Y(xy[2 * bestIndex + 1]), 6 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
    }
    run(evolve, draw);
  }

  if (embed) { fetch(embed.getAttribute("data-src")).then(function (r) { return r.json(); }).then(setupEmbed); }
  if (evolve) { fetch(evolve.getAttribute("data-src")).then(function (r) { return r.json(); }).then(setupEvolve); }
})();
