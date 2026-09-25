---
name: add-kind
description: Add a new kind to the make page (作るもの) end to end — §19 case, §26 commands, wizard, tools, tests and a visual check. Use when an Issue asks to add a 作るもの.
---

Add the kind named in the argument (or the Issue given). Work in this order and follow CLAUDE.md's content rules throughout.

1. Read the Issue (`gh issue view N -R kom3da/stackbook` with `GH_TOKEN="$(gh auth token --user kom3da)"`) and its 「決めること」. Confirm each default and alternative with primary sources (official docs) — never from memory. No version numbers or prices.
2. Content:
   - Add the case to `content/guide/19.md` as the next `### 19-N.` with `確認：YYYY年M月`, a `stack` block, a mermaid diagram and what to decide first.
   - If a field chapter (§1–18) lacks a role the kind needs, add it to that chapter's `choices`.
   - Add starter commands to `content/guide/26.md` with `（§19-N）` in the heading. Verify each command against the tool's docs.
   - Register new tools in `content/tools.yaml` with `ops` (code / self / managed) and the official URL.
3. Logic: add the kind to `KINDS` and `KIND_GROUPS` in `src/lib/wizard.ts` and its decision spec. Only show conditions that change the answer. Pick `cases` (diagram) and `commands` so they never contradict the recommended language.
4. Run `pnpm diagrams`, then `pnpm exec biome ci . && pnpm exec astro check && pnpm test && pnpm build`.
5. Run `/visual-check` for the new `make-<kind>` page (add it to `PAGES` in `scripts/shots.mjs` if it should stay in the regular set).
6. Commit with `feat:` and `Fixes #N`. Report what was verified and against which sources.
