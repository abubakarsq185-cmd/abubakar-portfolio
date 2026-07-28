/* Dewan-e-Hareem — interactions
   Nav toggle, sticky-header shading, scroll reveals, footer year. */

(function () {
  "use strict";

  /* ---- Mobile nav toggle ---- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");

  function closeNav() {
    if (!links) return;
    links.classList.remove("open");
    document.body.classList.remove("nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeNav);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  /* ---- Sticky header shading on scroll ---- */
  var header = document.getElementById("siteHeader");
  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Scroll reveal ---- */
  var revealTargets = [
    ".section-head", ".about-copy", ".about-media",
    ".service-card", ".menu-item", ".marquee-copy", ".marquee-media",
    ".bakery-copy", ".bakery-media", ".gtile",
    ".review-card", ".location-card", ".contact-card", ".menu-note"
  ];
  var nodes = document.querySelectorAll(revealTargets.join(","));
  nodes.forEach(function (n, i) {
    n.setAttribute("data-reveal", "");
    n.style.transitionDelay = (i % 6) * 60 + "ms";
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    nodes.forEach(function (n) { io.observe(n); });
  } else {
    nodes.forEach(function (n) { n.classList.add("in"); });
  }

  /* ---- Gallery lightbox ---- */
  var grid = document.getElementById("galleryGrid");
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCaption");
  var lbClose = document.getElementById("lbClose");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");

  if (grid && lb && lbImg) {
    var tiles = Array.prototype.slice.call(grid.querySelectorAll(".gtile img"));
    var slides = tiles.map(function (img) {
      return { src: img.getAttribute("src"), alt: img.getAttribute("alt") || "" };
    });
    var current = 0;
    var lastFocused = null;

    function render() {
      var s = slides[current];
      lbImg.setAttribute("src", s.src);
      lbImg.setAttribute("alt", s.alt);
      lbCap.textContent = s.alt;
    }
    function openAt(i) {
      current = i;
      lastFocused = document.activeElement;
      render();
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add("show"); });
      document.body.classList.add("nav-open");
      lbClose.focus();
    }
    function closeLb() {
      lb.classList.remove("show");
      document.body.classList.remove("nav-open");
      window.setTimeout(function () { lb.hidden = true; }, 300);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    function step(dir) {
      current = (current + dir + slides.length) % slides.length;
      render();
    }

    grid.querySelectorAll(".gtile").forEach(function (btn, i) {
      btn.addEventListener("click", function () { openAt(i); });
    });
    lbClose.addEventListener("click", closeLb);
    lbPrev.addEventListener("click", function () { step(-1); });
    lbNext.addEventListener("click", function () { step(1); });
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target === lb.querySelector(".lb-figure")) closeLb();
    });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }

  /* ---- Footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();


/* MENU-FILTER - category chips */
(function(){
  var mf=document.getElementById('menuFilter');
  var cat=document.getElementById('menuCatalog');
  if(!mf||!cat) return;
  var chips=mf.querySelectorAll('.mf-chip');
  var blocks=cat.querySelectorAll('.menu-cat-block');
  mf.addEventListener('click',function(e){
    var btn=e.target.closest('.mf-chip'); if(!btn) return;
    chips.forEach(function(c){ c.classList.toggle('active', c===btn); });
    var f=btn.getAttribute('data-filter');
    blocks.forEach(function(b){ b.style.display=(f==='all'||b.getAttribute('data-cat')===f)?'':'none'; });
  });
})();

/* ADMIN-EDITOR — owner-editable menu (photo / name / price), stored in the browser */
(function () {
  "use strict";
  var PASS = "hareem2026";                 // ← owner passcode (change this)
  var KEY  = "deh_menu_overrides_v1";
  var PUBLISHED = "data/menu-data.json";   // optional published edits for all visitors

  var catalog = document.getElementById("menuCatalog");
  var loginBtn = document.getElementById("adminLogin");
  if (!catalog || !loginBtn) return;

  var store = {};      // current overrides {id:{name,price,img}}
  var orig  = {};      // original values captured on load
  var editingId = null;

  function readStore() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function writeStore() { localStorage.setItem(KEY, JSON.stringify(store)); }

  function dishEl(id) { return catalog.querySelector('.dish[data-id="' + id + '"]'); }
  function parts(el) {
    return {
      name: el.querySelector(".dn-text"),
      price: el.querySelector(".dp-val"),
      img: el.querySelector(".dish-img img")
    };
  }

  // capture originals
  catalog.querySelectorAll(".dish[data-id]").forEach(function (el) {
    var p = parts(el);
    orig[el.getAttribute("data-id")] = {
      name: p.name ? p.name.textContent : "",
      price: p.price ? p.price.textContent : "",
      img: p.img ? p.img.getAttribute("src") : ""
    };
  });

  function applyOne(id) {
    var el = dishEl(id); if (!el) return;
    var o = store[id]; if (!o) return;
    var p = parts(el);
    if (o.name && p.name) p.name.textContent = o.name;
    if (o.price && p.price) p.price.textContent = o.price;
    if (o.img && p.img) { p.img.style.display = ""; p.img.src = o.img; }
  }
  function applyAll() { Object.keys(store).forEach(applyOne); }

  // load published edits (for all visitors), then local overrides on top.
  // Only fetch over http(s); skip on file:// so opening locally shows no errors.
  store = readStore();
  if (/^https?:$/.test(location.protocol)) {
    fetch(PUBLISHED, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (pub) {
        if (pub && typeof pub === "object") {
          Object.keys(pub).forEach(function (id) { store[id] = Object.assign({}, pub[id], store[id]); });
        }
      })
      .catch(function () {})
      .then(applyAll);
  } else {
    applyAll();
  }

  // ---- toast ----
  var toast;
  function say(msg) {
    if (!toast) { toast = document.createElement("div"); toast.className = "admin-toast"; document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add("show");
    window.clearTimeout(say._t); say._t = window.setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  // ---- admin mode ----
  var bar = document.getElementById("adminBar");
  function enterAdmin() { document.body.classList.add("admin-on"); if (bar) bar.hidden = false; say("Owner mode on — tap a dish to edit"); }
  function exitAdmin() { document.body.classList.remove("admin-on"); if (bar) bar.hidden = true; }

  var exitBtn = document.getElementById("adminExit");
  if (exitBtn) exitBtn.addEventListener("click", exitAdmin);

  /* ================= SECURE OWNER LOGIN ================= */
  var AUTH_KEY = "deh_auth_v1";
  var DEFAULTS = { user: "owner", pass: "hareem2026", recovery: "HAREEM-RESET-2026" };
  var MAX_TRIES = 5, LOCK_MS = 60000;

  // compact SHA-256 (works on http, https and file://) ---------------------
  function sha256(ascii) {
    function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var m = Math, h, i, j, res = "", words = [], hh = [], k = [];
    var maxWord = m.pow(2, 32), lengthProperty, bytes, b;
    var hash = hh = [], K = k = [];
    var primeCounter = 0, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hh[primeCounter] = (m.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (m.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii = unescape(encodeURIComponent(ascii));
    bytes = [];
    for (i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i) & 0xff);
    bytes.push(0x80);
    var L = ascii.length * 8;
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 0; i < 8; i++) bytes.push((L / m.pow(2, (7 - i) * 8)) & 0xff);
    words = [];
    for (i = 0; i < bytes.length; i++) { j = i % 4; words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((3 - j) * 8)); }
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hh.slice(0);
      for (i = 16; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var s0 = (rr(7, w15) ^ rr(18, w15) ^ (w15 >>> 3));
        var s1 = (rr(17, w2) ^ rr(19, w2) ^ (w2 >>> 10));
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = hh[0], bb = hh[1], c = hh[2], d = hh[3], e = hh[4], f = hh[5], g = hh[6], hgt = hh[7];
      for (i = 0; i < 64; i++) {
        var S1 = rr(6, e) ^ rr(11, e) ^ rr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hgt + S1 + ch + k[i] + w[i]) | 0;
        var S0 = rr(2, a) ^ rr(13, a) ^ rr(22, a);
        var maj = (a & bb) ^ (a & c) ^ (bb & c);
        var t2 = (S0 + maj) | 0;
        hgt = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      hh[0] = (hh[0] + a) | 0; hh[1] = (hh[1] + bb) | 0; hh[2] = (hh[2] + c) | 0; hh[3] = (hh[3] + d) | 0;
      hh[4] = (hh[4] + e) | 0; hh[5] = (hh[5] + f) | 0; hh[6] = (hh[6] + g) | 0; hh[7] = (hh[7] + hgt) | 0;
    }
    for (i = 0; i < 8; i++) { for (j = 3; j + 1; j--) { var byte = (hh[i] >> (j * 8)) & 255; res += ((byte < 16) ? "0" : "") + byte.toString(16); } }
    return res;
  }
  function rndSalt() { var s = ""; for (var i = 0; i < 16; i++) s += (((i * 2654435761) ^ (Date && 0)) % 16 || (i * 7 + 3) % 16).toString(16); return s; }
  function mkSalt() { // avoid Math.random dependency issues; derive from performance+counter
    var base = String((window.performance && performance.now ? performance.now() : 0)) + ":" + (mkSalt._c = (mkSalt._c || 0) + 1) + ":" + navigator.userAgent;
    return sha256(base).slice(0, 16);
  }
  function hashWith(salt, value) { return sha256(salt + "|" + value); }

  function loadAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { return null; } }
  function saveAuth(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
  function seedAuth() {
    var s1 = mkSalt(), s2 = mkSalt();
    var a = { user: DEFAULTS.user, pSalt: s1, pHash: hashWith(s1, DEFAULTS.pass), rSalt: s2, rHash: hashWith(s2, DEFAULTS.recovery.toUpperCase()), tries: 0, lockUntil: 0 };
    saveAuth(a); return a;
  }
  var auth = loadAuth() || seedAuth();

  // modal helpers
  var authModal = document.getElementById("authModal");
  function q(id) { return document.getElementById(id); }
  function showView(v) {
    authModal.querySelectorAll(".auth-view").forEach(function (el) { el.hidden = el.getAttribute("data-view") !== v; });
    ["authMsgLogin", "authMsgForgot", "authMsgChange"].forEach(function (id) { var e = q(id); if (e) e.hidden = true; });
  }
  function openAuth(v) { authModal.hidden = false; showView(v || "login"); var u = q("authUser"); if (v !== "change" && u) { u.value = auth.user; setTimeout(function () { q("authPass").focus(); }, 50); } }
  function closeAuth() { authModal.hidden = true; }
  function msg(id, text, ok) { var e = q(id); if (!e) return; e.textContent = text; e.className = "auth-msg " + (ok ? "ok" : "err"); e.hidden = false; }

  // login button (footer) toggles / opens login
  loginBtn.addEventListener("click", function () {
    if (document.body.classList.contains("admin-on")) { exitAdmin(); return; }
    openAuth("login");
  });
  q("authClose").addEventListener("click", closeAuth);
  authModal.addEventListener("click", function (e) { if (e.target === authModal) closeAuth(); });
  document.addEventListener("keydown", function (e) { if (!authModal.hidden && e.key === "Escape") closeAuth(); });

  q("authLoginBtn").addEventListener("click", function () {
    var now = Date.now();
    if (auth.lockUntil && now < auth.lockUntil) {
      msg("authMsgLogin", "Too many attempts. Try again in " + Math.ceil((auth.lockUntil - now) / 1000) + "s."); return;
    }
    var u = q("authUser").value.trim(), p = q("authPass").value;
    if (u.toLowerCase() === String(auth.user).toLowerCase() && hashWith(auth.pSalt, p) === auth.pHash) {
      auth.tries = 0; auth.lockUntil = 0; saveAuth(auth);
      closeAuth(); enterAdmin(); q("authPass").value = "";
    } else {
      auth.tries = (auth.tries || 0) + 1;
      if (auth.tries >= MAX_TRIES) { auth.lockUntil = now + LOCK_MS; auth.tries = 0; msg("authMsgLogin", "Too many attempts. Locked for 60 seconds."); }
      else msg("authMsgLogin", "Incorrect username or password. (" + (MAX_TRIES - auth.tries) + " left)");
      saveAuth(auth);
    }
  });
  q("authPass").addEventListener("keydown", function (e) { if (e.key === "Enter") q("authLoginBtn").click(); });

  q("authForgotLink").addEventListener("click", function () { showView("forgot"); });
  q("authBackLink").addEventListener("click", function () { showView("login"); });
  q("authResetBtn").addEventListener("click", function () {
    var code = q("authRecovery").value.trim().toUpperCase(), np = q("authNewPass").value;
    if (hashWith(auth.rSalt, code) !== auth.rHash) { msg("authMsgForgot", "That recovery code is not correct."); return; }
    if (np.length < 4) { msg("authMsgForgot", "New password must be at least 4 characters."); return; }
    var s = mkSalt(); auth.pSalt = s; auth.pHash = hashWith(s, np); auth.tries = 0; auth.lockUntil = 0; saveAuth(auth);
    msg("authMsgForgot", "Password reset. You can now log in.", true);
    setTimeout(function () { showView("login"); }, 1200);
  });

  var changeBtn = q("adminChangePass");
  if (changeBtn) changeBtn.addEventListener("click", function () { openAuth("change"); });
  q("authBackLink2").addEventListener("click", closeAuth);
  q("authChangeBtn").addEventListener("click", function () {
    var cur = q("authCurPass").value, np = q("authChgNew").value, nr = q("authChgRec").value.trim();
    if (hashWith(auth.pSalt, cur) !== auth.pHash) { msg("authMsgChange", "Current password is incorrect."); return; }
    if (np.length < 4) { msg("authMsgChange", "New password must be at least 4 characters."); return; }
    var s = mkSalt(); auth.pSalt = s; auth.pHash = hashWith(s, np);
    if (nr) { var s2 = mkSalt(); auth.rSalt = s2; auth.rHash = hashWith(s2, nr.toUpperCase()); }
    saveAuth(auth);
    msg("authMsgChange", "Password updated ✓", true);
    setTimeout(closeAuth, 1000);
  });

  // Google / phone — honest placeholder until Firebase is connected
  function socialNote() {
    var n = q("authSocialNote");
    n.textContent = "Google & phone sign-in switch on once a Firebase project is connected (free). Ask your developer to add the keys — for now use username & password above.";
    n.hidden = false;
  }
  q("authGoogle").addEventListener("click", socialNote);
  q("authPhone").addEventListener("click", socialNote);

  // Direct admin link: #admin or #owner opens the login page.
  function maybeHashLogin() {
    if (/^#(admin|owner)$/i.test(location.hash) && !document.body.classList.contains("admin-on")) openAuth("login");
  }
  window.addEventListener("hashchange", maybeHashLogin);
  maybeHashLogin();

  // ---- edit modal ----
  var modal = document.getElementById("adminModal");
  var mTitle = document.getElementById("adminModalTitle");
  var fName = document.getElementById("adminName");
  var fPrice = document.getElementById("adminPrice");
  var fImg = document.getElementById("adminImg");
  var preview = document.getElementById("adminPreview");
  var previewPh = document.getElementById("adminPreviewPh");
  var pendingImg = null;

  function showPreview(src) {
    if (src) { preview.src = src; preview.hidden = false; previewPh.hidden = true; }
    else { preview.removeAttribute("src"); preview.hidden = true; previewPh.hidden = false; }
  }
  function openEdit(el) {
    editingId = el.getAttribute("data-id");
    var p = parts(el);
    mTitle.textContent = "Edit — " + (p.name ? p.name.textContent : "item");
    fName.value = p.name ? p.name.textContent : "";
    fPrice.value = p.price ? p.price.textContent : "";
    pendingImg = null;
    var cur = (store[editingId] && store[editingId].img) || null;
    showPreview(cur || (p.img && p.img.style.display !== "none" && p.img.getAttribute("src")) || null);
    modal.hidden = false;
    fName.focus();
  }
  function closeEdit() { modal.hidden = true; editingId = null; pendingImg = null; }

  catalog.addEventListener("click", function (e) {
    if (!document.body.classList.contains("admin-on")) return;
    var d = e.target.closest(".dish[data-id]"); if (!d) return;
    openEdit(d);
  });

  if (fImg) fImg.addEventListener("change", function () {
    var f = fImg.files && fImg.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { pendingImg = rd.result; showPreview(pendingImg); };
    rd.readAsDataURL(f);
  });

  document.getElementById("adminSave").addEventListener("click", function () {
    if (editingId == null) return;
    var o = store[editingId] || {};
    var el = dishEl(editingId); var p = parts(el);
    var name = fName.value.trim(), price = fPrice.value.trim();
    if (name) o.name = name;
    if (price) o.price = price;
    if (pendingImg) o.img = pendingImg;
    store[editingId] = o;
    writeStore(); applyOne(editingId);
    closeEdit(); say("Saved ✓");
  });

  document.getElementById("adminResetItem").addEventListener("click", function () {
    if (editingId == null) return;
    delete store[editingId]; writeStore();
    var el = dishEl(editingId); var p = parts(el); var o = orig[editingId];
    if (p.name) p.name.textContent = o.name;
    if (p.price) p.price.textContent = o.price;
    if (p.img) { p.img.style.display = ""; p.img.src = o.img; }
    closeEdit(); say("Item reset");
  });

  document.getElementById("adminClose").addEventListener("click", closeEdit);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeEdit(); });
  document.addEventListener("keydown", function (e) { if (!modal.hidden && e.key === "Escape") closeEdit(); });

  // ---- export / import ----
  document.getElementById("adminExport").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "menu-data.json";
    document.body.appendChild(a); a.click(); a.remove();
    say("Exported menu-data.json");
  });
  var importInput = document.getElementById("adminImport");
  if (importInput) importInput.addEventListener("change", function () {
    var f = importInput.files && importInput.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result);
        Object.keys(data).forEach(function (id) { store[id] = Object.assign({}, store[id], data[id]); });
        writeStore(); applyAll(); say("Imported ✓");
      } catch (err) { window.alert("That file could not be read as menu data."); }
    };
    rd.readAsText(f);
  });
})();

/* SHOWCASE-SLIDER — auto-rotating food carousel (1.5s, infinite, crossfade) */
(function () {
  "use strict";
  var slider = document.getElementById("slider");
  if (!slider) return;
  var slides = Array.prototype.slice.call(slider.querySelectorAll(".slide"));
  if (slides.length < 2) return;
  var dotsWrap = document.getElementById("sliderDots");
  var DELAY = 1500, i = 0, timer = null;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var dots = [];
  if (dotsWrap) {
    slides.forEach(function (s, idx) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-label", "Go to slide " + (idx + 1));
      if (idx === 0) b.className = "active";
      b.addEventListener("click", function () { show(idx); restart(); });
      dotsWrap.appendChild(b); dots.push(b);
    });
  }
  function show(n) {
    slides[i].classList.remove("is-active"); if (dots[i]) dots[i].classList.remove("active");
    i = (n + slides.length) % slides.length;
    slides[i].classList.add("is-active"); if (dots[i]) dots[i].classList.add("active");
  }
  function next() { show(i + 1); }
  function start() { if (!reduce && !timer) timer = window.setInterval(next, DELAY); }
  function stop() { window.clearInterval(timer); timer = null; }
  function restart() { stop(); start(); }

  var nx = document.getElementById("sliderNext"), pv = document.getElementById("sliderPrev");
  if (nx) nx.addEventListener("click", function () { next(); restart(); });
  if (pv) pv.addEventListener("click", function () { show(i - 1); restart(); });
  slider.addEventListener("mouseenter", stop);
  slider.addEventListener("mouseleave", start);
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  start();
})();
