# Development Plan

## Approval record
- Plan ID: `MP-PLAN-001`, revision 1.
- Prepared: 2026-11-18, Asia/Colombo.
- Status: **MODULE 1 AND MODULE 5 BROWSER-ONLY LOGIN COMPLETE AND PUBLISHED**. Modules 2 through 4 and server-side hosting changes remain unapproved.
- Approval evidence: user replied "approved" on 2026-11-18 to the request to approve Module 1's focused repair and publication.
- Authorized now: Module 1 maintenance, the clarified Module 5 browser-only login, MP-PLAN-002 revision 1's trend-breakout replacement below, their tests and existing Pages publication, plus agent documentation maintenance.
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

## Development modules
Module 1's approved focused repair is complete. Modules 2 through 4 are suggestions for review, not commitments or approved implementation work. Each subsequent module needs its data inputs and final scope confirmed in the approved plan.

| Order | Module and boundary | Acceptance evidence | Dependencies |
| --- | --- | --- | --- |
| 1 | Feed reliability: distinguish expired authentication, delayed snapshot refresh and disconnected/stale browser data in existing provider/live/UI paths | Fixture tests for each failure state; sanitized errors; user-authorized live verification reported separately | Current architecture; current user credential only for real-session verification |
| 2 | Historical strategy evaluation: a separate research harness using versioned rules and chronological out-of-sample data | No-lookahead checks; declared dataset/split; costs, slippage and liquidity assumptions; net expectancy and drawdown alongside win rate | Agreed historical data availability and licensing; approved research scope |
| 3 | Forward paper trading: hypothetical signal/exit observations kept separate from actual fills | Deterministic scenario replay; timestamps/model version; no credential persistence; honest hypothetical result labels | Module 2 protocol; approval of any retention/storage design |
| 4 | Exchange calendar: holiday and special-session handling in existing session checks | Calendar fixtures and agreed behavior for unavailable/outdated calendar data | Suitable maintained source; approved session-policy change |

Persistent services, databases, order execution and hosting migration remain outside this proposal unless separately requested. No module can promise a 90% success rate; statistical evidence must precede accuracy claims.

## Module 1 focused repair - complete and published
Evidence recorded in [PROGRESS.md](PROGRESS.md): on 18 November at 11:10 IST the public model still used previous-session candles; the enabled workflow had no observed current-day run. Fresh socket quotes cannot satisfy the model-age gate.

Proposed scope for approval:
1. Dispatch the existing refresh workflow and inspect the actual result and deployed candle times. If broker authentication fails, report it and have the user renew the secret; never retrieve or publish secret values.
2. Add a clear dashboard distinction between stale strategy analysis, an absent/disconnected live tab, and a genuine fresh NO TRADE result, reusing existing components.
3. Test the previous-session-model plus fresh-ticks case, recovery when a fresh model arrives, and disconnected-feed behavior. Preserve all strategy, freshness, liquidity and risk gates.
4. Publish the focused change if this scope is approved, verify the workflow and public data, and record what remains unverified about the personal live connection.

Acceptance: stale analysis is identified as a data blocker rather than current market neutrality; fresh data recovery is demonstrated with fixtures and a deployed timestamp check when upstream access succeeds. GitHub scheduling latency cannot be guaranteed by a static-site change. No change to strategy thresholds, new backend, credential storage or automatic orders is proposed.

Completion evidence: [deployment 44247665180](https://github.com/sevendreamzone1/market-pulse/actions/runs/44247665180) succeeded for repair commit `a114a53`. At 11:27 IST on 18 November, the public diagnostic modules were verified and all three index candles ended at 11:25 IST with no refresh errors. Relevant regression suites and browser fixture checks passed; see [progress](PROGRESS.md). The user's authenticated browser stream remains a separate verification limit.

## Security and testing standards
- Apply root `AGENTS.md` credential, input-validation and trust-boundary rules to every approved module.
- Use `.agents/skills/security/SKILL.md` for authentication/trust-boundary work and `.agents/skills/testing/SKILL.md` to select existing checks.
- Test behavior and meaningful failure cases with fictional credentials. Live broker access is a separate verification step, not a unit-test dependency.
- Keep secrets out of source, tests, public snapshots and progress records. Keep index and premium units, timestamps and freshness visible.
- Documentation-only setup requires skill validation, local-link checks and whitespace checks; it does not justify runtime implementation or a market refresh.

## Home-page live prices - approved frontend extension
Approval evidence: the user requested "need to show live market datas in home page also" on 2026-11-18. This is a scoped UI extension using the existing broker tab and BroadcastChannel, not approval for a new backend or credential storage.

Added a visible home-page table for subscribed indices, equities and option contracts, with live price, change, trade time, freshness and a connection link. Only live packets with trades within 30 seconds and receipt within five seconds may appear as live. Preserve snapshot fallback in existing cards, disconnect clearing, demo isolation and separate strategy timestamps. Existing regression tests and a browser fixture verified those boundaries and a 390px layout. Status: complete and published. Deployment 44266239693 succeeded for commit `f0f7832`; the public home-page table, renderer and responsive styles were verified.

## Completion criteria
### Live entry and exit table - approved extension
Approval evidence: the user requested "update this to live also" after reviewing the entry-time/price, targets, stop-loss and exit table. Reuse the shared live panel on home and live pages; add current-scenario rows and session-only exit observation metadata. Preserve all existing signal gates. Show pending/unavailable values explicitly, separate watch references from confirmed triggers, and never describe observed bids as actual fills. Verify timestamp/price latching, absent/stale exit quotes, safe rendering and mobile table scrolling. This does not introduce a historical paper-trading ledger, storage, new strategy rules or backend. Status: complete and published. [Deployment 44293417590](https://github.com/sevendreamzone1/market-pulse/actions/runs/44293417590) succeeded for commit `96302b0`; the public table, exit metadata code and stylesheet were verified.

A module is complete when the requested behavior is implemented, relevant checks pass, limitations are recorded, and publication is verified if publication was requested. Fixture tests are not evidence of live broker entitlement or investment accuracy.

## Module 5 - original private login proposal, superseded
Requested outcome: a login page that prevents unauthenticated public access. A JavaScript username/password check on the existing public GitHub Pages site cannot enforce that outcome; visitors can inspect or bypass it and directly fetch the public market JSON.

Proposed minimal architecture:
1. Select hosting that can enforce server-side access control before serving protected content. Keep the existing frontend modules and GitHub source repository; avoid a frontend framework migration or a database for this single-owner account.
2. Store the owner username and a salted password hash in server-side secret configuration. Do not commit the supplied password or embed it, a password-equivalent hash, or an authentication secret in public JavaScript.
3. Serve a login form with server-validated credentials, rate-limited attempts, expiring Secure/HttpOnly/SameSite sessions, logout and fail-closed behavior when secret configuration is missing.
4. Require authentication for dashboard, live page and market JSON routes. Ensure protected market data has no public repository, artifact or legacy Pages copy that bypasses login; plan the publication cutover accordingly. Public source code can remain public if it contains no protected data or credentials.
5. Verify unauthenticated direct URLs cannot retrieve protected content, incorrect passwords fail, sessions expire/logout, and existing market logic remains intact.

Approval needed: replacing public Pages delivery with authenticated hosting and the chosen hosting destination. The previous Module 1 approval does not cover this architecture change. GitHub Enterprise Cloud organization private Pages is a separate access-control option using GitHub identity, not a custom hardcoded owner password.

No login implementation, credential storage, hosting migration, repository-visibility change or unpublishing has been performed under this proposal. Keep credential values out of planning/progress documents.

### Approved replacement: browser-only login
The user clarified: "a page where credentials enter if matches display home page ... no database ... hard coded login." This authorizes the narrower UI implementation and existing GitHub Pages publication; it does not authorize a hosting migration or establish private access.

Implement a matching login screen, fixed owner username/password digest, per-tab session marker, home/live-page redirects and Logout. Never store the entered password or broker credentials. Preserve safe local return destinations and existing live-feed isolation. Test wrong/correct credentials with fictional configuration, redirect safety, session expiry, storage failure and logout. Clearly state that direct files/JSON remain public and the UI gate is bypassable. Status: complete and published. Deployment 44254044485 succeeded for commit `1626c17`; the public login form, script, dashboard guard and live-page Logout control were verified.

### Shared login extension - approved by current user request
The user requested one login for home and the live feed. Replace the initial per-tab marker with an eight-hour browser-wide marker scoped to this site path, synchronize login/logout using storage events, and preserve expiry and safe local returns. Share only the UI marker; never persist the site password, Upstox token or authorized socket URL. Upstox API authorization remains separate from site sign-in. Cross-tab tests and a browser fixture verified a new live tab skips the second site prompt and logout from live signs out both pages. Status: complete and published. [Deployment 44286718036](https://github.com/sevendreamzone1/market-pulse/actions/runs/44286718036) succeeded for commit `54ecdef`; the public shared-login script and home/live page copy were verified.


## Approved replacement signal engine - MP-PLAN-002, revision 1
Status: approved for implementation and existing GitHub Pages publication. Approval evidence: after reviewing MP-PLAN-002, the user requested "can you figure out and configure code accordingly". This approves the concrete replacement method and its verification. Implementation, regression suites and fictional browser verification are complete. Published successfully in [deployment 44296520955](https://github.com/sevendreamzone1/market-pulse/actions/runs/44296520955), commit `5fceb83`; public code and all three index method identifiers were verified.

Request evidence: the user asked whether the supplied strategy catalog drives recommendations, and requested replacing it with a method selected by the architect. This replaces decision authority, rather than relaxing the existing catalog's agreement threshold. Root AGENTS.md requires review/approval of the concrete plan before this material strategy change.

### Selected method: five-minute trend breakout
This is a proposed, unvalidated rule set for research scenarios, not a claim of superior returns or exact executable prices. Moving-average trend filters and range breakout levels are chosen for explicit rules and reuse of available candle data. The numeric parameters below are design choices requiring evaluation; educational sources do not validate this combination.

- Scope: existing NIFTY, BANK NIFTY and SENSEX CE/PE scenarios; completed five-minute provider candles. Keep the catalog as optional diagnostics, but remove its category votes/60% agreement as decision authority. Show one named method and its passed/failed checks consistently across dashboard, options tab and live table. Do not alter ordinary equity quote transport or login.
- Data: require at least 60 valid, consecutive in-session OHLC candles for indicator calculations; history may span trading sessions, with no missing five-minute interval inside an observed regular session. Range and recent swing levels must use today's session bars; require 20 completed current-session bars before arming a breakout. This intentionally delays earliest setups until about 10:55 IST. EMA9/21 and ATR14 use completed available history; do not invent index volume/VWAP.
- CE watch: EMA9 > EMA21, latest EMA21 > its previous value, latest close > EMA9. Range trigger is the highest high of the latest 20 completed current-session candles + 0.1 ATR14.
- PE watch: EMA9 < EMA21, latest EMA21 < its previous value, latest close < EMA9. Range trigger is the lowest low of those 20 candles - 0.1 ATR14. Mixed filters mean NO TRADE, with a failed-check explanation.
- Confirmation: a later, fully observed five-minute live index candle must close above the CE trigger or below the PE trigger. Freeze an armed trigger while waiting for that next complete candle; replacing a snapshot must not silently move the pending trigger. Expire the arm after ten minutes from its source candle, or invalidate on a fresh opposite/neutral method decision, index stop breach, disconnect or missed/gapped confirmation. A new eligible snapshot may then arm a new watch; expired or partial observations cannot trigger retroactively.
- Underlying risk: CE stop is max(lowest low of latest five current-session candles, trigger - 1.5 ATR14); PE stop is min(highest high of those candles, trigger + 1.5 ATR14). Require strictly positive risk. Underlying references use index points; show 1R/2R reference levels separately from option prices.
- Contract and premium risk: retain existing future-expiry ATM selection, actual tick/lot units, option ATR14 from 30 completed option candles, fresh bid/ask, positive traded volume, spread <=5% and depth >=one lot. Retain the existing premium stop calculation and 1R/2R targets frozen at confirmation. Do not enter beyond the armed index T1 or option reference T1; missing/invalid premium risk means no entry.
- Exits: observed option bid at SL/T2, index stop breach, fresh method-direction invalidation, or 30 minutes from trigger / 15:15 IST, whichever comes first. T1 is a partial-exit observation only. Keep the existing observed timestamps/bid capture and no-fill labels.
- Availability: keep 09:30-14:45 IST weekday entry limits, snapshot age <=10 minutes, option metadata age <=5 minutes, trade age <=30 seconds and receipt age <=5 seconds. The 20-current-session-bar requirement further restricts actual readiness. No holiday-calendar implementation is included.

### Module workflow and acceptance
1. Python decision module: reuse EMA/ATR helpers; add versioned method output, explicit gates, pinned trigger inputs and index risk levels. Keep legacy diagnostics separate. Fixture-test CE/PE symmetry, flat/mixed trends, insufficient/missing/invalid candles, session boundaries and no future-bar use.
2. Live confirmation and shared presentation: consume the named method instead of catalog agreement; pin armed trigger identity; preserve all liquidity/freshness/partial-candle and no-chase checks. Fixture-test snapshot replacement during confirmation, arm expiry, opposite decision invalidation, fixed entry/exit levels, exit latching and rejection of incompatible old snapshots. Update existing Node and Python consumers/tests together.
3. Verify and publish: run affected suites, check desktop/mobile with fictional quotes, update requirements/architecture/progress and publish using existing GitHub Actions. Report actual deployment outcome. Do not claim owner-session verification from fixtures.

### Devil's advocate review
Decision: use one trend-following breakout method instead of mixing trend, reversal and event votes. Strongest unproven assumption: this method has a useful net edge on these index options. Failure modes: sideways false breakouts, opening gaps/late continuation, premium decay/spreads, too few signals, delayed GitHub snapshots and moved triggers. Mitigations in scope: explicit method gates, pinned arm identity, existing stop/liquidity/no-chase checks and honest NO TRADE/data-blocker states. Simpler alternative: retain current engine and merely explain its blockers; this does not satisfy the requested change in decision authority. Historical out-of-sample and forward evidence are still needed before claiming effectiveness; Modules 2/3 remain separately unapproved.

No new host, database, dependencies, credential storage, automatic orders or persistent signal history. This change cannot make GitHub schedules continuous or guarantee entries on every session.

References for concepts, not validation of these parameters: https://zerodha.com/varsity/chapter/moving-averages/ and https://zerodha.com/varsity/chapter/support-resistance/ .

### Automatic recommendation-change display - approved scoped extension
Approval evidence: the user requested "whenever there is a change please suggest ... analysis is from your side carry on" after deployment of MP-PLAN-002. Add visible, automatically updated change times and current recommendation summaries to the existing shared home/live panel. Track meaningful decision/status, direction, contract, armed index-level and confirmed entry/exit changes; ordinary LTP/bid/ask movement must not reset the change time. Keep only each index's current change metadata in session memory, share it with existing channel outputs, and clear it on disconnect. Initial observations must not be labeled new buy signals. Preserve every decision, freshness and risk rule. Verify semantic changes, unchanged ticks, watch re-arming, no-trade/data-blocker states, reconnect reset, safe text and mobile presentation. No chat monitoring, background push service, notifications permission, historical ledger or new analysis service is implied. Status: complete and published. [Deployment 44301994003](https://github.com/sevendreamzone1/market-pulse/actions/runs/44301994003) succeeded for commit `f62d985`; public change-summary code, timestamp tracking and responsive stylesheet were verified.
