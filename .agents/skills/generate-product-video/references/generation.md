# Research and generation

Research recent releases and hands-on posts within the user's requested period. Verify model IDs, input controls, availability, costs and commercial terms against current provider documentation. Distinguish publication dates from crawl dates. Vendor rankings and affiliate comparisons are leads, not proof of product fidelity. Save links, retrieval date, limitations and the reason for the recommendation in the project.

Gather source material before proposing scenes. Use the user's files and links, then web sources when useful. Load the description, specifications and gallery images, plus product videos when available. Check visible galleries, video players, embedded hosts and linked media; distinguish product footage from unrelated recommendations. Download accessible originals into project media and save source records with URLs, retrieval dates, local paths, creator and permission basis. Note unavailable assets rather than claiming completeness. Do not bypass access restrictions.

Open product-detail/specification tabs and inspect dimension diagrams; visible descriptions and structured product data may omit measurements. Capture each component's dimensions, units, source axis order, approximate qualifiers, quantity, material, color, weight and excluded accessories in a local product-facts.json with source and retrieval date. Keep packaging dimensions separate from product dimensions. Mark missing or conflicting facts instead of guessing. Use [physical fidelity](physical-fidelity.md) when preparing references, prompts and inspection criteria.

Separate discovered assets from selected production inputs. Record user exclusions and do not download, reuse or condition generation on excluded assets. When an existing video is rejected, create fresh footage from the selected photos and description.

Inspect the selected images and play selected videos, using representative frames to compare angles and mechanisms when helpful. Existing footage may supply a more accurate demonstration or a motion reference than fresh generation when the user wants it. Save the product description and verified facts with the sources. Record SKU, visual identity and price date. Match the real mechanism; do not invent a feature from a generic product name. A merchant page is not permission to reuse its images or videos in an advertisement.

Choose between two routes:

- Animate an existing photo directly when its composition already suits the shot.
- Edit or composite product references into a scene, approve that still, then animate it. Keep the original reference beside the result during inspection.

Image-to-video uses a starting frame; reference-to-video uses additional images to guide identity. Check that the specific endpoint can combine them. Prepare the intended aspect ratio before generation when the model derives its canvas from the input.

Start with one short shot and one action. Camera motion is an easier fidelity test than hands manipulating a mechanism. Preserve geometry, materials, accessory counts and markings; inspect the whole clip for drift. Reject invented parts, impossible contact, substituted colors and unsupported product behavior. Prompts improve control but do not guarantee accuracy. Use real footage or compositing for essential actions that generation cannot reproduce.

Keep exact captions, prices, brand marks and calls to action in the edit. Add narration and licensed music separately when pronunciation, timing or usage rights matter. Do not present synthetic performers as real customer testimonials.

Before paid requests, confirm existing authorization and a spending ceiling. Follow ADR 0004 for OpenRouter. For video providers, estimate by generated duration, resolution, references and attempts. Submit once, save the job ID and recover that job after an interrupted wait; do not submit a duplicate or retry failed jobs automatically. Keep API keys server-side and out of logs.

State the intended creative improvement before spending: the hook, visible action and why generated motion is useful. Check the starting image against that purpose as well as product fidelity. A successful API response alone is not a successful advertisement. Follow [lessons](lessons.md) and keep a product-specific review under projects/<id>/reviews/ when a result fails or the user rejects it. Record the verdict, feedback, artifacts, costs, observed defects, inferred causes and changes needed for another attempt. Link the review from current project settings; preserve frozen exports and receipts.

Save a generation manifest with model/endpoint, date, prompt, parameters, input files and hashes, output file, job ID, estimated/reported cost and inspection result. Preserve raw output and assemble accepted clips into a numbered export. Use frame-based trims, inspect audio and safe areas, and record the release context and credits.

Check the repository's actual renderer before promising integration. If it accepts only stills, report the gap and plan separately scoped video-shot support or a local editing step. Do not silently substitute animated stills for requested generated footage.
