---
name: generate-product-video
description: Research current video models and create product videos from reference photos for private experiments, organic social posts, paid ads, or shop pages such as Relaxdays.
---

# Generate product video

Use actual product references to plan, generate and inspect footage, then assemble a channel-specific export. Research alone does not request generation or publication.

For a frozen product-video request, read its `request.json` and the ordered context snapshot recorded there. Load [common execution](references/common.md), the single selected [family guide](references/workflows/direct.md) (or the corresponding skit, drama or reference-remake guide), and only the recipe files named in that snapshot. The catalog at `references/configuration/catalog.json` supports configuration and path resolution; its metadata is not a production prompt. The same normalized request is used by agent and browser. Execute the selected plan from the frozen inputs, using the local product-video Python utilities when available; do not silently replace an unsupported provider operation with another route. A plan action can stop before paid submission. A generate action still requires its explicit budget and provider checks.

For research or older project work without a frozen request, read [generation](references/generation.md) for model research, reference preparation and clip production. Load only the requested destination guide:

- [Private experiment](references/private.md): assess generation quality without a public release.
- [Organic social](references/organic.md): posts on a channel, including commercial or sponsored posts.
- [Paid advertising](references/paid.md): campaign creative, including boosted posts.
- [Shop and brand pages](references/shop.md): Relaxdays or another merchant's product pages and owned channels.

Before paid generation, read [lessons](references/lessons.md), [model recommendations](references/model-recommendations.md) and any existing reviews under the assigned project's reviews/ folder. Use the recorded outcome and user feedback to decide what the next attempt should change. Reassess the recommendations when their review date is over 30 days old; verify the chosen route and exact price again before each paid request.
For deeper workflow research, use [workflow resources](references/workflow-resources.md). Refresh their availability and terms before adopting code or services.

If several destinations are requested, prepare a shared footage plan and separate release requirements. Do not assume one destination's eligibility applies elsewhere. Preserve the selected product and merchant.

In this repository, read README.md and relevant ADRs. Keep product research, prompts, sources and settings in projects/<id>/; media, job receipts and exports follow its ignored folder boundaries. Shared renderer work needs its own scope. Use create-short only for its supported review and rendering capabilities; it currently handles still-image episodes.

Save dated model findings in the project, rather than treating a model name in this skill as permanently current. Report the recommendation, evidence, estimated spend, next production step and unresolved release requirements.
