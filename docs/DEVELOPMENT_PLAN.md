# Development Plan

## Approval record
- Plan ID: `MP-PLAN-001`, revision 1.
- Prepared: 2026-11-18, Asia/Colombo.
- Status: **MODULE 1 FOCUSED REPAIR APPROVED**; other proposed modules await approval.
- Approval evidence: user replied "approved" on 2026-11-18 to the request to approve Module 1's focused repair and publication.
- Authorized now: the focused Module 1 scope below, its tests and publication, plus agent documentation maintenance.
- Outside this approval: unrelated runtime refactors, dependency additions, infrastructure changes, and implementation of Modules 2 through 4.

The application already exists. This plan governs subsequent development; it does not describe existing features as work newly completed during setup. Update status and record the user's approved scope only after explicit approval. Approval of selected modules does not approve the entire backlog.

## Working method
1. Define the module's goal, affected files, dependencies, exclusions and observable acceptance checks.
2. Review the decision with the devil's advocate skill when assumptions or architecture risks warrant it; record the decision and unresolved risks briefly.
3. Obtain user approval of the plan and scope before application implementation. Documentation preparation can proceed before approval.
4. Implement one approved module at a time, reusing existing code and keeping patches focused.
5. Run relevant security and behavior checks; resolve failures within the approved scope.
6. Update [PROGRESS.md](PROGRESS.md) with files changed, evidence, limitations and the next module; report progress to the user.
7. Publish only when the user's instructions authorize publication. Verify the actual deployment result.

Do not add framework migrations, separate services, databases, exhaustive process artifacts, or parallel agents merely to follow this workflow. Routine steps within approved scope need no repeated approval.

## Existing modules
| Module | Current implementation | Change boundary |
| --- | --- | --- |
| Dashboard | Overview, charts, watchlist, technical cards, CE/PE tab | Reuse existing DOM/CSS and shared presentation |
| Providers/pipeline | Upstox/Yahoo, completed candles, snapshot publication | Preserve authentication and timestamp semantics |
| Strategy catalog | Category-weighted price/volume rules and option context | Update rules and meaningful tests together |
| Options research | Contract selection, index triggers, ATR premium risk | Preserve units, expiry, liquidity and freshness gates |
| Personal live feed | Authorization, full-feed decode, reconnect by user action | Keep credentials session-only and provider-bound |
| Live scenarios | Candle confirmation, frozen risk, observed exits, cross-tab display | Preserve partial/gapped candle rejection and bid-based exits |
| Delivery | GitHub Actions checks, snapshot refresh, Pages deployment | Publish explicit static assets; inspect the actual run |
| Agent guidance | Root instructions, project docs, nine scoped skills | Validate metadata and documentation links |

## Proposed next modules - not started
This is a suggested sequence for review, not a commitment to implement the full backlog. Each module needs its data inputs and final scope confirmed in the approved plan.

| Order | Module and boundary | Acceptance evidence | Dependencies |
| --- | --- | --- | --- |
| 1 | Feed reliability: distinguish expired authentication, delayed snapshot refresh and disconnected/stale browser data in existing provider/live/UI paths | Fixture tests for each failure state; sanitized errors; user-authorized live verification reported separately | Current architecture; current user credential only for real-session verification |
| 2 | Historical strategy evaluation: a separate research harness using versioned rules and chronological out-of-sample data | No-lookahead checks; declared dataset/split; costs, slippage and liquidity assumptions; net expectancy and drawdown alongside win rate | Agreed historical data availability and licensing; approved research scope |
| 3 | Forward paper trading: hypothetical signal/exit observations kept separate from actual fills | Deterministic scenario replay; timestamps/model version; no credential persistence; honest hypothetical result labels | Module 2 protocol; approval of any retention/storage design |
| 4 | Exchange calendar: holiday and special-session handling in existing session checks | Calendar fixtures and agreed behavior for unavailable/outdated calendar data | Suitable maintained source; approved session-policy change |

Persistent services, databases, order execution and hosting migration remain outside this proposal unless separately requested. No module can promise a 90% success rate; statistical evidence must precede accuracy claims.

## Module 1 focused repair - approved, in progress
Evidence recorded in [PROGRESS.md](PROGRESS.md): on 18 November at 11:10 IST the public model still used previous-session candles; the enabled workflow had no observed current-day run. Fresh socket quotes cannot satisfy the model-age gate.

Proposed scope for approval:
1. Dispatch the existing refresh workflow and inspect the actual result and deployed candle times. If broker authentication fails, report it and have the user renew the secret; never retrieve or publish secret values.
2. Add a clear dashboard distinction between stale strategy analysis, an absent/disconnected live tab, and a genuine fresh NO TRADE result, reusing existing components.
3. Test the previous-session-model plus fresh-ticks case, recovery when a fresh model arrives, and disconnected-feed behavior. Preserve all strategy, freshness, liquidity and risk gates.
4. Publish the focused change if this scope is approved, verify the workflow and public data, and record what remains unverified about the personal live connection.

Acceptance: stale analysis is identified as a data blocker rather than current market neutrality; fresh data recovery is demonstrated with fixtures and a deployed timestamp check when upstream access succeeds. GitHub scheduling latency cannot be guaranteed by a static-site change. No change to strategy thresholds, new backend, credential storage or automatic orders is proposed.

## Security and testing standards
- Apply root `AGENTS.md` credential, input-validation and trust-boundary rules to every approved module.
- Use `.agents/skills/security/SKILL.md` for authentication/trust-boundary work and `.agents/skills/testing/SKILL.md` to select existing checks.
- Test behavior and meaningful failure cases with fictional credentials. Live broker access is a separate verification step, not a unit-test dependency.
- Keep secrets out of source, tests, public snapshots and progress records. Keep index and premium units, timestamps and freshness visible.
- Documentation-only setup requires skill validation, local-link checks and whitespace checks; it does not justify runtime implementation or a market refresh.

## Completion criteria
A module is complete when the requested behavior is implemented, relevant checks pass, limitations are recorded, and publication is verified if publication was requested. Fixture tests are not evidence of live broker entitlement or investment accuracy.
