# Agent Instructions

## Development rules
- Develop module by module and implement only the requested scope.
- Follow the existing buildless HTML/CSS/JavaScript frontend and Python pipeline architecture.
- Apply SOLID and DRY principles where useful; reuse existing components before adding abstractions.
- Avoid unnecessary dependencies, frameworks, and unrelated file changes.

## Security
- Never hardcode credentials or include them in logs, fixtures, commits, URLs shared with others, or public artifacts.
- User-approved exception: the browser-only login uses a fixed owner username and password digest as a convenience UI gate. Its bypassable session marker is not authentication; do not reuse this design for broker credentials or claim it makes Pages private.
- Read pipeline secrets from environment variables/GitHub Actions secrets.
- Preserve the live page's session-only credential entry: send credentials only to Upstox, clear inputs, and never persist or broadcast credentials.
- Validate external inputs, timestamps, instrument identifiers, socket hosts, and binary payloads. Preserve secure authentication and the live page CSP.

## Context and token use
- Start with `git status --short`; inspect only files relevant to the task using targeted `rg` searches.
- Read the relevant document or skill rather than loading every document and skill.
- Prefer focused patches over whole-file rewrites. Reuse existing implementations and keep responses concise.

## Workflow
- Application implementation requires explicit user approval of [the development plan](docs/DEVELOPMENT_PLAN.md). Module 1 and the user's clarified Module 5 browser-only login are approved; other proposed modules remain unapproved.
- Before application edits, verify the approved plan version and scope. Record the user's approval evidence in the plan; never mark approval based on silence or an agent's decision.
- For complex tasks, make a short plan with modules and acceptance checks before editing. Plan approval covers the listed modules; do not request approval again for routine steps within that scope.
- Complete and verify each module, then report meaningful progress.
- Run relevant existing tests after implementation; add tests for changed behavior or meaningful failure cases.
- Update affected documentation when behavior, architecture, or completion status changes.
- Follow the user's publishing instructions and existing authorization; do not infer production access from a skill.
- If a material scope or architecture change falls outside the approved plan, document the proposed revision and obtain approval before implementing that change.

## Project invariants
- Strategy categories use completed five-minute candles; live ticks confirm and monitor scenarios. Do not describe them as full indicator recalculation on every tick.
- Keep index points separate from option-premium rupees. Preserve freshness, expiry, spread/depth, session, and no-chase gates.
- Category agreement is not accuracy or win probability. Do not claim a validated edge or 90% accuracy without supporting research.
- Preserve NO TRADE, unavailable-data states, explicit fictional demo isolation, and quote clearing on disconnect.
- GitHub Pages serves static files. It cannot host a persistent Python service, shared authenticated stream, or database server.

## Documentation
Read only what is needed:
- [Requirements](docs/REQUIREMENTS.md): product scope and acceptance criteria.
- [Architecture](docs/ARCHITECTURE.md): modules, data flow, and trust boundaries.
- [Development plan](docs/DEVELOPMENT_PLAN.md): current modules and future work.
- [Progress](docs/PROGRESS.md): completion evidence and outstanding limits.

## Project skills
Skills live in `.agents/skills/<name>/SKILL.md`. Select the matching skill; do not load all of them.
Open Codex in `market-pulse` or a subdirectory so repository skills are discoverable. Invoke a skill explicitly with a prompt such as `$devils-advocate review the live entry assumptions`; matching tasks may also select skills automatically. If new skills do not appear, restart the Codex session.

| Skill | Responsibility |
| --- | --- |
| `frontend` | Dashboard/live UI, browser modules, accessibility |
| `backend` | Providers, candle pipeline, strategy and option logic |
| `database` | Persistence design and migrations when explicitly in scope |
| `security` | Broker authentication, credentials, input validation, trust boundaries |
| `code-review` | Correctness, regressions, maintainability |
| `devils-advocate` | Challenge assumptions and identify concrete failure modes |
| `testing` | Relevant Python/Node checks and integration evidence |
| `deployment` | Existing GitHub Actions and Pages publication |
| `token-optimization` | Targeted context gathering and concise handoffs |

## Verification commands
Use the existing `.venv` Python when its dependencies are installed. Read the testing skill for selection; a docs-only change does not require broker access or a market refresh.

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -q
node --check app.js
node --check live.js
node tests/login.test.cjs
node tests/dashboard.test.cjs
node tests/live-feed.test.mjs
node tests/live-viewer.test.mjs
node tests/live-setups.test.mjs
node tests/live-dashboard.test.mjs
git diff --check
```
