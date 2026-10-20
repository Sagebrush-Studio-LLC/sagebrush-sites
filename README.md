# Sagebrush Studio LLC

Website for **Sagebrush Studio LLC**, a Fort Worth, Texas web-development studio that builds
warm, mobile-first sites for salons, barbers, nail studios, and spas.

**Live site:** https://sagebrushstudiollc.com/

## What's in it

- Multi-page site: Home, Work, Process, Pricing (packages, add-ons, FAQ), About, Skills, Free check,
  and Contact, plus a custom `404.html` and a 1200x630 social-sharing image (`images/og-image.jpg`).
- Four spec (concept) projects with case studies — Bloom Nail Studio, Haven Hair Studio,
  Ironclad Barber Co, and Still Water Spa — each a standalone demo site under
  `spec-projects/`.
- Installable web app manifest and a custom domain served from GitHub Pages.
- One shared stylesheet, `flair.css`, holds the base styles for all main pages (each page keeps
  only its own one-off styles inline), plus an interaction layer with `flair.js`: scroll reveals, device mockups with hover
  tilt, an interactive "try a style" demo, a concept-site carousel, and a floating quote button.
  Every effect is skipped for visitors who prefer reduced motion.

## Tech

Plain HTML, CSS, and JavaScript — no frameworks and no build step. Mobile-first
responsive layouts, deployed on GitHub Pages with a custom domain (`CNAME`).

## Author

Designed and built by [Michelle Feliciano](https://michellefeliciano.github.io/).
