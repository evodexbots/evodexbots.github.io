// Framework slide tiles. Embed: the latent map of the probe wrapped onto a slowly turning
// sphere (the genome lies on a hypersphere), dots for the hands as built, rings for their
// rotated copies. Evolve: the six trials of the overview figure growing their fitness
// landscapes on a sphere cap, one after another, with their walks.
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

  // ---- evolve: the six trials of the overview figure on a sphere cap ----------------
  // The whole latent sphere first; the camera turns to the figure's view and the mapped
  // region is cut out; then, in the order of the figure's letters, each trial's samples
  // raise its fitness landscape while its walk climbs from the shared start.
  function setupEvolve(data) {
    var canvas = evolve.querySelector("canvas");
    // Letters and colours as the submitted overview figure prints them (the figure's
    // colour order, not the task panels'): A rotate, G hang, I pick, M hold, O flip,
    // U retrieve. Kept until the paper is revised after review.
    var ORDER = [["rotate", "A", [102, 185, 221]], ["hang", "G", [223, 156, 85]],
      ["pick", "I", [16, 140, 156]], ["hold", "M", [200, 103, 39]],
      ["flip", "O", [0, 80, 127]], ["retrieve", "U", [147, 47, 24]]];
    var N = 72;                 // terrain cells per side
    // intro: the whole latent sphere, the camera turning to the figure's view, the
    // boundary of the mapped region cut out, then the cap alone
    var T_SPHERE = 1.2, T_TURN = 2.0, T_CUT = 1.4, T_REVEAL = 1.0;
    var GEN_SECONDS = 0.045;    // one generation
    var PAUSE_SECONDS = 0.35;   // between two trials
    var HOLD_SECONDS = 3.5;     // the finished cap
    var FADE_SECONDS = 0.6;
    var SHARPNESS = 8;          // how hard the task colours meet
    var VIEW_START = [15, -20], VIEW_END = [60, -55];  // (elevation, azimuth) in degrees
    var GROUND = [26, 32, 46];
    var G = data.grid, ex = data.extent[0], ey = data.extent[1];
    var R = 0.5 / (data.cap_half_angle_deg * Math.PI / 180);
    var capH = data.cap_height, gamma = data.relief_gamma, bw = data.bandwidth;
    var byName = {};
    data.tasks.forEach(function (t) { byName[t.name] = t; });
    var tasks = ORDER.map(function (o) {
      return { name: o[0], letter: o[1], color: o[2], data: byName[o[0]], env: new Float32Array(N * N), added: 0 };
    });
    var x0 = -ex / 2, y0 = -ey / 2, dx = ex / (N - 1), dy = ey / (N - 1);
    var reach = Math.ceil(3 * bw / Math.min(dx, dy));
    var ease = function (u) { u = Math.max(0, Math.min(1, u)); return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; };
    function addSample(env, x, y, h) {
      var ci = Math.round((x - x0) / dx), cj = Math.round((y - y0) / dy);
      for (var j = Math.max(0, cj - reach); j <= Math.min(N - 1, cj + reach); j++) {
        for (var i = Math.max(0, ci - reach); i <= Math.min(N - 1, ci + reach); i++) {
          var px0 = x0 + i * dx - x, py0 = y0 + j * dy - y;
          var v = Math.exp(-0.5 * (px0 * px0 + py0 * py0) / (bw * bw)) * h;
          var k = j * N + i;
          if (v > env[k]) { env[k] = v; }
        }
      }
    }
    function addUntil(task, gens) {  // samples of generations < gens
      var d = task.data, n = d.height.length;
      while (task.added < n && d.generation[task.added] < gens) {
        var a = task.added;
        addSample(task.env, d.xy[2 * a] / G, d.xy[2 * a + 1] / G, d.height[a]);
        task.added++;
      }
    }
    var finalMax = 0;
    tasks.forEach(function (t) { addUntil(t, Infinity); });
    for (var k0 = 0; k0 < N * N; k0++) {
      tasks.forEach(function (t) { if (t.env[k0] > finalMax) { finalMax = t.env[k0]; } });
    }
    function reset() { tasks.forEach(function (t) { t.env.fill(0); t.added = 0; }); }
    var tIntro = T_SPHERE + T_TURN + T_CUT + T_REVEAL;
    var schedule = [], tEnd = tIntro;
    tasks.forEach(function (t) {
      schedule.push({ task: t, start: tEnd });
      tEnd += t.data.generations * GEN_SECONDS + PAUSE_SECONDS;
    });
    var total = tEnd + HOLD_SECONDS + FADE_SECONDS;
    function capPoint(x, y, h) {
      var lon = x / R, lat = y / R, r = R + h;
      return [r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon) - R];
    }
    function spherePoint(lon, lat) {  // the whole latent sphere, centre (0, 0, -R), poles up and down
      return [R * Math.cos(lat) * Math.cos(lon), R * Math.cos(lat) * Math.sin(lon), R * Math.sin(lat) - R];
    }
    function camera(view) {
      var e = view[0] * Math.PI / 180, a = view[1] * Math.PI / 180;
      var ce = Math.cos(e), se = Math.sin(e), ca = Math.cos(a), sa = Math.sin(a);
      return { dir: [ce * ca, ce * sa, se], right: [-sa, ca, 0], up: [-se * ca, -se * sa, ce] };
    }
    var dot = function (p, v) { return p[0] * v[0] + p[1] * v[1] + p[2] * v[2]; };
    // the rim of the mapped region, on the bare sphere
    var rimUV = [];
    var RIM_N = 60;
    for (var r1 = 0; r1 <= RIM_N; r1++) { rimUV.push([x0 + ex * r1 / RIM_N, y0]); }
    for (r1 = 1; r1 <= RIM_N; r1++) { rimUV.push([x0 + ex, y0 + ey * r1 / RIM_N]); }
    for (r1 = 1; r1 <= RIM_N; r1++) { rimUV.push([x0 + ex - ex * r1 / RIM_N, y0 + ey]); }
    for (r1 = 1; r1 <= RIM_N; r1++) { rimUV.push([x0, y0 + ey - ey * r1 / RIM_N]); }
    function fitFor(cam, W, H, isSphere) {
      var lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      var add = function (p) {
        var u = dot(p, cam.right), v = dot(p, cam.up);
        lo[0] = Math.min(lo[0], u); hi[0] = Math.max(hi[0], u); lo[1] = Math.min(lo[1], v); hi[1] = Math.max(hi[1], v);
      };
      if (isSphere) {
        var c = [0, 0, -R], cu = dot(c, cam.right), cv = dot(c, cam.up);
        lo = [cu - R, cv - R]; hi = [cu + R, cv + R];
      } else {
        rimUV.forEach(function (uv) { add(capPoint(uv[0], uv[1], 0)); });
        tasks.forEach(function (task) {
          var m = task.data.mean, wk = task.data.walk;
          for (var g = 0; g < wk.length; g += 5) { add(capPoint(m[2 * g] / G, m[2 * g + 1] / G, wk[g])); }
        });
      }
      var scale = Math.min(W * 0.88 / (hi[0] - lo[0]), H * 0.88 / (hi[1] - lo[1]));
      return { scale: scale, cu: (lo[0] + hi[0]) / 2, cv: (lo[1] + hi[1]) / 2 };
    }
    var px = new Float32Array(N * N), py = new Float32Array(N * N), pz = new Float32Array(N * N);
    var cr = new Float32Array(N * N), cg = new Float32Array(N * N), cb = new Float32Array(N * N);
    var order = [];
    for (var q = 0; q < (N - 1) * (N - 1); q++) { order.push(q); }
    var depthOf = new Float32Array((N - 1) * (N - 1));

    // index.html?evolve_t=<seconds> freezes the tile at that moment, for layout checks
    var fixedT = parseFloat(new URLSearchParams(window.location.search).get("evolve_t"));
    function draw(seconds) {
      var t = isFrozen ? tEnd : seconds % total;
      if (!isNaN(fixedT)) { t = fixedT; reset(); }
      if (!isFrozen && t < 0.05) { reset(); }
      var fade = 1;
      if (!isFrozen && t > tEnd + HOLD_SECONDS) { fade = Math.max(0, 1 - (t - tEnd - HOLD_SECONDS) / FADE_SECONDS); }
      var fadeIn = isFrozen ? 1 : Math.min(1, t / 0.5);
      var turn = ease((t - T_SPHERE) / T_TURN);
      var cut = Math.max(0, Math.min(1, (t - T_SPHERE - T_TURN) / T_CUT));
      var reveal = ease((t - T_SPHERE - T_TURN - T_CUT) / T_REVEAL);
      var progress = schedule.map(function (s) {
        var g = isFrozen ? s.task.data.generations : Math.max(0, Math.min(s.task.data.generations, (t - s.start) / GEN_SECONDS));
        addUntil(s.task, Math.ceil(g));
        return g;
      });
      var dpr = sizeCanvas(canvas), ctx = canvas.getContext("2d");
      var W = canvas.width, H = canvas.height;
      var view = [VIEW_START[0] + (VIEW_END[0] - VIEW_START[0]) * turn, VIEW_START[1] + (VIEW_END[1] - VIEW_START[1]) * turn];
      var cam = camera(view);
      // the framing moves from the whole sphere to the cap with the camera
      var fs = fitFor(cam, W, H, true), fc = fitFor(cam, W, H, false);
      var zoom = ease((t - T_SPHERE - T_TURN * 0.3) / (T_TURN * 0.7 + T_CUT));
      var scale = fs.scale + (fc.scale - fs.scale) * zoom;
      var cu = fs.cu + (fc.cu - fs.cu) * zoom, cv = fs.cv + (fc.cv - fs.cv) * zoom;
      var SX = function (p) { return W / 2 + scale * (dot(p, cam.right) - cu); };
      var SY = function (p) { return H / 2 - scale * (dot(p, cam.up) - cv); };
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      // 1. the whole sphere: silhouette and front graticule, fading as the cap takes over
      var sphereAlpha = fadeIn * (1 - reveal);
      if (sphereAlpha > 0.01) {
        var centre = [0, 0, -R];
        ctx.strokeStyle = rgba(COLOR.text, 0.5 * sphereAlpha); ctx.lineWidth = 0.9 * dpr;
        ctx.beginPath(); ctx.arc(SX(centre), SY(centre), R * scale, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = rgba(COLOR.text, 0.16 * sphereAlpha); ctx.lineWidth = 0.6 * dpr;
        var front = function (p) { return dot([p[0], p[1], p[2] + R], cam.dir) > 0; };
        var lineOn = function (pts) {
          ctx.beginPath(); var open = false;
          pts.forEach(function (p) {
            if (!front(p)) { open = false; return; }
            if (!open) { ctx.moveTo(SX(p), SY(p)); open = true; } else { ctx.lineTo(SX(p), SY(p)); }
          });
          ctx.stroke();
        };
        for (var la = -60; la <= 75; la += 15) {
          var ring = [];
          for (var s1 = 0; s1 <= 96; s1++) { ring.push(spherePoint(s1 / 96 * 2 * Math.PI, la * Math.PI / 180)); }
          lineOn(ring);
        }
        for (var lo2 = 0; lo2 < 180; lo2 += 15) {
          var mer = [];
          for (var s2 = 0; s2 <= 96; s2++) {
            var th = s2 / 96 * 2 * Math.PI;
            mer.push(spherePoint(lo2 * Math.PI / 180, th));
          }
          lineOn(mer);
        }
      }
      // 2. the boundary of the mapped region, drawn on the bare sphere
      if (cut > 0) {
        var upto = Math.floor(cut * (rimUV.length - 1));
        ctx.strokeStyle = rgba(COLOR.data, 0.9 * (1 - reveal) + 0.1); ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        for (var r2 = 0; r2 <= upto; r2++) {
          var pr = capPoint(rimUV[r2][0], rimUV[r2][1], 0);
          if (r2 === 0) { ctx.moveTo(SX(pr), SY(pr)); } else { ctx.lineTo(SX(pr), SY(pr)); }
        }
        ctx.stroke();
      }
      if (reveal <= 0) { ctx.globalAlpha = 1; return; }
      // 3. the cap: terrain heights and colours
      var i, j, k;
      for (k = 0; k < N * N; k++) {
        var relief = 0;
        for (var a = 0; a < tasks.length; a++) { if (tasks[a].env[k] > relief) { relief = tasks[a].env[k]; } }
        var hgt = capH * Math.pow(relief / finalMax, gamma);
        i = k % N; j = (k - i) / N;
        var p = capPoint(x0 + i * dx, y0 + j * dy, hgt);
        px[k] = p[0]; py[k] = p[1]; pz[k] = p[2];
        var r0 = GROUND[0], g0 = GROUND[1], b0 = GROUND[2];
        if (relief > 1e-4) {
          var wsum = 0, mr = 0, mg = 0, mb = 0;
          for (a = 0; a < tasks.length; a++) {
            var w = Math.exp(SHARPNESS * (tasks[a].env[k] / relief - 1));
            var col = tasks[a].color, zt = Math.sqrt(tasks[a].env[k] / finalMax);
            var lift = Math.max(0, zt - 0.75) / 0.25 * 0.3, base = Math.min(1, zt / 0.75);
            mr += w * (r0 + (col[0] + (255 - col[0]) * lift - r0) * base);
            mg += w * (g0 + (col[1] + (255 - col[1]) * lift - g0) * base);
            mb += w * (b0 + (col[2] + (255 - col[2]) * lift - b0) * base);
            wsum += w;
          }
          r0 = mr / wsum; g0 = mg / wsum; b0 = mb / wsum;
        }
        cr[k] = r0; cg[k] = g0; cb[k] = b0;
      }
      ctx.globalAlpha = fade * reveal;
      for (q = 0; q < order.length; q++) {
        var a0 = q % (N - 1) + Math.floor(q / (N - 1)) * N;
        depthOf[q] = px[a0] * cam.dir[0] + py[a0] * cam.dir[1] + pz[a0] * cam.dir[2];
      }
      order.sort(function (a1, b1) { return depthOf[a1] - depthOf[b1]; });
      var light = [-0.4, 0.3, 0.87];
      for (var n = 0; n < order.length; n++) {
        var qd = order[n], qi = qd % (N - 1), qj = Math.floor(qd / (N - 1));
        var k00 = qj * N + qi, k10 = k00 + 1, k01 = k00 + N, k11 = k01 + 1;
        var ux = px[k10] - px[k00], uy = py[k10] - py[k00], uz = pz[k10] - pz[k00];
        var vx = px[k01] - px[k00], vy = py[k01] - py[k00], vz = pz[k01] - pz[k00];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        var shade = 0.55 + 0.45 * Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / nl);
        var rr = (cr[k00] + cr[k11]) / 2 * shade, gg = (cg[k00] + cg[k11]) / 2 * shade, bb = (cb[k00] + cb[k11]) / 2 * shade;
        ctx.fillStyle = "rgb(" + (rr | 0) + "," + (gg | 0) + "," + (bb | 0) + ")";
        var P00 = [px[k00], py[k00], pz[k00]], P10 = [px[k10], py[k10], pz[k10]], P11 = [px[k11], py[k11], pz[k11]], P01 = [px[k01], py[k01], pz[k01]];
        ctx.beginPath();
        ctx.moveTo(SX(P00), SY(P00)); ctx.lineTo(SX(P10), SY(P10)); ctx.lineTo(SX(P11), SY(P11)); ctx.lineTo(SX(P01), SY(P01));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6 * dpr; ctx.stroke();
      }
      // graticule and rim on the cap
      ctx.lineWidth = 0.6 * dpr;
      var STEP = Math.round((N - 1) / 9);
      ctx.strokeStyle = rgba(COLOR.text, 0.12);
      for (var line = 0; line < N; line += STEP) {
        [0, 1].forEach(function (axis) {
          ctx.beginPath();
          for (var s3 = 0; s3 < N; s3++) {
            var kk = axis ? line * N + s3 : s3 * N + line, P = [px[kk], py[kk], pz[kk] + 0.002];
            if (s3 === 0) { ctx.moveTo(SX(P), SY(P)); } else { ctx.lineTo(SX(P), SY(P)); }
          }
          ctx.stroke();
        });
      }
      ctx.strokeStyle = rgba(COLOR.text, 0.45); ctx.lineWidth = 0.9 * dpr; ctx.beginPath();
      var rim = [];
      for (i = 0; i < N; i++) { rim.push(i); }
      for (j = 1; j < N; j++) { rim.push(j * N + N - 1); }
      for (i = N - 2; i >= 0; i--) { rim.push((N - 1) * N + i); }
      for (j = N - 2; j >= 0; j--) { rim.push(j * N); }
      rim.forEach(function (kk, idx) {
        var P = [px[kk], py[kk], pz[kk]];
        if (idx === 0) { ctx.moveTo(SX(P), SY(P)); } else { ctx.lineTo(SX(P), SY(P)); }
      });
      ctx.closePath(); ctx.stroke();
      // 4. the walks
      ctx.globalAlpha = fade;
      var st = capPoint(data.start[0] / G, data.start[1] / G, data.start_walk);
      tasks.forEach(function (task, ti) {
        var g = progress[ti];
        if (g <= 0) { return; }
        var m = task.data.mean, wk = task.data.walk, last = Math.min(wk.length - 1, Math.floor(g));
        var pts = [[SX(st), SY(st)]];
        for (var g2 = 0; g2 <= last; g2++) {
          var pw = capPoint(m[2 * g2] / G, m[2 * g2 + 1] / G, wk[g2]);
          pts.push([SX(pw), SY(pw)]);
        }
        [[3.6, "rgba(5,7,13,0.9)"], [2.0, rgba(task.color, 1)]].forEach(function (style) {
          ctx.lineWidth = style[0] * dpr; ctx.strokeStyle = style[1]; ctx.lineJoin = "round";
          ctx.beginPath();
          pts.forEach(function (p2, idx) { if (idx === 0) { ctx.moveTo(p2[0], p2[1]); } else { ctx.lineTo(p2[0], p2[1]); } });
          ctx.stroke();
        });
        var end = pts[pts.length - 1];
        if (g >= task.data.generations) {
          ctx.fillStyle = rgba(COLOR.text, 1); ctx.beginPath(); ctx.arc(end[0], end[1], 7.5 * dpr, 0, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = "rgb(5,7,13)"; ctx.font = "600 " + Math.round(9.5 * dpr) + "px " + (tok("--font-mono") || "monospace");
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(task.letter, end[0], end[1] + 0.5 * dpr);
        } else {
          ctx.fillStyle = rgba(task.color, 1); ctx.beginPath(); ctx.arc(end[0], end[1], 2.6 * dpr, 0, 2 * Math.PI); ctx.fill();
        }
      });
      ctx.fillStyle = rgba(COLOR.text, reveal); ctx.beginPath(); ctx.arc(SX(st), SY(st), 3 * dpr, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    }
    run(evolve, draw);
  }

  if (embed) { fetch(embed.getAttribute("data-src")).then(function (r) { return r.json(); }).then(setupEmbed); }
  if (evolve) { fetch(evolve.getAttribute("data-src")).then(function (r) { return r.json(); }).then(setupEvolve); }
})();
