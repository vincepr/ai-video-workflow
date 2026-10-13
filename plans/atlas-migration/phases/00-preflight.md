# 00: Establish the baseline and migration workspace

## Read

[Runbook](../README.md), [source map](../source-map.md), repository README, AGENTS.md, ADRs 0001/0004/0012/0016. In the extraction, read README and source mapping before scripts. Consult using-git-worktrees if implementation needs isolation.

## Work

1. Record the actual target HEAD, branch, tracked/untracked status and upstream relationship. Other agents may have committed since this plan was written. Preserve their work; never clean/reset the workspace to make the baseline match an older hash.
2. Verify the pinned Atlas source and local extraction exist. Record source commit, script hashes, reuse basis and known hardcoded assumptions in local migration notes. Establish terms before copying upstream code or recipe text; implement behavior independently where needed.
3. Run npm run check on the baseline. Record results before changing production code. Use npm run files to inspect tracked boundaries.
4. Create an assigned generic project using npm run project -- create atlas-migration "Atlas migration verification" if it does not already exist. Reuse it if present. Store mutable progress and evidence under its ignored work/ folder.
5. Inventory the preferred local example from the private handoff or extraction's completed-run notes. Identify raw video, selected first frame, edit plan, final output, receipts and review. Hash them without changing their bytes. Keep this inventory local.
6. Note the existing renderer accepts stills and the T3 bridge targets an existing paired thread. No provider-capability or fresh-context assumption is verified merely by reading the design.

## Ownership

Orchestrator owns progress, source inventory and worktree/task assignments. No production feature change yet. Do not modify the Atlas checkout, existing product projects, credentials or upload records.

## Gate

Baseline checks are recorded; the source mapping is reproducible; local evidence is discoverable; the migration workspace is isolated. Existing failures are distinguished from newly introduced ones. Missing local sample assets may defer visual reproduction, but should not prevent contracts and synthetic offline verification.

## Handoff

Return baseline HEAD, actual source paths/commit, ignored progress path, prior test failures if any, artifact inventory location, and owned-file assignments for phase 01. Do not paste product prompts or source media into tracked notes.
