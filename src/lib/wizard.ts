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
  ['embedded', '組み込み・IoT', 'ファームウェア、マイコン'],
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
      ['p99', '厳しいレイテンシ（p99）', '低レイテンシ'],
      ['domain', '複雑な業務ルール', '複雑な業務'],
      ['batch', '大規模バッチ・ストリーム', 'バッチ'],
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
const BACK: Kind[] = ['web', 'saas', 'toc', 'ai', 'rt'];
export const SHOW: Record<keyof Answers, Kind[]> = {
  load: [...BACK, 'cli', 'data'],
  env: [...BACK, 'site', 'ec', 'data'],
  team: BACK,
  stage: BACK,
  cons: [...BACK, 'desktop', 'data'],
};
export const DEFAULTS: Answers = { load: 'db', env: 'paas', team: 'solo', stage: 'mvp', cons: [] };

type Opt = [string, string, string];
/** Kinds where only some choices change the result; a string picks the shared option as is */
const ONLY: Partial<Record<Kind, Partial<Record<keyof Answers, (Opt | string)[]>>>> = {
  // Team size only changes the language for SaaS (§2-10 手順3)
  web: { team: [['solo', '9人以下', '9人以下'], 'large'] },
  toc: { team: [['solo', '9人以下', '9人以下'], 'large'] },
  ai: { team: [['solo', '9人以下', '9人以下'], 'large'] },
  rt: { team: [['solo', '9人以下', '9人以下'], 'large'] },
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
  ec: { env: ['paas', 'onprem'] },
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
};

const R = (at: string, role: string): Src => ({ at, role });
const C = (c: string, layer: string): Src => ({ case: c, layer });
const T = (text: string, ...tools: string[]): Src => ({ text, tools });

const L: Record<Lang, { n: string; tools: string[]; ref: string; fw: Src; db: Src; job: Src; test: Src }> = {
  ts: {
    n: 'TypeScript',
    tools: ['typescript'],
    ref: '2-1',
    fw: R('2-1', 'HTTPフレームワーク'),
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
  ts: 'TS・マネージド',
  ex: '同時接続が非常に多い・プレゼンスが必要',
};
const HEAVY = T('Rustで切り出し（ワーカー、またはnapi-rs／PyO3でネイティブ拡張）', 'rust', 'napi-rs', 'pyo3');

type Input = Omit<Answers, 'cons'> & { kind: Kind; cons: Set<string> };

function pick(a: Input) {
  const why: string[] = [];
  let lang: Lang | null = null;
  let hard = false;
  let orig: Lang | null = null;
  const c = a.cons;
  if (a.env === 'edge') {
    lang = 'ts';
    hard = true;
    why.push('実行環境がエッジなので、Cloudflare Workersで動くTypeScript（§2-10 手順1）');
  } else if (c.has('unity')) {
    lang = 'cs';
    hard = true;
    why.push('Unityとモデルや通信定義を共有できるC#（§2-10 手順1）');
  } else if (c.has('java')) {
    lang = 'kt';
    hard = true;
    why.push('既存のJava資産と直接連携できるKotlin（§2-10 手順1）');
  } else if (c.has('ms')) {
    lang = 'cs';
    hard = true;
    why.push('Microsoft／Azure環境との親和性が高いC#（§2-10 手順1）');
  } else if (c.has('ml') || (a.kind === 'ai' && a.load === 'cpu')) {
    lang = 'py';
    hard = true;
    why.push('機械学習ライブラリがPythonに集中している（§2-10 手順1）');
  }
  if (!lang) {
    const byLoad: Record<string, [Lang, string]> = {
      conn: ['ex', '大量の常時接続を軽量プロセスと自動復旧で扱えるElixir'],
      p99: ['rust', 'GCによる停止がなく、p99の上振れを抑えられるRust'],
      domain: ['kt', '状態を型で表現しやすく、トランザクション基盤が成熟したKotlin'],
      batch: ['kt', '再実行・中断再開の仕組みが揃ったKotlin（Spring Batch／Kafka Streams）'],
      io: ['ts', '非同期I/Oが書きやすく、フロントと型を共有できるTypeScript'],
    };
    if (byLoad[a.load]) {
      [lang] = byLoad[a.load];
      why.push(`${byLoad[a.load][1]}（§2-10 手順2）`);
    } else {
      if (a.kind === 'web') {
        lang = 'rails';
        why.push('DB中心のCRUDなので性能差は効かない。画面数の多い業務システムはRailsが最も速く作れる（§2-10 手順2）');
      } else if (a.kind === 'saas') {
        lang = a.team === 'solo' ? 'ts' : 'go';
        why.push(
          lang === 'go'
            ? '中規模以上のAPIは、単一バイナリで運用が単純なGoが国内でも定番（§2-10 手順2）'
            : '少人数なのでフロントと同じTypeScriptに揃える（§2-10 手順3）',
        );
      } else if (a.kind === 'rt') {
        lang = 'ex';
        why.push('常時接続とプレゼンスが中核なのでElixir（§2-10 手順2）');
      } else {
        lang = 'ts';
        why.push('フロントと同じ言語に揃えられ、API呼び出し中心の処理に向くTypeScript（§2-10 手順2）');
      }
      if (a.load === 'cpu') why.push('CPU負荷の高い部分だけをRustで切り出す（§2-10 混在ルール）');
    }
  }
  if (!hard && a.stage === 'mvp' && (['go', 'kt', 'rust', 'ex'] as Lang[]).includes(lang)) {
    orig = lang;
    lang = a.kind === 'web' ? 'rails' : 'ts';
    why.push(
      `試作段階なので開発速度を優先して${name(lang)}で始め、本番化の段階で${name(orig)}への切り替え・切り出しを検討する（§2-10 手順3、§24）`,
    );
  }
  if (!hard && a.team === 'solo' && lang === 'go') {
    lang = 'ts';
    why.push('開発者が1〜2人なので、フロントと同じTypeScriptに揃える（§2-10 手順3）');
  }
  return { lang, why, orig };
}

type Edit = Table['edits'][number];
const edit = (layer: string, src: Src | null): Edit => ({ layer, src });

export function decide(kind: Kind, answers: Answers): Decision {
  const a: Input = { ...answers, kind, cons: new Set(answers.cons) };
  const why: string[] = [];
  const refs: string[] = [];
  const notes: string[] = [];
  const cases: string[] = [];
  const tables: Table[] = [];
  const env = a.env;
  let title = '';

  if (BACK.includes(a.kind)) {
    const p = pick(a);
    const l = L[p.lang];
    why.push(...p.why);
    title = l.n;
    const edits: Edit[] = [];
    // Tables built from the language set when no §19 case matches the chosen language
    const composed = (front: Src, auth: Src) => [
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
    let base: string | undefined;
    if (a.kind === 'web') {
      base = p.lang === 'rails' ? '19-4' : p.lang === 'ts' ? '19-5' : undefined;
      if (base) {
        if (env !== 'paas') edits.push(edit('デプロイ', ENV[env]));
      } else edits.push(...composed(p.lang === 'ex' ? R('2-7', '画面') : C('19-5', 'フロント'), R('6', '社内ツール')));
      cases.push(p.lang === 'rails' ? '19-4' : '19-5');
    } else if (a.kind === 'saas') {
      base = '19-6';
      if (p.lang !== 'go') edits.push(edit('バックエンド', l.fw), edit('ジョブ', l.job));
      if (env !== 'paas' && env !== 'aws') edits.push(edit('インフラ', ENV[env]));
    } else if (a.kind === 'toc') {
      base = '19-7';
      if (p.lang !== 'ts' && p.lang !== 'go') edits.push(edit('バックエンド', l.fw));
      if (env !== 'paas') edits.push(edit('インフラ', ENV[env]));
    } else if (a.kind === 'ai') {
      base = '19-8';
      if (p.lang !== 'ts' && p.lang !== 'py') edits.push(edit('AIバックエンド', l.fw));
      if (env !== 'paas') edits.push(edit('インフラ', ENV[env]));
    } else {
      // Real-time: §19-9 is a menu, so pick its row for the language
      edits.push(
        ...composed(
          p.lang === 'ex' ? R('2-7', '画面') : R('3', 'アプリ（SSR・フルスタック）'),
          R('6', 'マネージド（toC・スタートアップ）'),
        ),
        edit('リアルタイム', C('19-9', RT[p.lang] ?? '同時接続が多い（Elixirを採用しない場合）')),
        edit('共同編集', C('19-9', '共同編集')),
        edit('片方向の配信', C('19-9', '片方向で足りる')),
      );
    }
    if (base && !cases.includes(base)) cases.push(base);
    if (a.kind === 'rt') cases.push('19-9');
    if (env === 'aws') edits.push(edit('認証（AWSに集約する場合）', R('6', 'マネージド（AWS中心）')));
    if (a.load === 'cpu' && p.lang !== 'rust') edits.push(edit('重い処理', HEAVY));
    tables.push({ base, edits });
    refs.push('2-10', l.ref);
    if (p.orig)
      notes.push(
        `本番化で${name(p.orig)}に移るときの手順は §24 を確認する。APIをOpenAPIで定義しておくと差し替えやすい。`,
      );
    if (a.team === 'large')
      notes.push(
        '10人以上ならモジュール構造を強制する（TypeScriptならNestJS、Goならパッケージ境界のルール化。§23-4）。',
      );
  } else if (a.kind === 'site') {
    title = 'Astro＋ヘッドレスCMS';
    why.push('静的出力でサーバー保守がほぼ不要、非エンジニアの更新はCMSで賄える（§19-1）');
    tables.push({
      base: '19-1',
      edits: env === 'aws' ? [edit('ホスティング', T('S3＋CloudFront', 's3', 'cloudfront'))] : [],
    });
    cases.push('19-1');
    refs.push('11');
  } else if (a.kind === 'ec') {
    title = 'Shopify または Medusa';
    why.push(
      '独自要件が少なければSaaSに任せるのが最も安全で安い。定期購入・BtoB価格など独自要件が多いならMedusa（§19-2、§19-3）',
    );
    tables.push(
      { title: '独自要件が少ない', base: '19-2', edits: [] },
      { title: '独自要件が多い', base: '19-3', edits: env === 'onprem' ? [edit('インフラ', ENV.onprem)] : [] },
    );
    cases.push('19-2', '19-3');
    refs.push('7', '19-12');
  } else if (a.kind === 'cli') {
    const r = a.load === 'cpu' || a.load === 'p99';
    title = r ? 'Rust' : 'Go';
    why.push(
      r
        ? '起動時間・処理速度を詰める必要があるのでRust（§2-9）'
        : '単一バイナリで配布しやすく、クロスコンパイルも簡単なGo（§2-9）',
    );
    tables.push(
      r
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
    );
    cases.push('19-10');
    refs.push('2-9', r ? '2-5' : '2-2');
  } else if (a.kind === 'devtool') {
    title = 'Rust';
    why.push('近年の高速な開発ツールの主流で、WebAssemblyやネイティブ拡張として他言語に組み込める（§2-9）');
    tables.push({
      edits: [
        edit('言語', R('2-9', '開発者向けツール（Linter、フォーマッタ、ビルドツール、パーサ）')),
        edit('WebAssembly', R('2-5', 'WebAssembly')),
        edit('Node.jsから呼ぶ', R('2-5', 'Node.jsから呼ぶネイティブ拡張')),
        edit('Pythonから呼ぶ', R('2-5', 'Pythonから呼ぶネイティブ拡張')),
        edit('テスト', R('2-5', 'テスト実行')),
        edit('ベンチマーク', R('2-5', 'ベンチマーク')),
        edit('配布', R('2-5', 'バイナリ配布')),
      ],
    });
    refs.push('2-9', '2-5');
  } else if (a.kind === 'desktop') {
    const ms = a.cons.has('ms');
    title = ms ? 'C#（.NET）' : 'Tauri';
    why.push(
      ms
        ? 'Windows専用の業務アプリでMicrosoft環境が中心なら.NET（§2-9）'
        : 'UIはWeb技術、裏側はRustで軽量なバイナリになるTauri（§2-9）',
    );
    tables.push({
      edits: ms
        ? [
            edit('構成', T('C#（.NET）', 'csharp', 'net')),
            edit('SDK', R('2-8', 'SDK')),
            edit('テスト', R('2-8', 'テスト')),
          ]
        : [edit('構成', R('2-5', 'デスクトップアプリ')), edit('フロント', R('3', 'SPA（ログイン後の管理画面など）'))],
    });
    refs.push('2-9', ms ? '2-8' : '2-5');
  } else if (a.kind === 'embedded') {
    title = 'Rust';
    why.push('メモリ安全性とC並みの性能を両立できる（§2-9）');
    tables.push({
      edits: [
        edit('言語', R('2-9', '組み込み・IoT・ファームウェア')),
        edit('非同期フレームワーク', R('2-5', '組み込み（非同期）')),
        edit('テスト', R('2-5', 'テスト実行')),
      ],
    });
    refs.push('2-9', '2-5');
  } else if (a.kind === 'data') {
    const kt = a.load === 'batch' || a.cons.has('java');
    title = kt ? 'Kotlin（Spring Batch）＋SQL' : 'SQL＋Python（Polars）';
    why.push('集計はまずSQLで書くのが最短で、SQLで表現しにくい変換だけPythonにする（§2-9）');
    if (kt) why.push('再実行・中断再開が必要な大規模バッチやストリーム処理はKotlin（§2-10 手順2）');
    tables.push({
      edits: [
        edit('集計', R('2-9', 'データ分析・集計')),
        ...(kt
          ? [edit('バッチ', R('2-6', 'バッチ')), edit('ストリーム', R('2-6', 'ストリーム処理'))]
          : [edit('変換', R('2-4', 'データ処理')), edit('Python環境', R('2-4', 'バージョン・依存管理'))]),
        edit('ワークフロー', R('4-4', 'ワークフロー')),
        edit('実行', ENV[env]),
      ],
    });
    refs.push('2-9', '2-10');
  }
  refs.push('23', '24', '25');
  return { title, tables, why, notes, refs, cases };
}

/** A resolved row, ready to render */
export type Row = { layer: string; text: string; tools: string[]; ref?: string };
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
    const row = { ...value(e.src, look), layer: e.layer };
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
