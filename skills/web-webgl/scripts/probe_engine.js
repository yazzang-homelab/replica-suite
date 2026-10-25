// In-page probe: does this page's visual truth live in a canvas runtime?
// Paste into a browser evaluate tool (Playwright MCP browser_evaluate, DevTools console).
// Run AFTER the page settled but BEFORE scrolling/reveal tweaks change canvas state.
// Original implementation. Returns a JSON-serialisable verdict. Never calls canvas.getContext
// (that would create a context and alter the scene); to learn 2d/webgl/webgl2 use an init-time hook,
// see references/runtime-mirror.md.
(() => {
  const vw = innerWidth, vh = innerHeight;
  const canvases = [...document.querySelectorAll("canvas")].map((c) => {
    const r = c.getBoundingClientRect();
    const vis = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      coverage: +(vis / (vw * vh)).toFixed(3),
      dataEngine: c.dataset.engine || null,
      cls: String(c.className).slice(0, 80),
    };
  });
  const g = window;
  const globals = {
    three: !!(g.THREE || g.__THREE__ || document.querySelector("script[src*='three' i]")),
    rive: !!(g.rive || g.Rive || [...document.querySelectorAll("script")].some((s) => /rive/i.test(s.src))),
    pixi: !!(g.PIXI || document.querySelector("script[src*='pixi' i]")),
    babylon: !!(g.BABYLON),
    gsap: !!(g.gsap || g.TweenMax),
    scrollTrigger: !!g.ScrollTrigger,
    lenis: !!(g.lenis || g.Lenis || document.documentElement.classList.contains("lenis")),
    lottie: !!(g.lottie || g.bodymovin),
    r3f: !!document.querySelector("canvas[data-engine*='three' i]"),
  };
  const resources = performance.getEntriesByType("resource").map((r) => r.name);
  const ext = (re) => resources.filter((u) => re.test(u)).length;
  const assets = {
    models: ext(/\.(glb|gltf|fbx|obj|drc|ktx2?)(\?|$)/i),
    textures: ext(/\.(hdr|exr|basis|dds|png|jpe?g|webp|avif)(\?|$)/i),
    wasm: ext(/\.wasm(\?|$)/i),
    workers: ext(/worker/i),
    riv: ext(/\.riv(\?|$)/i),
    shaders: ext(/\.(glsl|frag|vert|wgsl)(\?|$)/i),
    video: ext(/\.(mp4|webm|m3u8)(\?|$)/i),
  };
  const maxCoverage = Math.max(0, ...canvases.map((c) => c.coverage));
  const knownEngine = Object.entries(globals).some(([k, v]) => v && ["three", "rive", "pixi", "babylon", "r3f"].includes(k))
    || canvases.some((c) => c.dataEngine);
  const activeScripts = document.scripts.length;
  const runtimeMirrorRecommended = (knownEngine && canvases.length > 0) || (maxCoverage >= 0.55 && activeScripts > 0);
  return { canvasCount: canvases.length, maxCoverage, canvases, globals, assets, knownEngine, activeScripts, runtimeMirrorRecommended };
})();
