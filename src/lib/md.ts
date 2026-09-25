// Compact markdown views for AI agents: same facts as the HTML pages, no markup overhead
import { GROUPS, guide, plain, rawSub, SECS } from './guide';
import { type ChoiceRow, category, dictionary, type Tool, toolInfo } from './tools';
import { DEFAULTS, decide, KINDS, type Kind, QUESTIONS, SHOW } from './wizard';

const where = (r: ChoiceRow) => (r.sub ? `§${r.sub.id}` : `§${r.sec.id}`);

export function toolMd(t: Tool) {
  const i = toolInfo(t.name);
  const out = [`# ${t.name}`, '', `分類：${category(t)}`];
  if (t.lang) out.push('', `言語別の既定セット：§${t.lang.ref}（/s/2.md）`, t.lang.lead && plain(t.lang.lead));
  if (t.uses.length)
    out.push(
      '',
      '## 選ぶ場面（§2-10）',
      ...t.uses.map((u) => `- ${plain(u.situation)}${u.detail ? `：${plain(u.detail)}` : ''}`),
    );
  if (t.def.length) {
    out.push('', '## 既定として使う役割');
    for (const r of t.def) {
      out.push(`- ${plain(r.role)}（${where(r)}）：${plain(r.def)}`);
      for (const a of r.alts) out.push(`  - 代替 ${plain(a.label)}${a.cond ? `：${plain(a.cond)}` : ''}`);
      if (r.note) out.push(`  - ${plain(r.note)}`);
    }
  }
  if (t.alt.length) {
    out.push('', '## 代替として使う条件');
    for (const { row, alt } of t.alt)
      out.push(
        `- ${plain(row.role)}（${where(row)}、既定は${plain(row.def)}）${alt.cond ? `：${plain(alt.cond)}` : ''}`,
      );
  }
  for (const e of i.why)
    out.push('', `## 採用の根拠（§${SECS.whyTools}）`, plain(e.r[1]), e.r[2] ? `懸念と回答：${plain(e.r[2])}` : '');
  for (const e of i.cost)
    out.push(
      '',
      `## 費用の注意（§${SECS.cost}）`,
      ...e.head.slice(1).map((k, j) => `- ${k}：${plain(e.r[j + 1] ?? '')}`),
    );
  for (const e of i.move)
    out.push(
      '',
      `## 育ったときの移行（§${SECS.growth}）→ ${plain(e.r[1])}`,
      `- きっかけ：${plain(e.r[2])}`,
      `- 最初からの備え：${plain(e.r[3])}`,
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
    ...d.rows.map(([l, v]) => `| ${l} | ${v} |`),
  ];
  for (const c of d.cases) out.push('', rawSub(c).replace(/^### (\d+-\d+)\. /, '## §$1 '));
  const cmd = guide.sections
    .find((s) => s.id === SECS.commands)
    ?.blocks.find((b) => b.t === 'h3' && d.cases.some((c) => b.text.includes(`§${c}`)));
  if (cmd?.t === 'h3') out.push('', rawSub(cmd.id).replace(/^### (\d+-\d+)\. /, '## §$1 '));
  out.push('', `次に読む：${[...new Set(d.refs)].map((r) => `§${r}`).join('、')}（/s/<N>.md）`);
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

// Absolute URLs in llms.txt so agents can fetch links directly
const abs = (path: string) => (import.meta.env.SITE ?? '').replace(/\/$/, '') + path;

export function llmsTxt() {
  const sec = (id: string) => guide.sections.find((s) => s.id === id);
  const line = (id: string) => {
    const s = sec(id);
    return s ? `- [${s.num ? `§${s.num} ` : ''}${s.title}](${abs(`/s/${s.id}.md`)})` : '';
  };
  return [
    `# ${guide.title}`,
    '',
    '> 新規プロジェクトの技術スタックを決めるための個人用ガイド。各カテゴリの「既定」は1つだけで、代替には乗り換える条件が付いている。PHPは選択肢に含めない。',
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
    '## 手元',
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
