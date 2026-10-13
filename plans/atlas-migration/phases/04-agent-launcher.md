# 04: Launch the same skill from agent and browser

## Read

Phases 01/02 interfaces; scripts/t3-bridge.mjs and its tests; ADR 0008; create-short's T3 reference. Read documented runtime tooling available in the implementation session before choosing a fresh-session mechanism.

## Work

1. Make both entry points invoke the same normalized, frozen product-video request. The agent resolves natural-language choices to IDs; the browser supplies IDs directly. Neither independently assembles the creative prompt.
2. Extend dispatch to route the correct workflow skill. The existing message unconditionally invokes create-short; preserve that behavior for old requests while adding an explicit product-video request type. Avoid silently changing existing saved dispatch commands.
3. Establish a supported fresh production-session launch seeded only with the frozen request and selected context. Existing thread.turn.start on a paired thread retains history and is not strict isolation. Do not rely on hidden session database writes or unsupported runtime APIs.
4. Bind the production session to the originating project and request, retain execution/session IDs, and send results back to its review record. Never fall back to another project's credentials or thread. Worker execution must use the owning project, not its own unrelated working draft.
5. Keep request/dispatch identity stable for delivery retries and resume. Accepted dispatch proves delivery, not completion; retain separate worker status and artifact evidence. Cancellation stops subsequent stages and leaves accepted jobs and receipts recoverable.
6. If the runtime cannot provide a fresh session, implement and test the launcher abstraction offline, mark strict isolation unavailable, and report the missing runtime operation. Existing-thread mode may remain an explicit compatibility option but cannot satisfy the isolated-context gate.

## Ownership

Launcher/dispatch adapters and tests. No tab widgets yet. Do not expose credentials in browser state, copy pairing cookies into workers or break the existing per-project bridge.

## Gate

Both entry points dispatch equivalent requests and context lists. A fresh-session test contains no unrelated conversation/recipe data. Duplicate sends reuse identity; project mismatches and cancellation are handled. Legacy create-short sends remain unchanged. Runtime-dependent verification is reported separately from offline transport tests.

## Handoff

Return chosen documented launch mechanism, actual isolation guarantees, browser/agent invocation contract, worker return protocol, compatibility behavior and test evidence. This is the phase that proves selected context, not merely the resolver returning a short file list.
