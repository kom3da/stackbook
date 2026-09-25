// Build-time rendering of guide blocks and tool details into HTML strings
import { type Block, plain, SECS, type Section, stripNo } from './guide';
import { esc, inline, linkNames, secHref } from './html';
import { HEADS } from './schema';
import { type ChoiceRow, namesOf, slugOfName, type Tool } from './tools';

/** Inline markdown with the given tools linked to their dictionary pages */
export const link = (text: string, ids: string[]) => linkNames(inline(text), namesOf(ids), slugOfName);

const LEVELS = ['', '未経験', '検証済み', '実務'];
export const profSelect = (key: string) =>
  `<select class="prof" data-tool="${esc(key)}" aria-label="${esc(key)}の習熟度">${LEVELS.map((l) => `<option value="${l}">${l || '—'}</option>`).join('')}</select>`;

const altName = (a: ChoiceRow['alts'][number]) => a.name ?? namesOf(a.tools).join('＋');
const alts = (list: ChoiceRow['alts']) =>
  list.length
    ? `<ul class="alts">${list.map((a) => `<li><span class="alt-n">${link(altName(a), a.tools)}</span>${a.when ? `<span class="alt-c">${inline(a.when)}</span>` : ''}</li>`).join('')}</ul>`
    : '';

const kv = (pairs: [string, string | undefined][], cls = 'kv') =>
  `<dl class="${cls}">${pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`)
    .join('')}</dl>`;
const rec = (title: string, fields: [string | undefined, string | undefined][]) =>
  `<article class="rec"><h4>${title}</h4>${fields
    .map(([k, v]) => (v ? `<p><span class="rec-k">${esc(k ?? '')}</span>${v}</p>` : ''))
    .join('')}</article>`;

function data(b: Extract<Block, { t: 'data' }>) {
  const d = b.d;
  const h = d.head ?? HEADS[d.kind];
  switch (d.kind) {
    case 'choices':
      return `<div class="choices">${d.rows
        .map(
          (r) => `<div class="ch"><div class="ch-role">${inline(r.role)}</div><div class="ch-main">
<div class="ch-pick">${link(r.default, r.tools)}</div>${alts(r.alts)}${r.note ? `<p class="ch-note">${inline(r.note)}</p>` : ''}</div></div>`,
        )
        .join('')}</div>`;
    case 'stack':
      return kv(d.rows.map((r) => [plain(r.layer), link(r.pick, r.tools)]));
    case 'prof':
      return `<div class="prof-list">${d.rows.map((r) => `<label class="pl"><span class="pl-n">${esc(r.name)}</span><span class="pl-k">${inline(r.kind)}</span>${profSelect(r.name)}</label>`).join('')}</div>`;
    case 'uses':
      return `<div class="recs">${d.rows
        .map((r) =>
          rec(inline(r.situation), [
            [h[1], link(r.pick, r.tools)],
            [h[2], r.next && inline(r.next)],
            [h[3], r.example && inline(r.example)],
            [h[4], r.reason && inline(r.reason)],
          ]),
        )
        .join('')}</div>`;
    case 'rationale':
      return `<div class="recs">${d.rows
        .map((r) =>
          rec(link(r.name, r.tools), [
            [h[1], inline(r.why)],
            [h[2], r.concern && inline(r.concern)],
          ]),
        )
        .join('')}</div>`;
    case 'growth':
      return `<div class="recs">${d.rows
        .map((r) =>
          rec(`${link(r.from, r.tools)} → ${link(r.to, r.to_tools)}`, [
            [h[2], inline(r.trigger)],
            [h[3], inline(r.prepare)],
          ]),
        )
        .join('')}</div>`;
    case 'cost':
      return `<div class="recs">${d.rows
        .map((r) =>
          rec(link(r.service, r.tools), [
            [h[1], inline(r.axis)],
            [h[2], r.grows === '—' ? undefined : inline(r.grows)],
            [h[3], inline(r.action)],
          ]),
        )
        .join('')}</div>`;
  }
}

function table(b: Extract<Block, { t: 'table' }>) {
  const cell = (c: string) => (c && c !== '—' ? inline(c) : '<span class="none">—</span>');
  const long = b.rows.some((r) => r.some((c) => c.length > 34));
  if (b.head.length <= 2 && !long) return kv(b.rows.map((r) => [plain(r[0]), cell(r[1] ?? '')]));
  if (!long)
    return `<div class="tw"><table><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
      .map((r) => `<tr>${r.map((c, k) => `<td data-label="${esc(b.head[k] ?? '')}">${cell(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>`;
  return `<div class="recs">${b.rows
    .map((r) =>
      rec(
        inline(r[0]),
        r.slice(1).map((c, k) => [b.head[k + 1], c && c !== '—' ? inline(c) : undefined]),
      ),
    )
    .join('')}</div>`;
}

// Stable key for a checklist item, so saved state survives reordering (FNV-1a)
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
};

export function blocks(list: Block[], sec: Section) {
  return list
    .map((b) => {
      switch (b.t) {
        case 'h3':
          return `<h3 id="${esc(b.id)}">${inline(b.text)}</h3>`;
        case 'h4':
          return `<h4>${inline(b.text)}</h4>`;
        case 'p':
          return `<p>${inline(b.text)}</p>`;
        case 'ul':
          return `<ul>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`;
        case 'ol':
          return `<ol>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`;
        case 'check':
          return `<ul class="check">${b.items.map((t) => `<li><label><input type="checkbox" data-ck="${sec.id}:${hash(t)}"><span>${inline(t)}</span></label></li>`).join('')}</ul>`;
        case 'code':
          return `<div class="code"><button type="button" class="copy">コピー</button><pre><code>${esc(b.text)}</code></pre></div>`;
        case 'mermaid':
          return `<figure class="diagram"><pre class="mermaid">${esc(b.text)}</pre></figure>`;
        case 'table':
          return table(b);
        default:
          return data(b);
      }
    })
    .join('\n');
}

const where = (r: ChoiceRow) =>
  `<a class="ref" href="${secHref(r.sec.id, r.sub?.id)}">${esc(r.sub ? stripNo(plain(r.sub.text)) : r.sec.title)}</a>`;
const head = (label: string, right = '') =>
  `<p class="tb-h"><span>${label}</span>${right ? `<span class="tb-w">${right}</span>` : ''}</p>`;
const ref = (id: string, sub?: string) => `<a class="ref" href="${secHref(id, sub)}">§${sub ?? id}</a>`;

// Everything the guide says about one tool, grouped by purpose
export function toolBody(t: Tool) {
  let h = '';
  if (t.lang)
    h += `<div class="tb">${head('言語別の既定セット', ref('2', t.lang.ref))}${t.lang.lead ? `<p>${inline(t.lang.lead)}</p>` : ''}</div>`;
  if (t.uses.length)
    h += `<div class="tb">${head('選ぶ場面', ref('2', '2-10'))}<ul class="uses">${t.uses.map((u) => `<li><strong>${inline(u.situation)}</strong>${u.reason ? `<span>${inline(u.reason)}</span>` : ''}</li>`).join('')}</ul></div>`;
  for (const r of t.def) {
    h += `<div class="tb">${head(`既定：${inline(r.role)}`, where(r))}`;
    if (r.alts.length) h += `<p class="tb-k">乗り換える条件</p>${alts(r.alts)}`;
    if (r.note) h += `<p class="ch-note">${inline(r.note)}</p>`;
    h += '</div>';
  }
  for (const { row, alt } of t.alt)
    h += `<div class="tb">${head(`代替：${inline(row.role)}`, where(row))}<p>既定は ${link(row.default, row.tools)}${alt.when ? `。<strong>${inline(alt.when)}</strong> に切り替える` : ''}。</p></div>`;
  for (const e of t.why)
    h += `<div class="tb">${head('採用の根拠', ref(SECS.why, SECS.whyTools))}<p>${inline(e.why)}</p>${e.concern ? `<p class="qa">${inline(e.concern)}</p>` : ''}</div>`;
  for (const e of t.cost)
    h += `<div class="tb">${head('費用の注意', ref(SECS.cost))}${kv(
      [
        [HEADS.cost[1], inline(e.axis)],
        [HEADS.cost[2], e.grows === '—' ? undefined : inline(e.grows)],
        [HEADS.cost[3], inline(e.action)],
      ],
      'kv sm',
    )}</div>`;
  for (const e of t.growth)
    h += `<div class="tb">${head(`育ったら → ${link(e.to, e.to_tools)}`, ref(SECS.growth))}${kv(
      [
        ['きっかけ', inline(e.trigger)],
        ['最初からの備え', inline(e.prepare)],
      ],
      'kv sm',
    )}</div>`;
  if (t.stacks.length)
    h += `<div class="tb">${head('ケース別の構成', ref('19'))}<ul class="uses">${t.stacks.map((s) => `<li><strong>${esc(s.sub ? stripNo(plain(s.sub.text)) : '')}</strong><span>${inline(s.layer)}：${inline(s.pick)}</span></li>`).join('')}</ul></div>`;
  for (const e of t.prof) h += `<div class="tb tb-prof">${head('習熟度')}${profSelect(e.name)}</div>`;
  return h;
}
