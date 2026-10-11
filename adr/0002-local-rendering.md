# 0002: Start with local panel animation

Status: Accepted
Date: 2026-10-11

## Decision

Use TypeScript, React and Remotion for a local 1080 x 1920, 30 fps renderer. Store each episode as JSON with ordered shots, camera positions, text and asset provenance. Derive animation from frames and duration from shots.

Use Remotion's bundled media tools. Pin dependencies and commit the lockfile. Add voice and video providers only when an episode needs them. Start with one coding agent and ordinary commands.

## Reason

Panel animation tests the editing workflow without generation costs, credentials or GPU setup. Editable data makes rerenders repeatable.

## Validation

Run `npm ci` and `npm run check`. Render the sample, inspect the export and verify resolution, frame rate and duration with FFprobe. A change to the format needs an updated ADR and sample.
