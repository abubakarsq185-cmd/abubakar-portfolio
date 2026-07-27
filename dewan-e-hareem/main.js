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
