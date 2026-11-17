import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from providers import (API_ROOT, INSTRUMENTS_URL, UpstoxProvider, YahooProvider,
                       candle_frame, get_json, resolve_instrument, select_provider, provider_configuration)
from fetch_market import build_item


class ProviderSelectionTests(unittest.TestCase):
    def test_auto_prefers_authenticated_api_when_configured(self):
        self.assertIsInstance(select_provider('auto', ''), YahooProvider)
        self.assertIsInstance(select_provider('auto', 'example-test-token'), UpstoxProvider)
        self.assertIsInstance(select_provider('yahoo', 'example-test-token'), YahooProvider)

    def test_explicit_api_requires_secret_and_unknown_provider_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'UPSTOX_ACCESS_TOKEN'):
            select_provider('upstox', '')
        with self.assertRaisesRegex(ValueError, 'MARKET_PROVIDER'):
            select_provider('other', '')

    def test_connection_metadata_distinguishes_pending_and_configured_feed(self):
        self.assertEqual(provider_configuration(select_provider('auto', ''), 'auto'),
                         {'preferred':'upstox', 'active':'yahoo', 'status':'awaiting_credentials'})
        self.assertEqual(provider_configuration(select_provider('auto', 'test-token'), 'auto'),
                         {'preferred':'upstox', 'active':'upstox', 'status':'configured'})
        self.assertNotIn('test-token', json.dumps(provider_configuration(select_provider('auto', 'test-token'), 'auto')))
        self.assertEqual(provider_configuration(select_provider('yahoo', ''), 'yahoo')['status'], 'configured')

    def test_instrument_resolution_matches_exchange_and_rejects_ambiguity(self):
        records = [dict(segment='NSE_EQ', trading_symbol='RELIANCE', instrument_key='NSE_EQ|TEST'),
                   dict(segment='BSE_EQ', trading_symbol='RELIANCE', instrument_key='BSE_EQ|TEST'),
                   dict(segment='NSE_INDEX', trading_symbol='NIFTY', name='Nifty 50', instrument_key='NSE_INDEX|Nifty 50'),
                   dict(segment='NSE_INDEX', trading_symbol='BANKNIFTY', name='Nifty Bank', instrument_key='NSE_INDEX|Nifty Bank')]
        self.assertEqual(resolve_instrument('RELIANCE.NS', records), 'NSE_EQ|TEST')
        self.assertEqual(resolve_instrument('^NSEI', records), 'NSE_INDEX|Nifty 50')
        self.assertEqual(resolve_instrument('^NSEBANK', records), 'NSE_INDEX|Nifty Bank')
        with self.assertRaisesRegex(ValueError, 'Expected one instrument'):
            resolve_instrument('ITC.BO', records)

    def test_option_chain_uses_actual_next_expiry_and_no_order_api(self):
        calls=[]
        def requester(url, token=None):
            calls.append(url)
            if url == INSTRUMENTS_URL:
                return [dict(segment='NSE_INDEX',trading_symbol='Nifty 50',instrument_key='NSE_INDEX|Nifty 50')]
            self.assertEqual(token,'test-token')
            if '/contract?' in url:
                return {'data':[{'expiry':'2026-11-17'},{'expiry':'2026-11-24'},{'expiry':'2026-12-01'}]}
            self.assertIn('/chain?',url)
            self.assertIn('expiry_date=2026-11-24',url)
            return {'data':[]}
        provider=UpstoxProvider('test-token',requester=requester)
        chain,contracts=provider.option_chain('^NSEI',datetime(2026,11,17,5,0,tzinfo=timezone.utc))
        self.assertEqual(len(calls),3)
        self.assertEqual(chain,[])
        self.assertEqual(len(contracts),3)


@unittest.skipUnless(importlib.util.find_spec('requests'), 'Install requirements for HTTP adapter tests')
class RequestTests(unittest.TestCase):
    def test_auth_failure_does_not_echo_token_or_response_body(self):
        token = 'fixture-secret-DO-NOT-PRINT'
        with patch('requests.get', return_value=Mock(status_code=401, content=token.encode())) as request:
            with self.assertRaises(RuntimeError) as result:
                get_json(API_ROOT + '/test', token)
            self.assertNotIn(token, str(result.exception))
            self.assertEqual(request.call_args.kwargs['headers']['Authorization'], 'Bearer '+token)
            self.assertFalse(request.call_args.kwargs['allow_redirects'])

    def test_provider_error_is_not_treated_as_data(self):
        response = Mock(status_code=200, content=json.dumps({'status':'error'}).encode())
        with patch('requests.get', return_value=response):
            with self.assertRaisesRegex(RuntimeError, 'rejected'):
                get_json(API_ROOT + '/test', 'test-token')


@unittest.skipUnless(importlib.util.find_spec('pandas'), 'Install requirements for API candle tests')
class UpstoxCandleTests(unittest.TestCase):
    def test_api_paths_candle_merging_and_previous_ist_session(self):
        import pandas as pd
        records = [dict(segment='NSE_INDEX', trading_symbol='Nifty 50', instrument_key='NSE_INDEX|Nifty 50')]
        history = [[stamp.isoformat(),100,101,99,100,1,0] for stamp in
                   pd.date_range('2026-11-16 09:15',periods=70,freq='5min',tz='Asia/Kolkata')]
        today = [['2026-11-17T09:15:00+05:30',100,105,99,105,1,0],
                 ['2026-11-17T09:20:00+05:30',105,99999,105,99999,1,0]]
        daily = [['2026-11-16T00:00:00+05:30',100,101,99,100,1,0]]
        def requester(url, token=None):
            if url == INSTRUMENTS_URL:
                self.assertIsNone(token)
                return records
            self.assertEqual(token,'test-token')
            self.assertIn('NSE_INDEX%7CNifty%2050',url)
            if '/intraday/' in url:
                rows = today
            elif '/days/1/' in url:
                self.assertTrue(url.endswith('/2026-11-16/2026-10-13'))
                rows = daily
            else:
                self.assertIn('/minutes/5/2026-11-16/2026-11-07',url)
                rows = history
            return {'status':'success','data':{'candles':rows}}
        provider=UpstoxProvider('test-token',requester=requester)
        now=datetime(2026,11,17,3,52,tzinfo=timezone.utc) # 09:22 IST
        candles,daily_frame=provider.frames('^NSEI',now)
        item=build_item('^NSEI',candles,daily_frame,now)
        self.assertEqual(item['price'],105)
        self.assertAlmostEqual(item['change_pct'],5)
        self.assertEqual(item['candle_end'],'2026-11-17T03:50:00+00:00')

    def test_timezone_missing_and_malformed_candles_are_rejected(self):
        for rows in ([['2026-11-17T09:15:00',1,1,1,1]], [['bad']],):
            with self.assertRaises(ValueError):
                candle_frame({'data':{'candles':rows}})


if __name__ == '__main__':
    unittest.main()
