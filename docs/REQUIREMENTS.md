# Requirements

## Scope
Market Pulse is a personal NSE/BSE research dashboard hosted on GitHub Pages. It combines TradingView charts, scheduled market-data analysis, and an optional personal Upstox browser stream. It does not manage broker orders or fills.

## Functional requirements
- Provide the user-requested fixed-credential login screen, home/live redirects and Logout without a database. Describe it as a browser-only convenience gate; it cannot prevent public access to Pages files or market JSON.
- Show eight watchlist equities plus NIFTY 50, BANK NIFTY, and SENSEX with provider and time context.
- Keep market overview and CE/PE analysis views available, with responsive layouts and explicit demo mode.
- Fetch completed five-minute candles through the configured provider: Upstox when its secret exists in auto mode, otherwise Yahoo. Invalid configured Upstox authentication must not silently fall back.
- Evaluate the requested strategy categories: structure, price action, candles, trend, momentum, volume, intraday, volatility, liquidity heuristics, and options context. See README for exact rules.
- CE/PE decision authority is `trend-breakout-v1`, approved under MP-PLAN-002: EMA9/21 stack, EMA21 slope and price alignment, followed by a five-minute close beyond the current-session 20-bar range buffered by 0.1 ATR14. Category votes are optional diagnostics only. Show missing data and NO TRADE explicitly.
- Require 60 valid in-session candles and 20 consecutive current-session candles from 09:15 IST; earliest watch is 10:55 IST. Missing intraday intervals block the method. Do not synthesize index volume.
- Display index triggers/invalidation separately from option contract, expiry, lot size, premium entry reference, SL, T1/T2, outlay, and planned risk.
- Accept a personal current access token or one-time authorized Upstox socket URL on the separate live page.
- Use live index candles and option depth to confirm and monitor snapshot-based scenarios; share only market data and scenario outputs with dashboard tabs.
- Preserve fixed levels after an observed trigger, latch exit observations, and clear session monitoring on disconnect. Never imply an observed trigger is an actual fill.

## Data and risk acceptance criteria
- Exclude incomplete candles and future/ambiguous timestamps; preserve old timestamps on retained failed symbols.
- Suppress stale technical signals after 20 minutes; new option scenarios need underlying candles within ten minutes and premium metadata within five minutes.
- Live confirmation requires a live update, trade age within 30 seconds, receipt age within five seconds, valid bid/ask, spread at most 5%, volume, and depth of at least one lot.
- Exclude expiry-day contracts. Use actual contract tick size and option ATR history for premium levels.
- Observe a full five-minute candle from its first ten seconds with no sample gap over 30 seconds before entry confirmation. Initial feeds and first partial candles cannot confirm entries.
- Pin each pending index trigger to its armed snapshot. Confirm only a later fully observed candle, expire on missed/gapped confirmation or source age over ten minutes, and invalidate on a fresh neutral/opposite method decision. Reject older/incompatible decision models.
- New-entry window is 09:30 to 14:45 IST on weekdays; time exit is 30 minutes after the observed trigger or 15:15 IST. No independent exchange holiday calendar is implemented.
- Skip invalidated setups and moves already past the original first target. Use bid prices for observed long-option exits.
- Keep credentials out of source, storage, telemetry, BroadcastChannel messages, and public JSON.

## Constraints and evidence
- Keep the current buildless frontend and small Python dependency set unless a requested change justifies migration.
- GitHub schedules are a target cadence, not a real-time execution guarantee. The live browser tab must remain open.
- Automated fixtures establish code behavior, not current broker authorization, market-data entitlement, execution quality, or profitability.
- Strategy accuracy and returns are unvalidated. Historical testing and forward paper trading are future work; never promise 90% accuracy.

## Out of current scope
Automated orders, actual position/fill tracking, persistent shared streaming services, database hosting, guaranteed stops, and tick-by-tick recalculation of the full strategy catalog.
