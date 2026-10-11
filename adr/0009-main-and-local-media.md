# 0009: Save project changes on GitHub main

Status: Accepted
Date: 2026-10-11

## Decision

Use https://github.com/vincepr/ai-video-workflow as origin. Commit completed project changes and push to main after validation. This standing instruction covers repository changes; publishing videos remains separate.

Keep credentials, source media, cleaned panels, review state and renders local and ignored. Do not force-add ignored files when pushing the project.

## Validation

Run npm run check before pushing code. Check git status, ignored credentials and tracked media. Confirm main matches origin/main after pushing.
