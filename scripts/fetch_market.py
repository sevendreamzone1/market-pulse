"""Build a static snapshot; no API credentials are shipped to the browser."""
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from signals import analyze
from providers import select_provider, provider_configuration

ROOT = Path(__file__).resolve().parents[1]
TICKERS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS',
           'ICICIBANK.NS', 'BHARTIARTL.NS', 'SBIN.BO', 'ITC.BO',
           '^NSEI', '^NSEBANK', '^BSESN']


def build_item(ticker, candles, daily, now):
    """yfinance candle timestamps denote candle START, not completion."""
    candles = candles.dropna(subset=['Close']).sort_index()
    if candles.empty:
        raise ValueError('No intraday candles returned; check provider connectivity or symbol availability')
    candles = candles[~candles.index.duplicated(keep='last')]
    if candles.index.tz is None:
        raise ValueError('Provider returned ambiguous candle timestamps')
    candles = candles[candles.index + timedelta(minutes=5) <= now]
    closes = [float(p) for p in candles['Close'].tolist()]
    indicators = analyze(closes)
    last_start = candles.index[-1].to_pydatetime()
    last_end = last_start + timedelta(minutes=5)
    # Compare against the daily close from BEFORE the latest intraday session.
    # This also works after hours, when today's daily bar is already complete.
    local_date = last_start.astimezone(ZoneInfo('Asia/Kolkata')).date()
    previous = daily.dropna(subset=['Close'])
    previous = previous[[stamp.date() < local_date for stamp in previous.index]]
    prev_close = float(previous['Close'].iloc[-1]) if len(previous) else None
    change = (closes[-1] / prev_close - 1) * 100 if prev_close and math.isfinite(prev_close) else None
    return dict(ticker=ticker, price=closes[-1], change_pct=change,
                candle_end=last_end.isoformat(), recent_closes=closes[-30:], **indicators)


def main():
    provider = select_provider()
    print('Data source: ' + provider.name)
    now = datetime.now(timezone.utc)
    items, errors = [], []
    for ticker in TICKERS:
        try:
            candles, daily = provider.frames(ticker, now)
            item = build_item(ticker, candles, daily, now)
            item.update(source=provider.name, adjustment=provider.adjustment)
            items.append(item)
            print(f'{ticker}: candle ended {items[-1]["candle_end"]}')
        except Exception as exc:
            errors.append(dict(ticker=ticker, error=str(exc)[:180]))
            print(f'::warning::{ticker}: {exc}', file=sys.stderr)
    path = ROOT / 'data' / 'market.json'
    if not items:
        raise SystemExit('No symbols refreshed. Keeping the previous deployed site. Check connectivity; '
                         'for the authenticated API configure UPSTOX_ACCESS_TOKEN and MARKET_PROVIDER=upstox.')
    # Retain previous values for failed symbols with their ORIGINAL timestamps.
    if path.exists():
        old = json.loads(path.read_text(encoding='utf-8'))
        refreshed = {item['ticker'] for item in items}
        for item in old.get('items', []):
            if item.get('ticker') not in refreshed:
                item.setdefault('source', old.get('source', 'Unknown retained feed'))
                items.append(item)
    result = dict(generated_at=datetime.now(timezone.utc).isoformat(), source=provider.name,
                  interval='5m', feed=provider_configuration(provider), items=items, errors=errors)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    temporary.replace(path)


if __name__ == '__main__':
    main()
