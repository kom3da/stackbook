// Renders a wizard decision. Pure: runs at build time and in the browser when conditions change.
import { esc, inline, linkNames, toolHref } from './html';
import { tokens } from './text';
import type { Decision } from './wizard';

export type Card = { slug: string; name: string; html: string; prof: string[] };
export type MakePayload = {
  /** keyed by token as produced by tokens() */
  cards: Record<string, Card>;
  cases: Record<string, { title: string; href: string; html: string }>;
  /** Command blocks keyed by §19 case id; "" holds the common setup */
  cmds: Record<string, { title: string; html: string }>;
  refs: Record<string, { href: string; label: string }>;
  /** Proficiency section id */
  prof: string;
};

export function renderMake(d: Decision, p: MakePayload, prof: Record<string, string>) {
  const slugOf = (n: string) => p.cards[n]?.slug || undefined;
  const unknown = new Set<string>();
  const sheet = d.rows
    .map(([layer, val]) => {
      const toks = [...new Set(tokens(val))];
      const cards = toks.map((n) => p.cards[n]).filter(Boolean);
      const warn = [...new Set(cards.flatMap((c) => c.prof).filter((t) => prof[t] === '未経験'))];
      for (const w of warn) unknown.add(w);
      const head = `<span class="s-layer">${esc(layer)}</span><span class="s-val">${linkNames(inline(val), toks, slugOf)}${warn.map((t) => ` <span class="badge">未経験：${esc(t)}</span>`).join('')}</span>`;
      if (!cards.length) return `<div class="srow"><div class="s-head">${head}</div></div>`;
      return `<details class="srow"><summary class="s-head">${head}<span class="chev" aria-hidden="true"></span></summary><div class="s-more">${cards
        .map(
          (c) =>
            `<section class="tcard"><h3>${c.slug ? `<a href="${toolHref(c.slug)}">${esc(c.name)}</a>` : esc(c.name)}</h3>${c.html}</section>`,
        )
        .join('')}</div></details>`;
    })
    .join('');
  const cases = d.cases
    .map((c) => p.cases[c])
    .filter(Boolean)
    .map(
      (c) =>
        `<section class="blk"><h2 class="sh">構成図 <a class="ref" href="${c.href}">${esc(c.title)}</a></h2>${c.html}</section>`,
    )
    .join('');
  const cmds = ['', ...d.cases]
    .map((c) => p.cmds[c])
    .filter(Boolean)
    .map((c) => `<h3>${esc(c.title)}</h3>${c.html}`)
    .join('');
  const refs = [...new Set(d.refs)]
    .map((r) => p.refs[r])
    .filter(Boolean)
    .map((r) => `<a class="nx" href="${r.href}">${esc(r.label)}</a>`)
    .join('');
  return `<section class="answer">
<p class="eyebrow">推奨</p><p class="ans">${esc(d.title)}</p>
<ul class="why">${d.why.map((w) => `<li>${inline(w)}</li>`).join('')}</ul>
${d.notes.length ? `<ul class="why note">${d.notes.map((n) => `<li>${inline(n)}</li>`).join('')}</ul>` : ''}
</section>
<section class="blk"><h2 class="sh">構成<span class="sh-d">行を開くと、乗り換える条件・根拠・費用・習熟度</span></h2><div class="sheet">${sheet}</div>
${unknown.size ? `<p class="warn">未経験のツールが含まれる。検証期間を見積もりに入れる（<a class="ref" href="/s/${p.prof}/">§${p.prof}</a>）。</p>` : ''}</section>
${cases}
${cmds ? `<section class="blk"><h2 class="sh">作り始める</h2>${cmds}</section>` : ''}
<section class="blk"><h2 class="sh">次に読む</h2><div class="nxs">${refs}</div></section>`;
}
