# CLAUDE.md

Project-specific instructions for working in the BuildClub repo.

## Before you start

- Read `PROJECT_CONTEXT.md` before doing any work. It is the source of truth for what BuildClub is and where it stands.

## Where things go

| Content | Location |
| --- | --- |
| Research (competitors, user research, market notes) | `research/` |
| Product decisions and documentation (PRD, scope, decision log) | `docs/` |
| Application code | `app/` |

- Avoid creating files in the repo root. Only add a root-level file when it is truly project-wide (e.g. config that tools expect at the root).
- Prefer adding to an existing file over creating a new one when the content fits.

## Editing existing content

- Preserve useful existing content. Revise or extend rather than overwrite or delete.
- Before changing a major product decision (for example in `docs/PRD.md`, `docs/mvp-scope.md`, or `docs/decision-log.md`), flag any contradictions with existing docs or `PROJECT_CONTEXT.md` and confirm with me first.

## Research standards

- Use current sources, and note the date accessed or published.
- Cite sources for every research claim (link plus title or publisher).
- Call out when information may be outdated or unverified.

## Git

- Do not commit or push unless I explicitly ask.
- Before any commit, show `git status` and summarize the changes.
