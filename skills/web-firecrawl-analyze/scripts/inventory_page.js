// In-page inventory for clone analysis: assets, motion drivers, section map. Original implementation.
// Run via Playwright MCP browser_evaluate / browser_run_code or page.evaluate, after the priming
// scroll (see SKILL.md step 3). Output feeds source/assets-manifest.json, motion-manifest.json
// and page-brief.md. Pair with scripts/download_assets.py.
(async () => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const uniq = (a) => [...new Set(a.filter(Boolean))];

  // Assets (use currentSrc so responsive <picture>/srcset resolves to what is really rendered).
  const images = [...document.images].map((i) => ({ url: abs(i.currentSrc || i.src), srcset: i.srcset || null, alt: i.alt, natural: [i.naturalWidth, i.naturalHeight], rendered: [Math.round(i.width), Math.round(i.height)], fit: getComputedStyle(i).objectFit, loading: i.loading }));
  const backgrounds = uniq([...document.querySelectorAll("*")].flatMap((el) => [...(getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))].map((m) => abs(m[1]))));
  const videos = [...document.querySelectorAll("video")].map((v) => ({ url: abs(v.currentSrc || v.src), poster: abs(v.poster), autoplay: v.autoplay, loop: v.loop, muted: v.muted, size: [v.videoWidth, v.videoHeight] }));
  const res = performance.getEntriesByType("resource");
  const fonts = uniq(res.filter((r) => /\.(woff2?|ttf|otf)(\?|$)/i.test(r.name)).map((r) => r.name));
  const svgSprites = uniq([...document.querySelectorAll("use")].map((u) => abs(u.getAttribute("href") || u.getAttribute("xlink:href"))));
  const scripts = uniq([...document.scripts].map((s) => s.src && abs(s.src)));
  const stylesheets = uniq([...document.styleSheets].map((s) => s.href));
  const origins = {};
  res.forEach((r) => { const o = new URL(r.name).origin; origins[o] = (origins[o] || 0) + 1; });

  // Motion drivers: libraries, hooks, running animations, smooth scroll.
  const w = window, html = document.documentElement;
  const libs = { gsap: !!(w.gsap || w.TweenMax), scrollTrigger: !!w.ScrollTrigger, lenis: !!(w.lenis || w.Lenis || html.classList.contains("lenis")), locomotive: !!document.querySelector("[data-scroll-container]"), framer: !!document.querySelector("[data-framer-name],[data-projection-id]"), aos: !!document.querySelector("[data-aos]"), swiper: !!document.querySelector(".swiper"), splide: !!document.querySelector(".splide"), lottie: !!(w.lottie || w.bodymovin), three: !!(w.THREE || document.querySelector("script[src*=three i]")), rive: !!document.querySelector("script[src*=rive i]") };
  const hooks = [...document.querySelectorAll("[data-aos],[data-scroll],[data-animate],[class*=reveal i],[class*=fade i],[class*=slide i],[class*=animate i]")].slice(0, 80).map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 100), aos: el.dataset.aos || null }));
  const running = (document.getAnimations?.() || []).slice(0, 60).map((a) => ({ kind: a.constructor.name, name: a.animationName || a.transitionProperty || null, state: a.playState, timing: a.effect?.getTiming?.() ? { duration: a.effect.getTiming().duration, easing: a.effect.getTiming().easing, iterations: a.effect.getTiming().iterations } : null }));
  const sticky = [...document.querySelectorAll("*")].filter((el) => ["sticky", "fixed"].includes(getComputedStyle(el).position)).slice(0, 20).map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), pos: getComputedStyle(el).position, top: getComputedStyle(el).top }));

  // Section map with stable tags for later per-section screenshots.
  const secs = [...document.querySelectorAll("body > *, main > *, section, header, footer, nav")].filter((e) => e.offsetHeight > 40);
  secs.forEach((el, i) => el.setAttribute("data-clone-idx", i));
  const sections = secs.slice(0, 50).map((el, i) => { const s = getComputedStyle(el); return { i, tag: el.tagName.toLowerCase(), id: el.id, cls: String(el.className).slice(0, 80), y: Math.round(el.getBoundingClientRect().top + scrollY), h: el.offsetHeight, display: s.display, cols: s.gridTemplateColumns !== "none" ? s.gridTemplateColumns : null, dir: s.flexDirection, gap: s.gap, padY: `${s.paddingTop}/${s.paddingBottom}`, bg: s.backgroundColor, headline: (el.querySelector("h1,h2,h3")?.textContent || "").trim().slice(0, 80) }; });

  const meta = { title: document.title, lang: html.lang, canonical: document.querySelector("link[rel=canonical]")?.href || null, ogImage: document.querySelector("meta[property='og:image']")?.content || null, scrollHeight: html.scrollHeight, framework: { next: !!document.getElementById("__next") || !!w.__NEXT_DATA__, nuxt: !!w.__NUXT__, webflow: !!document.documentElement.dataset.wfPage, framer: !!document.querySelector("[data-framer-name]"), wordpress: !!document.querySelector("link[href*=wp-content]") } };
  return { url: location.href, meta, assets: { images, backgrounds, videos, fonts, svgSprites, scripts, stylesheets, inlineSvgCount: document.querySelectorAll("svg").length, origins }, motion: { libs, hooks, running, sticky }, sections };
})();
