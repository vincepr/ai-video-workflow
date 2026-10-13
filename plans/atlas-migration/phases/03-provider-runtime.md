# 03: Generalize Python operations and durable provider jobs

## Read

Phase 01 interfaces; extraction probe.py/generate.py and provider-adaptation.md; ADR 0004; applicable test-driven-development guidance. Use saved discovery and sanitized recorded responses for offline development.

## Work

1. Adapt the Python utilities for explicit project/run paths and the frozen request. Remove machine-specific key/media paths. Load credentials only server-side at operation time; never persist the key, headers or large base64 payloads in artifacts.
2. Provide inspectable operations for discovery, dry run, image submission, video submission, poll, download and metadata inspection. Existing command names may change only through the phase 01 interface agreement. The agent writes creative prompts; scripts execute requests, not another hidden prompt-planning model.
3. Replace single-route assumptions with capability-aware provider operations. Validate supported reference roles, ratios, duration, resolution and audio against dated evidence. Keep Atlas payload mapping separate from OpenRouter. Offline fixtures must not contact the provider.
4. Add race-safe stage claiming and write-once submission markers before paid requests. Preserve accepted job IDs immediately. A timeout before a response is an ambiguous submission, not permission to retry. Poll/download/resume keep the same job. Preserve failures and discarded artifacts.
5. Enforce explicit run estimates and shared-key accounting across projects, including outstanding reservations and delayed usage receipts. Use the tighter live key limit and local authorized ceiling. No implicit provider fallback, automatic paid retry, preset sweep or extra paid planner.
6. Restrict authenticated calls to the intended provider API. For media redirects, strip Authorization off external hosts. Download to a temporary file, then finalize only after completion; preserve raw bytes and hashes.
7. Make operations resumable from files, without requiring the browser, Atlas login, database, Stripe, public storage or site credits. Refresh live discovery before a newly authorized paid run, not during every offline test.

## Ownership

Python runtime/provider adapter, stage ledger and tests. Put shared local key reservations in an ignored runtime location agreed in phase 01. Do not copy the source virtual environment or its product runs. Dependencies need a current implementation requirement.

## Gate

Recorded-response tests cover accepted jobs, ambiguous timeout, terminal failure, interrupted polling, output reuse, redirected downloads and duplicate concurrent submissions. Budget tests cover delayed usage and two projects sharing one key. Dry-run and test modes demonstrably perform zero paid calls and redact secrets.

## Handoff

Return runnable commands and schemas, provider operation matrix, no-network fixtures, stage/budget behavior, dependency installation notes and unresolved live capabilities. Do not call mock success live verification.
