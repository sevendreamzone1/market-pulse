import importlib.util
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from strategies import consensus, confirmed_pivots, ema_path, wilder, evaluate
from options_analysis import options_context, premium_scenario


class MathTests(unittest.TestCase):
    def test_seeded_average_paths(self):
        self.assertEqual(ema_path([1,2,3,4],3),[None,None,2,3])
        self.assertEqual(wilder([1,2,3,4],3),[None,None,2,8/3])

    def test_pivot_requires_two_later_bars(self):
        self.assertEqual(confirmed_pivots([1,2,5,4]),[])
        self.assertEqual(confirmed_pivots([1,2,5,4,3]),[(2,5)])
        self.assertEqual(confirmed_pivots([1,2,3,4,9]),[])

    def test_correlated_indicators_have_one_category_vote(self):
        rows=[{'category':'Trend','vote':1}]*20
        report=consensus(rows)
        self.assertEqual(report['available_categories'],1)
        self.assertEqual(report['signal'],'Neutral')
        rows += [{'category':str(i),'vote':1} for i in range(4)]
        self.assertEqual(consensus(rows)['signal'],'Bullish')

    def test_conflicts_unavailable_and_context_do_not_invent_conviction(self):
        rows=[{'category':str(i),'vote':1 if i%2 else -1} for i in range(8)]
        rows += [{'category':'Missing','vote':None},{'category':'Options','vote':1,'role':'context'}]
        report=consensus(rows)
        self.assertEqual(report['signal'],'Neutral')
        self.assertEqual(report['available_categories'],8)

    def test_missing_options_metrics_are_unavailable(self):
        rows=options_context([])
        self.assertEqual(len(rows),7)
        self.assertTrue(all(row['vote'] is None for row in rows))


@unittest.skipUnless(importlib.util.find_spec('pandas'),'Install requirements for candle strategy tests')
class CatalogTests(unittest.TestCase):
    def frame(self, count=260, volume=True):
        import pandas as pd
        close=[100+i*.03+math.sin(i*.2)*2 for i in range(count)]
        return pd.DataFrame({'Open':close,'High':[x+1 for x in close],'Low':[x-1 for x in close],
                             'Close':close,'Volume':[1000 if volume else 0]*count},
                            index=pd.date_range('2026-11-16 09:15',periods=count,freq='5min',tz='Asia/Kolkata'))

    def test_catalog_has_all_requested_price_rules(self):
        report=evaluate(self.frame())
        names={row['name'] for row in report['rows']}
        required={'BOS','CHoCH','Breakout + Retest','Trendline Breakout','Engulfing','Pin Bar','Hammer',
                  'Morning / Evening Star','EMA 9/21/50/200','Supertrend 10/3','ADX 14','RSI 14',
                  'MACD 12/26/9','Stochastic 14/3','Volume Breakout','Volume Spike','OBV','VWAP',
                  'Opening Range Breakout','Previous Day High / Low','Bollinger Bands 20/2','ATR 14',
                  'Squeeze Breakout','Liquidity Sweep','Fair Value Gap','Order Blocks',
                  'Higher High / Higher Low','Lower High / Lower Low','Support / Resistance'}
        self.assertEqual(required,names)
        self.assertEqual(report['status'],'evaluated')

    def test_zero_index_volume_never_creates_vwap_or_obv(self):
        rows=evaluate(self.frame(volume=False))['rows']
        missing=[r for r in rows if r['name'] in ('VWAP','OBV','Volume Breakout','Volume Spike')]
        self.assertTrue(all(r['state']=='Unavailable' for r in missing))

    def test_flat_market_has_no_directional_recommendation(self):
        frame=self.frame();frame['Open']=frame['High']=frame['Low']=frame['Close']=100
        report=evaluate(frame)
        self.assertEqual(report['consensus']['signal'],'Neutral')
        self.assertEqual(report['atr14'],0)

    def test_missing_ohlc_and_short_ema200_are_reported(self):
        report=evaluate(self.frame(80)[['Close']])
        self.assertEqual(report['status'],'partial')
        self.assertEqual(next(r for r in report['rows'] if r['name']=='EMA 9/21/50/200')['state'],'Unavailable')
        self.assertIsNone(report['atr14'])

    def test_json_has_no_nan_values(self):
        import json
        json.dumps(evaluate(self.frame()),allow_nan=False)


if __name__=='__main__':
    unittest.main()
