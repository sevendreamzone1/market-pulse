"""Conditional research scenarios, not validated trade recommendations."""
import math
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from zoneinfo import ZoneInfo
from strategies import atr_values

INDEX_TICKERS = ('^NSEI', '^NSEBANK', '^BSESN')


def underlying_setup(item):
    closes = item.get('recent_closes', [])
    if len(closes) < 20 or not all(isinstance(x, (float, int)) and math.isfinite(x) and x > 0 for x in closes):
        return dict(status='unavailable', reason='At least 20 valid completed closes are needed.')
    report=item.get('strategy_report', {})
    signal = report.get('consensus', {}).get('signal')
    if signal not in ('Bullish', 'Bearish'):
        return dict(status='no_trade', reason=report.get('consensus', {}).get('reason', 'Strategy evaluation unavailable; no recommendation from the legacy EMA/RSI signal.'))
    call = signal == 'Bullish'
    entry = report.get('swing_high', max(closes[-20:])) if call else report.get('swing_low', min(closes[-20:]))
    stop = min(closes[-5:]) if call else max(closes[-5:])
    atr=report.get('atr14')
    if atr and atr>0:
        stop=max(stop,entry-1.5*atr) if call else min(stop,entry+1.5*atr)
    risk = abs(entry - stop)
    direction = 1 if call else -1
    if risk <= 0 or entry + direction * 2 * risk <= 0:
        return dict(status='no_trade', reason='The recent price range cannot define a usable stop and targets.')
    return dict(status='conditional', side='CE' if call else 'PE',
                reason=report['consensus']['reason'], entry=round(entry, 2), stop=round(stop, 2),
                target1=round(entry + direction * risk, 2), target2=round(entry + direction * 2 * risk, 2),
                basis='underlying_index_points', confirmation='above' if call else 'below',
                candle_end=item.get('candle_end'))


def premium_scenario(chain, contracts, setup, now, risk_bars=None):
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
    if not risk_bars or len(risk_bars)<30:
        raise ValueError('Thirty completed option candles are required for ATR-based premium risk levels.')
    if not all(all(isinstance(b.get(k),(int,float)) and math.isfinite(b[k]) and b[k]>0 for k in ('high','low','close')) and b['low']<=b['close']<=b['high'] for b in risk_bars):
        raise ValueError('Option candle OHLC data is invalid.')
    atr=atr_values([b['high'] for b in risk_bars],[b['low'] for b in risk_bars],[b['close'] for b in risk_bars])[-1]
    stop=rounded(max(min(b['low'] for b in risk_bars[-5:]),entry-1.5*atr))
    risk=entry-stop
    if risk<float(tick_rupees)*2:
        raise ValueError('Premium entry is already invalidated or the risk distance is below two ticks.')
    t1,t2=rounded(entry+risk,up=True),rounded(entry+2*risk,up=True)
    if not 0 < stop < entry < t1 < t2:
        raise ValueError('Tick size cannot express the scenario levels.')
    return dict(status='available', instrument_key=key, trading_symbol=contract.get('trading_symbol', key),
                expiry=expiry, strike=row['strike_price'], side=side, lot_size=lot,
                bid=bid, ask=ask, entry=entry, stop=stop, target1=t1, target2=t2,
                premium_outlay=round(entry * lot, 2), planned_risk=round((entry-stop)*lot, 2),
                fetched_at=datetime.now(timezone.utc).isoformat(), exchange_timestamp=None,
                basis='option_premium_rupees',atr14=round(atr,4),tick_size_rupees=float(tick_rupees),
                rule='Ask reference; stop at the tighter of the five-bar swing low and 1.5 ATR14; targets 1R and 2R, before costs.')


def options_context(chain):
    """Descriptive derivatives metrics; OI/PCR alone do not imply a direction."""
    rows=[]
    def record(name,values,reason):
        valid=bool(values) and all(isinstance(v,(float,int)) and math.isfinite(v) for v in values.values())
        rows.append(dict(category='Options analysis',name=name,vote=0 if valid else None,
                         state='Context' if valid else 'Unavailable',role='context',values=values if valid else {},reason=reason))
    atm=min(chain,key=lambda x:abs(x.get('strike_price',0)-x.get('underlying_spot_price',0))) if chain else {}
    calls=[r.get('call_options',{}).get('market_data',{}) for r in chain]
    puts=[r.get('put_options',{}).get('market_data',{}) for r in chain]
    call_oi=sum(m.get('oi',0) or 0 for m in calls); put_oi=sum(m.get('oi',0) or 0 for m in puts)
    record('Open Interest',{'call_oi':call_oi,'put_oi':put_oi} if chain else {},'Across returned expiry strikes; OI is positioning, not a buy/sell signal.')
    record('PCR',{'pcr':round(put_oi/call_oi,3)} if call_oi else {},'Put OI / call OI. No universal bullish/bearish threshold is assumed.')
    for title,key in [('IV','iv'),('Delta','delta'),('Theta','theta'),('Gamma','gamma')]:
        values={side:atm.get(side+'_options',{}).get('option_greeks',{}).get(key) for side in ('call','put')}
        record(title,values,'Nearest-to-spot Greeks from the returned chain; descriptive risk context, not forecasts.')
    markets={side:atm.get(side+'_options',{}).get('market_data',{}) for side in ('call','put')}
    values={side+'_spread_pct':round((m['ask_price']-m['bid_price'])/m['ask_price']*100,3) for side,m in markets.items()
            if isinstance(m.get('ask_price'),(int,float)) and isinstance(m.get('bid_price'),(int,float)) and m['ask_price']>0 and 0<m['bid_price']<=m['ask_price']}
    record('Liquidity',values,'Bid/ask spread; selected contracts additionally require volume and depth of at least one lot.')
    return rows


def build_options(items, provider, now):
    result = []
    for item in items:
        if item.get('ticker') not in INDEX_TICKERS:
            continue
        setup = underlying_setup(item)
        setup.update(ticker=item['ticker'], source=item.get('source'),
                     candle_end=item.get('candle_end'), strategy_report=item.get('strategy_report', {}),
                     premium={'status':'unavailable', 'reason':'No directional confluence or usable option-chain quote.'})
        context=options_context([])
        if hasattr(provider, 'option_chain'):
            try:
                age = (now - datetime.fromisoformat(item['candle_end'])).total_seconds()
                if not 0 <= age <= 600:
                    raise ValueError('Underlying candle is stale; premium scenarios withheld.')
                chain, contracts = provider.option_chain(item['ticker'], now)
                context=options_context(chain)
                if setup['status']=='conditional':
                    # Select the same ATM contract used by the scenario; never invent premium history.
                    relevant=[r for r in chain if r.get('underlying_spot_price') is not None]
                    atm=min(relevant,key=lambda r:abs(r['strike_price']-r['underlying_spot_price']))
                    key=atm['call_options' if setup['side']=='CE' else 'put_options']['instrument_key']
                    bars=provider.option_candles(key,datetime.now(timezone.utc))
                    setup['premium'] = premium_scenario(chain, contracts, setup, now, risk_bars=bars)
            except Exception as exc:
                setup['premium'] = dict(status='unavailable', reason=str(exc)[:180])
        setup['strategy_report']={**setup['strategy_report'], 'rows':setup['strategy_report'].get('rows',[])+context}
        result.append(setup)
    return result
