(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll progress
  const progressBar = document.querySelector(".scroll-progress");
  function updateProgress() {
    const doc = document.documentElement;
    const scrollTop = window.scrollY;
    const height = doc.scrollHeight - window.innerHeight;
    const pct = height > 0 ? scrollTop / height : 0;
    progressBar.style.transform = `scaleX(${pct})`;
  }

  // Nav scroll state + active section
  const nav = document.querySelector(".nav");
  const navLinks = document.querySelectorAll("[data-nav]");
  const sections = document.querySelectorAll("section[id]");

  function updateNav() {
    nav.classList.toggle("scrolled", window.scrollY > 40);
    const y = window.scrollY + 120;
    let current = "home";
    sections.forEach((sec) => {
      if (y >= sec.offsetTop && y < sec.offsetTop + sec.offsetHeight) {
        current = sec.id;
      }
    });
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.nav === current);
    });
  }

  // Smooth scroll
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    closeDrawer();
  }

  document.querySelectorAll("[data-scroll]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToId(el.dataset.scroll);
    });
  });

  // Mobile drawer
  const drawer = document.getElementById("mobile-drawer");
  const menuToggle = document.getElementById("menu-toggle");

  function closeDrawer() {
    drawer?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }

  menuToggle?.addEventListener("click", () => {
    const open = drawer.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  // Back to top
  const backTop = document.getElementById("back-top");
  backTop?.addEventListener("click", () => scrollToId("home"));

  function updateBackTop() {
    backTop?.classList.toggle("visible", window.scrollY > 600);
  }

  window.addEventListener("scroll", () => {
    updateProgress();
    updateNav();
    updateBackTop();
  }, { passive: true });
  updateProgress();
  updateNav();
  updateBackTop();

  // Reveal on scroll
  const revealEls = document.querySelectorAll(".reveal, .reveal-left, .reveal-right");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => revealObserver.observe(el));

  // Hero stagger on load
  document.querySelectorAll(".hero .reveal").forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), 200 + i * 120);
  });

  // Project filters
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll(".project-card");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      projectCards.forEach((card) => {
        const cat = card.dataset.category;
        const show = filter === "all" || cat === filter;
        card.classList.toggle("hidden", !show);
        if (show) {
          card.style.animation = "none";
          card.offsetHeight;
          card.style.animation = "";
        }
      });
    });
  });

})();
