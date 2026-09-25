---
name: review-chapter
description: Re-verify one guide chapter against primary sources and update its 確認 month. Use when a chapter is stale (12 months since 確認) or an Issue labelled 見直し names it.
---

For the chapter given (e.g. `22` or `§22`):

1. Read `content/guide/NN.md`. List every factual claim: defaults, alternatives and their 乗り換える条件, tool status (maintained, renamed, discontinued), commands, and statistics with their source.
2. Check each claim against primary sources (official docs, release notes, the cited report) with web search. Note the URL for each.
3. Edit what changed. Keep CLAUDE.md's content rules (one default per category, no version numbers or prices, である調, 目安 marked as 目安). If a tool is replaced, move it to §20 採用しないもの and fix every reference.
4. Update `確認：YYYY年M月` for each section and subsection you actually re-verified — only those.
5. `pnpm test && pnpm build`; if the chapter feeds the make page, run `/visual-check make`.
6. Commit with `docs:` (content only) and summarise what changed and what was confirmed unchanged, with sources.
