---
name: devils-advocate
description: Challenge Market Pulse strategy claims, proposed architecture, live-data assumptions, or release decisions when a risk-focused critique is requested or materially useful.
---

# Devil's advocate

Identify the decision and its claimed benefit. Inspect the relevant implementation or proposal before challenging it; this is a reasoning workflow, not a requirement to spawn another agent.

- Distinguish observed evidence, assumptions and unknowns. Ask what result would disprove the claim and which check can produce it.
- Challenge category agreement being presented as win rate, correlated signals as independent evidence, and backtests with lookahead or omitted costs/liquidity.
- Challenge an open socket being labeled fresh data, a snapshot trigger being labeled a fill, and an observed stop being presented as guaranteed execution.
- Examine delayed schedules, expired credentials, stale depth, partial candles, reconnect gaps, closed tabs and static-hosting limits where relevant.
- Assess whether a simpler change within the current architecture meets the user's goal. Do not invent a server/database migration as a default answer.
- Return concrete failure scenarios, likely impact, and the cheapest meaningful validation or mitigation. State when evidence already addresses a concern.
- Preserve the user's chosen scope. Critique does not authorize disabling controls, adding services, trading, or publishing changes.
- For an architecture decision, provide a concise record: decision, strongest assumption, concrete failure mode, simplest viable alternative, and evidence needed to proceed. State whether the risk is resolved, accepted by the user, or still open; do not invent acceptance.
- Before recommending implementation, check the approval record in `docs/DEVELOPMENT_PLAN.md`. Reviewing a proposal can proceed while implementation approval is pending.

Consult [requirements](../../../docs/REQUIREMENTS.md) and [progress](../../../docs/PROGRESS.md) only for the assumptions under review.
