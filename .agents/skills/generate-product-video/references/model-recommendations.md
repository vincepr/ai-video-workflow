# Product-video model shortlist

Reviewed: 2026-10-15

This is the single agent-facing shortlist for product-video stages. Choose per task, not once for the whole ad. If this review is over 30 days old, compare current model releases, IDs, routes, supported inputs and prices, then update the date and priorities. Even when it is recent, check live provider capability and the exact request cost before spending. A listed model is a candidate, not proof that its current route works or that it will preserve this product.

| Stage | Starting choice | When to change it |
| --- | --- | --- |
| Concept and shot planning | The current agent, with no extra provider call by default | Use a separate text model only when the task or host requires one, after checking its current cost and output needs. |
| Fast first-frame concept | [Seedream 5.0 Flash](https://openrouter.ai/bytedance-seed/seedream-5-0-flash-20261001) | Move to [Seedream 5.0 Pro](https://openrouter.ai/bytedance-seed/seedream-5-0-pro) when product detail or editing control matters more than the lower per-image cost. Inspect the actual frame. |
| Low-cost motion concept | [Seedance 2.0 Mini](https://openrouter.ai/bytedance/seedance-2.0-mini) | Use only when a continuity defect is tolerable for a concept test. One reviewed transformation cost $0.61 for an eight-second 720p clip and moved supposedly stable objects. |
| Product-sensitive motion | Compare [Seedance 2.0](https://openrouter.ai/bytedance/seedance-2.0) and [Wan 3.0](https://openrouter.ai/alibaba/wan-3.0) against the shot's reference, end-frame, duration, audio and budget needs | Neither model is a guaranteed fidelity fix. Prefer the route whose required controls and estimated full cost are verified for this shot; inspect intermediate frames before accepting it. |
| Speech, lip sync or source-video edit | No default model | Verify a specific supported route and cost for the requested operation. Do not substitute ordinary image-to-video. |
| Captions, music mix and final encoding | Local FFmpeg tools | Use a model only if a distinct, authorized task requires it. |

At this review, the provider listed Flash from $0.018/image, Pro from $0.045/image, Mini from $0.03363/second, Seedance 2.0 from $0.06726/second and Wan 3.0 from $0.0425/second. These are starting prices, not quotes for a chosen resolution, audio mode or input set. Price and availability may change without this file changing. Record the actual model, route, dated estimate, reason, output quality and charged cost in the project run.
