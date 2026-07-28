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

  loginBtn.addEventListener("click", function () {
    if (document.body.classList.contains("admin-on")) { exitAdmin(); return; }
    var p = window.prompt("Owner passcode:");
    if (p === null) return;
    if (p === PASS) enterAdmin(); else window.alert("Incorrect passcode.");
  });
  var exitBtn = document.getElementById("adminExit");
  if (exitBtn) exitBtn.addEventListener("click", exitAdmin);

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
