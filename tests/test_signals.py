import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from signals import analyze, classify, ema, rsi


class IndicatorTests(unittest.TestCase):
    def test_flat_prices_have_neutral_rsi(self):
        result = analyze([100.0] * 80)
        self.assertEqual(result['rsi14'], 50)
        self.assertEqual(result['signal'], 'Neutral')
        self.assertEqual(result['ema9'], 100)

    def test_monotonic_prices_saturate_rsi_without_division_errors(self):
        self.assertEqual(rsi(list(range(1, 81))), 100)
        self.assertEqual(rsi(list(range(80, 0, -1))), 0)
        self.assertEqual(analyze(list(range(1, 81)))['signal'], 'Neutral')

    def test_wilder_reference_series(self):
        prices = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10,
                  45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28]
        self.assertAlmostEqual(rsi(prices), 70.464135, places=5)

    def test_ema_seed_and_recursive_update(self):
        self.assertEqual(ema([1, 2, 3], 3), 2)
        self.assertEqual(ema([1, 2, 3, 4], 3), 3)

    def test_rule_boundaries(self):
        self.assertEqual(classify(101, 100, 50)[0], 'Bullish')
        self.assertEqual(classify(101, 100, 70)[0], 'Bullish')
        self.assertEqual(classify(101, 100, 70.1)[0], 'Neutral')
        self.assertEqual(classify(99, 100, 30)[0], 'Bearish')
        self.assertEqual(classify(99, 100, 50)[0], 'Neutral')
        self.assertEqual(classify(100, 100, 55)[0], 'Neutral')

    def test_rejects_insufficient_and_invalid_prices(self):
        for values in ([100] * 59, [100] * 60 + [float('nan')],
                       [100] * 60 + [float('inf')], [100] * 60 + [0]):
            with self.assertRaises(ValueError):
                analyze(values)


if __name__ == '__main__':
    unittest.main()
