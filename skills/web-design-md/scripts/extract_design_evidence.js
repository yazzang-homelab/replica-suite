// In-page design-evidence extractor. Original implementation.
// Run inside the live page via any browser-eval tool (agent-browser eval, Playwright
// browser_evaluate / page.evaluate, DevTools). Wrap as `(() => { ... })()` if your tool needs it.
// Run AFTER the page hydrated and was scrolled once. Re-run per theme (light/dark) and per
// viewport (e.g. 1440 and 390). Returns one JSON object; save it OUTSIDE the deliverable
// folder (e.g. /tmp or .web-design/evidence/). Values are OBSERVED facts; roles are inference.
(() => {
  const px = (v) => (v && v.endsWith("px") ? Math.round(parseFloat(v) * 100) / 100 : v);
  const count = (map, k) => k && (map[k] = (map[k] || 0) + 1);
  const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, uses]) => ({ value, uses }));
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== "hidden"; };

  // 1. Tokens declared by the site (custom properties, @font-face, @keyframes, @media breakpoints).
  const vars = {}, fontFaces = [], keyframes = [], media = new Set(), unreadable = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { unreadable.push(sheet.href); continue; }
    const walk = (list) => {
      for (const r of list) {
        if (r.style) for (const p of r.style) if (p.startsWith("--")) vars[p] = r.style.getPropertyValue(p).trim();
        if (r instanceof CSSFontFaceRule) fontFaces.push({ family: r.style.getPropertyValue("font-family"), weight: r.style.getPropertyValue("font-weight"), style: r.style.getPropertyValue("font-style"), src: r.style.getPropertyValue("src").slice(0, 160) });
        if (r instanceof CSSKeyframesRule && !keyframes.some((k) => k.name === r.name)) keyframes.push({ name: r.name, cssText: r.cssText.slice(0, 600) });
        if (r instanceof CSSMediaRule) { media.add(r.conditionText); walk(r.cssRules); }
        else if (r.cssRules && !(r instanceof CSSKeyframesRule)) walk(r.cssRules);
      }
    };
    walk(rules);
  }

  // 2. Observed values by frequency across visible elements.
  const colors = {}, bgs = {}, borders = {}, radii = {}, shadows = {}, gaps = {}, families = {}, sizes = {}, gradients = {}, transitions = {};
  const els = [...document.querySelectorAll("body *")].filter(visible).slice(0, 4000);
  for (const el of els) {
    const s = getComputedStyle(el);
    count(colors, s.color);
    if (s.backgroundColor !== "rgba(0, 0, 0, 0)") count(bgs, s.backgroundColor);
    if (parseFloat(s.borderTopWidth) > 0) count(borders, `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`);
    if (s.borderRadius !== "0px") count(radii, s.borderRadius);
    if (s.boxShadow !== "none") count(shadows, s.boxShadow);
    if (s.backgroundImage.includes("gradient")) count(gradients, s.backgroundImage.slice(0, 200));
    for (const g of [s.rowGap, s.columnGap, s.paddingTop, s.paddingLeft, s.marginTop]) if (g && g !== "0px" && g !== "normal" && g !== "auto") count(gaps, g);
    count(families, s.fontFamily);
    count(sizes, `${s.fontSize}/${s.lineHeight}/${s.fontWeight}/${s.letterSpacing}`);
    if (s.transitionDuration !== "0s") count(transitions, `${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`);
  }

  // 3. Typography hierarchy: first visible instance per role.
  const roles = { h1: "h1", h2: "h2", h3: "h3", h4: "h4", body: "p", small: "small, .caption, figcaption", link: "a[href]", button: "button, [role=button], a[class*=btn i], a[class*=button i]", input: "input:not([type=hidden]), textarea, select", label: "label", code: "code, pre", nav: "nav a", eyebrow: "[class*=eyebrow i], [class*=overline i], [class*=kicker i]" };
  const typography = {};
  for (const [role, sel] of Object.entries(roles)) {
    const el = [...document.querySelectorAll(sel)].find(visible);
    if (!el) continue;
    const s = getComputedStyle(el);
    typography[role] = { sample: (el.textContent || "").trim().slice(0, 60), fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, textTransform: s.textTransform, color: s.color, textDecoration: s.textDecorationLine };
  }

  // 4. Component fingerprints (default state; interaction states must be probed separately).
  const fingerprint = (el) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 80), text: (el.textContent || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, color: s.color, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, radius: s.borderRadius, padding: s.padding, shadow: s.boxShadow, font: `${s.fontSize}/${s.fontWeight}`, transition: s.transition.slice(0, 120), cursor: s.cursor };
  };
  const pick = (sel, n = 4) => [...document.querySelectorAll(sel)].filter(visible).slice(0, n).map(fingerprint);
  const components = {
    buttons: pick("button, [role=button], a[class*=btn i], a[class*=button i]", 8),
    inputs: pick("input:not([type=hidden]), textarea, select"),
    cards: pick("[class*=card i], article, li[class*=item i]"),
    nav: pick("header, nav", 3),
    badges: pick("[class*=badge i], [class*=tag i], [class*=chip i], [class*=pill i]"),
    footer: pick("footer", 1),
  };

  // 5. Theme + page topology + motion hints.
  const html = document.documentElement;
  const theme = { colorScheme: getComputedStyle(html).colorScheme, dataTheme: html.dataset.theme || document.body.dataset.theme || null, htmlClass: String(html.className).slice(0, 120), prefersDark: matchMedia("(prefers-color-scheme: dark)").matches, toggles: [...document.querySelectorAll("[aria-label*=theme i], [aria-label*=dark i], [class*=theme-toggle i], [data-theme-toggle]")].slice(0, 3).map((e) => e.outerHTML.slice(0, 160)) };
  const sections = [...document.querySelectorAll("header, nav, main > *, section, footer")].filter(visible).slice(0, 30).map((el, i) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { i, tag: el.tagName.toLowerCase(), id: el.id, cls: String(el.className).slice(0, 60), y: Math.round(r.top + scrollY), h: Math.round(r.height), maxW: s.maxWidth, display: s.display, position: s.position, bg: s.backgroundColor, padY: `${s.paddingTop}/${s.paddingBottom}` }; });
  const motion = { libs: { gsap: !!window.gsap, scrollTrigger: !!window.ScrollTrigger, lenis: !!(window.lenis || html.classList.contains("lenis")), framer: !!document.querySelector("[data-framer-name],[data-projection-id]"), aos: !!document.querySelector("[data-aos]") }, runningAnimations: (document.getAnimations?.() || []).slice(0, 20).map((a) => ({ name: a.animationName || a.transitionProperty || "web-anim", duration: a.effect?.getTiming?.().duration })) };

  return {
    url: location.href, title: document.title, viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    declared: { customProperties: vars, fontFaces, keyframes, mediaQueries: [...media].slice(0, 40), unreadableStylesheets: unreadable },
    observed: { textColors: top(colors, 12), backgrounds: top(bgs, 14), borders: top(borders, 8), radii: top(radii, 10), shadows: top(shadows, 8), gradients: top(gradients, 6), spacing: top(gaps, 20), fontFamilies: top(families, 6), typeScale: top(sizes, 24), transitions: top(transitions, 8) },
    typography, components, theme, sections, motion,
  };
})();
