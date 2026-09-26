// Fade-up on scroll, capture mode for screenshots, active section link.
(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get("capture") === "1") {
    document.body.classList.add("is-capture");
    document.documentElement.classList.add("is-capture");
  }
  // index.html?capture=1&only=<section id>: show that section alone, at the top.
  var only = params.get("only");
  if (only) {
    document.querySelectorAll("main > section, header.topbar, footer.footer").forEach(function (el) {
      var key = el.getAttribute("data-section") || el.id;
      if (key !== only) { el.style.display = "none"; }
    });
  }
  var targets = document.querySelectorAll(".fade-up");
  if ("IntersectionObserver" in window && !document.body.classList.contains("is-capture")) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    targets.forEach(function (el) { observer.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
// Section menu behind the three-line toggle in the top bar.
(function () {
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.querySelector(".menu");
  if (!toggle || !menu) { return; }
  function close() { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
  toggle.addEventListener("click", function () {
    var isOpen = !menu.hidden;
    menu.hidden = isOpen;
    toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", close); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); } });
})();
// Layout debug readout for headless checks: index.html?debug=1
(function () {
  if (new URLSearchParams(window.location.search).get("debug") !== "1") { return; }
  var pick = function (sel) { var el = document.querySelector(sel); if (!el) { return sel + ": none"; }
    var cs = getComputedStyle(el); var r = el.getBoundingClientRect();
    return sel + ": w=" + Math.round(r.width) + " x=" + Math.round(r.left) + " ws=" + cs.whiteSpace + " disp=" + cs.display + " pos=" + cs.position + " minw=" + cs.minWidth + " maxw=" + cs.maxWidth; };
  var pre = document.createElement("pre"); pre.id = "debug";
  var main = document.querySelector("main");
  var rect = function (sel) { var el = document.querySelector(sel); if (!el) { return sel + ": none"; } var r = el.getBoundingClientRect(); return sel + ": x=" + Math.round(r.left) + " y=" + Math.round(r.top) + " w=" + Math.round(r.width) + " h=" + Math.round(r.height); };
  pre.textContent = ["viewport=" + window.innerWidth, rect('.slide[data-section="results"] .slide-media > .render'), rect('.slide[data-section="results"] .slide-media > .clip'), rect(".refs-scroll"), rect(".topbar-center"), "main disp=" + getComputedStyle(main).display + " scrollW=" + main.scrollWidth + " scrollL=" + main.scrollLeft + " slide=" + Math.round(main.scrollLeft / window.innerWidth), pick(".hero"), pick(".hero-left"), pick(".hero-block"), pick(".hero-title"), pick(".hero-title span"), pick(".hero-text"), "media900=" + window.matchMedia("(max-width: 900px)").matches].join("\n");
  document.body.appendChild(pre);
})();

// Slide chrome: every slide gets the hero's bottom bar (previous, section dots, next); arrow keys move one slide.
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll("main > .hero, main > .slide"));
  if (slides.length < 2) { return; }
  var sections = [];
  slides.forEach(function (s) {
    var id = s.getAttribute("data-section");
    if (id && !(sections.length && sections[sections.length - 1].id === id)) {
      sections.push({ id: id, num: s.getAttribute("data-num") || "", name: s.getAttribute("data-name") || "", el: s });
    }
  });
  function label(s) {
    if (!s.getAttribute("data-section")) { return "Top"; }
    return (s.getAttribute("data-num") || "") + " " + (s.getAttribute("data-name") || "");
  }
  function link(target, text, isNext) {
    var a = document.createElement("a");
    a.className = "hero-foot-side";
    a.href = "#" + target.id;
    a.innerHTML = isNext ? text + '<span class="arrow">&#9655;</span>' : '<span class="arrow">&#9665;</span>' + text;
    return a;
  }
  slides.forEach(function (s, i) {
    if (!s.classList.contains("slide")) { return; }
    var id = s.getAttribute("data-section");
    var own = slides.filter(function (o) { return o.getAttribute("data-section") === id; });
    var k = own.indexOf(s) + 1;
    var foot = document.createElement("nav");
    foot.className = "hero-foot slide-foot";
    var center = document.createElement("div");
    center.className = "hero-foot-center";
    var text = document.createElement("p");
    text.className = "hero-foot-label";
    text.textContent = label(s) + (own.length > 1 ? " \u00b7 " + k + " / " + own.length : "");
    var dots = document.createElement("div");
    dots.className = "hero-dots";
    sections.forEach(function (sec) {
      var d = document.createElement("a");
      d.className = "dot" + (sec.id === id ? " is-current" : "");
      d.href = "#" + sec.el.id;
      d.title = sec.num + " " + sec.name;
      dots.appendChild(d);
    });
    center.appendChild(text);
    center.appendChild(dots);
    foot.appendChild(i > 0 ? link(slides[i - 1], label(slides[i - 1]), false) : document.createElement("span"));
    foot.appendChild(center);
    foot.appendChild(i < slides.length - 1 ? link(slides[i + 1], label(slides[i + 1]), true) : document.createElement("span"));
    s.appendChild(foot);
  });
  // Deck navigation: the track scrolls sideways; keys and the wheel move one slide at a time.
  var main = document.querySelector("main");
  var isDeck = function () { return getComputedStyle(main).display === "flex"; };
  var current = function () { return Math.round(main.scrollLeft / window.innerWidth); };
  var goTo = function (index) {
    var target = slides[Math.min(slides.length - 1, Math.max(0, index))];
    if (target) { target.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" }); }
  };
  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { return; }
    var step = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { step = 1; }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { step = -1; }
    if (!step) { return; }
    e.preventDefault();
    if (isDeck()) { goTo(current() + step); return; }
    var y = window.scrollY + window.innerHeight * 0.5;
    var index = 0;
    slides.forEach(function (s, i) { if (s.offsetTop <= y) { index = i; } });
    goTo(index + step);
  });
  // Wheel input: a mouse notch or a trackpad swipe moves one slide. A new swipe is told
  // from the inertia tail of the previous one by acceleration: the recent deltas grow
  // instead of decaying. After a move, input is ignored for LOCK_MS so one swipe cannot
  // move twice. Sideways swipes are left to the browser's own scroll snapping.
  var LOCK_MS = 700;
  var GAP_MS = 400;   // silence longer than this starts a fresh gesture
  var WINDOW = 10;    // deltas compared for acceleration
  var history = [];
  var lastEvent = 0, lastMove = 0, target = null;
  var average = function (list) {
    if (!list.length) { return 0; }
    var sum = 0;
    list.forEach(function (v) { sum += v; });
    return sum / list.length;
  };
  main.addEventListener("wheel", function (e) {
    if (!isDeck()) { return; }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { return; }
    var list = e.target.closest ? e.target.closest(".refs-scroll") : null;
    if (list) {
      var atTop = list.scrollTop <= 0 && e.deltaY < 0;
      var atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1 && e.deltaY > 0;
      if (!atTop && !atEnd) { return; }
    }
    e.preventDefault();
    var now = Date.now();
    if (now - lastEvent > GAP_MS) { history = []; }
    lastEvent = now;
    var size = Math.abs(e.deltaY);
    history.push(size);
    if (history.length > WINDOW * 8) { history.shift(); }
    var recent = history.slice(-WINDOW);
    var before = history.slice(0, -WINDOW);
    var isAccelerating = before.length === 0 || average(recent) >= average(before);
    if (size < 4 || !isAccelerating || now - lastMove < LOCK_MS) { return; }
    var isStale = target === null || now - lastMove > 1500;
    lastMove = now;
    history = [];
    if (isStale) { target = current(); }
    target = Math.min(slides.length - 1, Math.max(0, target + (e.deltaY > 0 ? 1 : -1)));
    goTo(target);
  }, { passive: false });
  main.addEventListener("scrollend", function () { target = null; });
})();

// Fit the media of every slide into its stage: when the media and the caption are taller than
// the stage (short or squarish viewports), the media is zoomed down so nothing overlaps the bars.
(function () {
  var main = document.querySelector("main");
  if (!main) { return; }
  var isDeck = function () { return getComputedStyle(main).display === "flex"; };
  var stages = Array.prototype.slice.call(document.querySelectorAll(".slide-stage"));
  var fit = function () {
    stages.forEach(function (stage) {
      var media = stage.querySelector(".slide-media, .gp-figure, .refs-scroll");
      if (!media) { return; }
      if (!isDeck()) { media.style.zoom = ""; return; }
      var caption = stage.querySelector(":scope > .caption, :scope > .lp-readout");
      media.style.zoom = "";
      var natural = media.offsetHeight;
      var room = stage.clientHeight - (caption ? caption.offsetHeight + 14 : 0);
      if (natural > room && natural > 0) { media.style.zoom = String(Math.max(0.4, room / natural)); }
    });
  };
  var timer = null;
  var schedule = function () { clearTimeout(timer); timer = setTimeout(fit, 60); };
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  if ("ResizeObserver" in window) {
    var observer = new ResizeObserver(schedule);
    stages.forEach(function (stage) { observer.observe(stage); });
  }
  schedule();
})();
