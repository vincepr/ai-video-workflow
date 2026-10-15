# 0018: Transfer ignored project data separately from Git

Status: Accepted
Date: 2026-10-15

## Decision

Keep each project's media, work records and numbered videos in ignored folders inside `projects/<id>/`. Git carries code and tracked project files. A single `transfer-project` skill exports those three ignored folders to a ZIP and imports them after the repository is available on another machine. Do not put the ZIP or its contents in Git.

The bundle lists relative paths, sizes and SHA-256 hashes. Import checks the manifest, validates every file and rejects path escapes or any existing destination path before writing. It never overwrites project data. Credentials remain outside the bundle and are configured on the destination machine. The same bundle format works regardless of which agent drives the workflow.

## Validation

Run `python -m unittest tests/test_project_bundle.py` and `npm run check`. Test a synthetic export/import, a repeated import clash and a path escape. Confirm the ZIP remains ignored by Git.
