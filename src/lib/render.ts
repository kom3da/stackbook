// Build-time rendering of guide blocks and tool details into HTML strings
import { type Block, plain, SECS, type Section, stripNo } from './guide';
import { esc, inline, linkNames, secHref } from './html';
import { type Alt, type ChoiceRow, norm, ROWS, same, TOOLS, type ToolInfo, tokens } from './tools';

export const slugOf = (name: string) =>
  (TOOLS.get(norm(name)) ?? [...TOOLS.values()].find((t) => same(t.name, name)))?.slug;
export const link = (html: string, names: string[]) => linkNames(html, names, slugOf);

const LEVELS = ['', '未経験', '検証済み', '実務'];
export const profSelect = (tool: string) =>
  `<select class="prof" data-tool="${esc(tool)}" aria-label="${esc(tool)}の習熟度">${LEVELS.map((l) => `<option value="${l}">${l || '—'}</option>`).join('')}</select>`;

const alts = (list: Alt[]) =>
  list.length
    ? `<ul class="alts">${list.map((a) => `<li><span class="alt-n">${link(inline(a.label), a.names)}</span>${a.cond ? `<span class="alt-c">${inline(a.cond)}</span>` : ''}</li>`).join('')}</ul>`
    : '';

function choices(b: Block) {
  const rows = ROWS.filter((r) => r.block === b);
  return `<div class="choices">${rows
    .map(
      (r) => `<div class="ch"><div class="ch-role">${inline(r.role)}</div><div class="ch-main">
<div class="ch-pick">${link(inline(r.def), r.names)}</div>${alts(r.alts)}${r.note ? `<p class="ch-note">${inline(r.note)}</p>` : ''}</div></div>`,
    )
    .join('')}</div>`;
}

function table(b: Extract<Block, { t: 'table' }>, sec: Section) {
  if (sec.id === SECS.prof && b.head.includes('習熟度'))
    return `<div class="prof-list">${b.rows.map((r) => `<label class="pl"><span class="pl-n">${inline(r[0])}</span><span class="pl-k">${inline(r[1] ?? '')}</span>${profSelect(r[0])}</label>`).join('')}</div>`;
  if (ROWS.some((r) => r.block === b)) return choices(b);
  const cell = (c: string) => (c && c !== '—' ? link(inline(c), tokens(c)) : '<span class="none">—</span>');
  const long = b.rows.some((r) => r.some((c) => c.length > 34));
  if (b.head.length <= 2 && !long)
    return `<dl class="kv">${b.rows.map((r) => `<div><dt>${inline(r[0])}</dt><dd>${cell(r[1] ?? '')}</dd></div>`).join('')}</dl>`;
  if (!long)
    return `<div class="tw"><table><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
      .map((r) => `<tr>${r.map((c, k) => `<td data-label="${esc(b.head[k] ?? '')}">${cell(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>`;
  return `<div class="recs">${b.rows
    .map(
      (r) =>
        `<article class="rec"><h4>${inline(r[0])}</h4>${r
          .slice(1)
          .map((c, k) =>
            c && c !== '—' ? `<p><span class="rec-k">${inline(b.head[k + 1] ?? '')}</span>${inline(c)}</p>` : '',
          )
          .join('')}</article>`,
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
        default:
          return table(b, sec);
      }
    })
    .join('\n');
}

const where = (r: ChoiceRow) =>
  `<a class="ref" href="${secHref(r.sec.id, r.sub?.id)}">${esc(r.sub ? stripNo(plain(r.sub.text)) : r.sec.title)}</a>`;
const head = (label: string, right = '') =>
  `<p class="tb-h"><span>${label}</span>${right ? `<span class="tb-w">${right}</span>` : ''}</p>`;

// Everything the guide says about one tool, grouped by purpose
export function toolBody(i: ToolInfo) {
  let h = '';
  const t = i.t;
  if (t?.lang) {
    h += `<div class="tb">${head('言語別の既定セット', `<a class="ref" href="${secHref('2', t.lang.ref)}">§${t.lang.ref}</a>`)}${t.lang.lead ? `<p>${inline(t.lang.lead)}</p>` : ''}</div>`;
  }
  if (t?.uses.length) {
    h += `<div class="tb">${head('選ぶ場面', `<a class="ref" href="${secHref('2', '2-10')}">§2-10</a>`)}<ul class="uses">${t.uses.map((u) => `<li><strong>${inline(u.situation)}</strong>${u.detail ? `<span>${inline(u.detail)}</span>` : ''}</li>`).join('')}</ul></div>`;
  }
  for (const r of t?.def ?? []) {
    h += `<div class="tb">${head(`既定：${inline(r.role)}`, where(r))}`;
    if (r.alts.length) h += `<p class="tb-k">乗り換える条件</p>${alts(r.alts)}`;
    if (r.note) h += `<p class="ch-note">${inline(r.note)}</p>`;
    h += '</div>';
  }
  for (const { row, alt } of t?.alt ?? []) {
    h += `<div class="tb">${head(`代替：${inline(row.role)}`, where(row))}<p>既定は ${link(inline(row.def), row.names)}${alt.cond ? `。<strong>${inline(alt.cond)}</strong> に切り替える` : ''}。</p></div>`;
  }
  for (const e of i.why) {
    h += `<div class="tb">${head('採用の根拠', `<a class="ref" href="${secHref(SECS.why, SECS.whyTools)}">§${SECS.whyTools}</a>`)}<p>${inline(e.r[1])}</p>${e.r[2] ? `<p class="qa">${inline(e.r[2])}</p>` : ''}</div>`;
  }
  for (const e of i.cost) {
    h += `<div class="tb">${head('費用の注意', `<a class="ref" href="${secHref(SECS.cost)}">§${SECS.cost}</a>`)}<dl class="kv sm">${e.head
      .slice(1)
      .map((k, j) =>
        e.r[j + 1] && e.r[j + 1] !== '—' ? `<div><dt>${esc(k)}</dt><dd>${inline(e.r[j + 1])}</dd></div>` : '',
      )
      .join('')}</dl></div>`;
  }
  for (const e of i.move) {
    h += `<div class="tb">${head(`育ったら → ${link(inline(e.r[1]), tokens(e.r[1]))}`, `<a class="ref" href="${secHref(SECS.growth)}">§${SECS.growth}</a>`)}<dl class="kv sm"><div><dt>きっかけ</dt><dd>${inline(e.r[2])}</dd></div><div><dt>最初からの備え</dt><dd>${inline(e.r[3])}</dd></div></dl></div>`;
  }
  for (const e of i.prof) h += `<div class="tb tb-prof">${head('習熟度')}${profSelect(e.r[0])}</div>`;
  return h;
}
