# Market Pulse · India

A responsive NSE/BSE dashboard built for GitHub Pages. Plain HTML, CSS, and JavaScript; no frontend build or browser API keys.

Includes TradingView charts, an eight-company watchlist, NIFTY 50 / BANK NIFTY / SENSEX snapshots, exchange and signal filters, and EMA 9 / EMA 21 / Wilder RSI 14 observations. Demo mode is explicitly fictional and opt-in. No fake prices are shown as market data.

## Data and timing

- **Charts:** embedded TradingView widget. Availability and delays depend on the exchange and the widget's data rights. Chart data cannot be read by the signal engine.
- **Signals:** Yahoo Finance through the unofficial `yfinance` client. The workflow downloads five days of five-minute candles, discards unfinished candles, and computes indicators. This is indicative data, not a guaranteed real-time feed. Some symbols may be unavailable or rate-limited.
- **Updates:** GitHub Actions targets a five-minute cadence on weekdays, 03:02–10:57 UTC (08:32–16:27 IST). Actions queues may delay or drop scheduled executions. The browser checks the deployed JSON every minute; Refresh reads the latest published snapshot, not the upstream provider.
- **Freshness:** a signal is withheld when its completed candle is over 20 minutes old or in the future. Each signal shows its own candle-end timestamp in IST. Fetch failure never changes an old candle's timestamp. A complete upstream failure stops deployment, preserving the previous site.
- **Session badge:** regular weekday hours only, 09:15–15:30 IST. It does not check exchange holidays or special sessions.
- **Price changes:** compared with the daily close before the latest intraday session. The backend keeps failed symbols from the previous cached snapshot with their original times.

This project cannot promise tick-by-tick live NSE/BSE data. For production real-time use, obtain an authorized provider, put credentials in a server-side service, and adapt the fetcher to that provider. Never embed a broker access token in this public frontend. Review Yahoo's data terms for your intended use; yfinance is intended for personal research. Public/commercial redistribution may need a licensed feed. TradingView attribution is retained.

## Signal rules

Indicators use at least 60 completed, adjusted five-minute closes. EMA is initialized with the period's simple mean; RSI uses Wilder smoothing.

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

The indicator tests run with the Python standard library. The candle pipeline tests additionally need the installed requirements. The dashboard smoke test uses Node's built-in VM and a minimal DOM harness; it is not a browser rendering test.

## Customize

Watchlist metadata is in `app.js`. Provider tickers are in `scripts/fetch_market.py`. Keep the lists in sync (`.NS` = NSE, `.BO` = BSE). The schedule is in `.github/workflows/pages.yml`. All asset paths are relative, so repository-based GitHub Pages paths work without a custom domain.
