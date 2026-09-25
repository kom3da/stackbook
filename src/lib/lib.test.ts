import { describe, expect, it } from 'vitest';
import { guide, parseGuide, rawSection, rawSub, SEC, SECS } from './guide';
import { linkNames } from './html';
import { llmsTxt, makeMd } from './md';
import { norm, parseAlts, TOOLS, tokens, toolInfo } from './tools';
import { DEFAULTS, decide, KINDS } from './wizard';

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

describe('tokens', () => {
  it.each([
    ['PostgreSQL＋Drizzle（SQLに近い）', ['PostgreSQL', 'Drizzle']],
    ['Render または Fly.io＋Neon', ['Render', 'Fly.io', 'Neon']],
    ['Zodでスキーマ定義して起動時に検証', ['Zod']],
    ['Ruby / Rails 8', ['Ruby', 'Rails 8']],
    ['フレームワーク標準のメタデータAPI', []],
    ['リポジトリ内 `docs/runbooks/`', []],
    ['GMOペイメントゲートウェイ', []],
  ])('%s', (input, expected) => {
    expect(tokens(input)).toEqual(expected);
  });
});

describe('parseAlts', () => {
  it('splits "name：condition" pairs', () => {
    const { alts, note } = parseAlts('Bun：スクリプトで速度を重視するとき。Deno：Deno Deploy前提のとき');
    expect(alts.map((a) => [a.label, a.cond])).toEqual([
      ['Bun', 'スクリプトで速度を重視するとき'],
      ['Deno', 'Deno Deploy前提のとき'],
    ]);
    expect(note).toBe('');
  });
  it('keeps bare names and turns sentences into notes', () => {
    expect(parseAlts('Bullet').alts.map((a) => a.label)).toEqual(['Bullet']);
    const r = parseAlts('Neon・Supabaseは組み込みのプーラーを使う');
    expect(r.alts).toEqual([]);
    expect(r.note).toContain('プーラー');
    expect(parseAlts('—')).toEqual({ alts: [], note: '' });
  });
});

describe('linkNames', () => {
  it('links whole words only', () => {
    const html = linkNames('GoReleaserとGo', ['Go'], () => 'go');
    expect(html).toBe('GoReleaserと<a class="tl" href="/dict/go/">Go</a>');
  });
});

describe('tool index', () => {
  it('merges versions and marks languages', () => {
    const rails = TOOLS.get(norm('Rails 8'));
    expect(rails?.name).toBe('Rails');
    expect(rails?.lang?.ref).toBe('2-3');
    for (const l of ['TypeScript', 'Go', 'Python', 'Rust', 'Kotlin', 'Elixir', 'C#'])
      expect(TOOLS.get(norm(l))?.lang, l).toBeDefined();
  });

  it('collects alternatives, rationale and cost', () => {
    const i = toolInfo('PostgreSQL');
    expect(i.t?.def.length).toBeGreaterThan(0);
    expect(i.why.length).toBe(1);
    expect(toolInfo('Vercel').cost.length).toBe(1);
    expect(toolInfo('Bun').t?.alt.some((a) => a.alt.cond.includes('スクリプト'))).toBe(true);
  });

  it('assigns unique slugs', () => {
    const slugs = [...TOOLS.values()].map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('decide (§2-9, §2-10, §19)', () => {
  const run = (kind: Parameters<typeof decide>[0], a: Partial<typeof DEFAULTS> = {}) =>
    decide(kind, { ...DEFAULTS, ...a });

  it('uses Rails for a CRUD business app', () => {
    const d = run('web');
    expect(d.title).toBe('Ruby / Rails 8');
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
    expect(run('rt', { stage: 'prod', team: 'small' }).title).toBe('Elixir');
    expect(run('saas', { stage: 'prod', team: 'small', load: 'p99' }).title).toBe('Rust');
    expect(run('cli', { load: 'cpu' }).title).toBe('Rust');
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
    expect(m).toContain('## 推奨：Ruby / Rails 8');
    expect(m).toContain('## §19-4');
    expect(m).toContain('## §26-4');
  });
});
