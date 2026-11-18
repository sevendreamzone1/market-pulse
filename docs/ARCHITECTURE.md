# Architecture

## Runtime boundaries
The public site is static HTML, CSS, JavaScript, and JSON. Python runs locally or in GitHub Actions, not on GitHub Pages. There is no database, Node application server, React build, TypeScript compiler, Docker deployment, or continuous hosted analysis worker.

## Folder structure
Keep the existing layout; organizing development does not require relocating working modules.

```text
market-pulse/
  AGENTS.md                     # Always-on project instructions
  .agents/skills/<name>/SKILL.md # Reusable, selectively loaded workflows
  docs/                         # Requirements, architecture, plan, progress
  .github/workflows/pages.yml   # Checks, data refresh, Pages publication
  index.html, app.js, styles.css
  live.html, live.js, live.css
  live-feed.mjs                 # Broker binary decoding and validation
  live-setups.mjs               # Scenario state and risk monitoring
  live-panel.mjs, live-setups.css
  live-dashboard.mjs            # Dashboard connection to the live tab
  scripts/                      # Python pipeline and local connection helper
  data/market.json              # Tracked seed / generated deployment snapshot
  tests/                        # Python unit tests and Node fixture checks
  requirements.txt              # Existing Python runtime dependencies
  README.md                     # Setup and operational instructions
```

Ignored `.venv/`, `.qa/` and `dist/` hold local dependencies, optional local QA tooling and generated site output. They are not sources of application architecture or credential distribution. Add a new folder only for an approved module with a concrete need.

## Scheduled analysis
1. `scripts/providers.py` selects Upstox or Yahoo, resolves instruments, and retrieves candles/options. Pipeline authentication comes from `UPSTOX_ACCESS_TOKEN`; `MARKET_PROVIDER` selects the mode.
2. `scripts/fetch_market.py` filters unfinished candles, calls analysis modules, retains failed symbols without changing their times, and atomically writes `data/market.json`. Complete upstream failure stops publication.
3. `scripts/signals.py` supplies baseline EMA/RSI; `scripts/strategies.py` evaluates the full price/volume catalog and category confluence.
4. `scripts/options_analysis.py` builds index scenarios, option-chain context, contract selection, and ATR/tick-based premium risk references.
5. `.github/workflows/pages.yml` runs checks, fetches data, caches the snapshot, copies an explicit static allowlist into `dist`, and deploys Pages.

The tracked `data/market.json` is a seed; deployed market data can differ because Actions generates the public artifact. Do not replace the seed with fictional market prices to hide provider failures.

## Browser modules
| Module | Responsibility |
| --- | --- |
| `login.html`, `login.css`, `login.js` | User-requested fixed-credential UI gate, local redirect, eight-hour shared browser access marker, Logout; not private hosting |
| `index.html`, `styles.css`, `app.js` | Main tabs, watchlist, TradingView embedding, snapshot analysis, labeled live price overrides |
| `live.html`, `live.css`, `live.js` | Separate credential entry, authorization, WebSocket lifecycle, subscription updates and quote display |
| `live-feed.mjs` | Bounds-checked Protobuf LTPC/full decoding, socket URL validation, quote freshness |
| `live-setups.mjs` | Live candle observation, eligibility gates, fixed triggered scenarios, latched exit observations |
| `live-panel.mjs`, `live-setups.css` | Shared scenario presentation, using text nodes for external strings |
| `live-dashboard.mjs` | Same-origin BroadcastChannel reception, heartbeat expiry, shared panel and price events |

TradingView renders its own chart feed. The strategy engine evaluates provider candle data, not widget contents or chart screenshots.

## Personal live data flow
The user supplies a current token or one-time socket URL to the live page. The token authorize request goes only to Upstox; browser CORS can prevent it. The local `scripts/connect_upstox.ps1` helper or the user's API client can obtain a one-time URL without browser HTTP CORS. Credentials are cleared and are never included in the public snapshot or channel messages.

The authorized socket uses full mode. Quotes feed the live scenario engine and table. BroadcastChannel `marketpulse-live-v1` shares quote/scenario outputs with tabs on the same origin and browser context; `marketpulse-quotes` events supply main-page live price overrides. Heartbeat/quote expiry removes live labels and returns prices to snapshot mode. Tokens and socket URLs remain outside these channels.

The main app publishes its already-loaded public snapshot through `marketpulse-snapshot`. The live dashboard requests it with `marketpulse-request-snapshot` during startup, avoiding duplicate HTTP polling and module-load races. Without a connected live tab, the shared panel classifies this snapshot instead of replacing every condition with a generic missing-live-entry label. Missing/stale strategy analysis, disconnected live confirmation, and fresh NO TRADE are distinct states. Each card exposes the model candle time; the panel links to the existing refresh workflow. Refreshing the page's JSON does not itself trigger an upstream fetch.

The full strategy catalog still uses completed-candle snapshots. Live monitoring does not imply full indicator recalculation on every tick, a shared public account stream, exchange-fresh Greeks, actual order execution, or fill tracking.

The shared live panel includes a current-scenario table on home and live pages: contract/side/status, observed entry time and ask reference, premium SL/T1/T2, time-exit deadline, observed exit time, and a captured option bid with its exchange timestamp. `live-setups.mjs` latches exit metadata at the first observed exit condition; stale/missing/crossed option quotes produce no exit price. Watch references have no entry time. Times are IST, prices are premium rupees, and none are actual broker fills. This is session-only scenario presentation, cleared on disconnect, not a historical paper-trading ledger. The table scrolls horizontally on narrow screens and retains its scroll/focus during live redraws.

The home-page live-price table is rendered by `live-dashboard.mjs` from the same quote channel. It shows instrument labels, LTP, change from close, exchange trade time and freshness. Quotes must be live updates with a positive finite price, trade age at most 30 seconds and receipt age at most five seconds; initial, future and stale values are withheld. The filtered quotes also drive existing index/watchlist overrides. No broker credential is entered or stored on the home page, and no extra socket or polling pipeline was added.

## Trust and persistence
- The live page has a restrictive CSP and no third-party scripts/fonts. Main-page TradingView is a separate trust boundary.
- Validate broker URLs, binary messages, timestamps, identifiers, and external labels; never render external strings as executable HTML.
- Do not persist browser credentials or live scenario state. A disconnect ends session monitoring.
- The approved convenience login compares a static username/password digest in the browser. Only an expiring UI access marker is kept in localStorage, scoped to the site path; entered passwords and Upstox credentials are not stored. Both entry pages load the guard before application scripts. Storage events synchronize sign-in and Logout across tabs; expiry timers enforce the same eight-hour deadline. This is bypassable and does not protect public assets or JSON.
- Tests under `tests/` use fixtures/mocks. Local `.qa/` helpers are ignored conveniences, not tracked infrastructure or required deployment tools.

## References
See [requirements](REQUIREMENTS.md), [development plan](DEVELOPMENT_PLAN.md), and README for detailed strategy definitions, API setup, and publishing instructions.
