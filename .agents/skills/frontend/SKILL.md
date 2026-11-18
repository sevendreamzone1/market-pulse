---
name: frontend
description: Build or change Market Pulse dashboard and live-feed UI, browser modules, shared components, accessibility, or responsive layouts.
---

# Frontend

Read the browser-module map in [architecture](../../../docs/ARCHITECTURE.md) and only the HTML/CSS/JS involved in the request.

- Preserve buildless browser JavaScript. Introduce React, TypeScript, a bundler, or a UI dependency only when the requested architecture change warrants it.
- Reuse `live-panel.mjs` and `live-setups.css` for scenario presentation. Keep broker connection logic in `live.js` and scenario decisions in `live-setups.mjs`.
- Keep live quote labels distinct from indicator candle times and TradingView chart data. Preserve demo isolation and NO TRADE/unavailable states.
- Render external labels as text. Retain keyboard support, responsive layout, semantic controls and visible connection/freshness states.
- Keep credentials on the isolated live page; do not move credential entry into third-party-script dashboard flows.
- Verify relevant dashboard/shared-panel tests. For layout changes, inspect desktop/mobile when browser tooling is available; disclose any preview limit.
- Update only affected documentation and report changed behavior, checks and material limitations.
