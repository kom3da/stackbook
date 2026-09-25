// Stack selection logic. Must stay consistent with §2-9, §2-10 and §19 of content/guide/.
// Tool ids refer to content/tools.yaml.

export type Kind =
  | 'web'
  | 'saas'
  | 'toc'
  | 'ai'
  | 'rt'
  | 'site'
  | 'ec'
  | 'data'
  | 'cli'
  | 'devtool'
  | 'desktop'
  | 'mobile'
  | 'embedded';
export type Answers = {
  load: string;
  env: string;
  team: string;
  stage: string;
  cons: string[];
};

export const KINDS: [Kind, string, string][] = [
  ['web', '業務システム・管理画面', '社内ツール、予約、受発注'],
  ['saas', 'SaaS・Web API', 'B2Bの自社サービス、公開API'],
  ['toc', '一般向けサービス', 'Web＋スマホアプリ'],
  ['ai', 'AI・LLMプロダクト', 'LLM API、RAG、エージェント'],
  ['rt', 'リアルタイム通信', 'チャット、通知、共同編集'],
  ['site', 'コーポレートサイト・メディア', 'LP、ブログ、非エンジニアが更新'],
  ['ec', 'EC', 'ネットショップ、定期購入'],
  ['data', 'データ集計・バッチ', '夜間の一括計算、分析'],
  ['cli', 'CLI・インフラツール', '単一バイナリで配るツール'],
  ['devtool', '開発者ツール・ライブラリ', 'Linter、パーサ、Wasm'],
  ['desktop', 'デスクトップアプリ', 'Mac・Windowsのアプリ'],
  ['mobile', 'モバイルアプリ', 'iOS・Androidのアプリだけを作る'],
  ['embedded', '組み込み・IoT', 'ファームウェア、マイコン'],
];
/** Kinds grouped so a reader can skip straight to their kind of product */
export const KIND_GROUPS: [string, Kind[]][] = [
  ['Webサービス', ['web', 'saas', 'toc', 'ai', 'rt', 'ec', 'site']],
  ['ソフトウェア・ツール', ['cli', 'devtool', 'desktop', 'mobile', 'embedded']],
  ['データ', ['data']],
];
/** opts: [value, label, short label for the summary line] */
export const QUESTIONS: { q: keyof Answers; label: string; multi?: true; opts: [string, string, string][] }[] = [
  {
    q: 'load',
    label: '処理の中心',
    opts: [
      ['db', 'DBの読み書き・業務ロジック', 'DB中心'],
      ['io', '外部APIの待ち時間', '外部API待ち'],
      ['conn', '大量の常時接続', '常時接続'],
      ['cpu', 'CPU負荷の高い計算', 'CPU負荷'],
      ['p99', '厳しいレイテンシ（p99で10ms未満）', '低レイテンシ'],
      ['domain', '複雑な業務ルール', '複雑な業務'],
      ['batch', '大規模バッチ・ストリーム', 'バッチ'],
      ['spike', 'セール・チケット販売などの瞬間的な大量アクセス', '瞬間アクセス'],
    ],
  },
  {
    q: 'env',
    label: '実行環境',
    opts: [
      ['paas', '指定なし（PaaS可）', 'PaaS'],
      ['aws', 'AWS', 'AWS'],
      ['onprem', 'オンプレ・VPS', 'オンプレ'],
      ['edge', 'エッジ', 'エッジ'],
    ],
  },
  {
    q: 'team',
    label: '開発者の人数',
    opts: [
      ['solo', '1〜2人', '1〜2人'],
      ['small', '3〜9人', '3〜9人'],
      ['large', '10人以上', '10人以上'],
    ],
  },
  {
    q: 'stage',
    label: '段階',
    opts: [
      ['mvp', '試作・MVP', 'MVP'],
      ['prod', '本番・長期運用', '本番'],
    ],
  },
  {
    q: 'cons',
    label: '外部の制約',
    multi: true,
    opts: [
      ['ml', '機械学習ライブラリが必須', 'ML必須'],
      ['java', '既存のJava資産と連携', 'Java資産'],
      ['unity', 'Unityとコード共有', 'Unity'],
      ['ms', 'Microsoft／Azure中心', 'Microsoft'],
    ],
  },
];
const BACK = ['web', 'saas', 'toc', 'ai', 'rt'] as const satisfies Kind[];
export const SHOW: Record<keyof Answers, Kind[]> = {
  load: [...BACK, 'cli', 'data', 'ec'],
  env: [...BACK, 'site', 'ec', 'data'],
  team: BACK,
  stage: BACK,
  cons: [...BACK, 'desktop', 'data'],
};
export const DEFAULTS: Answers = { load: 'db', env: 'paas', team: 'solo', stage: 'mvp', cons: [] };

type Opt = [string, string, string];
/** Kinds where only some choices change the result; a string picks the shared option as is */
// Spikes change the answer only where §19-12 applies: consumer services and shops
const STEADY = ['db', 'io', 'conn', 'cpu', 'p99', 'domain', 'batch'];
const ONLY: Partial<Record<Kind, Partial<Record<keyof Answers, (Opt | string)[]>>>> = {
  web: { load: STEADY },
  saas: { load: STEADY },
  ai: { load: STEADY },
  rt: { load: STEADY },
  cli: {
    load: [
      ['db', '一般的な処理', '一般'],
      ['cpu', '速度・起動時間を詰めたい', '高速'],
    ],
  },
  data: {
    load: [
      ['db', '集計・変換が中心', '集計'],
      ['batch', '大規模バッチ・ストリーム', 'バッチ'],
    ],
    cons: ['java'],
  },
  desktop: { cons: ['ms'] },
  site: { env: ['paas', 'aws'] },
  ec: {
    env: ['paas', 'onprem'],
    load: [['db', '通常のアクセス', '通常'], 'spike'],
  },
};
/** The questions shown for a kind, each option guaranteed to matter (see lib.test.ts) */
export function questionsFor(kind: Kind) {
  return QUESTIONS.filter((q) => SHOW[q.q].includes(kind)).map((q) => {
    const only = ONLY[kind]?.[q.q];
    if (!only) return q;
    return { ...q, opts: only.map((o) => (typeof o === 'string' ? (q.opts.find((x) => x[0] === o) as Opt) : o)) };
  });
}

type Lang = 'ts' | 'go' | 'rails' | 'py' | 'rust' | 'kt' | 'ex' | 'cs';

/**
 * Where a row's content comes from. The wizard never restates the guide:
 * - a row of a §19 `stack` table, or the default of a `choices` row (at = §N-M or §N, role = its 役割)
 * - a literal only for conclusions the guide has no single row for
 */
export type Src = { case: string; layer: string } | { at: string; role: string } | { text: string; tools: string[] };
/** A table starts from a §19 case (base) and applies edits: replace or add a layer, or drop it (null) */
export type Table = { title?: string; base?: string; edits: { layer: string; src: Src | null }[] };
export type Decision = {
  title: string;
  tables: Table[];
  why: string[];
  notes: string[];
  /** Section refs such as "2-10" or "24" */
  refs: string[];
  /** §19 subsections whose diagrams and commands apply */
  cases: string[];
  /** §26 subsections with starter commands (the common setup §26-1 is always shown) */
  commands: string[];
};

const R = (at: string, role: string): Src => ({ at, role });
const C = (c: string, layer: string): Src => ({ case: c, layer });
const T = (text: string, ...tools: string[]): Src => ({ text, tools });

const L: Record<Lang, { n: string; tools: string[]; ref: string; fw: Src; api?: Src; db: Src; job: Src; test: Src }> = {
  ts: {
    n: 'TypeScript',
    tools: ['typescript'],
    ref: '2-1',
    fw: R('2-1', 'HTTPフレームワーク'),
    api: R('2-1', 'OpenAPI'),
    db: R('2-1', 'ORM／クエリ'),
    job: R('2-1', 'ジョブキュー'),
    test: R('2-1', 'テスト（ユニット）'),
  },
  go: {
    n: 'Go',
    tools: ['go'],
    ref: '2-2',
    fw: R('2-2', 'HTTPルーティング'),
    db: R('2-2', 'クエリ'),
    job: R('2-2', 'ジョブキュー'),
    test: R('2-2', 'テスト'),
  },
  rails: {
    n: 'Ruby / Rails',
    tools: ['ruby', 'rails'],
    ref: '2-3',
    fw: T('Rails', 'rails'),
    db: R('4-1', 'RDB'),
    job: R('2-3', 'ジョブ'),
    test: R('2-3', 'テスト'),
  },
  py: {
    n: 'Python',
    tools: ['python'],
    ref: '2-4',
    fw: R('2-4', 'Webフレームワーク'),
    db: R('2-4', 'ORM'),
    job: R('2-4', 'ジョブ'),
    test: R('2-4', 'テスト'),
  },
  rust: {
    n: 'Rust',
    tools: ['rust'],
    ref: '2-5',
    fw: R('2-5', 'Webフレームワーク'),
    db: R('2-5', 'DB'),
    job: R('4-4', 'マネージドキュー（AWS）'),
    test: R('2-5', 'テスト実行'),
  },
  kt: {
    n: 'Kotlin',
    tools: ['kotlin'],
    ref: '2-6',
    fw: R('2-6', 'Webフレームワーク'),
    api: R('2-6', 'OpenAPI'),
    db: R('2-6', 'DBアクセス'),
    job: R('2-6', 'バッチ'),
    test: R('2-6', 'テスト'),
  },
  ex: {
    n: 'Elixir',
    tools: ['elixir'],
    ref: '2-7',
    fw: R('2-7', 'Webフレームワーク'),
    db: R('2-7', 'DB'),
    job: R('2-7', 'ジョブ'),
    test: R('2-7', 'テスト'),
  },
  cs: {
    n: 'C#',
    tools: ['csharp'],
    ref: '2-8',
    fw: R('2-8', 'Webフレームワーク'),
    api: R('2-8', 'OpenAPI'),
    db: R('2-8', 'DBアクセス'),
    job: R('2-8', 'ジョブ・スケジュール'),
    test: R('2-8', 'テスト'),
  },
};
const name = (l: Lang) => L[l].n;
/** §12-1 row for each execution environment */
const ENV: Record<string, Src> = {
  paas: R('12-1', '自由に選べる・Webアプリ'),
  aws: R('12-1', 'AWSを使う'),
  onprem: R('12-1', 'VPS・オンプレVM'),
  edge: R('12-1', 'エッジ・軽量API'),
};
/** §19-9 row for each language */
const RT: Partial<Record<Lang, string>> = {
  rails: 'Rails',
  ex: '同時接続が非常に多い・プレゼンスが必要',
};
/** Real-time row per language: TypeScript is managed on the edge/PaaS and self-run on AWS or on-prem */
const rtRow = (lang: Lang, env: string): Src => {
  if (lang === 'ts')
    return C('19-9', env === 'aws' || env === 'onprem' ? 'TS・自前運用（AWS・オンプレ）' : 'TS・マネージド');
  if (RT[lang]) return C('19-9', RT[lang] as string);
  if (lang === 'cs') return R('2-8', 'リアルタイム');
  if (lang === 'go') return C('19-9', '同時接続が多い（Elixirを採用しない場合）');
  return T('WebSocket＋Valkey Pub/Sub（言語の標準的なWebSocketライブラリで実装）', 'valkey');
};

const HEAVY = T('Rustで切り出し（ワーカー、またはnapi-rs／PyO3でネイティブ拡張）', 'rust', 'napi-rs', 'pyo3');

type Input = Omit<Answers, 'cons'> & { kind: Kind; cons: Set<string> };
type Edit = Table['edits'][number];
const edit = (layer: string, src: Src | null): Edit => ({ layer, src });
const COMMON_REFS = ['23', '24', '25'];

// ---- Choosing the language (§2-10). Rules are checked top to bottom; the first match wins ----

type Rule = { when: (a: Input) => boolean; lang: Lang; why: string };

/** 手順1: an external constraint decides outright */
const CONSTRAINTS: Rule[] = [
  {
    when: (a) => a.env === 'edge',
    lang: 'ts',
    why: '実行環境がエッジなので、Cloudflare Workersで動くTypeScript（§2-10 手順1）',
  },
  { when: (a) => a.cons.has('unity'), lang: 'cs', why: 'Unityとモデルや通信定義を共有できるC#（§2-10 手順1）' },
  { when: (a) => a.cons.has('java'), lang: 'kt', why: '既存のJava資産と直接連携できるKotlin（§2-10 手順1）' },
  { when: (a) => a.cons.has('ms'), lang: 'cs', why: 'Microsoft／Azure環境との親和性が高いC#（§2-10 手順1）' },
  {
    when: (a) => a.cons.has('ml') || (a.kind === 'ai' && a.load === 'cpu'),
    lang: 'py',
    why: '機械学習ライブラリがPythonに集中している（§2-10 手順1）',
  },
];

/** 手順2: the nature of the load, then the kind of product */
const LOADS: Rule[] = [
  {
    when: (a) => a.load === 'conn',
    lang: 'ex',
    why: '大量の常時接続を軽量プロセスと自動復旧で扱えるElixir（§2-10 手順2）',
  },
  {
    when: (a) => a.load === 'p99',
    lang: 'rust',
    why: 'GCによる停止がなく、p99の上振れを抑えられるRust（§2-10 手順2）',
  },
  {
    when: (a) => a.load === 'domain',
    lang: 'kt',
    why: '状態を型で表現しやすく、トランザクション基盤が成熟したKotlin（§2-10 手順2）',
  },
  {
    when: (a) => a.load === 'batch',
    lang: 'kt',
    why: '再実行・中断再開の仕組みが揃ったKotlin（Spring Batch／Kafka Streams）（§2-10 手順2）',
  },
  {
    when: (a) => a.load === 'io',
    lang: 'ts',
    why: '非同期I/Oが書きやすく、フロントと型を共有できるTypeScript（§2-10 手順2）',
  },
  {
    when: (a) => a.kind === 'web',
    lang: 'rails',
    why: 'DB中心のCRUDなので性能差は効かない。画面数の多い業務システムはRailsが最も速く作れる（§2-10 手順2）',
  },
  {
    when: (a) => a.kind === 'saas' && a.team !== 'solo',
    lang: 'go',
    why: '中規模以上のAPIは、単一バイナリで運用が単純なGoが国内でも定番（§2-10 手順2）',
  },
  { when: (a) => a.kind === 'saas', lang: 'ts', why: '少人数なのでフロントと同じTypeScriptに揃える（§2-10 手順3）' },
  {
    when: (a) => a.kind === 'rt',
    lang: 'ts',
    why: '数万接続に満たないチャットや通知はマネージドの基盤で足り、言語はフロントと揃えられる（§2-10 手順2、§19-9）',
  },
  {
    when: () => true,
    lang: 'ts',
    why: 'フロントと同じ言語に揃えられ、API呼び出し中心の処理に向くTypeScript（§2-10 手順2）',
  },
];

/** §26 starter commands per language */
const LANG_CMD: Record<Lang, string> = {
  ts: '26-5',
  go: '26-6',
  rails: '26-4',
  py: '26-8',
  ex: '26-9',
  kt: '26-11',
  cs: '26-11',
  rust: '26-11',
};

/** Languages a team of one or two should not add (手順3) */
const SOLO_TO_TS: Lang[] = ['go', 'kt', 'ex'];
/** Languages that are slower to prototype in (手順3) */
const SLOW_TO_START: Lang[] = ['go', 'kt', 'rust', 'ex'];

function pickLanguage(a: Input): { lang: Lang; why: string[]; orig?: Lang } {
  const hard = CONSTRAINTS.find((r) => r.when(a));
  if (hard) return { lang: hard.lang, why: [hard.why] };
  const r = LOADS.find((x) => x.when(a)) as Rule;
  const why = [r.why];
  let lang = r.lang;
  let orig: Lang | undefined;
  // CPU-heavy work does not change the language; the heavy part is carved out
  if (a.load === 'cpu') why.push('CPU負荷の高い部分だけをRustで切り出す（§2-10 混在ルール）');
  // 手順3: prototype in a fast-to-build language, and keep tiny teams on one language
  if (a.stage === 'mvp' && SLOW_TO_START.includes(lang)) {
    orig = lang;
    lang = a.kind === 'web' ? 'rails' : 'ts';
    why.push(
      `試作段階なので開発速度を優先して${name(lang)}で始め、本番化の段階で${name(orig)}への切り替え・切り出しを検討する（§2-10 手順3、§24）`,
    );
  }
  // 1〜2人: do not add a language nobody else can maintain (Rust is kept for strict latency needs)
  if (a.team === 'solo' && SOLO_TO_TS.includes(lang)) {
    const from = lang;
    lang = 'ts';
    why.push(
      from === 'ex'
        ? '開発者が1〜2人なので、Elixirではなくマネージドのリアルタイム基盤とTypeScriptにする（§2-10 手順3）'
        : `開発者が1〜2人なので、${name(from)}ではなくフロントと同じTypeScriptに揃える（§2-10 手順3）`,
    );
  }
  return { lang, why, orig };
}

// ---- Backend products: a §19 case adjusted to the chosen language and environment ----

type Backend = (typeof BACK)[number];
type BackendSpec = {
  /** §19 case to start from for the chosen language; undefined means compose from the language's defaults */
  base: (lang: Lang) => string | undefined;
  /** Languages the case already covers; for others, `swap` replaces its language-specific rows */
  covers?: Lang[];
  swap?: (l: (typeof L)[Lang]) => Edit[];
  /** Row the execution environment replaces, except in the environments listed in `keep` */
  env?: { layer: string; keep: string[] };
  /** Used when composing: the front-end and auth rows, and rows to append */
  front?: (lang: Lang) => Src;
  auth?: Src;
  extra?: (lang: Lang, env: string) => Edit[];
  /** §19 cases whose diagrams and commands apply */
  cases: (lang: Lang) => string[];
  /** §26 commands; defaults to the language's starter commands */
  commands?: (lang: Lang) => string[];
};

const BACKEND: Record<Backend, BackendSpec> = {
  web: {
    base: (lang) => ({ rails: '19-4', ts: '19-5' })[lang as 'rails' | 'ts'],
    env: { layer: 'デプロイ', keep: ['paas'] },
    front: (lang) => (lang === 'ex' ? R('2-7', '画面') : C('19-5', 'フロント')),
    auth: R('6', '社内ツール'),
    cases: (lang) => [lang === 'rails' ? '19-4' : '19-5'],
  },
  saas: {
    base: () => '19-6',
    covers: ['go'],
    swap: (l) => [edit('バックエンド', l.fw), edit('API', l.api ?? R('5', '外部公開API')), edit('ジョブ', l.job)],
    env: { layer: 'インフラ', keep: ['paas', 'aws'] },
    cases: () => ['19-6'],
  },
  toc: {
    base: () => '19-7',
    covers: ['ts', 'go'],
    swap: (l) => [edit('バックエンド', l.fw)],
    env: { layer: 'インフラ', keep: ['paas'] },
    cases: () => ['19-7'],
    commands: (lang) => ['26-7', ...(lang === 'ts' ? [] : [LANG_CMD[lang]])],
  },
  ai: {
    base: () => '19-8',
    covers: ['ts', 'py'],
    swap: (l) => [edit('AIバックエンド', l.fw)],
    env: { layer: 'インフラ', keep: ['paas'] },
    cases: () => ['19-8'],
  },
  rt: {
    // §19-9 is a menu, so compose and pick its row for the language
    base: () => undefined,
    front: (lang) => (lang === 'ex' ? R('2-7', '画面') : R('3', 'アプリ（SSR・フルスタック）')),
    auth: R('6', 'マネージド（toC・スタートアップ）'),
    extra: (lang, env) => [
      edit('リアルタイム', rtRow(lang, env)),
      edit('共同編集', C('19-9', '共同編集')),
      edit('片方向の配信', C('19-9', '片方向で足りる')),
    ],
    // §19-9's diagram is the Elixir build; other languages would contradict the table above it
    cases: (lang) => (lang === 'ex' ? ['19-9'] : []),
    commands: () => ['26-9'],
  },
};

/** A table from the language's defaults, for languages no §19 case covers */
const composed = (l: (typeof L)[Lang], front: Src, auth: Src, env: string): Edit[] => [
  edit('言語', T(l.n, ...l.tools)),
  edit('フロント', front),
  edit('バックエンド', l.fw),
  edit('DB', R('4-1', 'RDB')),
  edit('データアクセス', l.db),
  edit('ジョブ', l.job),
  edit('認証', auth),
  edit('テスト', l.test),
  edit('インフラ', ENV[env]),
  edit('監視', R('14', 'エラー監視')),
  edit('CI', R('13', 'CI/CD')),
];

function backend(kind: Backend, a: Input): Decision {
  const spec = BACKEND[kind];
  const p = pickLanguage(a);
  const l = L[p.lang];
  const base = spec.base(p.lang);
  const edits: Edit[] = [];
  if (!base)
    edits.push(
      ...composed(l, (spec.front as (x: Lang) => Src)(p.lang), spec.auth as Src, a.env),
      ...(spec.extra?.(p.lang, a.env) ?? []),
    );
  else {
    if (spec.covers && !spec.covers.includes(p.lang)) edits.push(...(spec.swap?.(l) ?? []));
    if (spec.env && !spec.env.keep.includes(a.env)) edits.push(edit(spec.env.layer, ENV[a.env]));
  }
  if (a.env === 'aws') edits.push(edit('認証（AWSに集約する場合）', R('6', 'マネージド（AWS中心）')));
  if (a.load === 'cpu' && p.lang !== 'rust') edits.push(edit('重い処理', HEAVY));
  const notes: string[] = [];
  if (p.orig)
    notes.push(
      `本番化で${name(p.orig)}に移るときの手順は §24 を確認する。APIをOpenAPIで定義しておくと差し替えやすい。`,
    );
  if (a.team === 'large')
    notes.push('10人以上ならモジュール構造を強制する（TypeScriptならNestJS、Goならパッケージ境界のルール化。§23-4）。');
  return {
    title: l.n,
    tables: [{ base, edits }],
    why: p.why,
    notes,
    refs: ['2-10', l.ref, ...COMMON_REFS],
    cases: spec.cases(p.lang),
    commands: spec.commands?.(p.lang) ?? [LANG_CMD[p.lang]],
  };
}

// ---- Other products: one small definition each ----

type Other = Omit<Decision, 'notes'>;
const OTHER: Record<Exclude<Kind, Backend>, (a: Input) => Other> = {
  site: (a) => ({
    title: 'Astro＋ヘッドレスCMS',
    tables: [
      { base: '19-1', edits: a.env === 'aws' ? [edit('ホスティング', T('S3＋CloudFront', 's3', 'cloudfront'))] : [] },
    ],
    why: ['静的出力でサーバー保守がほぼ不要、非エンジニアの更新はCMSで賄える（§19-1）'],
    refs: ['11'],
    cases: ['19-1'],
    commands: ['26-2'],
  }),
  ec: (a) => ({
    title: 'Shopify または Medusa',
    tables: [
      { title: '独自要件が少ない', base: '19-2', edits: [] },
      { title: '独自要件が多い', base: '19-3', edits: a.env === 'onprem' ? [edit('インフラ', ENV.onprem)] : [] },
    ],
    why: [
      '独自要件が少なければSaaSに任せるのが最も安全で安い。定期購入・BtoB価格など独自要件が多いならMedusa（§19-2、§19-3）',
    ],
    refs: ['7', '19-12'],
    cases: ['19-2', '19-3'],
    commands: ['26-3'],
  }),
  cli: (a) => {
    const fast = a.load === 'cpu';
    return {
      title: fast ? 'Rust' : 'Go',
      tables: [
        fast
          ? {
              edits: [
                edit('言語', T('Rust', 'rust')),
                edit('CLI', R('2-5', 'CLI')),
                edit('配布', R('2-5', 'バイナリ配布')),
                edit('クロスコンパイル', R('2-5', 'クロスコンパイル')),
                edit('テスト', R('2-5', 'テスト実行')),
                edit('脆弱性チェック', R('2-5', '脆弱性チェック')),
              ],
            }
          : {
              base: '19-10',
              edits: [
                edit('CLI', R('2-2', 'CLI')),
                edit('テスト', R('2-2', 'テスト')),
                edit('脆弱性チェック', R('2-2', '脆弱性チェック')),
              ],
            },
      ],
      why: [
        fast
          ? '起動時間・処理速度を詰める必要があるのでRust（§2-9）'
          : '単一バイナリで配布しやすく、クロスコンパイルも簡単なGo（§2-9）',
      ],
      refs: ['2-9', fast ? '2-5' : '2-2'],
      cases: ['19-10'],
      commands: [fast ? '26-11' : '26-10'],
    };
  },
  devtool: () => ({
    title: 'Rust',
    tables: [
      {
        edits: [
          edit('言語', R('2-9', '開発者向けツール（Linter、フォーマッタ、ビルドツール、パーサ）')),
          edit('WebAssembly', R('2-5', 'WebAssembly')),
          edit('Node.jsから呼ぶ', R('2-5', 'Node.jsから呼ぶネイティブ拡張')),
          edit('Pythonから呼ぶ', R('2-5', 'Pythonから呼ぶネイティブ拡張')),
          edit('テスト', R('2-5', 'テスト実行')),
          edit('ベンチマーク', R('2-5', 'ベンチマーク')),
          edit('配布', R('2-5', 'バイナリ配布')),
        ],
      },
    ],
    why: ['近年の高速な開発ツールの主流で、WebAssemblyやネイティブ拡張として他言語に組み込める（§2-9）'],
    refs: ['2-9', '2-5'],
    cases: [],
    commands: ['26-11'],
  }),
  desktop: (a) => {
    const ms = a.cons.has('ms');
    return {
      title: ms ? 'C#（.NET）' : 'Tauri',
      tables: [
        {
          edits: ms
            ? [
                edit('構成', T('C#（.NET）', 'csharp', 'net')),
                edit('SDK', R('2-8', 'SDK')),
                edit('テスト', R('2-8', 'テスト')),
              ]
            : [
                edit('構成', R('2-5', 'デスクトップアプリ')),
                edit('フロント', R('3', 'SPA（ログイン後の管理画面など）')),
              ],
        },
      ],
      why: [
        ms
          ? 'Windows専用の業務アプリでMicrosoft環境が中心なら.NET（§2-9）'
          : 'UIはWeb技術、裏側はRustで軽量なバイナリになるTauri（§2-9）',
      ],
      refs: ['2-9', ms ? '2-8' : '2-5'],
      cases: [],
      commands: ['26-11'],
    };
  },
  mobile: () => ({
    title: 'React Native＋Expo',
    tables: [{ base: '19-14', edits: [] }],
    why: [
      'iOSとAndroidを1つのコードで作れるReact Native＋Expoが既定（§2-9）。Webの画面も要るなら一般向けサービス（§19-7）の構成にする',
    ],
    refs: ['2-9', '19-7', '24'],
    cases: ['19-14'],
    commands: ['26-13'],
  }),
  embedded: () => ({
    title: 'Rust',
    tables: [
      {
        edits: [
          edit('言語', R('2-9', '組み込み・IoT・ファームウェア')),
          edit('非同期フレームワーク', R('2-5', '組み込み（非同期）')),
          edit('テスト', R('2-5', 'テスト実行')),
        ],
      },
    ],
    why: ['メモリ安全性とC並みの性能を両立できる（§2-9）'],
    refs: ['2-9', '2-5'],
    cases: [],
    commands: ['26-11'],
  }),
  data: (a) => {
    const kt = a.load === 'batch' || a.cons.has('java');
    return {
      title: kt ? 'Kotlin（Spring Batch）＋SQL' : 'SQL＋Python（Polars）',
      tables: [
        {
          base: '19-13',
          edits: [
            ...(kt ? [edit('変換', R('2-6', 'バッチ')), edit('ストリーム', R('2-6', 'ストリーム処理'))] : []),
            ...(a.env !== 'paas' ? [edit('実行', ENV[a.env])] : []),
          ],
        },
      ],
      why: [
        '集計はまずSQLで書くのが最短で、SQLで表現しにくい変換だけPythonにする（§2-9）',
        ...(kt ? ['再実行・中断再開が必要な大規模バッチやストリーム処理はKotlin（§2-10 手順2）'] : []),
      ],
      refs: ['2-9', '2-10'],
      cases: ['19-13'],
      commands: kt ? ['26-11'] : [],
    };
  },
};

const isBackend = (k: Kind): k is Backend => (BACK as Kind[]).includes(k);

export function decide(kind: Kind, answers: Answers): Decision {
  const a: Input = { ...answers, kind, cons: new Set(answers.cons) };
  const o = isBackend(kind) ? backend(kind, a) : { notes: [], ...OTHER[kind](a) };
  const d: Decision = isBackend(kind) ? o : { ...o, refs: [...o.refs, ...COMMON_REFS] };
  return a.load === 'spike' ? withSpike(d) : d;
}

/** Sale or ticket-drop traffic: §19-12's measures go on top of the stack */
function withSpike(d: Decision): Decision {
  return {
    ...d,
    tables: [...d.tables, { title: '瞬間的な大量アクセスへの対策', base: '19-12', edits: [] }],
    notes: [...d.notes, '瞬間的な大量アクセスがあるので、入場制御・キャッシュ・注文の直列化を加える（§19-12）'],
    refs: [...new Set([...d.refs, '19-12', '23'])],
    cases: [...d.cases, '19-12'],
  };
}

/** A resolved row, ready to render */
/** edited: replaced or added on top of the §19 base for the chosen conditions */
export type Row = { layer: string; text: string; tools: string[]; ref?: string; edited?: boolean };
export type Lookup = {
  caseRows: (c: string) => { layer: string; text: string; tools: string[] }[] | undefined;
  choice: (at: string, role: string) => { text: string; tools: string[] } | undefined;
};
export const srcKey = (s: Src) => ('case' in s ? `${s.case}|${s.layer}` : 'at' in s ? `${s.at}|${s.role}` : '');

function value(s: Src, look: Lookup): Row & { layer?: string } {
  if ('text' in s) return { layer: '', text: s.text, tools: s.tools };
  if ('case' in s) {
    const r = look.caseRows(s.case)?.find((x) => x.layer === s.layer);
    if (!r) throw new Error(`No row "${s.layer}" in §${s.case}`);
    return { ...r, ref: s.case };
  }
  const r = look.choice(s.at, s.role);
  if (!r) throw new Error(`No choice "${s.role}" in §${s.at}`);
  return { layer: '', ...r, ref: s.at };
}

/** Applies a table's edits to its §19 base rows */
export function resolve(t: Table, look: Lookup): Row[] {
  const rows: Row[] = t.base ? (look.caseRows(t.base) ?? []).map((r) => ({ ...r, ref: t.base })) : [];
  for (const e of t.edits) {
    const i = rows.findIndex((r) => r.layer === e.layer);
    if (e.src === null) {
      if (i >= 0) rows.splice(i, 1);
      continue;
    }
    const row = { ...value(e.src, look), layer: e.layer, edited: !!t.base };
    if (i >= 0) rows[i] = row;
    else rows.push(row);
  }
  return rows;
}

/** Every Src a decision can reference, for building lookups */
export const sources = (d: Decision): Src[] => d.tables.flatMap((t) => t.edits.flatMap((e) => (e.src ? [e.src] : [])));

// Every answer combination the UI can produce for a kind
export function* allAnswers(kind: Kind): Generator<Answers> {
  const qs = questionsFor(kind);
  const opts = (q: keyof Answers) => qs.find((x) => x.q === q)?.opts.map((o) => o[0]) ?? [DEFAULTS[q] as string];
  const consOpts = qs.find((x) => x.q === 'cons')?.opts.map((o) => o[0]) ?? [];
  const consSets = Array.from({ length: 1 << consOpts.length }, (_, m) => consOpts.filter((_, i) => m & (1 << i)));
  for (const load of opts('load'))
    for (const env of opts('env'))
      for (const team of opts('team'))
        for (const stage of opts('stage')) for (const cons of consSets) yield { load, env, team, stage, cons };
}
