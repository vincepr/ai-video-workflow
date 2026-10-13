# Product-video workflow resources

Reviewed 2026-10-13 after a rejected paid generation test. These are reading references, not installed dependencies or a permanent ranking. Inspect the linked code, current terms and provider support before reuse. Project-specific evaluations stay in projects/<id>/reviews/.

## Repositories

| Resource | Useful part | Limits |
| --- | --- | --- |
| [HiAPIAI product-video workflows](https://github.com/HiAPIAI/awesome-ai-video-workflows) | Product facts, shot-plan templates, reference auditing and media QC. Start with its [hero-to-video guide](https://github.com/HiAPIAI/awesome-ai-video-workflows/blob/main/workflows/03-hero-visual-to-product-video.md). | Small workflow library; examples do not guarantee product fidelity. Original content is MIT; linked projects have separate terms. |
| [sub-level marketing-videos](https://github.com/sub-level/marketing-videos) | [Process](https://github.com/sub-level/marketing-videos/blob/main/docs/process.md) assigns a suitable medium to each beat; stills precede generated motion and Remotion assembly. | MIT, small repo, mostly software examples. Adapt asset handling to this repository's ignored-media boundaries. |
| [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | Shot recipes, [MP4 clip composition](https://github.com/Vincentwei1021/video-shotcraft/blob/main/assets/lib/ClipCard.tsx) and [frame review](https://github.com/Vincentwei1021/video-shotcraft/blob/main/references/final-review.md). | Local motion design, not a physical-product video model. Code is Apache-2.0; audio has separate terms. |
| [Atlas Marketing Studio](https://github.com/AtlasCloudAI/atlas-marketing-studio) | [Workflow code](https://github.com/AtlasCloudAI/atlas-marketing-studio/blob/main/src/lib/marketing-studio/workflow.ts) separates ordered product, character and environment references and durable jobs. | Provider-specific app. README claims MIT, but no license file was found in this review; study architecture before considering reuse. |

## Practical guides

- [Runway product-video pipeline](https://dev.runwayml.com/learn/generate-product-videos), September 23, 2026: product references, script beats, approved keyframes, persistent jobs and cost per accepted asset. Vendor tutorial, not independent evidence of ad performance.
- [Luma Scenes guide](https://lumalabs.ai/learning-center/articles/intro-to-luma-scenes), August 2, 2026: inspect the full storyboard and individual frames, timing and ending before rendering. Useful method without requiring Luma adoption.
- [Photoroom product-fidelity QA](https://www.photoroom.com/blog/automate-product-image-quality-assurance-at-scale), September 14, 2026: assess product accuracy separately from image attractiveness. Its specialized raters and benchmark should not be generalized to all product categories.
- [Runway motion prompting](https://academy.runwayml.com/guides/prompting-guide), current guide checked October 13, 2026, undated: the starting image supplies composition; the video prompt primarily specifies movement over time.
- [OpenRouter first/last frames](https://openrouter.ai/docs/cookbook/video-generation/image-to-video) and [reference-to-video](https://openrouter.ai/docs/cookbook/video-generation/reference-to-video), current docs checked October 13, 2026: exact frame anchors and identity/style references have different roles. Check route support rather than combining them indiscriminately.

## Applying the research

Make a complete inexpensive ad draft before buying footage: hook, reveal/action, product proof and CTA, with temporary sound and captions. Record which beats need generated video and which use source imagery or code. Preserve the requested generated-video scope when choosing a hybrid approach.

Keep an unchanged product reference pack and give style images explicit separate roles. Approve the relevant starting and ending frames, including product bounds and scale, before asking the video model for one contained action. Treat count and measurement fidelity as inspection criteria, not promised capabilities.

Finish pacing, captions, branding and soundtrack locally, then reuse accepted footage for variants. Track total attempt cost, accepted shots/seconds and rejection reasons. None of these resources removes the need to inspect actual output.
