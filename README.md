# Gavin Morris Portfolio

Personal portfolio site for [gavinmorrisportfolio.com](https://gavinmorrisportfolio.com/).

## Structure

- `index.html` — page content
- `case-study.html` — client case study
- `styles.css` — layout and visual design (ink navy + warm paper, cobalt accent; Geist / Geist Mono)
- `main.js` — page behavior: Lenis smooth scrolling, GSAP ScrollTrigger reveals, navigation, project filter
- `effects.js` — vanilla JavaScript ports of the React Bits components used on the site
- `assets/vendor/` — pinned, self-hosted third-party libraries
- `CNAME` — custom domain for GitHub Pages

## Libraries

Everything is static files served straight from the `main` branch; there is no build step.

| Library | Version | Files |
| --- | --- | --- |
| [GSAP](https://github.com/greensock/GSAP) (core, ScrollTrigger, SplitText, Flip, ScrambleText) | 3.15.0 | `assets/vendor/gsap-3.15.0/` |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.27 | `assets/vendor/lenis-1.3.27/` |
| [React Bits](https://github.com/DavidHDev/react-bits) | commit `4dc7b5b` | ported in `effects.js` |

React Bits ships React components, so the ones used here were ported to plain functions:
DotGrid (hero background), SplitText (headline and section-title reveals), ScrollReveal
(featured-work statement), CountUp (headline numbers), SpotlightCard (project and featured
cards), Magnet (primary buttons), TiltedCard (featured cards) and VariableProximity
("Let's talk"). Their license is in `assets/vendor/react-bits/LICENSE.md`.

Other motion, all GSAP: a curtain page transition between the two pages, section labels that
decode with ScrambleText while their rule draws in, shaded and dark sections that open out from a
rounded inset panel on large screens, card grids that lean with Lenis scroll velocity, and the hero
name drifting with the pointer and splitting apart on scroll. Pointer-only effects (tilt, proximity,
magnet) are skipped on touch devices.

## Motion and accessibility

- With `prefers-reduced-motion: reduce`, Lenis and all GSAP/React Bits animations are skipped
  and every element renders in place.
- Content hidden for an entrance animation stays focusable, and is revealed when it gets focus.
- If the scripts fail to load, a fail-safe in `<head>` un-hides content after 2.5 s.

## Local preview

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).
