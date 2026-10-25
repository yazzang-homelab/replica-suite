// animation-inventory.js — original script for the replica-suite (no upstream code).
// Evaluate in-page after the page settles. Ground truth for time- and scroll-driven motion
// (Web Animations API). JS-library tweens (GSAP/Lenis) are reported via fingerprints only:
// for those, read the library config in the downloaded JS chunks instead.
(() => {
  const short = (el) => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (el.className?.toString().split(/\s+/)[0] || '') : null;
  const anims = document.getAnimations({ subtree: true }).map(a => {
    const t = a.effect?.getTiming?.() || {};
    return {
      target: short(a.effect?.target), kind: a.constructor.name, timeline: a.timeline?.constructor?.name,
      range: [String(a.rangeStart ?? ''), String(a.rangeEnd ?? '')],
      duration: t.duration, delay: t.delay, easing: t.easing, iterations: t.iterations, fill: t.fill,
      name: a.animationName || a.transitionProperty || null,
      keyframes: (a.effect?.getKeyframes?.() || []).slice(0, 12),
      inlineVars: a.effect?.target?.getAttribute?.('style')?.slice(0, 200) || null,
    };
  });
  const cssHits = [];
  for (const sh of document.styleSheets) {
    try { for (const r of sh.cssRules) {
      const t = r.cssText || '';
      if (r instanceof CSSKeyframesRule || /animation-timeline|view-timeline|scroll-timeline/.test(t)) cssHits.push(t.slice(0, 400));
    } } catch { /* cross-origin */ }
  }
  return JSON.stringify({
    count: anims.length, scrollDriven: anims.filter(a => /ViewTimeline|ScrollTimeline/.test(a.timeline || '')).length,
    scrollSnap: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).scrollSnapType !== 'none').map(short).slice(0, 10),
    stickyOrFixed: [...document.querySelectorAll('*')].filter(e => /sticky|fixed/.test(getComputedStyle(e).position)).map(e => [short(e), getComputedStyle(e).position, getComputedStyle(e).top]).slice(0, 30),
    anims, cssHits: cssHits.slice(0, 60),
  }, null, 1);
})()
