// extract-styles.js — original script for the replica-suite (no upstream code).
// Usage: set SELECTOR (and optionally DEPTH) then evaluate the whole expression in-page.
// Returns a JSON string: per-element computed styles (non-default only) + pseudo-elements + text.
// Run it once per section container; run it again after a state change (scroll/hover/click)
// and diff the two outputs with diff_states.py — the diff is the behaviour spec.
((SELECTOR, DEPTH = 4) => {
  const PROPS = ['display','position','top','right','bottom','left','zIndex','width','height','minWidth','maxWidth','minHeight','maxHeight',
    'flexDirection','flexWrap','justifyContent','alignItems','alignSelf','gap','rowGap','columnGap','gridTemplateColumns','gridTemplateRows','gridColumn','gridRow',
    'padding','margin','border','borderRadius','boxShadow','outline','overflow','overflowX','overflowY',
    'color','backgroundColor','backgroundImage','backgroundSize','backgroundPosition','backgroundClip','opacity','filter','backdropFilter','mixBlendMode','clipPath','maskImage',
    'fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','textTransform','textDecoration','whiteSpace','textOverflow',
    'transform','transformOrigin','transition','animation','willChange','cursor','objectFit','objectPosition','aspectRatio','scrollSnapType','scrollSnapAlign','pointerEvents'];
  const SKIP = new Set(['none','normal','auto','0px','rgba(0, 0, 0, 0)','static','visible','start','stretch','row','nowrap','baseline','0','1','1px 1px','0% 0%']);
  const pick = (cs) => { const o = {}; for (const p of PROPS) { const v = cs[p]; if (v && !SKIP.has(v)) o[p] = v; } return o; };
  const pseudo = (el, which) => { const cs = getComputedStyle(el, which); return cs.content && cs.content !== 'none' && cs.content !== 'normal' ? { content: cs.content, ...pick(cs) } : null; };
  const walk = (el, d) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
    return {
      tag: el.tagName.toLowerCase(), cls: (el.className?.toString() || '').split(/\s+/).slice(0, 6).join(' '),
      rect: { x: Math.round(r.x), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      text: own.slice(0, 240) || undefined,
      attrs: ['href','src','alt','aria-label','role','data-state','type','placeholder'].reduce((a, k) => (el.getAttribute(k) != null && (a[k] = el.getAttribute(k).slice(0, 200)), a), {}),
      style: pick(cs), before: pseudo(el, '::before') || undefined, after: pseudo(el, '::after') || undefined,
      svg: el.tagName.toLowerCase() === 'svg' ? el.outerHTML.slice(0, 4000) : undefined,
      children: d < DEPTH ? [...el.children].slice(0, 30).map(c => walk(c, d + 1)) : (el.children.length ? `[${el.children.length} children truncated]` : undefined),
    };
  };
  const el = document.querySelector(SELECTOR);
  return JSON.stringify(el ? walk(el, 0) : { error: 'not found: ' + SELECTOR }, null, 1);
})(/* SELECTOR */ 'main > section:nth-of-type(1)', /* DEPTH */ 4)
