---
name: security
description: Review or change Market Pulse broker authentication, secret handling, socket validation, external-data rendering, binary input handling, or public deployment boundaries.
---

# Security

Read the relevant trust boundary in [architecture](../../../docs/ARCHITECTURE.md), then inspect the actual credential/data path involved.

- Pipeline credentials come from environment variables/Actions secrets. A public frontend cannot retrieve a repository secret; never extract it through logs or artifacts.
- Personal live credentials remain session-only, are sent only to the official broker, and are cleared from inputs. Never place tokens/socket URLs in browser storage, BroadcastChannel, screenshots, source, fixtures or exception output.
- Preserve secure `wss:` Upstox subdomain validation, credential-free URL authority, and the live page's CSP/no-third-party-script isolation.
- Distinguish broker CORS/network failures from invalid-token responses; do not bypass CORS by sending a token to an untrusted proxy.
- Check external strings reach text nodes/escaping, binary reads are bounded, and invalid timestamps/values cannot make stale data look fresh.
- Keep deployment artifacts limited to explicit static files; exclude local helpers, environment files and credential material.
- Test the relevant rejection paths with fictional credentials. Report demonstrated issues with impact and a concrete fix; avoid unrelated speculative hardening.
- Security edits do not authorize account changes, secret rotation, new services, or order endpoints beyond the user's task.
