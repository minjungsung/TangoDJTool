# Project instructions

## Delivery

- Work on `main` by default. The user authorizes committing and pushing validated routine fixes and DJ workflow improvements directly to `main`; a pull request is not required by default.
- Fetch the current remote state before writing. Preserve unrelated work and commit only task-owned files or changes. Never force-push or discard another session's work.
- Reproduce meaningful defects before fixing them and run checks appropriate to the change. Report actual outcomes and remaining limitations.

## Continuing DJ quality review

- Prioritize uninterrupted live playback, safe headphone preview, reliable local-file access, tanda/cortina pacing, repeat detection and recoverable preparation edits.
- Maintain `docs/dj-roadmap.md` as the development checklist, with stable item identifiers, priorities, acceptance criteria and verification evidence. Check and cross out an item only after its stated criteria are met.
- Run `npm run roadmap` after updating the checklist to regenerate `docs/dj-roadmap.html`. Keep implementation completion separate from physical venue, hardware and endurance validation.
- Audit existing behavior as well as the backlog. Add newly confirmed defects or useful missing capabilities with concrete evidence, and select focused improvements rather than inventing work.
- Write repository documents and reusable artifacts in English. Keep personal workstation paths and identifiers out of them.
