"""Build a static snapshot; no API credentials are shipped to the browser."""
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from signals import analyze

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
    import yfinance as yf
    now = datetime.now(timezone.utc)
    items, errors = [], []
    for ticker in TICKERS:
        try:
            candles = yf.download(ticker, period='5d', interval='5m', auto_adjust=True,
                                  progress=False, multi_level_index=False, threads=False, timeout=20)
            daily = yf.download(ticker, period='1mo', interval='1d', auto_adjust=True,
                                progress=False, multi_level_index=False, threads=False, timeout=20)
            items.append(build_item(ticker, candles, daily, now))
            print(f'{ticker}: candle ended {items[-1]["candle_end"]}')
        except Exception as exc:
            errors.append(dict(ticker=ticker, error=str(exc)[:180]))
            print(f'::warning::{ticker}: {exc}', file=sys.stderr)
    path = ROOT / 'data' / 'market.json'
    if not items:
        raise SystemExit('No symbols refreshed. Keeping the previous deployed site; inspect provider connectivity.')
    # Retain previous values for failed symbols with their ORIGINAL timestamps.
    if path.exists():
        old = json.loads(path.read_text(encoding='utf-8'))
        refreshed = {item['ticker'] for item in items}
        items.extend(item for item in old.get('items', []) if item.get('ticker') not in refreshed)
    result = dict(generated_at=now.isoformat(), source='Yahoo Finance via yfinance (indicative, may be delayed)',
                  interval='5m', items=items, errors=errors)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    temporary.replace(path)


if __name__ == '__main__':
    main()
