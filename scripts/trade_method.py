"""One versioned trend-breakout decision; catalog votes are diagnostics only."""
import math
from strategies import ema_path, atr_values

METHOD_ID = 'trend-breakout-v1'
METHOD_NAME = 'Five-minute trend breakout'


def evaluate_method(frame):
    result = dict(id=METHOD_ID, name=METHOD_NAME, status='unavailable', side=None,
                  checks=[], values={}, reason='Valid completed five-minute OHLC history is required.')
    def blocked(reason):
        return {**result, 'reason': reason}
    if not all(k in frame for k in ('Open', 'High', 'Low', 'Close')) or frame.empty:
        return blocked(result['reason'])
    if frame.index.tz is None or not frame.index.is_monotonic_increasing or not frame.index.is_unique:
        return blocked('Candle times must be ordered, unique and timezone-aware.')
    local = frame.index.tz_convert('Asia/Kolkata')
    mask = [(t.weekday() < 5 and 555 <= t.hour*60+t.minute < 930
             and t.minute % 5 == 0 and t.second == 0 and t.microsecond == 0) for t in local]
    bars, times = frame[mask], local[mask]
    if bars.empty or times[-1] != local[-1]:
        return blocked('The latest candle is outside the regular five-minute session.')
    if len(bars) < 60:
        return blocked('At least 60 valid completed in-session candles are required.')
    for previous, current in zip(times, times[1:]):
        if previous.date() == current.date() and (current-previous).total_seconds() != 300:
            return blocked('Missing five-minute candles inside an observed session; no setup.')
    try:
        o, h, l, c = ([float(x) for x in bars[k]] for k in ('Open', 'High', 'Low', 'Close'))
    except (ValueError, TypeError):
        return blocked('OHLC values must be numeric.')
    if not all(all(math.isfinite(x) and x > 0 for x in values) for values in (o,h,l,c)):
        return blocked('OHLC values must be finite and positive.')
    if any(not low <= min(op,cl) <= max(op,cl) <= high for op,high,low,cl in zip(o,h,l,c)):
        return blocked('Candle OHLC ranges are invalid.')
    today = [i for i,t in enumerate(times) if t.date() == times[-1].date()]
    if len(today) < 20 or times[today[0]].hour*60+times[today[0]].minute != 555:
        return blocked('Need 20 consecutive current-session candles from 09:15 IST; earliest readiness is 10:55 IST.')
    e9, e21 = ema_path(c,9), ema_path(c,21)
    atr = atr_values(h,l,c)[-1]
    result['values'] = dict(ema9=round(e9[-1],4), ema21=round(e21[-1],4),
                            previous_ema21=round(e21[-2],4), close=c[-1], atr14=round(atr,4), session_bars=len(today))
    ce = [e9[-1]>e21[-1], e21[-1]>e21[-2], c[-1]>e9[-1]]
    pe = [e9[-1]<e21[-1], e21[-1]<e21[-2], c[-1]<e9[-1]]
    result['checks'] = [dict(name=name, ce_pass=bool(a), pe_pass=bool(b)) for name,a,b in zip(
        ('EMA9 versus EMA21', 'EMA21 slope', 'Close versus EMA9'),ce,pe)]
    if not atr or atr <= 0:
        return blocked('ATR14 must be positive to define breakout and risk levels.')
    if not all(ce) and not all(pe):
        return {**result, 'status':'no_trade', 'reason':'Trend checks conflict or are flat. No CE/PE entry; inspect the method checks.'}
    call = all(ce)
    last20, last5 = today[-20:], today[-5:]
    entry = max(h[i] for i in last20)+.1*atr if call else min(l[i] for i in last20)-.1*atr
    stop = max(min(l[i] for i in last5),entry-1.5*atr) if call else min(max(h[i] for i in last5),entry+1.5*atr)
    risk, direction = (entry-stop if call else stop-entry), (1 if call else -1)
    if risk <= 0 or min(entry,stop,entry+direction*2*risk) <= 0:
        return blocked('The breakout cannot define valid positive index risk levels.')
    return {**result, 'status':'conditional', 'side':'CE' if call else 'PE',
            'entry':round(entry,4), 'stop':round(stop,4),
            'target1':round(entry+direction*risk,4), 'target2':round(entry+direction*2*risk,4),
            'reason':('Uptrend: watch CE above the 20-bar high + 0.1 ATR14.' if call else
                      'Downtrend: watch PE below the 20-bar low - 0.1 ATR14.')+' A later fully observed five-minute close must confirm; this is not an entry yet.'}
