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

  // Typewriter
  const roles = [
    "Software Engineer",
    "AI Research @ ATHENA Lab",
    "Founder @ Deltara Tech",
    "Computer Science @ LSU",
  ];
  const typeEl = document.getElementById("typewriter");
  if (typeEl && !prefersReducedMotion) {
    let roleIdx = 0;
    let charIdx = 0;
    let deleting = false;

    function tick() {
      const word = roles[roleIdx];
      if (!deleting) {
        charIdx++;
        typeEl.textContent = word.slice(0, charIdx);
        if (charIdx === word.length) {
          deleting = true;
          setTimeout(tick, 2200);
          return;
        }
        setTimeout(tick, 55);
      } else {
        charIdx--;
        typeEl.textContent = word.slice(0, charIdx);
        if (charIdx === 0) {
          deleting = false;
          roleIdx = (roleIdx + 1) % roles.length;
          setTimeout(tick, 400);
          return;
        }
        setTimeout(tick, 35);
      }
    }
    tick();
  } else if (typeEl) {
    typeEl.textContent = roles[0];
  }

  // Animated counters
  const counters = document.querySelectorAll("[data-count]");
  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || "";
        const duration = 1400;
        const start = performance.now();

        function step(now) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        countObserver.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((c) => countObserver.observe(c));

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

  // Cert flip on tap (mobile)
  document.querySelectorAll(".cert-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (window.innerWidth < 768) card.classList.toggle("flipped");
    });
  });

  // Particle canvas
  const canvas = document.getElementById("particle-canvas");
  if (canvas && !prefersReducedMotion) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    let w, h;
    const count = 48;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function init() {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.5 + 0.5,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(147, 197, 253, 0.35)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            ctx.strokeStyle = `rgba(99, 179, 237, ${0.12 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      });
      requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();
    window.addEventListener("resize", () => {
      resize();
      init();
    });
  }
})();
