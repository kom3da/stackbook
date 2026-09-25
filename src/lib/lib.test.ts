import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Inline, LinksContext } from '../components/Inline';
import { guide, monthsSince, parseGuide, rawSection, rawSub, SEC, SECS } from './guide';
import { findName, segments } from './inline';
import { CASE_ROWS, LOOKUP } from './lookup';
import { llmsTxt, makeMd, toMarkdown } from './md';
import { parseData } from './schema';
import { dictionary, ROWS, TOOLS } from './tools';
import { type Answers, allAnswers, DEFAULTS, decide, KINDS, type Kind, questionsFor, resolve } from './wizard';

describe('parseGuide', () => {
  it('reads every numbered section plus intro and memo', () => {
    const ids = guide.sections.map((s) => s.id);
    expect(ids[0]).toBe('intro');
    expect(ids.at(-1)).toBe('memo');
    for (let n = 1; n <= 27; n++) expect(ids).toContain(String(n));
  });

  it('records a review month for every numbered section', () => {
    for (const s of guide.sections) if (s.num) expect(s.checked, `§${s.num}`).toMatch(/^\d{4}年\d{1,2}月$/);
  });

  it('computes review age in months', () => {
    expect(monthsSince('2026年9月', new Date(2027, 8, 1))).toBe(12);
    expect(monthsSince('2026年9月', new Date(2026, 11, 1))).toBe(3);
  });

  it('has every section and subsection the code refers to (SECS)', () => {
    for (const ref of Object.values(SECS)) {
      const [n, sub] = ref.split('-');
      expect(SEC.get(n), ref).toBeDefined();
      if (sub)
        expect(
          SEC.get(n)?.blocks.some((b) => b.t === 'h3' && b.id === ref),
          ref,
        ).toBe(true);
    }
  });

  it('parses headings, tables, lists and fences', () => {
    const g = parseGuide(
      [
        '# T',
        '作成：a　／　b',
        '## 1. S',
        '### 1-1. Sub',
        '| a | b |',
        '|---|---|',
        '| x | **y** |',
        '|  |  |',
        '- [ ] todo',
        '```mermaid',
        'flowchart TB',
        '```',
        'para',
        'cont',
      ].join('\n'),
    );
    expect(g.title).toBe('T');
    expect(g.meta).toEqual(['作成：a', 'b']);
    expect(g.sections[0].blocks).toEqual([
      { t: 'h3', id: '1-1', text: '1-1. Sub' },
      { t: 'table', head: ['a', 'b'], rows: [['x', '**y**']] },
      { t: 'check', items: ['todo'] },
      { t: 'mermaid', text: 'flowchart TB' },
      { t: 'p', text: 'para cont' },
    ]);
  });

  it('slices raw subsections without being fooled by code fences', () => {
    const sub = rawSub(SECS.commandsCommon);
    expect(sub).toMatch(/^### 26-1\./);
    expect(sub).toContain('```bash');
    expect(sub).not.toContain('### 26-2');
  });

  it('slices raw markdown per section', () => {
    expect(rawSection('7')).toMatch(/^## 7\. 決済/);
    expect(rawSection('7')).not.toContain('## 8.');
  });
});

describe('data blocks', () => {
  it('rejects unknown keys and missing fields', () => {
    expect(() => parseData('choices', { rows: [{ role: 'x', default: 'y', typo: 1 }] })).toThrow();
    expect(() => parseData('cost', { rows: [{ service: 'x' }] })).toThrow();
  });
  it('reports the section of an invalid block', () => {
    expect(() => parseGuide('## 1. S\n\n```choices\nrows: [{ role: x }]\n```')).toThrow(/choices.*§1/);
  });
  it('round-trips to markdown tables for agents', () => {
    const m = toMarkdown(
      '```choices\nrows:\n  - role: R\n    default: "**A**"\n    tools: [a]\n    alts: [{ name: B, when: C }]\n```',
    );
    expect(m).toBe('| 役割 | 既定 | 代替と乗り換え条件 |\n|---|---|---|\n| R | **A** | B：C |');
  });
});

describe('inline markdown', () => {
  it('splits code, bold, refs and urls', () => {
    expect(segments('a `x` **b** §2-10 https://e.com/。').map((x) => x.t)).toEqual([
      'text',
      'code',
      'text',
      'bold',
      'text',
      'ref',
      'text',
      'url',
      'text',
    ]);
  });
  it('matches tool names on whole words only', () => {
    expect(findName('GoReleaserとGo', 'Go')).toEqual(['GoReleaserと', '']);
    expect(findName('GoReleaser', 'Go')).toBeNull();
  });
  it('renders escaped html with tool links', () => {
    const html = renderToStaticMarkup(
      createElement(
        LinksContext.Provider,
        { value: { go: { name: 'Go', href: '/dict/go/' } } },
        createElement(Inline, { text: '<b>GoReleaserとGo</b> §2', tools: ['go'] }),
      ),
    );
    expect(html).toBe(
      '&lt;b&gt;GoReleaserと<a class="tl" href="/dict/go/">Go</a>&lt;/b&gt; <a class="ref" href="/s/2/">§2</a>',
    );
  });
});

describe('tool index', () => {
  it('marks languages', () => {
    expect(TOOLS.get('rails')?.lang?.ref).toBe('2-3');
    for (const id of ['typescript', 'go', 'python', 'rust', 'kotlin', 'elixir', 'csharp'])
      expect(TOOLS.get(id)?.lang, id).toBeDefined();
  });

  it('collects defaults, alternatives, rationale, cost and growth', () => {
    const pg = TOOLS.get('postgresql');
    expect(pg?.def.length).toBeGreaterThan(0);
    expect(pg?.why.length).toBe(1);
    expect(TOOLS.get('vercel')?.cost.length).toBe(1);
    expect(TOOLS.get('supabase')?.growth.length).toBe(1);
    expect(TOOLS.get('bun')?.alt.some((a) => a.alt.when?.includes('スクリプト'))).toBe(true);
  });

  it('lists every tool the dictionary links to', () => {
    const listed = new Set(dictionary().map((t) => t.id));
    for (const r of ROWS) for (const id of r.tools) expect(listed.has(id), id).toBe(true);
  });
});

describe('decide (§2-9, §2-10, §19)', () => {
  const run = (kind: Parameters<typeof decide>[0], a: Partial<typeof DEFAULTS> = {}) =>
    decide(kind, { ...DEFAULTS, ...a });

  it('uses Rails for a CRUD business app', () => {
    const d = run('web');
    expect(d.title).toBe('Ruby / Rails');
    expect(d.cases).toEqual(['19-4']);
  });
  it('keeps small SaaS teams on TypeScript and moves to Go in production', () => {
    expect(run('saas').title).toBe('TypeScript');
    expect(run('saas', { team: 'small', stage: 'prod' }).title).toBe('Go');
  });
  it('lets hard constraints win', () => {
    expect(run('saas', { env: 'edge', load: 'conn' }).title).toBe('TypeScript');
    expect(run('web', { cons: ['unity'] }).title).toBe('C#');
    expect(run('ai', { load: 'cpu' }).title).toBe('Python');
  });
  it('picks by load in production', () => {
    expect(run('rt', { stage: 'prod', team: 'small', load: 'conn' }).title).toBe('Elixir');
    expect(run('rt', { stage: 'prod', team: 'solo', load: 'conn' }).title).toBe('TypeScript');
    expect(run('rt', { stage: 'prod', team: 'small' }).title).toBe('TypeScript');
    expect(run('web', { stage: 'prod', team: 'solo', load: 'domain' }).title).toBe('TypeScript');
    expect(run('web', { stage: 'prod', team: 'small', load: 'domain' }).title).toBe('Kotlin');
    expect(run('saas', { stage: 'prod', team: 'small', load: 'p99' }).title).toBe('Rust');
    expect(run('cli', { load: 'cpu' }).title).toBe('Rust');
  });
  it('resolves every row against the guide for every answer combination', () => {
    for (const [k] of KINDS)
      for (const ans of allAnswers(k))
        for (const t of decide(k, ans).tables)
          for (const r of resolve(t, LOOKUP)) for (const id of r.tools) expect(TOOLS.has(id), `${k}: ${id}`).toBe(true);
  });
  it('matches the §19 table exactly under default conditions', () => {
    // saas: §19-6 assumes a Go team, so compare under conditions that pick Go
    const cond: Partial<Record<Kind, Partial<Answers>>> = { saas: { team: 'small', stage: 'prod' } };
    for (const k of ['web', 'saas', 'toc', 'ai', 'site'] as const) {
      const [t] = run(k, cond[k]).tables;
      expect(t.base, k).toBeDefined();
      expect(
        resolve(t, LOOKUP).map((r) => r.text),
        k,
      ).toEqual(CASE_ROWS.get(t.base as string)?.map((r) => r.text));
    }
  });
  it('shows only options that change the result', () => {
    const key = (k: Kind, a: Answers) => JSON.stringify(decide(k, a));
    for (const [k] of KINDS) {
      const all = [...allAnswers(k)];
      for (const q of questionsFor(k)) {
        if (q.multi) {
          for (const [v, label] of q.opts)
            expect(
              all.some(
                (a) => a.cons.includes(v) && key(k, a) !== key(k, { ...a, cons: a.cons.filter((x) => x !== v) }),
              ),
              `${k} / ${q.label} / ${label}`,
            ).toBe(true);
          continue;
        }
        // Every pair of options must lead to different results under some other conditions
        for (const [v, lv] of q.opts)
          for (const [o, lo] of q.opts) {
            if (v >= o) continue;
            expect(
              all.some((a) => a[q.q] === v && key(k, a) !== key(k, { ...a, [q.q]: o })),
              `${k} / ${q.label}: ${lv} と ${lo} が同じ結果`,
            ).toBe(true);
          }
      }
    }
  });
  it('points every case at an existing §19 subsection', () => {
    for (const [k] of KINDS)
      for (const c of run(k).cases) expect(SEC.get('19')?.blocks.some((b) => b.t === 'h3' && b.id === c)).toBe(true);
  });
});

describe('markdown for agents', () => {
  it('lists every kind in llms.txt', () => {
    const t = llmsTxt();
    for (const [k] of KINDS) expect(t).toContain(`/make/${k}.md`);
  });
  it('bundles recommendation, §19 case and commands', () => {
    const m = makeMd('web');
    expect(m).toContain('最新安定版');
    expect(m).toContain('## 推奨：Ruby / Rails');
    expect(m).toContain('## §19-4');
    expect(m).toContain('## 条件が違うとき');
    expect(m).toContain('## §26-4');
  });
});
