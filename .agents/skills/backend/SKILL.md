---
name: backend
description: Change Market Pulse Python data providers, candle processing, strategy calculations, option scenarios, or the public snapshot contract.
---

# Backend and data pipeline

Use [architecture](../../../docs/ARCHITECTURE.md) to locate the affected module. This project's backend logic is a batch pipeline, not a hosted HTTP server.

- Keep API transport/instrument resolution in `scripts/providers.py`, orchestration in `fetch_market.py`, indicators in `signals.py`/`strategies.py`, and option rules in `options_analysis.py`.
- Maintain timezone-aware timestamps and completed-candle filtering. Retained cached symbols keep their original source and time; fetch time is not exchange quote time.
- Preserve explicit provider selection and the failure behavior of invalid configured Upstox authentication.
- Validate finite numeric inputs, sufficient history, contract identity, tick/lot units and missing/zero volume semantics. Do not fabricate inputs to obtain a signal.
- Update all producer/consumer boundaries when changing snapshot fields, including browser modules and fixtures.
- Preserve full category confluence, directional/context separation, and the distinction between index points and premium rupees.
- Run relevant provider, pipeline, strategy or options tests. Use fixtures for routine checks; real API requests need an existing authorized credential and must not expose it.
- Consult current official broker documentation when endpoint or schema behavior is uncertain.
