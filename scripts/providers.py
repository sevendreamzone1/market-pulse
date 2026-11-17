"""Market-data adapters used only by Python / GitHub Actions, never the browser."""
import gzip
import json
import os
from datetime import timedelta
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

API_ROOT = 'https://api.upstox.com/v3'
INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz'
INDEX_NAMES = {'^NSEI': ('NSE_INDEX', 'Nifty 50'),
               '^NSEBANK': ('NSE_INDEX', 'Nifty Bank'),
               '^BSESN': ('BSE_INDEX', 'SENSEX')}


def get_json(url, token=None):
    import requests
    headers = {'Accept': 'application/json', 'User-Agent': 'MarketPulse/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        response = requests.get(url, headers=headers, timeout=20, allow_redirects=False)
    except requests.RequestException:
        # Deliberately do not echo a request, token, or provider response body.
        raise RuntimeError('Market API connection failed; check network access') from None
    if response.status_code in (401, 403):
        raise RuntimeError('Market API authorization failed; renew UPSTOX_ACCESS_TOKEN and check data access')
    if response.status_code != 200:
        raise RuntimeError(f'Market API returned HTTP {response.status_code}')
    try:
        body = response.content
        if body.startswith(b'\x1f\x8b'):
            body = gzip.decompress(body)
        result = json.loads(body)
    except (ValueError, OSError):
        raise RuntimeError('Market API returned an invalid JSON response') from None
    if isinstance(result, dict) and result.get('status') == 'error':
        raise RuntimeError('Market API rejected the request; check instrument and API access')
    return result


def resolve_instrument(ticker, instruments):
    if ticker in INDEX_NAMES:
        segment, symbol = INDEX_NAMES[ticker]
    else:
        symbol, suffix = ticker.rsplit('.', 1)
        segment = {'NS': 'NSE_EQ', 'BO': 'BSE_EQ'}[suffix]
    matches = [item['instrument_key'] for item in instruments
               if item.get('segment') == segment
               and (str(item.get('trading_symbol', '')).casefold() == symbol.casefold()
                    or (ticker in INDEX_NAMES and (
                        str(item.get('name', '')).casefold() == symbol.casefold()
                        or str(item.get('instrument_key', '')).casefold() == f'{segment}|{symbol}'.casefold())))
               and item.get('instrument_key')]
    if len(set(matches)) != 1:
        raise ValueError(f'Expected one instrument for {ticker}; found {len(set(matches))}')
    return matches[0]


def candle_frame(payload):
    import pandas as pd
    candles = payload.get('data', {}).get('candles')
    if not isinstance(candles, list):
        raise ValueError('Market API response does not contain candles')
    if not candles:
        return pd.DataFrame({'Close': []}, index=pd.DatetimeIndex([], tz='UTC'))
    if any(not isinstance(row, list) or len(row) < 5 for row in candles):
        raise ValueError('Market API candle has an invalid shape')
    # Parse to UTC so intraday filtering and candle completion are unambiguous.
    index = pd.to_datetime([row[0] for row in candles], utc=True, errors='raise')
    if any(pd.Timestamp(row[0]).tzinfo is None for row in candles):
        raise ValueError('Market API candle is missing its timezone')
    values = {name: pd.to_numeric([row[position] for row in candles], errors='raise')
              for position, name in enumerate(('Open', 'High', 'Low', 'Close'), start=1)}
    if all(len(row) > 5 for row in candles):
        values['Volume'] = pd.to_numeric([row[5] for row in candles], errors='raise')
    return pd.DataFrame(values, index=index).sort_index()


class YahooProvider:
    name = 'Yahoo Finance via yfinance (indicative, may be delayed)'
    adjustment = 'adjusted'

    def frames(self, ticker, now):
        import yfinance as yf
        candles = yf.download(ticker, period='5d', interval='5m', auto_adjust=True,
                              progress=False, multi_level_index=False, threads=False, timeout=12)
        daily = yf.download(ticker, period='1mo', interval='1d', auto_adjust=True,
                            progress=False, multi_level_index=False, threads=False, timeout=12)
        return candles, daily


class UpstoxProvider:
    name = 'Upstox API v3 (completed five-minute candles)'
    adjustment = 'provider-native'

    def __init__(self, token, requester=get_json):
        if not token or not token.strip():
            raise ValueError('Set UPSTOX_ACCESS_TOKEN as a GitHub Actions repository secret')
        self._token = token.strip()
        self._request = requester
        self._instruments = None

    def instrument_key(self, ticker):
        if self._instruments is None:
            self._instruments=self._request(INSTRUMENTS_URL)
        return resolve_instrument(ticker,self._instruments)

    def frames(self, ticker, now):
        import pandas as pd
        if self._instruments is None:
            self._instruments = self._request(INSTRUMENTS_URL)
            if not isinstance(self._instruments, list):
                raise ValueError('Instrument master is not a JSON array')
        key = quote(resolve_instrument(ticker, self._instruments), safe='')
        today = now.astimezone(ZoneInfo('Asia/Kolkata')).date()
        yesterday = today - timedelta(days=1)
        start = today - timedelta(days=10)
        history = candle_frame(self._request(
            f'{API_ROOT}/historical-candle/{key}/minutes/5/{yesterday}/{start}', self._token))
        intraday = candle_frame(self._request(
            f'{API_ROOT}/historical-candle/intraday/{key}/minutes/5', self._token))
        daily = candle_frame(self._request(
            f'{API_ROOT}/historical-candle/{key}/days/1/{yesterday}/{today - timedelta(days=35)}', self._token))
        # Daily session dates must be in IST, not the UTC date of local midnight.
        daily.index = daily.index.tz_convert('Asia/Kolkata')
        candles = pd.concat([history, intraday]).sort_index()
        return candles, daily

    def option_chain(self, ticker, now):
        if self._instruments is None:
            self._instruments = self._request(INSTRUMENTS_URL)
        key = resolve_instrument(ticker, self._instruments)
        root = 'https://api.upstox.com/v2/option/'
        contracts = self._request(root + 'contract?' + urlencode({'instrument_key':key}), self._token).get('data', [])
        today = now.astimezone(ZoneInfo('Asia/Kolkata')).date().isoformat()
        expiries = sorted({str(c.get('expiry', ''))[:10] for c in contracts if str(c.get('expiry', ''))[:10] > today})
        if not expiries:
            raise ValueError('No future-expiry options contracts returned.')
        chain = self._request(root + 'chain?' + urlencode({'instrument_key':key, 'expiry_date':expiries[0]}), self._token).get('data', [])
        return chain, contracts

    def option_candles(self, instrument_key, now):
        import pandas as pd
        key=quote(instrument_key,safe='')
        today=now.astimezone(ZoneInfo('Asia/Kolkata')).date()
        history=candle_frame(self._request(f'{API_ROOT}/historical-candle/{key}/minutes/5/{today-timedelta(days=1)}/{today-timedelta(days=10)}',self._token))
        intraday=candle_frame(self._request(f'{API_ROOT}/historical-candle/intraday/{key}/minutes/5',self._token))
        frame=pd.concat([history,intraday]).sort_index()
        frame=frame[~frame.index.duplicated(keep='last')]
        frame=frame[frame.index+timedelta(minutes=5)<=now]
        if frame.empty or (now-frame.index[-1].to_pydatetime()-timedelta(minutes=5)).total_seconds()>600:
            raise ValueError('Option candle history is stale or unavailable.')
        return [{'high':float(row.High),'low':float(row.Low),'close':float(row.Close)} for row in frame.itertuples()]


def select_provider(mode=None, token=None):
    mode = (mode if mode is not None else os.getenv('MARKET_PROVIDER', 'auto')).strip().lower() or 'auto'
    token = token if token is not None else os.getenv('UPSTOX_ACCESS_TOKEN', '')
    if mode not in ('auto', 'yahoo', 'upstox'):
        raise ValueError('MARKET_PROVIDER must be auto, yahoo, or upstox')
    if mode == 'upstox' or (mode == 'auto' and token.strip()):
        return UpstoxProvider(token)
    return YahooProvider()


def provider_configuration(provider, mode=None):
    """Public connection metadata; never include credentials in snapshots."""
    mode = (mode if mode is not None else os.getenv('MARKET_PROVIDER', 'auto')).strip().lower() or 'auto'
    active = 'upstox' if isinstance(provider, UpstoxProvider) else 'yahoo'
    return dict(preferred='upstox' if mode == 'auto' else mode, active=active,
                status='awaiting_credentials' if mode == 'auto' and active == 'yahoo' else 'configured')
