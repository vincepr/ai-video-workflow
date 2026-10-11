# Working rules

- Read README.md for commands. Read only the ADRs relevant to the task.
- Keep changes small. Add dependencies only for a current requirement.
- Work in the assigned projects/<id>/ folder. Shared code and media need separate scope; see adr/0012-project-boundaries.md.
- Keep instructions concise and task specific. See adr/0001-context-and-writing.md.
- Use plain language in files and commits. Do not use em dashes or stock assistant phrasing.
- Edit episode data before changing the renderer. Keep animation frame based.
- Run `npm run check`. Render and inspect a sample when visuals change.
- Record important decisions in adr/ with a validation method.
- Keep credentials, source media and rendered output out of Git.
- Store reusable media in media/ with matching .attribution.json files. See adr/0010-music-and-upload-credits.md.
- Commit completed changes and push to origin/main.
- Use OpenRouter sparingly. Follow adr/0004-api-costs.md before making requests.
- Publishing and adding other paid services require an explicit request.
