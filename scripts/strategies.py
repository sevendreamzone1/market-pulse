"""Explicit, reproducible heuristics for the requested strategy catalog.

Rules are observations, not institutional order-flow detection or proven edge.
Confirmed pivots use two bars on each side. No future bars enter a past signal.
"""
import math
from statistics import mean, pstdev
from signals import ema, rsi


def ema_path(values, period):
    out = [None] * len(values)
    if len(values) < period:
        return out
    value = mean(values[:period]); out[period-1] = value
    for i in range(period, len(values)):
        value += 2 / (period+1) * (values[i]-value); out[i] = value
    return out


def wilder(values, period):
    result = [None] * len(values)
    if len(values) < period:
        return result
    value = mean(values[:period]); result[period-1] = value
    for i in range(period,len(values)):
        value = (value*(period-1)+values[i])/period; result[i] = value
    return result


def confirmed_pivots(values, high=True):
    compare = max if high else min
    return [(i,values[i]) for i in range(2,len(values)-2)
            if values[i] == compare(values[i-2:i+3])
            and values[i] != values[i-1] and values[i] != values[i+1]]


def atr_values(high, low, close, period=14):
    tr = [high[0]-low[0]] + [max(high[i]-low[i],abs(high[i]-close[i-1]),abs(low[i]-close[i-1])) for i in range(1,len(close))]
    return wilder(tr,period)


def supertrend(high, low, close, period=10, multiplier=3):
    atr = atr_values(high,low,close,period)
    if not atr[-1]:
        return 0, close[-1]
    upper=lower=None; direction=1
    for i in range(period-1,len(close)):
        bu=(high[i]+low[i])/2+multiplier*atr[i]
        bl=(high[i]+low[i])/2-multiplier*atr[i]
        if upper is None:
            upper,lower=bu,bl; continue
        old_upper,old_lower=upper,lower
        upper=bu if bu<old_upper or close[i-1]>old_upper else old_upper
        lower=bl if bl>old_lower or close[i-1]<old_lower else old_lower
        if direction==-1 and close[i]>upper: direction=1
        elif direction==1 and close[i]<lower: direction=-1
    return direction, lower if direction==1 else upper


def consensus(rows):
    """Equal weight per category, so correlated indicators don't dominate."""
    grouped={}
    for row in rows:
        if row['vote'] is not None and row.get('role') != 'context':
            grouped.setdefault(row['category'],[]).append(row['vote'])
    groups=[]
    for category,votes in grouped.items():
        score=mean(votes)
        groups.append(dict(category=category, vote=1 if score>=.25 else -1 if score<=-.25 else 0))
    bull=sum(g['vote']==1 for g in groups); bear=sum(g['vote']==-1 for g in groups)
    total=len(groups)
    side='Bullish' if total>=5 and bull>=4 and bull/total>=.6 and bull-bear>=3 else 'Bearish' if total>=5 and bear>=4 and bear/total>=.6 and bear-bull>=3 else 'Neutral'
    return dict(signal=side, categories=groups, bullish_categories=bull, bearish_categories=bear,
                available_categories=total, agreement_pct=round(max(bull,bear)/total*100,1) if total else 0,
                reason=f'{bull} bullish / {bear} bearish / {total-bull-bear} neutral categories. '
                       + ('Directional confluence meets the rule.' if side!='Neutral' else 'Insufficient agreement; no directional recommendation.'),
                score_meaning='Category agreement, not a probability of profit.')


def evaluate(frame):
    rows=[]
    def add(category,name,vote,reason,values=None):
        rows.append(dict(category=category,name=name,vote=vote,
                         state='Unavailable' if vote is None else 'Bullish' if vote>0 else 'Bearish' if vote<0 else 'Neutral',
                         reason=reason,values=values or {}))
    def compare(a,b): return 1 if a>b else -1 if a<b else 0
    c=[float(x) for x in frame['Close']]
    if len(c)<60 or not all(math.isfinite(x) and x>0 for x in c):
        return dict(rows=[],consensus=consensus([]),status='insufficient_data',atr14=None)
    e9,e21=ema(c,9),ema(c,21)
    add('Trend indicators','EMA 9/21/50/200',compare(e9,e21) if len(c)>=200 and (e9>e21>ema(c,50)>ema(c,200) or e9<e21<ema(c,50)<ema(c,200)) else 0 if len(c)>=200 else None,
        'Requires the complete 9/21/50/200 EMA stack; EMA200 needs 200 closes.',
        {f'ema{p}':round(ema(c,p),4) if len(c)>=p else None for p in (9,21,50,200)})
    momentum=rsi(c)
    add('Momentum','RSI 14',1 if 50<=momentum<=70 else -1 if 30<=momentum<50 else 0,'Momentum bands: 50–70 bullish; 30–50 bearish; extremes abstain.',{'rsi':round(momentum,2)})
    fast,slow=ema_path(c,12),ema_path(c,26)
    macd=[a-b for a,b in zip(fast,slow) if a is not None and b is not None]
    sig=ema(macd,9); hist=macd[-1]-sig
    add('Momentum','MACD 12/26/9',1 if macd[-1]>sig and macd[-1]>0 else -1 if macd[-1]<sig and macd[-1]<0 else 0,
        'MACD must be above signal and zero for bullish, below both for bearish.',{'macd':round(macd[-1],4),'signal':round(sig,4),'histogram':round(hist,4)})
    s20=mean(c[-20:]); sd=pstdev(c[-20:]); lower,upper=s20-2*sd,s20+2*sd
    prev_mean=mean(c[-21:-1]); prev_sd=pstdev(c[-21:-1])
    add('Volatility','Bollinger Bands 20/2',1 if c[-2]<prev_mean-2*prev_sd and c[-1]>=lower else -1 if c[-2]>prev_mean+2*prev_sd and c[-1]<=upper else 0,
        'Mean-reversion event only: re-entry inside a band after a close outside.',{'lower':round(lower,4),'middle':round(s20,4),'upper':round(upper,4)})
    valid_ohlc=all(k in frame for k in ('Open','High','Low'))
    if valid_ohlc:
        o,h,l=([float(x) for x in frame[key]] for key in ('Open','High','Low'))
        valid_ohlc=all(all(math.isfinite(x) and x>0 for x in group) for group in (o,h,l)) and all(lo<=min(op,cl)<=max(op,cl)<=hi for op,hi,lo,cl in zip(o,h,l,c))
    catalog={
        'Market structure':['Higher High / Higher Low','Lower High / Lower Low','BOS','CHoCH'],
        'Price action':['Breakout + Retest','Support / Resistance','Trendline Breakout'],
        'Candlestick patterns':['Engulfing','Pin Bar','Hammer','Morning / Evening Star'],
        'Trend indicators':['Supertrend 10/3','ADX 14'],
        'Momentum':['Stochastic 14/3'],
        'Intraday':['Opening Range Breakout','Previous Day High / Low'],
        'Volatility':['ATR 14','Squeeze Breakout'],
        'Liquidity concepts':['Liquidity Sweep','Fair Value Gap','Order Blocks']}
    if not valid_ohlc:
        for category,names in catalog.items():
            for name in names: add(category,name,None,'Valid OHLC candles are required.')
        for name in ['Volume Breakout','Volume Spike','OBV']:
            add('Volume',name,None,'Valid OHLCV candles are required.')
        add('Intraday','VWAP',None,'Valid session OHLCV is required.')
        return dict(rows=rows,consensus=consensus(rows),status='partial',atr14=None)
    atr=atr_values(h,l,c)[-1]
    hp,lp=confirmed_pivots(h),confirmed_pivots(l,False)
    structure=1 if len(hp)>=2 and len(lp)>=2 and hp[-1][1]>hp[-2][1] and lp[-1][1]>lp[-2][1] else -1 if len(hp)>=2 and len(lp)>=2 and hp[-1][1]<hp[-2][1] and lp[-1][1]<lp[-2][1] else 0
    pivots_available=len(hp)>=2 and len(lp)>=2
    add('Market structure','Higher High / Higher Low',1 if structure==1 else 0 if pivots_available else None,'Two successive confirmed highs and lows must both rise; pivots confirm two bars later.')
    add('Market structure','Lower High / Lower Low',-1 if structure==-1 else 0 if pivots_available else None,'Two successive confirmed highs and lows must both fall.')
    break_up=bool(hp and c[-2]<=hp[-1][1]<c[-1]); break_down=bool(lp and c[-2]>=lp[-1][1]>c[-1])
    add('Market structure','BOS',1 if break_up else -1 if break_down else 0,'Latest close crosses the last confirmed swing high or low.')
    add('Market structure','CHoCH',1 if structure==-1 and break_up else -1 if structure==1 and break_down else 0,'A swing break against the prior confirmed structure; heuristic reversal event.')
    resistance,support=max(h[-25:-5]),min(l[-25:-5])
    retest_up=max(c[-5:-1])>resistance and l[-1]<=resistance+.2*atr and c[-1]>resistance and c[-1]>o[-1]
    retest_down=min(c[-5:-1])<support and h[-1]>=support-.2*atr and c[-1]<support and c[-1]<o[-1]
    add('Price action','Breakout + Retest',1 if retest_up else -1 if retest_down else 0,'Prior 20-bar range, breakout in the last four bars, retest within 0.2 ATR and rejection close.')
    sr_high,sr_low=max(h[-51:-1]),min(l[-51:-1])
    add('Price action','Support / Resistance',1 if l[-1]<=sr_low+.25*atr and c[-1]>o[-1] else -1 if h[-1]>=sr_high-.25*atr and c[-1]<o[-1] else 0,'Rejection within 0.25 ATR of the preceding 50-bar extreme.',{'support':round(sr_low,4),'resistance':round(sr_high,4)})
    line_vote=0
    if len(hp)>=2:
        (a,x),(b,y)=hp[-2:]; slope=(y-x)/(b-a)
        if slope<0 and c[-2]<=y+slope*(len(c)-2-b) and c[-1]>y+slope*(len(c)-1-b): line_vote=1
    if len(lp)>=2:
        (a,x),(b,y)=lp[-2:]; slope=(y-x)/(b-a)
        if slope>0 and c[-2]>=y+slope*(len(c)-2-b) and c[-1]<y+slope*(len(c)-1-b): line_vote=-1
    add('Price action','Trendline Breakout',line_vote if pivots_available else None,'Cross of a projected line through the last two confirmed declining highs or rising lows.')
    body=abs(c[-1]-o[-1]); prev_body=abs(c[-2]-o[-2]); span=h[-1]-l[-1]
    lower_wick=min(o[-1],c[-1])-l[-1]; upper_wick=h[-1]-max(o[-1],c[-1])
    engulf=1 if c[-2]<o[-2] and c[-1]>o[-1] and o[-1]<=c[-2] and c[-1]>=o[-2] else -1 if c[-2]>o[-2] and c[-1]<o[-1] and o[-1]>=c[-2] and c[-1]<=o[-2] else 0
    add('Candlestick patterns','Engulfing',engulf,'Opposite-color body fully engulfs the previous body.')
    pin=1 if span>0 and lower_wick>=2*max(body,.01*atr) and upper_wick<=.2*span else -1 if span>0 and upper_wick>=2*max(body,.01*atr) and lower_wick<=.2*span else 0
    add('Candlestick patterns','Pin Bar',pin,'Dominant wick at least twice the body; opposite wick at most 20% of range.')
    add('Candlestick patterns','Hammer',1 if pin==1 and c[-2]<c[-5] else 0,'Bullish lower pin after a five-bar decline.')
    star=1 if c[-3]<o[-3] and abs(c[-2]-o[-2])<=.3*abs(c[-3]-o[-3]) and c[-1]>o[-1] and c[-1]>(o[-3]+c[-3])/2 else -1 if c[-3]>o[-3] and abs(c[-2]-o[-2])<=.3*abs(c[-3]-o[-3]) and c[-1]<o[-1] and c[-1]<(o[-3]+c[-3])/2 else 0
    add('Candlestick patterns','Morning / Evening Star',star,'Three-bar body-based star heuristic; gaps are not required.')
    st,st_line=supertrend(h,l,c)
    add('Trend indicators','Supertrend 10/3',st,'Wilder ATR10 trailing bands at multiplier 3.',{'line':round(st_line,4)})
    up=[0]+[max(h[i]-h[i-1],0) if h[i]-h[i-1]>l[i-1]-l[i] else 0 for i in range(1,len(c))]
    down=[0]+[max(l[i-1]-l[i],0) if l[i-1]-l[i]>h[i]-h[i-1] else 0 for i in range(1,len(c))]
    tr=atr_values(h,l,c); pu,md=wilder(up,14),wilder(down,14)
    plus,minus=100*pu[-1]/atr if atr else 0,100*md[-1]/atr if atr else 0
    dx=[100*abs(a-b)/(a+b) if a+b else 0 for a,b in zip(pu,md) if a is not None and b is not None]
    adx=wilder(dx,14)[-1]
    add('Trend indicators','ADX 14',compare(plus,minus) if adx>=25 else 0,'Wilder ADX >=25 confirms the +DI/-DI direction.',{'adx':round(adx,2),'plus_di':round(plus,2),'minus_di':round(minus,2)})
    k=[100*(c[i]-min(l[i-13:i+1]))/(max(h[i-13:i+1])-min(l[i-13:i+1])) if max(h[i-13:i+1])>min(l[i-13:i+1]) else 50 for i in range(13,len(c))]
    d=mean(k[-3:])
    add('Momentum','Stochastic 14/3',1 if k[-2]<=mean(k[-4:-1]) and k[-1]>d and k[-1]<80 else -1 if k[-2]>=mean(k[-4:-1]) and k[-1]<d and k[-1]>20 else 0,'K/D cross outside extreme zones.',{'k':round(k[-1],2),'d':round(d,2)})
    local=frame.index.tz_convert('Asia/Kolkata'); session_date=local[-1].date()
    session=[i for i,t in enumerate(local) if t.date()==session_date and 555<=t.hour*60+t.minute<930]
    prior_dates=sorted({t.date() for t in local if t.date()<session_date})
    opening=[i for i in session if local[i].hour*60+local[i].minute<570]
    complete_orb={local[i].hour*60+local[i].minute for i in opening}=={555,560,565}
    orb_high=max((h[i] for i in opening),default=0); orb_low=min((l[i] for i in opening),default=0)
    add('Intraday','Opening Range Breakout',1 if complete_orb and c[-1]>orb_high else -1 if complete_orb and c[-1]<orb_low else 0 if complete_orb else None,'09:15–09:30 IST range; all three completed five-minute bars are required.',{'high':round(orb_high,4),'low':round(orb_low,4)})
    previous=[i for i,t in enumerate(local) if prior_dates and t.date()==prior_dates[-1] and 555<=t.hour*60+t.minute<930]
    pdh=max((h[i] for i in previous),default=0); pdl=min((l[i] for i in previous),default=0)
    add('Intraday','Previous Day High / Low',1 if previous and c[-1]>pdh else -1 if previous and c[-1]<pdl else 0 if previous else None,'Current close beyond the preceding observed trading session high/low.',{'high':round(pdh,4),'low':round(pdl,4)})
    has_volume='Volume' in frame and all(math.isfinite(float(x)) and float(x)>=0 for x in frame['Volume']) and sum(float(x) for x in frame['Volume'])>0
    v=[float(x) for x in frame['Volume']] if has_volume else []
    if has_volume:
        avg=mean(v[-21:-1]); relative=v[-1]/avg if avg else 0
        add('Volume','Volume Breakout',compare(c[-1],c[-2]) if relative>=1.5 and (c[-1]>max(h[-21:-1]) or c[-1]<min(l[-21:-1])) else 0,'Range breakout with volume >=1.5 times preceding 20-bar mean.',{'relative_volume':round(relative,2)})
        add('Volume','Volume Spike',compare(c[-1],o[-1]) if relative>=2 else 0,'Directional candle with volume >=2 times preceding 20-bar mean.')
        obv=[0]
        for i in range(1,len(c)): obv.append(obv[-1]+compare(c[i],c[i-1])*v[i])
        add('Volume','OBV',compare(obv[-1],mean(obv[-20:])),'OBV above/below its 20-bar mean.',{'obv':round(obv[-1],2)})
    else:
        for name in ('Volume Breakout','Volume Spike','OBV'): add('Volume',name,None,'Underlying volume is absent or zero; index volume is not synthesized.')
    session_volume=sum(v[i] for i in session) if has_volume else 0
    if session_volume:
        vwap=sum((h[i]+l[i]+c[i])/3*v[i] for i in session)/session_volume
        add('Intraday','VWAP',compare(c[-1],vwap),'Session typical-price VWAP; requires actual underlying volume.',{'vwap':round(vwap,4)})
    else: add('Intraday','VWAP',None,'No usable session volume; index VWAP is unavailable.')
    add('Volatility','ATR 14',0,'Risk-distance measure only; does not predict direction.',{'atr':round(atr,4),'atr_pct':round(atr/c[-1]*100,3)})
    prior_squeeze=prev_sd*2<atr_values(h[:-1],l[:-1],c[:-1])[-1]*1.5
    add('Volatility','Squeeze Breakout',1 if prior_squeeze and c[-1]>upper else -1 if prior_squeeze and c[-1]<lower else 0,'Previous Bollinger half-width <1.5 ATR; latest close breaks its current band.')
    sweep=1 if lp and l[-1]<lp[-1][1]<c[-1] else -1 if hp and h[-1]>hp[-1][1]>c[-1] else 0
    add('Liquidity concepts','Liquidity Sweep',sweep,'Wick beyond a confirmed swing and close back inside; price-only heuristic.')
    add('Liquidity concepts','Fair Value Gap',1 if l[-1]>h[-3] else -1 if h[-1]<l[-3] else 0,'Three-candle non-overlap; this does not establish institutional activity.')
    displacement=abs(c[-1]-o[-1])>=atr
    add('Liquidity concepts','Order Blocks',1 if displacement and c[-2]<o[-2] and c[-1]>h[-2] else -1 if displacement and c[-2]>o[-2] and c[-1]<l[-2] else 0,'Opposite candle before a >=1 ATR displacement that closes beyond it; heuristic only.')
    report=consensus(rows)
    return dict(rows=rows,consensus=report,status='evaluated',atr14=round(atr,4),
                swing_high=round(max(h[-20:]),4),swing_low=round(min(l[-20:]),4),
                evaluated_at=frame.index[-1].isoformat(),timeframe='5m',model_version='catalog-v1')
