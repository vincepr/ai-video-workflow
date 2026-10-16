# 0020: Restore guided ad choices and pause at the first frame

Status: Accepted
Date: 2026-10-16

## Decision

Keep the product-video request as the ad configuration contract. Preserve Atlas direct format, hook, setting and avatar IDs in the catalog; freeze a named avatar's casting description with the request. A custom avatar uses a project presenter reference. The creative-direction text and run mode are optional fields, so older frozen requests remain readable.

The Creator Desk shows the ad choices for every project and keeps provider and delivery controls under Advanced. Uploaded references stay in that project's ignored media folder. Generate freezes the request and starts a fresh local Codex CLI task. The CLI task uses the selected skill and frozen context; the provider runtime checks current capabilities, prices and the USD cap before submission. A task failure or unsupported operation remains visible instead of being called a video.

Only direct ads support a first-frame checkpoint. The direct runner inspects the generated frame and stops before video submission. The desk approval receipt binds the exact frame hash to the selected motion prompt. A revised image setup receives a new request ID, preserving the previous candidate. Full mode advances after agent inspection. The post-video edit reads the saved caption windows, changes text locally and creates another numbered export without changing raw footage. The agent can still add more elaborate cuts, stills or music in its project edit plan.

## Validation

Run `npm run check` and `npm run files`. Test legacy request normalization, all avatar IDs, frame-hash rejection, pause and resume, and local overlay validation. Open the desk and inspect the direct ad form. Verify a live task ID can be started and resumed with the installed Codex CLI without a provider request. A paid end-to-end run is checked separately with an explicit project cap; offline tests cannot prove current provider availability or creative quality.
