---
name: testing
description: Select, write, or run meaningful Market Pulse Python and Node tests for changed market-data, UI, feed-decoder, or live-scenario behavior.
---

# Testing

Select checks by the changed behavior. Use the installed project environment; do not add a test framework or require broker credentials for fixture tests.

| Changed area | Existing checks |
| --- | --- |
| Baseline indicators | `tests/test_signals.py` |
| Provider/API adapter and pipeline | `tests/test_providers.py`, `tests/test_pipeline.py` |
| Strategy catalog and options | `tests/test_strategies.py`, `tests/test_options.py` |
| Main dashboard | `node tests/dashboard.test.cjs` |
| Browser-only login UI | `node tests/login.test.cjs` |
| Binary schema, URL/freshness checks | `node tests/live-feed.test.mjs` |
| Authorization and socket lifecycle | `node tests/live-viewer.test.mjs` |
| Live scenarios and exits | `node tests/live-setups.test.mjs` |
| Shared panel and heartbeat expiry | `node tests/live-dashboard.test.mjs` |

- Python discovery command: `.\.venv\Scripts\python -m unittest discover -s tests -q`; for a focused run, use unittest discovery with the affected filename pattern.
- Syntax-check changed JavaScript with `node --check <file>`. Check whitespace with `git diff --check`.
- Cover changed invariants such as no future data/lookahead, stale/partial feed suppression, CE/PE direction, fixed risk levels, bid-based latched exits and credential clearing.
- For UI layout or browser integration, use available browser tooling and fictional packets. Label fixture results honestly; don't claim real authentication was tested.
- For instructions/docs only, validate skill frontmatter and links; do not create product tests or trigger a broker refresh merely to test text.
- Run required checks once after the relevant change; repeat/broaden only for new edits, failures or unresolved risks. Record results and limitations in the task handoff and affected [progress](../../../docs/PROGRESS.md).
