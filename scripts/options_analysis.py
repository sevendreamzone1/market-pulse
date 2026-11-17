"""Conditional research scenarios, not validated trade recommendations."""
import math
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from zoneinfo import ZoneInfo

INDEX_TICKERS = ('^NSEI', '^NSEBANK', '^BSESN')


def underlying_setup(item):
    closes = item.get('recent_closes', [])
    if len(closes) < 20 or not all(isinstance(x, (float, int)) and math.isfinite(x) and x > 0 for x in closes):
        return dict(status='unavailable', reason='At least 20 valid completed closes are needed.')
    signal = item.get('signal')
    if signal not in ('Bullish', 'Bearish'):
        return dict(status='no_trade', reason='EMA and RSI do not align. Wait; neither CE nor PE meets the directional rule.')
    call = signal == 'Bullish'
    entry = max(closes[-20:]) if call else min(closes[-20:])
    stop = min(closes[-5:]) if call else max(closes[-5:])
    risk = abs(entry - stop)
    direction = 1 if call else -1
    if risk <= 0 or entry + direction * 2 * risk <= 0:
        return dict(status='no_trade', reason='The recent price range cannot define a usable stop and targets.')
    return dict(status='conditional', side='CE' if call else 'PE',
                reason=item.get('reason', ''), entry=round(entry, 2), stop=round(stop, 2),
                target1=round(entry + direction * risk, 2), target2=round(entry + direction * 2 * risk, 2),
                basis='underlying_index_points', confirmation='above' if call else 'below',
                candle_end=item.get('candle_end'))


def premium_scenario(chain, contracts, setup, now):
    """Choose near-ATM from a real chain, with quote and lot-size checks."""
    today = now.astimezone(ZoneInfo('Asia/Kolkata')).date()
    side = setup['side']
    relevant = [c for c in contracts if c.get('instrument_type') == side
                and str(c.get('expiry', ''))[:10] > today.isoformat()]
    if not relevant:
        raise ValueError('No future-expiry contract is available; expiry-day contracts are excluded.')
    expiry = min(c['expiry'][:10] for c in relevant)
    rows = [r for r in chain if str(r.get('expiry', ''))[:10] == expiry
            and isinstance(r.get('strike_price'), (int, float))
            and isinstance(r.get('underlying_spot_price'), (int, float))
            and math.isfinite(r['strike_price']) and math.isfinite(r['underlying_spot_price'])]
    if not rows:
        raise ValueError('Option chain has no matching expiry or underlying price.')
    row = min(rows, key=lambda r: abs(r['strike_price'] - r['underlying_spot_price']))
    option = row.get('call_options' if side == 'CE' else 'put_options', {})
    key = option.get('instrument_key')
    contract = next((c for c in relevant if c.get('instrument_key') == key and c['expiry'][:10] == expiry), None)
    if not contract or (contract.get('strike_price') is not None and contract['strike_price'] != row['strike_price']):
        raise ValueError('Chain contract does not match the contract master.')
    market = option.get('market_data', {})
    bid, ask = market.get('bid_price'), market.get('ask_price')
    lot, tick = contract.get('lot_size'), contract.get('tick_size')
    values = (bid, ask, lot, tick, market.get('volume'), market.get('bid_qty'), market.get('ask_qty'))
    if not all(isinstance(x, (int, float)) and math.isfinite(x) and x > 0 for x in values):
        raise ValueError('Quote, volume, tick size, or liquidity is unavailable.')
    if int(lot) != lot or bid > ask or (ask - bid) / ask > .05 or min(market['bid_qty'], market['ask_qty']) < lot:
        raise ValueError('Spread exceeds 5%, quote is crossed, or depth is below one lot.')
    # Upstox instrument-master tick_size is in paise; premiums are rupees.
    tick_rupees = Decimal(str(tick)) / 100
    def rounded(value, up=False):
        rounding = ROUND_CEILING if up else ROUND_FLOOR
        return float((Decimal(str(value)) / tick_rupees).to_integral_value(rounding=rounding) * tick_rupees)
    entry = rounded(ask, up=True)
    stop, t1, t2 = rounded(entry * .8), rounded(entry * 1.2, up=True), rounded(entry * 1.4, up=True)
    if not 0 < stop < entry < t1 < t2:
        raise ValueError('Tick size cannot express the scenario levels.')
    return dict(status='available', instrument_key=key, trading_symbol=contract.get('trading_symbol', key),
                expiry=expiry, strike=row['strike_price'], side=side, lot_size=lot,
                bid=bid, ask=ask, entry=entry, stop=stop, target1=t1, target2=t2,
                premium_outlay=round(entry * lot, 2), planned_risk=round((entry-stop)*lot, 2),
                fetched_at=datetime.now(timezone.utc).isoformat(), exchange_timestamp=None,
                basis='option_premium_rupees', rule='Ask reference; stop -20%, T1 +20%, T2 +40%, tick-rounded; before costs.')


def build_options(items, provider, now):
    result = []
    for item in items:
        if item.get('ticker') not in INDEX_TICKERS:
            continue
        setup = underlying_setup(item)
        setup.update(ticker=item['ticker'], source=item.get('source'),
                     candle_end=item.get('candle_end'), premium={'status':'unavailable', 'reason':'Upstox option-chain connection required.'})
        if setup['status'] == 'conditional' and hasattr(provider, 'option_chain'):
            try:
                age = (now - datetime.fromisoformat(item['candle_end'])).total_seconds()
                if not 0 <= age <= 600:
                    raise ValueError('Underlying candle is stale; premium scenarios withheld.')
                chain, contracts = provider.option_chain(item['ticker'], now)
                setup['premium'] = premium_scenario(chain, contracts, setup, now)
            except Exception as exc:
                setup['premium'] = dict(status='unavailable', reason=str(exc)[:180])
        result.append(setup)
    return result
