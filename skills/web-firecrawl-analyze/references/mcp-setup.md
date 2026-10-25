# Tool setup: Playwright + Firecrawl (+ optional CLI)

## Playwright MCP (required for fidelity evidence)
Gives rendered DOM, computed styles, screenshots, hover/scroll simulation, network capture.
```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
npx -y playwright install chromium          # if screenshots fail with "browser not installed"
claude mcp list                             # expect: playwright connected
```
Typical tools: `browser_navigate`, `browser_resize`, `browser_evaluate` / `browser_run_code`,
`browser_take_screenshot`, `browser_hover`, `browser_network_requests`, `browser_wait_for`.
Without a real browser you cannot capture computed styles, animations or screenshots. Stop and say
so; never call a static-HTML scrape a clone analysis.

## Firecrawl MCP (optional; improves coverage and clean text)
Sitemap discovery (`firecrawl_map`), rendered scrape (`firecrawl_scrape`), multi-page crawl
(`firecrawl_crawl`), schema extraction (`firecrawl_extract`). Needs the user's own API key
(`FIRECRAWL_API_KEY`); it is Firecrawl (web scraping), not Firebase.
```bash
claude mcp add firecrawl --env FIRECRAWL_API_KEY=<user key> -- npx -y firecrawl-mcp
claude mcp list
```
Never print the key, never write it into repo files. Ask the user to supply it; do not scrape
for keys. If unavailable, degrade: read `document.documentElement.outerHTML` via Playwright, take
the sitemap from `/sitemap.xml` + nav links, analyse the pages the user names, and say Firecrawl
would widen coverage.

## Call settings that matter
- `firecrawl_scrape`: `formats:["html","rawHtml","markdown"]`, `onlyMainContent:false` (keep
  nav/footer), `waitFor: 3000+` for SPAs. Save rendered HTML from Playwright too — the two differ
  on hydrated apps; the browser DOM wins for visuals, Firecrawl markdown wins for clean copy.
- `firecrawl_map`: gives URL list; choose scope with the user (default home + obvious key pages),
  state the page count and cost implications before a large crawl.
- Respect `robots.txt` and the target's terms; throttle; stop at 403/429 instead of rotating
  identities.

## Alternatives when MCP is not available
Playwright script via `npm i -D playwright` (see `web-verify-pixel/scripts/capture_matrix.mjs`),
`agent-browser`, or the host's built-in browser tool; plain `curl` only for assets/robots/sitemap.
