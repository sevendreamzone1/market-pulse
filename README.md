# Market Pulse · India

A responsive NSE/BSE dashboard built for GitHub Pages. Plain HTML, CSS, and JavaScript; no frontend build or browser API keys.

[Published website](https://sevendreamzone1.github.io/market-pulse/) · [Repository](https://github.com/sevendreamzone1/market-pulse)

Upstox is the preferred market-data API. The repository is configured with `MARKET_PROVIDER=auto`: it selects Upstox when `UPSTOX_ACCESS_TOKEN` exists, otherwise keeps Yahoo snapshots available. The dashboard explicitly shows when the Upstox connection is pending. A present but invalid/expired Upstox token fails the refresh rather than silently switching feeds.

Includes TradingView charts, an eight-company watchlist, NIFTY 50 / BANK NIFTY / SENSEX snapshots, exchange and signal filters, and EMA 9 / EMA 21 / Wilder RSI 14 observations. Demo mode is explicitly fictional and opt-in. No fake prices are shown as market data.

## Browser-only sign-in

Opening the dashboard or live page redirects to `login.html` until the configured owner credentials match. Successful sign-in returns to the home page or an allowed local return destination; Logout removes the shared marker and sends other open dashboard/live tabs back to sign-in. One site sign-in lasts up to eight hours across tabs in the same browser profile and site path. No database or backend was added. The fixed username and password digest are configured in `login.js`; entered passwords and broker tokens are never stored by this gate.

This is the user's requested convenience UI gate, **not private hosting or server-side authentication**. The check and session flag can be bypassed, and direct assets/market JSON remain publicly accessible. Do not reuse an important account password for this publicly inspectable configuration. The Upstox token/one-time URL flow remains separate.

## Personal live API quotes

Open [Live API quotes](https://sevendreamzone1.github.io/market-pulse/live.html), or select **Live API quotes** in the dashboard header. This separate page connects from the browser directly to Upstox V3 WebSocket in full mode. It shows last price, change from previous close, exchange trade time, and freshness. It includes the three indices, available watchlist instrument keys, and current option-contract keys from the published snapshot. It confirms snapshot-based CE/PE scenarios with live index candles and option depth, then monitors targets and stops. Full strategy calculations remain completed-candle snapshots.

Choose one connection method:

1. **Access token:** enter your own current Upstox access token (not the client ID/API key). The page sends it directly to `https://api.upstox.com/v3/feed/market-data-feed/authorize`. Success returns a one-use socket URL. Browser authorization depends on Upstox's CORS policy.
2. **One-time WebSocket URL:** if browser authorization is blocked, obtain `authorized_redirect_uri` from the [official authorize endpoint](https://upstox.com/developer/api-documentation/get-market-data-feed-authorize-v3/) in your own API client and enter it in the second mode. It is a private, one-use credential, not a public shareable link. Only secure WebSocket hosts below `.upstox.com` are accepted.

If browser authorization reports a network/timeout/CORS error, run this from your local checkout in PowerShell:

```powershell
powershell -NoProfile -File .\scripts\connect_upstox.ps1
```

Enter the access token at the hidden prompt. The helper contacts the official authorize endpoint outside browser CORS and copies only the validated one-time URL to the clipboard. On the live page, choose **One-time authorized WebSocket URL**, paste, and connect immediately. Clear the clipboard afterwards with `Set-Clipboard -Value ""`. Each reconnect needs a new URL. Run locally without transcription or terminal recording; never in Actions. Network, account, and WebSocket restrictions can still prevent a connection. The helper never prints the token or URL and sanitizes failures.

The token is used for that connection attempt and cleared from the form; it is never persisted in browser storage, cookies, source, or GitHub. It is sent only to Upstox. This page has no third-party scripts or fonts and uses a restrictive CSP. Existing GitHub Actions secrets cannot be read back by this public frontend. Every viewer must authorize their own session; this does not expose a shared account feed publicly.

The broker's connection/subscription limits and data entitlements apply. Disconnect when finished. There is no unattended reconnect: a new connection needs a current token or new socket URL. All quotes clear on disconnect, error, and page exit. An initial feed is labeled separately from live update packets. “Fresh trade” requires an exchange last-trade timestamp within 30 seconds; an open socket or newly received packet alone is insufficient. Closed sessions/illiquid instruments can have old trade times.

The dependency-free decoder handles LTPC plus full-feed index and option depth fields in [Upstox's official V3 schema](https://github.com/upstox/upstox-python/blob/master/upstox_client/feeder/proto/MarketDataFeedV3.proto). It bounds-checks binary input and rejects malformed/unsafe fields. Decoder and connection flow are tested with fixtures; a successful authenticated browser feed still depends on the viewer's current credential, network, and broker policy. There are no order requests.

## Live CE / PE scenarios across the app

The live page and a shared panel above both dashboard tabs show NIFTY 50, BANK NIFTY and SENSEX scenarios. Connect once on `live.html` and keep it open in the same browser and origin. An in-memory BroadcastChannel shares only quotes and scenario outputs, never the access token or socket URL. Index cards and watchlist prices use fresh broker quotes when available, explicitly labeled live; technical indicators retain their own candle timestamps. After five seconds without the live tab heartbeat, the dashboard clears live scenarios and falls back to labeled snapshot prices. Broker credentials and live scenario state are not persisted. The separate convenience login stores only a shared UI access marker.

A buy candidate requires all of the following: a directional trend-breakout snapshot no older than ten minutes; a matching future-expiry contract with option ATR/risk metadata retrieved within five minutes; fresh live index and option trades within 30 seconds and packets within five seconds; uncrossed bid/ask spread <=5%; traded volume and depth >=one lot; and a newly completed five-minute candle beyond the underlying trigger. The live candle must be observed from its first ten seconds with no sample gap over 30 seconds. Initial snapshots, partial candles and reconnect gaps never confirm an entry. Entries are restricted to 09:30?14:45 IST weekdays; exchange holidays are not independently checked. Skip moves that have already passed either the original index or premium T1.

Before confirmation, WATCH CE/PE displays changing ask references. Confirmation freezes the indicative ask entry, the tighter existing swing stop / 1.5 option ATR stop, and 1R/2R targets rounded to the contract tick size. These are observed scenarios, not actual fills. Fresh option bids monitor SL, T1 and T2; target/stop touches latch on each packet. Underlying invalidation, a fresh neutral/opposite method decision, or 30 minutes from the observed trigger / 15:15 IST also exits the scenario. Stale model/quotes pause price monitoring; broker-side risk management is still required. Disconnecting or closing the live page clears session monitoring. No orders or fill tracking are implemented.

This is live **confirmation and monitoring of the trend-breakout snapshot**, not recalculation of every indicator on every tick. Strategy/OI/Greeks context still refreshes through GitHub Actions; completed-candle data, broker entitlements and browser connectivity determine availability. No validated win rate is claimed.

## Live prices on the home page

The home page shows a **Live market prices** table above the analysis panel. Select **Connect live feed**; the live tab shares your site sign-in. Authorize Upstox there, and keep that tab open in the same browser. Subscribed index, watchlist and option quotes appear automatically with LTP, change from close, exchange trade time and freshness.

Only fresh live-update packets are shown as live. Trades older than 30 seconds, packets received more than five seconds ago, initial snapshots and future timestamps are withheld. Disconnected/waiting rows show no live price; the existing index/watchlist cards can still show explicitly labeled snapshot prices. Demo mode hides real live panels. No additional broker connection, backend or credential storage was added, and strategy calculations remain five-minute snapshots.

## Why a recommendation may be missing

Home and live pages show **Recommendation updates** and a **Status changed IST** table column automatically. They highlight current CE/PE watches, confirmed entries, targets, exits and eligibility changes, using the configured rule-based method. Each index retains only its latest change time and previous status in memory. Ordinary price ticks and repeated snapshots do not create a new recommendation. Initial status observations are labeled separately; disconnect clears live change state. Keep the live tab connected and open. This is not an ongoing human/ChatGPT monitoring service, background push notifications or persistent signal history.

The shared live panel and CE/PE tab distinguish stale data from market neutrality:

- **WAIT FOR ANALYSIS:** no strategy snapshot has loaded yet.
- **STALE ANALYSIS:** the model candle is over ten minutes old or its timestamp is invalid. Fresh live ticks cannot make that model current.
- **LIVE FEED DISCONNECTED:** a directional model is fresh, but live confirmation is not connected or its tab heartbeat expired.
- **NO TRADE:** fresh trend-breakout checks are mixed or flat, or a later risk gate rejects the setup. Read the reason; this is not a promise that a trade will appear.
- **WAIT FOR METHOD / METHOD DATA UNAVAILABLE:** an old decision model or missing candle history cannot authorize a trade.
- **WATCH EXPIRED:** the pinned watch missed confirmation or expired; wait for a new snapshot.
- **WAIT FOR OPTION DATA / WAIT FOR LIVE OPTION:** the model needs usable premium risk metadata or fresh option depth before confirmation.

Each live card shows its strategy candle time. If analysis is stale, use **Open market-data refresh workflow**, run the existing workflow and inspect its result. The dashboard's Refresh data button only reloads published JSON; it cannot trigger an upstream broker refresh. The main dashboard can diagnose the loaded model without a connected live tab and without a second snapshot poll. GitHub's scheduled refresh can be delayed, and manual refresh can still fail if upstream credentials/access are invalid. A configured provider or open socket is not proof of fresh data.

## Trend-breakout CE / PE scenarios and optional diagnostics

The second tab shows the five-minute trend-breakout decision and its checks first. The previously requested catalog remains expandable diagnostics, with exact rules and measurements per indicator. It uses **completed five-minute candles**, not live ticks. GitHub Pages cannot run a continuous stream-processing backend. Scheduled Actions refresh the analysis and the browser reads the latest published snapshot. The UI does not label these snapshots as tick-live.

| Category | Implemented rules |
| --- | --- |
| Market structure | HH/HL, LH/LL from two confirmed pivots; BOS; CHoCH |
| Price action | Breakout + Retest; Support/Resistance; Trendline Breakout |
| Candlestick patterns | Engulfing; Pin Bar; Hammer; body-based Morning/Evening Star |
| Trend indicators | Full EMA 9/21/50/200 stack; Supertrend 10/3; Wilder ADX14 with DI |
| Momentum | Wilder RSI14; EMA MACD12/26/9; Stochastic14/3 crosses |
| Volume | Volume Breakout; Volume Spike; OBV versus its 20-bar mean |
| Intraday | Session VWAP; completed 09:15–09:30 ORB; Previous Day High/Low |
| Volatility | Bollinger20/2 re-entry; Wilder ATR14; squeeze breakout |
| Liquidity concepts | Swing liquidity-sweep rejection; three-bar FVG; displacement-based order-block heuristic |
| Options context | OI, PCR, IV, Delta, Theta, Gamma, and bid/ask liquidity from Upstox |

The model is versioned `catalog-v1`. Names with multiple interpretations use explicit heuristics, not discretionary institutional order-flow inference. Pivots require two preceding and two later bars; unconfirmed pivots are never used. Volume-dependent rules are unavailable for zero-volume indices. Missing OHLC, EMA200 warm-up, incomplete opening range, missing Greeks, and other unavailable inputs are displayed, never fabricated.

**CE/PE decision method (`trend-breakout-v1`):** one five-minute trend breakout replaces category voting. CE needs EMA9 > EMA21, rising EMA21 and close > EMA9; PE needs the inverse. Mixed/flat checks mean NO TRADE. Require 60 valid completed in-session OHLC candles and 20 consecutive current-session bars from 09:15 IST; earliest watch is 10:55 IST. Missing in-session intervals block analysis. Today's latest 20-bar high + 0.1 ATR14 is the CE trigger; the 20-bar low - 0.1 ATR14 is the PE trigger. Catalog category agreement remains optional diagnostics, never an entry decision or win probability.

**Confirmation and risk:** arm the displayed trigger, then require a later fully observed five-minute live close beyond it. New snapshots cannot move that pending trigger. Watches expire on missing/gapped confirmation, source age over ten minutes, direction/contract change or disconnect; already closed pre-arm bars cannot trigger retrospectively. The index stop uses the tighter last-five-bar low/high and 1.5 ATR14; index targets are 1R/2R. Premium entry uses the live ask and retains option ATR14/five-bar swing risk, actual tick/lot units and 1R/2R targets. Levels freeze at confirmation; skip entries beyond original T1. Missing option history means no premium targets. No rule here has a demonstrated profitable edge; costs, IV changes and slippage are not predicted.

**Options contract:** nearest future expiry (exclude expiry day), nearest-to-spot strike. Require valid bid/ask, spread <=5%, nonzero volume, and depth >=one lot. The master supplies lot/tick sizes. The chain has no exchange quote timestamp; retrieval freshness alone cannot prove exchange freshness. Verify broker quotes.

**Exit and suppression:** stop, index invalidation, or a fresh neutral/opposite trend-breakout decision; partial T1 / remainder T2 are illustrative. Time exit: 30 minutes after entry or 15:15 IST. New-entry window 09:30–14:45 IST, weekdays only (no holiday calendar). Hide levels when the underlying is >ten minutes old; hide premium levels when retrieval is >five minutes old. Five-minute snapshots cannot monitor or execute live stops. No orders or fills are managed.

## Data and timing

- **Charts:** embedded TradingView widget. Availability and delays depend on the exchange and the widget's data rights. Chart data cannot be read by the signal engine.
- **Signals:** two feed options: Yahoo Finance through the unofficial `yfinance` client, or authenticated Upstox API v3. Yahoo downloads five days of five-minute candles; Upstox combines ten calendar days of historical candles with today's intraday candles. Both discard unfinished candles before computing indicators. Some symbols may be unavailable or rate-limited. See API setup below.
- **Updates:** GitHub Actions targets a five-minute cadence on weekdays, 03:02–10:57 UTC (08:32–16:27 IST). Actions queues may delay or drop scheduled executions. The browser checks the deployed JSON every minute; Refresh reads the latest published snapshot, not the upstream provider.
- **Freshness:** a signal is withheld when its completed candle is over 20 minutes old or in the future. Each signal shows its own candle-end timestamp in IST. Fetch failure never changes an old candle's timestamp. A complete upstream failure stops deployment, preserving the previous site.
- **Session badge:** regular weekday hours only, 09:15–15:30 IST. It does not check exchange holidays or special sessions.
- **Price changes:** compared with the daily close before the latest intraday session. The backend keeps failed symbols from the previous cached snapshot with their original times.

The scheduled strategy pipeline uses periodically fetched candles. Its Upstox requests run in GitHub Actions with a server-side secret; that secret is never sent to the browser. The separate personal live page authorizes its own session directly with Upstox. Data access depends on the account's permissions and provider availability. Never embed a broker access token in this public frontend. Review the provider's terms for your intended use; yfinance is intended for personal research. Public/commercial redistribution may need a licensed feed. TradingView attribution is retained.

## Authenticated API setup (Upstox)

1. Set up an Upstox developer app and generate an access token using the [official authentication flow](https://upstox.com/developer/api-documentation/authentication/). An API key/client ID alone is not an access token. Do not paste credentials into this chat, a source file, or a frontend settings field.
2. Open this repository's [Actions secrets settings](https://github.com/sevendreamzone1/market-pulse/settings/secrets/actions), choose **New repository secret**, name it `UPSTOX_ACCESS_TOKEN`, and put the access token in its value. The client ID or API key alone will not work. The app secret is not needed by the snapshot fetcher.
3. Under the **Variables** tab, optionally add `MARKET_PROVIDER` with value `upstox`. The default `auto` already selects Upstox when the token exists; without it, `auto` selects Yahoo. Set `yahoo` to explicitly use Yahoo. Explicit Upstox mode fails clearly when the token is missing.
4. Open [Refresh market data and deploy Pages](https://github.com/sevendreamzone1/market-pulse/actions/workflows/pages.yml), choose **Run workflow** on `main`, and wait for the deployment to succeed. No source change is needed after adding the secret. It resolves the watchlist against Upstox's instrument master and fetches historical, daily, and current-session candles. Without a connected live tab, dashboard prices represent the last completed five-minute candle. Fresh browser-streamed prices override index and watchlist prices with an explicit live label.
5. Renew the repository secret when needed: Upstox's [standard access token expires at 3:30 AM the following day](https://upstox.com/developer/api-documentation/get-token/). This project does not bypass login or automatically renew tokens. Failed authentication preserves the prior deployment, whose signals expire by candle time.

Only market-data GET endpoints are used; there is no order placement. An Upstox authorization failure is not silently replaced with Yahoo data. Each refreshed item records its source; retained failed symbols keep their original source and timestamp. Yahoo prices are adjusted; Upstox prices use provider-native candles, so corporate actions can affect indicators differently.

Endpoints implemented:

- [Instrument master](https://upstox.com/developer/api-documentation/instruments/)
- [Intraday candles v3](https://upstox.com/developer/api-documentation/v3/get-intra-day-candle-data/): `/v3/historical-candle/intraday/{instrument_key}/minutes/5`
- [Historical candles v3](https://upstox.com/developer/api-documentation/v3/get-historical-candle-data/): `/v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date}`

The website also serves a public, credential-free snapshot API at `./data/market.json`, refreshed on deployment. It contains `generated_at`, `source`, `interval`, `feed`, `items`, and `errors`; `feed` identifies the preferred/active providers and connection status. Each item includes `ticker`, `price`, `change_pct`, `candle_end`, `ema9`, `ema21`, `rsi14`, `signal`, `reason`, and `source`. It is a static API snapshot, not a continuously running backend.

## Signal rules

The separate stock-card EMA/RSI indicators use at least 60 completed five-minute closes; they do not decide CE/PE scenarios. Yahoo closes are adjusted; Upstox uses provider-native prices. EMA is initialized with the period's simple mean; RSI uses Wilder smoothing.

| Observation | Rule |
| --- | --- |
| Bullish | EMA 9 > EMA 21 and RSI 14 between 50 and 70 inclusive |
| Bearish | EMA 9 < EMA 21 and RSI 14 >= 30 and < 50 |
| Neutral | Any other combination |

No orders, return predictions, position sizing, or buy/sell guarantees. The rules are unvalidated observations for education, not investment advice.

## Create the GitHub repository and publish

With an authenticated GitHub CLI, from this folder:

```powershell
gh repo create market-pulse --public --source . --remote origin --push
```

Or create an **empty public** `market-pulse` repository in GitHub (do not add a README), then use the exact repository URL GitHub supplies:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/market-pulse.git
git push -u origin main
```

1. In the new repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Open **Actions → Refresh market data and deploy Pages → Run workflow** on `main`.
3. Open the URL shown by the successful deploy job. Usually `https://YOUR-USERNAME.github.io/market-pulse/`.

The first push can fail its deployment if Pages has not yet been enabled; rerun after step 1. No API secrets are required for the default personal-research feed. Python dependencies are installed in Actions. An empty initial snapshot is intentional: the first successful workflow populates it. Provider/network failure is visible in workflow logs; no data is fabricated as a fallback. Scheduled Actions in public repositories can be disabled after 60 days without repository activity; check Actions if updates stop.

## Run locally

```powershell
python -m http.server 8080
```

Open `http://localhost:8080`. TradingView needs an internet connection. For an offline UI walkthrough, choose **Explore with clearly labeled demo data** in the methodology panel. Demo mode does not change the external chart.

To fetch real snapshots locally:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python scripts/fetch_market.py
```

## Check

```powershell
python -m unittest discover -s tests -v
node --check app.js
node tests/dashboard.test.cjs
node tests/login.test.cjs
node tests/live-feed.test.mjs
node tests/live-viewer.test.mjs
node tests/live-setups.test.mjs
node tests/live-dashboard.test.mjs
```

The indicator tests run with the Python standard library. The candle pipeline and API adapter tests additionally need the installed requirements. API adapter tests use fixtures and mock HTTP responses; they do not prove that a live account is authorized. The dashboard smoke test uses Node's built-in VM and a minimal DOM harness; it is not a browser rendering test.

## Customize

Watchlist metadata is in `app.js`. Provider tickers are in `scripts/fetch_market.py`. Keep the lists in sync (`.NS` = NSE, `.BO` = BSE). The schedule is in `.github/workflows/pages.yml`. All asset paths are relative, so repository-based GitHub Pages paths work without a custom domain.
