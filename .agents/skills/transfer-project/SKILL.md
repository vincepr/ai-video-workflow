---
name: transfer-project
description: Export or import a video project's ignored media, work records and videos as a ZIP when moving between machines. Use for project handoffs, not Git synchronization.
---

# Transfer a project

This skill moves one project's ignored data. Git separately carries the workflow code and tracked project files. Run from the repository root after reading the project's `project.json`.

- Export: `python .agents/skills/transfer-project/scripts/project_bundle.py export . <project-id> <archive.zip>`
- Import: clone or update the repository and ensure `projects/<project-id>/project.json` exists, then run `python .agents/skills/transfer-project/scripts/project_bundle.py import . <archive.zip>`.

The ZIP contains `media/`, `work/` and `videos/` files for that project, plus a hash manifest. It does not contain tracked project files, shared code, `.env` or `credentials/`. Copy the ZIP separately from Git. Configure provider and publishing credentials on the destination machine.

Export refuses to replace an existing archive. Import validates every file and rejects the whole bundle if any destination file or path clashes. Inspect the reported clashes and resolve them deliberately; do not delete or overwrite existing project data automatically. Keep the ZIP outside the project folder during export and do not commit it.
