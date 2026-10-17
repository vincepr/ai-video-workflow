# Generation attempt 1

Date: 2026-10-17. User cap: $5 maximum across this task.

Run: work/product-video/1f298bed-a887-4df7-b59e-4ebc01922347/.

Planned improvement: show a gardener closing the actual tent zipper in one eight-second shot. Seedream 5.0 Pro first frame estimate $0.054 with three references; Wan 3.0 720p motion estimate $0.80. Routes, input support and prices verified by live discovery before submission.

Outcome: image submission did not return an image or receipt within the runtime's 90-second timeout. The runtime preserved its ambiguous-submission marker and $0.054 ledger reservation. No video request was sent. No duplicate image request was sent.

Read-only reconciliation observed no change in key usage immediately afterward. This does not establish that the request was uncharged or rejected because account totals can lag. Reserve $0.054 until reconciled. No actual charge is confirmed.

Creative verdict: not assessable; no generated image or footage received. This is a provider/transport failure, not evidence of poor visual fidelity. Preserve the complete photo draft at videos/000001-relaxdays-garten/video.mp4.

Next step: reconcile the original image request against provider activity or an available receipt before any retry. No generation ID was returned, so the documented generation retrieval endpoint cannot identify this request from the saved response. If the provider confirms no continuing request, make a new explicit attempt with an appropriate timeout and fresh route/pricing checks, accounting for all prior spend under the same $5 task cap.

Official references checked: https://openrouter.ai/docs/api/api-reference/generations/get-generation and https://openrouter.ai/docs/api/api-reference/generations/list-generation-content require a generation ID. Current model page: https://openrouter.ai/alibaba/wan-3.0. Exact request estimates come from the saved API discovery rather than the model page's starting price.

## Explicit continuation

The user requested "continue". Read-only reconciliation still observed no usage increase or returned receipt for attempt 1. Provider activity lookup was unavailable with the current key. Keep the original marker and $0.054 reservation; do not treat missing usage as proof of no charge.

Created a separate frozen attempt with a 300-second project-local timeout, reserving the unresolved earlier estimate against the $5 task cap. Shared runtime code was unchanged.

| Request | Outcome | Reported cost |
| --- | --- | --- |
| d10b8b5a-3e7f-4e9d-95b1-36305dd7e9f6 | First frame received; rejected because tent edges and person were tightly cropped and scale was uncertain | $0.051 |
| 7aa35de9-c399-4708-bc35-d5d3272f100f | Wider first frame accepted; full base and gardener visible, tent tip slightly above adult head | $0.048 |
| cfe95322-c986-4941-9644-2c592a719181 | Reused accepted frame; seven-second Wan 3.0 480p clip accepted for internal draft | $0.2975 |

The eight-second 720p video estimate of $0.80 failed the shared-credit reservation check before submission. Available unreserved key headroom was approximately $0.39655. Chose one seven-second 480p request estimated at $0.35, with a fresh frozen request and capability/price discovery. Actual video charge was $0.2975.

Video job: gen-vid-1792244726-DMvv01JaO844OTjsZxTR. Native output: 480 x 854, 30 fps, 7.035 seconds, with an unexpected audio track despite audio=false. Raw output retained unchanged. Final renderer mutes the source and uses 210 frames. Raw SHA-256: fde2b7447d263e287f64d0938305dbc246aed235195283766bd0918af7c504a1.

Inspection: sampled the full clip every 0.5 seconds, including initial doorway, hand moving down the seam, closure and final hold. Product frame and six-sided silhouette stay stable; pot and tree remain inside. No invented heater or floor. Accept for an internal ad draft. This is a visual comparison, not calibrated dimensional validation. Native 480p limits scrutiny of fingers and zip teeth. No caption covers the action.

Known total charge: $0.3965. With the unresolved first request reserved, task exposure is $0.4505, below the $5 cap. No further paid requests planned. Final assembly uses the generated shot between merchant source photographs. Photo rights, intended placement and public-release review remain unresolved.
