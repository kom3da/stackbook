// Compact markdown views for AI agents: same facts as the HTML pages, no markup overhead
import YAML from 'yaml';
import { GROUPS, guide, plain, rawSub, SECS, stripNo } from './guide';
import { type Data, HEADS, isDataKind, parseData } from './schema';
import { type ChoiceRow, category, dictionary, namesOf, type Tool } from './tools';
import { DEFAULTS, decide, KINDS, type Kind, QUESTIONS, SHOW } from './wizard';

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

export function makeMd(kind: Kind) {
  const k = KINDS.find((x) => x[0] === kind);
  const d = decide(kind, DEFAULTS);
  const qs = QUESTIONS.filter((q) => SHOW[q.q].includes(kind));
  const def = (q: (typeof QUESTIONS)[number]) =>
    q.multi ? 'なし' : (q.opts.find((o) => o[0] === DEFAULTS[q.q])?.[1] ?? '');
  const out = [
    `# ${k?.[1]}：推奨構成`,
    '',
    PREAMBLE(),
    '',
    qs.length ? `前提（既定の条件）：${qs.map((q) => `${q.label}＝${def(q)}`).join('、')}` : '',
    qs.length ? '条件が違う場合は §2-10（/s/2.md）の手順で言語を決め直す。' : '',
    '',
    `## 推奨：${d.title}`,
    ...d.why.map((w) => `- ${w}`),
    ...d.notes.map((n) => `- ${n}`),
    '',
    '## 構成',
    '| レイヤー | 採用 |',
    '|---|---|',
    ...d.rows.map((r) => `| ${r.layer} | ${r.text} |`),
  ];
  for (const c of d.cases) out.push('', toMarkdown(rawSub(c)).replace(/^### (\d+-\d+)\. /, '## §$1 '));
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
