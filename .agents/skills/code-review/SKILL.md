---
name: code-review
description: Review Market Pulse diffs for correctness, regressions, architecture fit, test coverage, and maintainability without silently expanding implementation scope.
---

# Code review

Start with the requested diff and `git status --short`; read only affected modules and their immediate producers/consumers.

- Trace changed behavior from provider input or socket packet through strategy decisions to UI labels.
- Prioritize broken freshness checks, lookahead/incomplete candles, index-versus-premium units, unstable entry levels, bid/ask errors, missing-data fabrication and credential exposure.
- Check existing component reuse and clear module responsibilities. Do not request abstractions or dependencies without a concrete benefit.
- Verify tests exercise observable behavior and failure cases rather than repeating implementation wording.
- Separate evidence from inference. Fixture success does not establish broker authorization or strategy profitability.
- Report actionable findings ordered by severity with file locations, triggering conditions, effect and a focused remedy.
- For a review-only request, do not edit or publish unless authorized. If no issue is found, say so and identify material verification gaps.

Use [requirements](../../../docs/REQUIREMENTS.md) as the domain baseline, not as permission to implement unrelated features.
