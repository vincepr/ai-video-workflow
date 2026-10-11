# 0001: Keep context and writing concise

Status: Accepted
Date: 2026-10-11

## Decision

Keep AGENTS.md at 20 nonempty lines or fewer, README.md at 80 and each ADR at 40. Load task-specific guidance when needed. Do not duplicate rules across agent instruction files. Add a skill only when a recurring task needs it.

Use plain, concrete language in tracked text and commit messages. Do not use em dashes, promotional filler or stock assistant phrasing. Keep research dumps, generated output and session history out of instruction files.

## Reason

Large context files consume attention and make rules harder to follow. Short instructions keep the work focused.

## Validation

`npm run check` checks document budgets, em dashes and a short list of stock phrases in tracked or nonignored text. Review new instructions for duplication and relevance. Review commit messages with the same writing rules. Automated checks do not replace that review.
