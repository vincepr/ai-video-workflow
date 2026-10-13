# Product-video workflow resources

Reviewed 2026-10-13 after a rejected paid generation test. These are reading references, not installed dependencies or a permanent ranking. Inspect the linked code, current terms and provider support before reuse. Project-specific evaluations stay in projects/<id>/reviews/.

## Repositories

| Resource | Useful part | Limits |
| --- | --- | --- |
| [HiAPIAI product-video workflows](https://github.com/HiAPIAI/awesome-ai-video-workflows) | Product facts, shot-plan templates, reference auditing and media QC. Start with its [hero-to-video guide](https://github.com/HiAPIAI/awesome-ai-video-workflows/blob/main/workflows/03-hero-visual-to-product-video.md). | Small workflow library; examples do not guarantee product fidelity. Original content is MIT; linked projects have separate terms. |
| [sub-level marketing-videos](https://github.com/sub-level/marketing-videos) | [Process](https://github.com/sub-level/marketing-videos/blob/main/docs/process.md) assigns a suitable medium to each beat; stills precede generated motion and Remotion assembly. | MIT, small repo, mostly software examples. Adapt asset handling to this repository's ignored-media boundaries. |
| [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | Shot recipes, [MP4 clip composition](https://github.com/Vincentwei1021/video-shotcraft/blob/main/assets/lib/ClipCard.tsx) and [frame review](https://github.com/Vincentwei1021/video-shotcraft/blob/main/references/final-review.md). | Local motion design, not a physical-product video model. Code is Apache-2.0; audio has separate terms. |
| [Atlas Marketing Studio](https://github.com/AtlasCloudAI/atlas-marketing-studio) | [Workflow code](https://github.com/AtlasCloudAI/atlas-marketing-studio/blob/main/src/lib/marketing-studio/workflow.ts) separates ordered product, character and environment references and durable jobs. | Provider-specific app. README claims MIT, but no license file was found in this review; study architecture before considering reuse. |
| [remotion-product-video](https://github.com/rickthomasjr/remotion-product-video) | [HeroShot](https://github.com/rickthomasjr/remotion-product-video/blob/main/src/components/HeroShot.tsx) supplies a local camera-motion cost baseline. | MIT starter focused on apps/devices; cover crops need adaptation. |
| [Creatify video-ad-generator](https://github.com/creatify-ai/video-ad-generator) | [Brief and script skill](https://github.com/creatify-ai/video-ad-generator/blob/main/SKILL.md) offers hooks, before/after structure and CTA planning. | Older March 2026 provider-oriented instruction repo; do not copy automatic retry examples. |
| [Product Studio](https://github.com/lorena-bordonaba-pau/product-studio) | Local learnings and visible-product inventory. | July 2026 supporting source; correction loops and fidelity claims require scrutiny. |
| [Pixfizz imagery production](https://github.com/pixfizz/pixfizz-knowledge/blob/main/83_AI_IMAGERY_PRODUCTION.md) | Real product photography composited into generated environments. | July 2026 supporting source; no repository license detected in the review. |

Screened leads for later inspection: [AI-Video-Generation-Pipeline](https://github.com/alexander-t-ho/AI-Video-Generation-Pipeline) (older December 2025 activity, license unresolved), [remotion-ad-video-skill](https://github.com/leosssvip-dot/remotion-ad-video-skill), [OpenFrame AI](https://github.com/tapankumarpatro/openframe-ai), [open-ai-video-agent](https://github.com/SamurAIGPT/open-ai-video-agent), [Storyboard](https://github.com/crashtestoz/storyboard), and [OpenRouter video integration](https://github.com/rbb-dev/Open-WebUI-OpenRouter-pipe/blob/main/docs/openrouter_video_generation.md). These are candidates, not validated recommendations; distinguish code-based ad assembly from generated footage.

## Practical guides

- [Runway product-video pipeline](https://dev.runwayml.com/learn/generate-product-videos), September 23, 2026: product references, script beats, approved keyframes, persistent jobs and cost per accepted asset. Vendor tutorial, not independent evidence of ad performance.
- [Luma Scenes guide](https://lumalabs.ai/learning-center/articles/intro-to-luma-scenes), August 2, 2026: inspect the full storyboard and individual frames, timing and ending before rendering. Useful method without requiring Luma adoption.
- [Photoroom product-fidelity QA](https://www.photoroom.com/blog/automate-product-image-quality-assurance-at-scale), September 14, 2026: assess product accuracy separately from image attractiveness. Its specialized raters and benchmark should not be generalized to all product categories.
- [Runway motion prompting](https://academy.runwayml.com/guides/prompting-guide), current guide checked October 13, 2026, undated: the starting image supplies composition; the video prompt primarily specifies movement over time.
- [OpenRouter first/last frames](https://openrouter.ai/docs/cookbook/video-generation/image-to-video) and [reference-to-video](https://openrouter.ai/docs/cookbook/video-generation/reference-to-video), current docs checked October 13, 2026: exact frame anchors and identity/style references have different roles. Check route support rather than combining them indiscriminately.
- [Photoroom photo-to-video guide](https://www.photoroom.com/blog/turn-product-photos-into-videos-with-ai), September 3, 2026: source clarity and composition, useful references and framing space.
- [Google video generation](https://ai.google.dev/gemini-api/docs/veo), updated October 8, 2026, and [image editing](https://ai.google.dev/gemini-api/docs/image-generation), updated October 9, 2026: reference roles, targeted edits and temporal controls. Verify the exact provider route.
- [Luma layer editing](https://lumalabs.ai/learning-center/articles/editing-with-layers), July 13, 2026: independently controlled product, background, shadow and text.
- [Runway Product Ad recipe](https://docs.dev.runwayml.com/recipes/product-ad/): architectural reference for product/style inputs and versioned generation; not a request to add a paid service.
- [TikTok creative starter pack](https://ads.tiktok.com/business/library/AUNZ_Creative_Starter_Pack_TakeItToTikTok.pdf), 2026 edition: hook, benefit, sound and CTA; underlying studies are not all recent.
- [TikTok Symphony credits](https://ads.tiktok.com/resources/help/article/about-symphony-credits?lang=en), September 2026 update: investigate actual account availability before assuming credits. Localized pages disagree; access is unverified.
- [Reported intricate-product failures](https://discuss.ai.google.dev/t/edge-case-intricate-products-high-resolution-plain-white-background-blurred-partially-rendered-output-nano-banana/171932), June 2026 report with August follow-up: anecdotal failure evidence, not a measured model ranking.

Inspect the visual work too: [Shotcraft gallery](https://vincentwei1021.github.io/video-shotcraft/) for editing references and [sub-level's case studies](https://github.com/sub-level/marketing-videos/tree/main/docs/case-studies) for how completed films were constructed. Use them to study timing and composition; source rights remain separate from inspiration.

## Applying the research

Make a complete inexpensive ad draft before buying footage: hook, reveal/action, product proof and CTA, with temporary sound and captions. Record which beats need generated video and which use source imagery or code. Preserve the requested generated-video scope when choosing a hybrid approach.

Keep an unchanged product reference pack and give style images explicit separate roles. Approve the relevant starting and ending frames, including product bounds and scale, before asking the video model for one contained action. Treat count and measurement fidelity as inspection criteria, not promised capabilities.

Finish pacing, captions, branding and soundtrack locally, then reuse accepted footage for variants. Track total attempt cost, accepted shots/seconds and rejection reasons. None of these resources removes the need to inspect actual output.
