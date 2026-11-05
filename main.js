/* Gavin Morris Portfolio — page behavior.
   Lenis smooth scrolling + GSAP ScrollTrigger, plus the React Bits ports from effects.js.
   Everything degrades to a static, fully readable page when motion is reduced or a script fails. */
(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const root = document.documentElement;
  const RB = window.ReactBits || null;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const hasGSAP = !!(gsap && ScrollTrigger);
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // "motion" is set in <head> and removed by a fail-safe if scripts were too slow to arrive.
  const motionOK = hasGSAP && !prefersReduced && root.classList.contains("motion");

  if (!motionOK) root.classList.remove("motion");
  root.classList.add("motion-ready");

  if (hasGSAP) {
    const plugins = [ScrollTrigger];
    if (window.SplitText) plugins.push(window.SplitText);
    if (window.Flip) plugins.push(window.Flip);
    gsap.registerPlugin(...plugins);
  }

  /* ---------- Lenis smooth scrolling (driven by GSAP's ticker) ---------- */
  let lenis = null;
  if (motionOK && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const nav = $(".nav");
  const navOffset = () => (nav ? nav.offsetHeight : 64) + 16;

  function scrollToTarget(target, focus) {
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target === document.body ? 0 : target, { offset: target === document.body ? 0 : -navOffset(), duration: 1.2 });
    } else {
      target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    }
    if (focus !== false) {
      if (!target.hasAttribute("tabindex") && !target.matches("a, button, input, select, textarea")) {
        target.setAttribute("tabindex", "-1");
      }
      target.focus({ preventScroll: true });
    }
  }

  /* ---------- Mobile drawer ---------- */
  const drawer = $("#mobile-drawer");
  const toggle = $("#menu-toggle");
  let drawerOpen = false;

  function openDrawer() {
    if (!drawer || !toggle) return;
    drawerOpen = true;
    drawer.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (lenis) lenis.stop();
    if (motionOK) {
      gsap.fromTo(drawer, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" });
      gsap.fromTo(drawer.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power3.out", delay: 0.05 });
    }
    const first = drawer.querySelector("a");
    if (first) first.focus();
  }

  function closeDrawer(returnFocus) {
    if (!drawerOpen) return;
    drawerOpen = false;
    toggle.setAttribute("aria-expanded", "false");
    if (lenis) lenis.start();
    const done = () => { drawer.hidden = true; };
    if (motionOK) gsap.to(drawer, { autoAlpha: 0, y: -8, duration: 0.2, ease: "power2.in", onComplete: done });
    else done();
    if (returnFocus !== false) toggle.focus();
  }

  if (toggle && drawer) {
    toggle.addEventListener("click", () => (drawerOpen ? closeDrawer() : openDrawer()));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerOpen) closeDrawer();
    });
    document.addEventListener("pointerdown", (e) => {
      if (drawerOpen && !drawer.contains(e.target) && !toggle.contains(e.target)) closeDrawer(false);
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", (e) => {
      if (e.matches) closeDrawer(false);
    });
  }

  /* ---------- In-page anchors (skip link, nav, buttons) ---------- */
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(link.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    closeDrawer(false);
    scrollToTarget(target);
    if (window.location.hash !== url.hash) history.pushState(null, "", url.hash);
  });

  /* ---------- Back to top ---------- */
  const backTop = $("#back-top");
  if (backTop) {
    backTop.addEventListener("click", () => {
      const first = $("main section[id]") || $("main");
      if (lenis) lenis.scrollTo(0, { duration: 1.4 });
      else window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      if (first) {
        if (!first.hasAttribute("tabindex")) first.setAttribute("tabindex", "-1");
        first.focus({ preventScroll: true });
      }
    });
  }

  /* ---------- Nav state, active link, progress, back-to-top ---------- */
  const navLinks = $$("[data-nav]");
  function setActive(id) {
    navLinks.forEach((link) => {
      const on = link.dataset.nav === id;
      link.classList.toggle("active", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  if (hasGSAP) {
    ScrollTrigger.create({
      start: 8,
      end: "max",
      onToggle: (self) => nav && nav.classList.toggle("is-scrolled", self.isActive),
    });
    if (backTop) {
      ScrollTrigger.create({
        start: 600,
        end: "max",
        onToggle: (self) => backTop.classList.toggle("visible", self.isActive),
      });
    }
    const progress = $(".scroll-progress");
    if (progress) {
      gsap.to(progress, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: true } });
    }
    if (navLinks.length) {
      $$("main section[id]").forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: "top 45%",
          end: "bottom 45%",
          onToggle: (self) => { if (self.isActive) setActive(section.id); },
        });
      });
    }
  } else {
    // Minimal fallback without GSAP.
    const onScroll = () => {
      const y = window.scrollY;
      if (nav) nav.classList.toggle("is-scrolled", y > 8);
      if (backTop) backTop.classList.toggle("visible", y > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Project filter (GSAP Flip) ---------- */
  let revealInView = () => {}; // replaced below when motion is on
  const revealed = new WeakSet(); // [data-reveal] elements that have been (or are being) revealed
  const filterBtns = $$(".filter-btn");
  const projectCards = $$(".project-card");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      const Flip = window.Flip;
      if (motionOK) {
        // Settle every card's scroll reveal first: Flip kills other tweens on its targets when it
        // finishes, so a card still waiting to fade in would otherwise be left invisible.
        gsap.killTweensOf(projectCards, "opacity,y");
        gsap.set(projectCards, { opacity: 1, y: 0 });
        projectCards.forEach((card) => revealed.add(card));
      }
      const state = motionOK && Flip ? Flip.getState(projectCards) : null;
      projectCards.forEach((card) => {
        card.hidden = !(filter === "all" || card.dataset.category === filter);
      });
      if (state) {
        Flip.from(state, {
          duration: 0.6,
          ease: "power3.inOut",
          absolute: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: "power3.out" }),
          onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.25 }),
          onComplete: () => ScrollTrigger.refresh(),
        });
      } else if (hasGSAP) {
        ScrollTrigger.refresh();
      }
    });
  });

  /* ---------- React Bits: effects that are not motion-heavy run for everyone ---------- */
  if (RB) {
    const dots = $("#dot-grid");
    if (dots) {
      RB.dotGrid(dots, {
        dotSize: 3,
        gap: 22,
        baseColor: "#24324d",
        activeColor: "#9db4ff",
        proximity: 150,
        strength: 0.8,
        swell: 0.6,
        stretch: 0.4,
        glow: 0.45,
        fade: 0.45,
        shockRadius: 280,
        shockStrength: 3,
      });
    }
    $$("[data-spotlight]").forEach((card) => {
      const dark = card.dataset.spotlight === "dark";
      RB.spotlightCard(card, dark
        ? { theme: "dark", spotlightColor: "#9db4ff", intensity: 0.16, borderGlow: 0.7, spotlightSize: 320 }
        : { theme: "light", spotlightColor: "#2747b8", intensity: 0.32, borderGlow: 0.8, spotlightSize: 280 });
    });
  }

  if (!motionOK) return;

  /* ======================================================
     Motion-only: intro, scroll reveals, text effects
     ====================================================== */

  // Generic reveal: fade + rise in batches as elements enter. Opacity only (never visibility),
  // so keyboard focus can still reach content that has not animated in yet.
  const revealEls = $$("[data-reveal]");
  const revealNow = (els, delay) => {
    els.forEach((el) => revealed.add(el));
    return gsap.to(els, {
      opacity: 1, y: 0, duration: 1, delay: delay || 0, ease: "power3.out", stagger: 0.08, overwrite: "auto", clearProps: "transform",
    });
  };
  gsap.set(revealEls, { y: 32 });
  ScrollTrigger.batch(revealEls, {
    start: "top 90%",
    once: true,
    onEnter: (batch) => {
      const fresh = batch.filter((el) => !revealed.has(el));
      if (fresh.length) revealNow(fresh);
    },
  });
  // Layout changes (filtering, resizing, loading at a #hash) can move content into view
  // without a scroll event, which batch() never sees. Reveal anything already on screen.
  revealInView = () => {
    const limit = window.innerHeight * 0.9;
    const due = revealEls.filter((el) => !revealed.has(el) && !el.closest("[hidden]") && el.getBoundingClientRect().top < limit);
    if (due.length) revealNow(due);
  };
  ScrollTrigger.addEventListener("refresh", revealInView);
  document.addEventListener("focusin", (e) => {
    const hidden = e.target.closest && e.target.closest("[data-reveal], [data-hero-item]");
    if (hidden && parseFloat(getComputedStyle(hidden).opacity) < 1) {
      gsap.to(hidden, { opacity: 1, y: 0, duration: 0.3, overwrite: "auto" });
    }
  });

  // Experience timeline: the rail fills with scroll and each role's marker lights up.
  const timeline = $(".timeline");
  if (timeline) {
    gsap.fromTo(".timeline-fill", { scaleY: 0 }, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: timeline, start: "top 65%", end: "bottom 65%", scrub: 0.4 },
    });
    $$(".exp-card", timeline).forEach((card) => {
      ScrollTrigger.create({
        trigger: card,
        start: "top 65%",
        onEnter: () => card.classList.add("is-active"),
        onLeaveBack: () => card.classList.remove("is-active"),
      });
    });
  }

  // Case study diagrams wipe in left to right.
  $$("[data-wipe] img").forEach((img) => {
    gsap.fromTo(img, { clipPath: "inset(0 100% 0 0)" }, {
      clipPath: "inset(0 0% 0 0)",
      duration: 1.3,
      ease: "power3.inOut",
      scrollTrigger: { trigger: img, start: "top 82%", once: true },
    });
  });

  // Hero: content drifts up and the dot field dims as the hero scrolls away.
  const hero = $(".hero");
  if (hero) {
    gsap.to(".hero-inner", {
      yPercent: -10,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(".hero-canvas", {
      opacity: 0.25,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
  }

  if (RB) {
    // Magnet on primary calls to action.
    $$("[data-magnet]").forEach((el) => RB.magnet(el, { padding: 70, magnetStrength: 5, maxOffset: 10 }));

    // CountUp on the headline numbers.
    $$("[data-countup]").forEach((el, i) => RB.countUp(el, { duration: 2, delay: i * 0.08 }));

    // ScrollReveal on the featured-work statement.
    const statement = $("[data-scroll-reveal]");
    if (statement) {
      RB.scrollReveal(statement, {
        baseOpacity: 0.14,
        baseRotation: 0,
        enableBlur: true,
        blurStrength: 3,
        stagger: 0.05,
        wordAnimationEnd: "bottom 55%",
      });
    }
  }

  // Text splits wait for web fonts so measurements are final.
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();

  fontsReady.then(() => {
    const intro = gsap.timeline({ delay: 0.1 });
    const heroItems = $$("[data-hero-item]");
    const heroTitle = $("[data-hero-title]");
    const caseTitle = $("[data-case-title]");

    if (heroTitle) {
      const split = RB && RB.splitText(heroTitle, {
        splitType: "chars",
        trigger: "load",
        delay: 45,
        duration: 1.1,
        ease: "power4.out",
        from: { opacity: 0, yPercent: 55 },
        to: { opacity: 1, yPercent: 0 },
      });
      if (split) intro.add(split.timeline, 0.15);
      else gsap.set(heroTitle, { opacity: 1 });
    }
    if (caseTitle) {
      const split = RB && RB.splitText(caseTitle, {
        splitType: "words",
        mask: true,
        trigger: "load",
        delay: 40,
        duration: 1.1,
        ease: "power4.out",
        from: { yPercent: 105 },
        to: { yPercent: 0 },
      });
      if (split) intro.add(split.timeline, 0.1);
      else gsap.set(caseTitle, { opacity: 1 });
    }
    if (heroItems.length) {
      intro.fromTo(heroItems, { opacity: 0, y: 22 }, {
        opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.08, clearProps: "transform",
      }, heroTitle ? 0.55 : 0.1);
    }

    // Section titles: masked word rise (React Bits SplitText, view trigger).
    $$("[data-split]").forEach((el) => {
      const split = RB && RB.splitText(el, {
        splitType: "words",
        mask: true,
        delay: 70,
        duration: 1.1,
        ease: "power4.out",
        from: { yPercent: 105 },
        to: { yPercent: 0 },
        threshold: 0.1,
        rootMargin: "-40px",
      });
      if (!split) gsap.set(el, { opacity: 1 });
    });

    ScrollTrigger.refresh();
  });
})();
