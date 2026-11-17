"""Small deterministic indicators. Input prices must be completed closes."""
import math


def ema(values, period):
    if len(values) < period:
        raise ValueError('Insufficient prices')
    result = sum(values[:period]) / period
    alpha = 2 / (period + 1)
    for value in values[period:]:
        result = value * alpha + result * (1 - alpha)
    return result


def rsi(values, period=14):
    if len(values) < period + 1:
        raise ValueError('Insufficient prices')
    changes = [b - a for a, b in zip(values, values[1:])]
    gain = sum(max(value, 0) for value in changes[:period]) / period
    loss = sum(max(-value, 0) for value in changes[:period]) / period
    for change in changes[period:]:
        gain = (gain * (period - 1) + max(change, 0)) / period
        loss = (loss * (period - 1) + max(-change, 0)) / period
    if loss == 0:
        return 100.0 if gain else 50.0
    return 100 - 100 / (1 + gain / loss)


def classify(ema9, ema21, rsi14):
    if ema9 > ema21 and 50 <= rsi14 <= 70:
        return 'Bullish', 'EMA 9 is above EMA 21; RSI 14 is between 50 and 70. Upward momentum setup.'
    if ema9 < ema21 and 30 <= rsi14 < 50:
        return 'Bearish', 'EMA 9 is below EMA 21; RSI 14 is between 30 and 50. Downward momentum setup.'
    return 'Neutral', 'Trend and momentum do not meet either directional rule. Wait for alignment.'


def analyze(prices):
    if len(prices) < 60 or not all(math.isfinite(p) and p > 0 for p in prices):
        raise ValueError('At least 60 valid completed closes are required')
    short, long, momentum = ema(prices, 9), ema(prices, 21), rsi(prices)
    signal, reason = classify(short, long, momentum)
    return dict(ema9=round(short, 4), ema21=round(long, 4),
                rsi14=round(momentum, 2), signal=signal, reason=reason)
