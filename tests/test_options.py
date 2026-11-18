import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from options_analysis import underlying_setup, premium_scenario, build_options

NOW = datetime(2026, 11, 17, 5, 0, tzinfo=timezone.utc)


class OptionsTests(unittest.TestCase):
    def item(self, signal='Bullish'):
        return dict(ticker='^NSEI', recent_closes=list(range(100, 130)), signal=signal,
                    entry_method={'id':'trend-breakout-v1','status':'conditional' if signal in ('Bullish','Bearish') else 'no_trade','side':'CE' if signal=='Bullish' else 'PE','entry':129 if signal=='Bullish' else 110,'stop':125 if signal=='Bullish' else 129,'target1':133 if signal=='Bullish' else 91,'target2':137 if signal=='Bullish' else 72,'reason':'Fixture trend breakout','checks':[{'ce_pass':signal=='Bullish','pe_pass':signal=='Bearish'}]*3},
                    strategy_report={'consensus':{'signal':'Neutral','reason':'Diagnostics do not vote'}},
                    candle_end='2026-11-17T04:55:00+00:00', reason='Fixture alignment')

    def quote(self):
        contract = dict(instrument_key='NSE_FO|fixture', instrument_type='CE', expiry='2026-11-24',
                        lot_size=50, tick_size=5, trading_symbol='Fixture CE')
        row = dict(expiry='2026-11-24', strike_price=130, underlying_spot_price=129,
                   call_options=dict(instrument_key=contract['instrument_key'],
                     market_data=dict(bid_price=99, ask_price=100, bid_qty=100, ask_qty=100, volume=1000)))
        return [row], [contract]

    def test_ce_and_pe_underlying_target_direction_and_risk(self):
        call = underlying_setup(self.item())
        put = underlying_setup(self.item('Bearish'))
        self.assertEqual((call['side'],call['entry'],call['stop'],call['target1'],call['target2']), ('CE',129,125,133,137))
        self.assertEqual((put['side'],put['entry'],put['stop'],put['target1'],put['target2']), ('PE',110,129,91,72))

    def test_neutral_flat_and_bad_data_do_not_create_levels(self):
        missing=self.item();missing.pop('entry_method')
        invalid=self.item();invalid['entry_method']['stop']=float('nan')
        crossed=self.item();crossed['entry_method']['stop']=9999
        for item in (self.item('Neutral'),missing,invalid,crossed):
            plan=underlying_setup(item)
            self.assertNotIn('entry',plan)
            self.assertIn(plan['status'],('unavailable','no_trade'))

    def test_premium_levels_use_actual_ask_and_master_lot_size(self):
        rows,contracts = self.quote()
        bars=[{'high':102,'low':98,'close':100}]*30
        plan = premium_scenario(rows, contracts, {'side':'CE'}, NOW, risk_bars=bars)
        self.assertEqual((plan['entry'],plan['stop'],plan['target1'],plan['target2']),(100,98,102,104))
        self.assertEqual((plan['premium_outlay'],plan['planned_risk']),(5000,100))
        self.assertIsNone(plan['exchange_timestamp'])

    def test_rejects_expiry_day_missing_quote_and_illiquid_contract(self):
        for field,value in [('ask_price',None),('bid_price',110),('bid_price',90),('volume',0),('bid_qty',1)]:
            rows,contracts=self.quote()
            rows[0]['call_options']['market_data'][field]=value
            with self.assertRaises(ValueError):
                premium_scenario(rows,contracts,{'side':'CE'},NOW)
        rows,contracts=self.quote();contracts[0]['expiry']='2026-11-17'
        with self.assertRaises(ValueError):
            premium_scenario(rows,contracts,{'side':'CE'},NOW)

    def test_no_option_provider_does_not_fabricate_premiums(self):
        plan=build_options([self.item()],object(),NOW)[0]
        self.assertEqual(plan['side'],'CE')
        self.assertEqual(plan['premium']['status'],'unavailable')
        self.assertNotIn('entry',plan['premium'])

    def test_stale_underlying_never_fetches_option_quote(self):
        class Provider:
            def option_chain(self, *args):
                raise AssertionError('A stale underlying must not request premiums')
        item=self.item();item['candle_end']='2020-01-01T00:00:00+00:00'
        plan=build_options([item],Provider(),NOW)[0]
        self.assertEqual(plan['premium']['status'],'unavailable')
        self.assertIn('stale',plan['premium']['reason'])


if __name__ == '__main__':
    unittest.main()
