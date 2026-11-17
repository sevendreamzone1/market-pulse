import importlib.util
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from fetch_market import build_item


@unittest.skipUnless(importlib.util.find_spec('pandas'), 'Install requirements for candle pipeline tests')
class PipelineTests(unittest.TestCase):
    def test_excludes_unfinished_candle_and_uses_previous_session_close(self):
        import pandas as pd
        index = pd.date_range('2026-11-17 09:15', periods=73, freq='5min', tz='Asia/Kolkata')
        prices = [100 + i * .1 for i in range(72)] + [99999]
        candles = pd.DataFrame({'Close':prices}, index=index)
        daily = pd.DataFrame({'Close':[100, 500]},
                             index=pd.to_datetime(['2026-11-16', '2026-11-17']))
        # 15:17 IST; final 15:15 candle has not ended.
        item = build_item('TEST.NS', candles, daily, datetime(2026, 11, 17, 9, 47, tzinfo=timezone.utc))
        self.assertAlmostEqual(item['price'],107.1)
        self.assertAlmostEqual(item['change_pct'],7.1)
        self.assertEqual(datetime.fromisoformat(item['candle_end']).minute,15)
        self.assertNotIn(99999,item['recent_closes'])

    def test_rejects_ambiguous_timezone(self):
        import pandas as pd
        candles = pd.DataFrame({'Close':[100]*70},index=pd.date_range('2026-11-17',periods=70,freq='5min'))
        with self.assertRaises(ValueError):
            build_item('TEST.NS',candles,candles,datetime.now(timezone.utc))


if __name__ == '__main__':
    unittest.main()
