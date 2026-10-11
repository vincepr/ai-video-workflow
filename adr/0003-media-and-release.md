# 0003: Keep media review and publishing explicit

Status: Accepted
Date: 2026-10-11

## Decision

Record a source and permission basis for every shot. Reject missing records and assets before rendering. These records are notes, not a legal determination.

Use original sample artwork. Keep private media, downloaded source footage, credentials and renders out of Git. Track third-party assets only with permission to redistribute them.

Store API keys in the ignored root `.env`. Commit only an empty `.env.example`. Keep keys out of browser code and render props. Ignore common media formats, model weights, archives, caches and working folders by default.

Review the full export and intended use before release. Keep publishing manual. Add paid services or automated posting only after an explicit request.

## Reason

A rendered draft should be easy to test without posting it or incurring service charges. Source records help later review.

## Validation

Episode tests cover missing source records and invalid asset paths. The render command checks that assets exist. Review staged assets and the complete export before release.

Use `git check-ignore` to verify secret and media paths. `git ls-files -ci --exclude-standard` must be empty; ignore rules do not remove already tracked files.
