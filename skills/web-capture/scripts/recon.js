// recon.js — original script for the replica-suite (no upstream code).
// Paste as ONE expression into any in-page evaluator (Chrome DevTools MCP evaluate_script,
// agent-browser eval, Playwright page.evaluate). Returns a JSON-serialisable fact sheet.
// Save the result to .web-clone/source/recon.json; never print it whole into the chat.
(() => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };
  const res = performance.getEntriesByType('resource');
  const byExt = (re) => [...new Set(res.map(e => e.name).filter(n => re.test(n)))];
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  // Section outline: direct, tall-enough children of <main>/<body> wrappers.
  const root = document.querySelector('main') || document.body;
  let kids = [...root.children];
  if (kids.length === 1) kids = [...kids[0].children];
  const outline = kids.map((el, i) => ({
    i, tag: el.tagName.toLowerCase(), id: el.id || null,
    cls: (el.className && el.className.toString().slice(0, 100)) || null,
    heading: (el.querySelector('h1,h2,h3')?.innerText || '').trim().slice(0, 80),
    position: getComputedStyle(el).position, ...rect(el),
  })).filter(s => s.h > 40);
  const faces = [];
  for (const sh of document.styleSheets) {
    try { for (const r of sh.cssRules) if (r instanceof CSSFontFaceRule) faces.push({ family: r.style.getPropertyValue('font-family'), weight: r.style.getPropertyValue('font-weight'), style: r.style.getPropertyValue('font-style'), src: r.style.getPropertyValue('src').slice(0, 300) }); }
    catch { /* cross-origin sheet: use the network list instead */ }
  }
  const bgs = [...new Set([...document.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).filter(b => b && b.includes('url(')))];
  const html = document.documentElement.outerHTML;
  const fingerprints = {
    nextjs: !!window.__NEXT_DATA__ || /\/_next\//.test(html), nuxt: !!window.__NUXT__,
    webflow: /data-wf-site|website-files\.com/.test(html), framer: /framerusercontent\.com/.test(html),
    wordpress: /wp-content|wp-includes/.test(html), shopify: !!window.Shopify,
    lenis: !!document.querySelector('.lenis') || !!window.Lenis, locomotive: !!document.querySelector('[data-scroll-container]'),
    gsap: !!window.gsap, scrollTrigger: !!window.ScrollTrigger, three: !!window.THREE, lottie: !!window.lottie || !!document.querySelector('lottie-player'),
    canvasCount: document.querySelectorAll('canvas').length, videoCount: document.querySelectorAll('video').length, iframeCount: document.querySelectorAll('iframe').length,
  };
  return {
    url: location.href, title: document.title, viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    pageHeight: document.documentElement.scrollHeight, fingerprints, outline,
    cssUrls: byExt(/\.css(\?|$)/), fontFiles: byExt(/\.(woff2?|ttf|otf)(\?|$)/), jsChunks: byExt(/\.m?js(\?|$)/), fontFaces: faces, loadedFonts: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })),
    images: [...new Set([...document.querySelectorAll('img')].map(i => abs(i.currentSrc || i.src)))],
    videos: [...new Set([...document.querySelectorAll('video')].flatMap(v => [v.currentSrc, v.poster, ...[...v.querySelectorAll('source')].map(s => s.src)]).filter(Boolean).map(abs))],
    backgroundImages: bgs.slice(0, 80), inlineSvgCount: document.querySelectorAll('svg').length,
    icons: [...document.querySelectorAll('link[rel*=icon],link[rel=manifest],meta[property^="og:"],meta[name^="twitter:"]')].map(l => l.href || l.content),
    embedScripts: [...document.querySelectorAll('script[src]')].map(s => s.src).filter(u => new URL(u, location.href).origin !== location.origin).slice(0, 40),
    htmlBytes: html.length,
  };
})()
