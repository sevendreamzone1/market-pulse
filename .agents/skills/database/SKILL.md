---
name: database
description: Design or change Market Pulse persistent storage, schemas, migrations, or historical queries when persistence is explicitly part of the task.
---

# Database and persistence

The current application has no database. `data/market.json` is a public snapshot, GitHub cache is operational reuse, and browser scenarios are session-only.

- For a storage request, establish retention, query needs, volume, hosting and access boundaries from available context before choosing a store.
- Keep schema design within the requested scope. Do not introduce a database, migration framework, browser credential storage, or server merely because this skill exists.
- GitHub Pages cannot run a database server. Any persistent backend needs an explicit architecture and hosting change.
- Separate quote/event time, ingestion time, model version, hypothetical scenario state and actual fills. Never label simulated records as executed trades.
- Use deterministic identifiers, parameterized queries, integrity constraints and reversible migrations where the chosen database supports them.
- Keep broker tokens and one-time socket URLs out of research datasets and migration fixtures. Minimize account-specific data.
- Test migration/rollback and representative queries for an implemented storage change; do not run destructive changes without applicable user authorization.
- Record approved storage boundaries in [architecture](../../../docs/ARCHITECTURE.md); future proposals remain proposals until implemented.
