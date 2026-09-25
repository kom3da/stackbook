// Compact markdown views for AI agents: same facts as the HTML pages, no markup overhead
import YAML from 'yaml';
import { GROUPS, guide, h3Text, plain, rawSub, SECS, stripNo, subBlocks } from './guide';
import { LOOKUP } from './lookup';
import { type Data, HEADS, isDataKind, parseData } from './schema';
import { type ChoiceRow, category, dictionary, namesOf, type Tool } from './tools';
import { DEFAULTS, type Decision, decide, KINDS, type Kind, questionsFor, resolve } from './wizard';

const where = (r: ChoiceRow) => (r.sub ? `§${r.sub.id}` : `§${r.sec.id}`);
const altText = (a: ChoiceRow['alts'][number]) =>
  `${a.name ?? namesOf(a.tools).join('＋')}${a.when ? `：${a.when}` : ''}`;

// Data blocks back to plain markdown tables (compact for agents)
const row = (cells: (string | undefined)[]) => `| ${cells.map((c) => c || '—').join(' | ')} |`;
function dataMd(d: Data): string {
  const h = d.head ?? HEADS[d.kind];
  const table = (head: string[], rows: (string | undefined)[][]) =>
    [row(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(row)].join('\n');
  switch (d.kind) {
    case 'choices':
      return table(
        h,
        d.rows.map((r) =>
          [r.role, r.default, [...r.alts.map(altText), r.note].filter(Boolean).join('。')].slice(0, h.length),
        ),
      );
    case 'uses':
      return table(
        h,
        d.rows.map((r) => [r.situation, r.pick, r.next, r.example, r.reason].slice(0, h.length)),
      );
    case 'stack':
      return table(
        h,
        d.rows.map((r) => [r.layer, r.pick]),
      );
    case 'rationale':
      return table(
        h,
        d.rows.map((r) => [r.name, r.why, r.concern]),
      );
    case 'growth':
      return table(
        h,
        d.rows.map((r) => [r.from, r.to, r.trigger, r.prepare]),
      );
    case 'cost':
      return table(
        h,
        d.rows.map((r) => [r.service, r.axis, r.grows, r.action]),
      );
    case 'prof':
      return table(
        h.slice(0, 2),
        d.rows.map((r) => [r.name, r.kind]),
      );
  }
}
/** Raw guide markdown with YAML data blocks rendered as tables */
export const toMarkdown = (raw: string) =>
  raw.replace(/^```(\w+)\n([\s\S]*?)^```$/gm, (m, kind: string, body: string) =>
    isDataKind(kind) ? dataMd(parseData(kind, YAML.parse(body))) : m,
  );

export function toolMd(t: Tool) {
  const out = [`# ${t.name}`, '', `分類：${category(t)}`];
  if (t.lang) out.push('', `言語別の既定：§${t.lang.ref}（/s/2.md）`, t.lang.lead && plain(t.lang.lead));
  if (t.uses.length)
    out.push(
      '',
      '## 選ぶ場面（§2-10）',
      ...t.uses.map((u) => `- ${plain(u.situation)}${u.reason ? `：${plain(u.reason)}` : ''}`),
    );
  if (t.def.length) {
    out.push('', '## 既定として使う役割');
    for (const r of t.def) {
      out.push(`- ${plain(r.role)}（${where(r)}）：${plain(r.default)}`);
      for (const a of r.alts) out.push(`  - 代替 ${plain(altText(a))}`);
      if (r.note) out.push(`  - ${plain(r.note)}`);
    }
  }
  if (t.alt.length) {
    out.push('', '## 代替として使う条件');
    for (const { row: r, alt } of t.alt)
      out.push(`- ${plain(r.role)}（${where(r)}、既定は${plain(r.default)}）${alt.when ? `：${plain(alt.when)}` : ''}`);
  }
  for (const e of t.why)
    out.push(
      '',
      `## 採用の根拠（§${SECS.whyTools}）`,
      plain(e.why),
      e.concern ? `懸念と回答：${plain(e.concern)}` : '',
    );
  for (const e of t.cost)
    out.push(
      '',
      `## 費用の注意（§${SECS.cost}）`,
      `- ${HEADS.cost[1]}：${plain(e.axis)}`,
      `- ${HEADS.cost[2]}：${plain(e.grows)}`,
      `- ${HEADS.cost[3]}：${plain(e.action)}`,
    );
  for (const e of t.growth)
    out.push(
      '',
      `## 成長したときの移行（§${SECS.growth}）→ ${plain(e.to)}`,
      `- きっかけ：${plain(e.trigger)}`,
      `- 最初からの備え：${plain(e.prepare)}`,
    );
  if (t.stacks.length)
    out.push(
      '',
      '## ケース別の構成（§19）',
      ...t.stacks.map((x) => `- ${x.sub ? stripNo(plain(x.sub.text)) : ''}：${plain(x.layer)}＝${plain(x.pick)}`),
    );
  return `${out
    .filter((l) => l !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')}\n`;
}

export const dictMd = () =>
  [
    '# 辞書（言語・ライブラリ・サービス）',
    '',
    '各項目の詳細は /dict/<slug>.md。',
    '',
    ...dictionary().map((t) => {
      const roles = [...new Set(t.def.map((r) => plain(r.role)))].slice(0, 3);
      const alts = [...new Set(t.alt.map((a) => plain(a.row.role)))].slice(0, 2);
      const s = t.lang
        ? `言語（§${t.lang.ref}）`
        : roles.length
          ? `既定：${roles.join('、')}`
          : alts.length
            ? `代替：${alts.join('、')}`
            : category(t);
      return `- [${t.name}](/dict/${t.slug}.md) — ${s}`;
    }),
    '',
  ].join('\n');

// Absolute URLs in llms.txt so agents can fetch links directly
const abs = (path: string) => (import.meta.env.SITE ?? '').replace(/\/$/, '') + path;

// Context an agent needs before trusting any recommendation
const PREAMBLE = () =>
  [
    `> ${guide.meta.join('。')}。個人の既定であり、プロジェクト固有の要件・既存資産・チームの制約と食い違う場合はそちらを優先する。`,
    '> バージョン番号は書いていない。採用時は各ツールの最新安定版を確認して使う。料金も記載していないので、各サービスの最新の料金ページで確認する。',
  ].join('\n');

const tablesMd = (d: Decision) =>
  d.tables.flatMap((t) => [
    '',
    `### ${t.title ?? '構成'}${t.base ? `（§${t.base} をもとに${t.edits.length ? '条件に合わせて差し替え' : '作成'}）` : ''}`,
    '| レイヤー | 採用 |',
    '|---|---|',
    ...resolve(t, LOOKUP).map((r) => `| ${r.layer} | ${r.text} |`),
  ]);

// For each single-condition change from the defaults, what changes (compactly)
function diffMd(kind: Kind, base: Decision) {
  const flat = (d: Decision) => new Map(d.tables.flatMap((t) => resolve(t, LOOKUP)).map((r) => [r.layer, r.text]));
  const bases = (d: Decision) => d.tables.map((t) => t.base ?? '').join();
  const before = flat(base);
  const out: string[] = [];
  for (const q of questionsFor(kind))
    for (const [v, label] of q.opts) {
      if (!q.multi && DEFAULTS[q.q] === v) continue;
      const d = decide(kind, { ...DEFAULTS, ...(q.multi ? { cons: [v] } : { [q.q]: v }) });
      const after = flat(d);
      const changes = d.title !== base.title ? [`推奨が「${d.title}」になる`] : [];
      const other = d.tables.find((t) => t.base && !base.tables.some((b) => b.base === t.base))?.base;
      if (other) changes.push(`構成は §${other}（${stripNo(plain(h3Text(SECS.cases, other)))}）を使う`);
      else if (bases(d) !== bases(base))
        changes.push(`構成は言語別の既定から組み立てる：${[...after].map(([k, t]) => `${k}＝${plain(t)}`).join('、')}`);
      else changes.push(...[...after].filter(([k, t]) => before.get(k) !== t).map(([k, t]) => `${k}＝${plain(t)}`));
      if (changes.length) out.push(`- ${q.label}＝${label}：${changes.join('／')}`);
    }
  return out;
}

export function makeMd(kind: Kind) {
  const k = KINDS.find((x) => x[0] === kind);
  const d = decide(kind, DEFAULTS);
  const qs = questionsFor(kind);
  const def = (q: (typeof qs)[number]) => (q.multi ? 'なし' : (q.opts.find((o) => o[0] === DEFAULTS[q.q])?.[1] ?? ''));
  const diff = diffMd(kind, d);
  const out = [
    `# ${k?.[1]}：推奨構成`,
    '',
    PREAMBLE(),
    '',
    qs.length ? `前提（既定の条件）：${qs.map((q) => `${q.label}＝${def(q)}`).join('、')}` : '',
    qs.length ? '案件の条件が前提と違う場合は、下の「条件が違うとき」で該当する行を確認する。' : '',
    '',
    `## 推奨：${d.title}`,
    ...d.why.map((w) => `- ${w}`),
    ...d.notes.map((n) => `- ${n}`),
    '',
    '## 構成',
    ...tablesMd(d),
  ];
  if (diff.length) out.push('', '## 条件が違うとき（既定との差分）', ...diff);
  // §19 diagrams and notes (the stack table itself is already merged above)
  for (const c of d.cases) {
    const body = subBlocks(SECS.cases, c)
      .flatMap((b) => (b.t === 'mermaid' ? ['```mermaid', b.text, '```'] : b.t === 'p' ? [b.text] : []))
      .join('\n\n');
    if (body) out.push('', `## §${c} ${stripNo(plain(h3Text(SECS.cases, c)))}`, '', body);
  }
  const cmd = guide.sections
    .find((s) => s.id === SECS.commands)
    ?.blocks.find((b) => b.t === 'h3' && d.cases.some((c) => b.text.includes(`§${c}`)));
  if (cmd?.t === 'h3') out.push('', toMarkdown(rawSub(cmd.id)).replace(/^### (\d+-\d+)\. /, '## §$1 '));
  out.push(
    '',
    '## 次に読む',
    ...[...new Set(d.refs)].map((r) => {
      const [n, sub] = r.split('-');
      return `- §${r}: ${abs(`/s/${n}.md`)}${sub ? `（「### ${r}.」の節）` : ''}`;
    }),
  );
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

export function llmsTxt() {
  const sec = (id: string) => guide.sections.find((s) => s.id === id);
  const line = (id: string) => {
    const s = sec(id);
    return s ? `- [${s.num ? `§${s.num} ` : ''}${s.title}](${abs(`/s/${s.id}.md`)})` : '';
  };
  return [
    `# ${guide.title}`,
    '',
    '> 新規プロジェクトの技術スタックを決めるための個人用ガイド。各カテゴリの「既定」は1つだけで、代替には乗り換える条件が付いている。',
    '',
    PREAMBLE(),
    '',
    '読み方：作るものが決まっていれば、まず該当する /make/<kind>.md だけを読む（推奨構成・根拠・構成図・雛形コマンドが1ファイルにまとまっている）。個別の判断が必要になったら該当セクションの .md を読む。全文（/guide.md）は大きいので、必要なときだけ読む。',
    '',
    '## 作るもの別の推奨構成',
    ...KINDS.map(([k, n, d]) => `- [${n}](${abs(`/make/${k}.md`)}): ${d}`),
    '',
    '## 分野別の既定と乗り換え条件',
    ...GROUPS.tools.map(line),
    '',
    '## 考え方',
    ...GROUPS.read.map(line),
    '',
    '## 準備',
    ...GROUPS.kit.filter((id) => id !== 'memo').map(line),
    '',
    '## 辞書',
    `- [言語・ライブラリの索引](${abs('/dict.md')}): 名前から、既定・代替・根拠・費用を引く`,
    '',
    '## Optional',
    `- [全文](${abs('/guide.md')}): ガイド全体のMarkdown`,
    '',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}
