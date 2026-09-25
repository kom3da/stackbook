---
name: visual-check
description: Screenshot the built site at 360/390 (WebKit) and 768/1280 (Chromium) and audit it with read-only subagents. Use after any change to layout, CSS, components or page scripts, before reporting the work as done.
---

1. `pnpm build && pnpm shots [filter]` — the filter matches page and action names in `scripts/shots.mjs` (e.g. `make`, `s19`, `compare`). Shots land in `.shots/<width>/`; `SHOTS_DIR=…` writes elsewhere.
2. Do not read many screenshots yourself: a conversation that has read dozens of images gets its later images rejected. Read at most a handful to spot-check.
3. For a real audit, launch `visual-auditor` subagents in parallel, one per slice (e.g. 390 make pages + actions, 390 chapters, 360 all, 768 all, 1280 all). In each prompt, give the file names, the owner's design rules and what changed, and ask for defects ranked by severity with file and selector.
4. Keep a checklist of every finding. Fix each one, or report it as not fixed with the reason — never drop minor ones silently.
5. After fixing, re-shoot only what changed and have a subagent verify each claim PASS/FAIL.
6. Delete `.shots/` when done if it is no longer needed.
