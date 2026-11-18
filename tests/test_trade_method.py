import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from trade_method import evaluate_method, METHOD_ID
from fetch_market import build_item


class MethodTests(unittest.TestCase):
    def frame(self, side='CE', today=20):
        times=pd.date_range('2026-11-16 09:15',periods=75,freq='5min',tz='Asia/Kolkata').append(
            pd.date_range('2026-11-17 09:15',periods=today,freq='5min',tz='Asia/Kolkata'))
        close=[1000+(i if side=='CE' else -i) for i in range(len(times))]
        return pd.DataFrame(dict(Open=close,High=[v+.8 for v in close],Low=[v-.8 for v in close],Close=close),index=times)

    def test_mirrored_trend_watches_and_atr_risk(self):
        for side in ('CE','PE'):
            frame=self.frame(side);r=evaluate_method(frame)
            self.assertEqual((r['id'],r['status'],r['side']),(METHOD_ID,'conditional',side))
            self.assertTrue(all(c['ce_pass' if side=='CE' else 'pe_pass'] for c in r['checks']))
            e,s,t1,t2=(r[k] for k in ('entry','stop','target1','target2'))
            self.assertTrue(s<e<t1<t2 if side=='CE' else s>e>t1>t2)
            self.assertAlmostEqual(abs(t1-e),abs(e-s),places=3)
            self.assertAlmostEqual(abs(t2-e),2*abs(e-s),places=3)
            self.assertAlmostEqual(e,(frame.High.iloc[-20:].max()+.1*r['values']['atr14']) if side=='CE'
                                   else (frame.Low.iloc[-20:].min()-.1*r['values']['atr14']),places=3)

    def test_insufficient_current_session_and_missing_opening(self):
        self.assertIn('20 consecutive',evaluate_method(self.frame(today=19))['reason'])
        f=self.frame(today=25);f=f.drop(f.index[75])
        self.assertIn('20 consecutive',evaluate_method(f)['reason'])
        self.assertEqual(evaluate_method(self.frame().iloc[-20:])['status'],'unavailable')

    def test_flat_and_conflicting_trends_do_not_signal(self):
        f=self.frame();f['Open']=f['Close']=1000;f['High']=1001;f['Low']=999
        self.assertEqual(evaluate_method(f)['status'],'no_trade')
        f=self.frame();f.loc[f.index[-1],['Open','Close','Low']]=1080
        self.assertEqual(evaluate_method(f)['status'],'no_trade')

    def test_missing_invalid_or_misaligned_bars_are_explicit(self):
        f=self.frame();self.assertIn('Missing five-minute',evaluate_method(f.drop(f.index[10]))['reason'])
        f=self.frame();f.loc[f.index[-1],'Low']=99999
        self.assertEqual(evaluate_method(f)['status'],'unavailable')
        f=self.frame();f.loc[f.index[-1],'Close']=float('nan')
        self.assertEqual(evaluate_method(f)['status'],'unavailable')
        f=self.frame();f.index=f.index.tz_localize(None)
        self.assertEqual(evaluate_method(f)['status'],'unavailable')
        f=self.frame();self.assertEqual(evaluate_method(f.iloc[::-1])['status'],'unavailable')

    def test_current_range_ignores_prior_session_extreme(self):
        f=self.frame();f.iloc[0,f.columns.get_loc('High')]=5000
        self.assertLess(evaluate_method(f)['entry'],2000)

    def test_unfinished_future_candle_cannot_change_method(self):
        f=self.frame();daily=pd.DataFrame({'Close':[1000]},index=pd.to_datetime(['2026-11-16']))
        now=datetime(2026,11,17,5,25,tzinfo=timezone.utc)  # 10:55 IST
        baseline=build_item('^NSEI',f,daily,now)
        future=pd.DataFrame(dict(Open=[9000],High=[9001],Low=[8999],Close=[9000]),
                            index=pd.DatetimeIndex(['2026-11-17 10:55'],tz='Asia/Kolkata'))
        item=build_item('^NSEI',pd.concat([f,future]),daily,now)
        self.assertEqual(item['entry_method'],baseline['entry_method'])
        self.assertEqual(item['price'],baseline['price'])


if __name__=='__main__':
    unittest.main()
