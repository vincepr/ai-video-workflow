# Physical fidelity

Read the project's product-facts.json before preparing scene images. Keep the source's dimension order and units; do not silently relabel height, width and depth as length or transpose axes when a component is posed differently. Preserve approximate measurements and distinguish per-piece dimensions from assembled or packaging dimensions.

Use a dimension diagram alongside clean product views. Translate facts into the relevant image prompt: actual size, relative component lengths, material, included quantities and recognizable markings. Choose a plausible scene scale anchor, such as a table of a stated width, and record its dimensions as a staging assumption rather than a product fact. Avoid mixing perspectives that make relative sizes ambiguous. Exact measurement graphics belong in the edit rather than generated footage.

Inspect the starting image for scale before video generation. Compare components on the same plane or account for perspective; use measured relative proportions rather than raw pixel sizes across different depths. Reject oversized, miniature or duplicated parts and material substitutions. If scale is uncertain, revise the composition or composite the source product into a scene with controlled scale.

Feed the approved starting frame and available product/scale references into the selected video endpoint. Repeat the important size relationships and material constraints in the motion prompt, then inspect the full clip for scale drift, changed geometry and inconsistent contact or weight behavior. Total weight describes the supplied bundle unless the source gives component weights; do not infer those weights or imply powered motion.

Numeric prompts and reference images improve guidance but do not enforce physical dimensions. Use calibrated compositing, a measured 3D model or real footage when exact scale must be demonstrated. Record what was checked and any remaining uncertainty with the generation result.
