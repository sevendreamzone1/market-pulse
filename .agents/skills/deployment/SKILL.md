---
name: deployment
description: Prepare, publish, or diagnose Market Pulse's existing GitHub Actions and GitHub Pages delivery, including static assets and scheduled data refreshes.
---

# Deployment

Inspect `.github/workflows/pages.yml`, the relevant diff, and publishing instructions in README. The supported deployment is static GitHub Pages; Python is a build-time job.

- Follow existing user authorization. A deployment skill does not grant access or permission to create infrastructure, change repository visibility, or expose a shared account feed.
- Use available GitHub tooling or authenticated Git/REST without printing credentials. Ignored `.qa/` scripts are local conveniences, not required project infrastructure.
- Preserve Actions secret references and the explicit `dist` asset allowlist. Add new browser modules/styles to that list when needed; never copy the whole working directory.
- Run the workflow's relevant checks. Preserve provider failure behavior so a failed fetch does not publish misleading fresh data.
- Keep GitHub Pages relative paths, module MIME compatibility, and the existing deployment concurrency/environment setup intact.
- Inspect the actual run for the target commit and wait for its terminal result. Report failure with the failed stage; never equate a successful push with a deployed release.
- If authorization to publish exists, carry the prepared change through publication. Otherwise finish local preparation and report its state without adding a new approval ritual.
- Do not add Docker, a backend server, a database or another host unless that architecture change is part of the task.
- Report the deployed URL and material verification limits. A successful deployment does not establish live-token validity or strategy accuracy.
