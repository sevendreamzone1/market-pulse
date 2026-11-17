# Market Pulse · India

A responsive NSE/BSE dashboard built for GitHub Pages. Plain HTML, CSS, and JavaScript; no frontend build or browser API keys.

[Published website](https://sevendreamzone1.github.io/market-pulse/) · [Repository](https://github.com/sevendreamzone1/market-pulse)

Upstox is the preferred market-data API. The repository is configured with `MARKET_PROVIDER=auto`: it selects Upstox when `UPSTOX_ACCESS_TOKEN` exists, otherwise keeps Yahoo snapshots available. The dashboard explicitly shows when the Upstox connection is pending. A present but invalid/expired Upstox token fails the refresh rather than silently switching feeds.

Includes TradingView charts, an eight-company watchlist, NIFTY 50 / BANK NIFTY / SENSEX snapshots, exchange and signal filters, and EMA 9 / EMA 21 / Wilder RSI 14 observations. Demo mode is explicitly fictional and opt-in. No fake prices are shown as market data.

## CE / PE analysis (second tab)

The **CE / PE analysis** tab covers NIFTY 50, BANK NIFTY, and SENSEX. A bullish EMA/RSI observation creates a conditional **CE watch**; bearish creates a **PE watch**; neutral means **no trade**. These are unvalidated research rules, not predictions or automated buy instructions.

- **Underlying trigger:** a NEW completed five-minute candle beyond the extreme of the latest 20 completed closes (above for CE, below for PE). Invalidation is the opposite extreme of the latest five closes. Index targets are one and two times that index risk distance. All these levels are **index points**, not option premiums. Recheck alignment at entry and skip an invalidated or already-run move.
- **Premium scenario:** when Upstox is active, fetch option contracts and the nearest future expiry's chain. Resolve the nearest-to-spot strike and selected CE/PE contract, including its actual lot and tick sizes. Exclude same-day expiry, nonpositive/missing prices or volume, crossed quotes, spread above 5%, and bid/ask quantities below one lot. The ask is a planning reference; preset stop is -20% and targets +20% / +40%, rounded to ticks. Recalculate using the actual fill. Fees, slippage, IV and theta are not modeled. Planned stop risk is not maximum risk; the whole premium can be lost.
- **Exit criteria:** stop, index invalidation, or lost EMA/RSI alignment, whichever occurs first; partial T1 and remainder T2 are illustrative. Time exit is 30 minutes from entry or 15:15 IST, whichever comes first. No new-entry scenarios before 09:30 or from 14:45 IST.
- **Freshness:** withhold entry/target levels outside the weekday research window or when the underlying is older than ten minutes. Premium values are hidden when retrieval is older than five minutes. Upstox option-chain responses do not give an exchange quote timestamp; retrieval freshness does NOT prove quote freshness. The UI explicitly requires broker confirmation. No option quotes means no premium levels. Demo shows fictional underlying scenarios only.
- **Execution:** this dashboard does not track fills, monitor live stops, or place orders. Five-minute scheduled snapshots cannot enforce exit criteria. Use broker-side live monitoring and orders. The strategy has not been backtested.

The snapshot's `options` array contains these scenarios separately from watchlist data. Option-chain failures are isolated so they do not prevent publishing valid underlying snapshots. Existing candle-source and stale-data checks still apply.

## Data and timing

- **Charts:** embedded TradingView widget. Availability and delays depend on the exchange and the widget's data rights. Chart data cannot be read by the signal engine.
- **Signals:** two feed options: Yahoo Finance through the unofficial `yfinance` client, or authenticated Upstox API v3. Yahoo downloads five days of five-minute candles; Upstox combines ten calendar days of historical candles with today's intraday candles. Both discard unfinished candles before computing indicators. Some symbols may be unavailable or rate-limited. See API setup below.
- **Updates:** GitHub Actions targets a five-minute cadence on weekdays, 03:02–10:57 UTC (08:32–16:27 IST). Actions queues may delay or drop scheduled executions. The browser checks the deployed JSON every minute; Refresh reads the latest published snapshot, not the upstream provider.
- **Freshness:** a signal is withheld when its completed candle is over 20 minutes old or in the future. Each signal shows its own candle-end timestamp in IST. Fetch failure never changes an old candle's timestamp. A complete upstream failure stops deployment, preserving the previous site.
- **Session badge:** regular weekday hours only, 09:15–15:30 IST. It does not check exchange holidays or special sessions.
- **Price changes:** compared with the daily close before the latest intraday session. The backend keeps failed symbols from the previous cached snapshot with their original times.

This project uses periodically fetched candles, not a tick-by-tick streaming feed. Upstox requests run in GitHub Actions with a server-side secret; no token is sent to the browser. Data access depends on the account's permissions and provider availability. Never embed a broker access token in this public frontend. Review the provider's terms for your intended use; yfinance is intended for personal research. Public/commercial redistribution may need a licensed feed. TradingView attribution is retained.

## Authenticated API setup (Upstox)

1. Set up an Upstox developer app and generate an access token using the [official authentication flow](https://upstox.com/developer/api-documentation/authentication/). An API key/client ID alone is not an access token. Do not paste credentials into this chat, a source file, or a frontend settings field.
2. Open this repository's [Actions secrets settings](https://github.com/sevendreamzone1/market-pulse/settings/secrets/actions), choose **New repository secret**, name it `UPSTOX_ACCESS_TOKEN`, and put the access token in its value. The client ID or API key alone will not work. The app secret is not needed by the snapshot fetcher.
3. Under the **Variables** tab, optionally add `MARKET_PROVIDER` with value `upstox`. The default `auto` already selects Upstox when the token exists; without it, `auto` selects Yahoo. Set `yahoo` to explicitly use Yahoo. Explicit Upstox mode fails clearly when the token is missing.
4. Open [Refresh market data and deploy Pages](https://github.com/sevendreamzone1/market-pulse/actions/workflows/pages.yml), choose **Run workflow** on `main`, and wait for the deployment to succeed. No source change is needed after adding the secret. It resolves the watchlist against Upstox's instrument master and fetches historical, daily, and current-session candles. Prices in the dashboard represent the last completed five-minute candle, not the latest traded tick.
5. Renew the repository secret when needed: Upstox's [standard access token expires at 3:30 AM the following day](https://upstox.com/developer/api-documentation/get-token/). This project does not bypass login or automatically renew tokens. Failed authentication preserves the prior deployment, whose signals expire by candle time.

Only market-data GET endpoints are used; there is no order placement. An Upstox authorization failure is not silently replaced with Yahoo data. Each refreshed item records its source; retained failed symbols keep their original source and timestamp. Yahoo prices are adjusted; Upstox prices use provider-native candles, so corporate actions can affect indicators differently.

Endpoints implemented:

- [Instrument master](https://upstox.com/developer/api-documentation/instruments/)
- [Intraday candles v3](https://upstox.com/developer/api-documentation/v3/get-intra-day-candle-data/): `/v3/historical-candle/intraday/{instrument_key}/minutes/5`
- [Historical candles v3](https://upstox.com/developer/api-documentation/v3/get-historical-candle-data/): `/v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date}`

The website also serves a public, credential-free snapshot API at `./data/market.json`, refreshed on deployment. It contains `generated_at`, `source`, `interval`, `feed`, `items`, and `errors`; `feed` identifies the preferred/active providers and connection status. Each item includes `ticker`, `price`, `change_pct`, `candle_end`, `ema9`, `ema21`, `rsi14`, `signal`, `reason`, and `source`. It is a static API snapshot, not a continuously running backend.

## Signal rules

Indicators use at least 60 completed five-minute closes. Yahoo closes are adjusted; Upstox uses provider-native prices. EMA is initialized with the period's simple mean; RSI uses Wilder smoothing.

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
```

The indicator tests run with the Python standard library. The candle pipeline and API adapter tests additionally need the installed requirements. API adapter tests use fixtures and mock HTTP responses; they do not prove that a live account is authorized. The dashboard smoke test uses Node's built-in VM and a minimal DOM harness; it is not a browser rendering test.

## Customize

Watchlist metadata is in `app.js`. Provider tickers are in `scripts/fetch_market.py`. Keep the lists in sync (`.NS` = NSE, `.BO` = BSE). The schedule is in `.github/workflows/pages.yml`. All asset paths are relative, so repository-based GitHub Pages paths work without a custom domain.
