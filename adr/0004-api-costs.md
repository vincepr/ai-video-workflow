# 0004: Keep API use small and explicit

Status: Accepted
Date: 2026-10-11

## Decision

OpenRouter is available for tasks in this project. Load the key from the local `.env` at the start of each run. Do not hardcode or log it. Restart long-running processes after key rotation.

Prefer local tools for editing, validation and rendering. Use an API only for a task that needs a model. Reuse saved results when inputs have not changed.

Start with one request at a time and at most 1,024 output tokens per request. Choose a low-cost model using its current pricing. Send only the context needed for the task. Do not run model comparisons, batch generation or unattended request loops by default.

Do not retry automatically. Stop on rate limits, quota errors or insufficient credit. Set a request timeout. Agree a spending cap before a larger batch or raising these defaults.

## Reason

Early experiments should consume little credit and leave room for later work.

## Validation

Before introducing a client, verify its output cap, timeout, retry behavior and key loading. Record model, usage and reported cost with results under `out/`, without credentials. These are working rules until a client implements them.
