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
export type Decision = {
  title: string;
  rows: { layer: string; text: string; tools: string[] }[];
  why: string[];
  notes: string[];
  /** Section refs such as "2-10" or "24" */
  refs: string[];
  /** §19 subsections such as "19-4" */
  cases: string[];
};

export const KINDS: [Kind, string, string][] = [
  ['web', '業務システム・管理画面', '社内ツール、予約、受発注'],
  ['saas', 'SaaS・Web API', 'B2Bの自社サービス、公開API'],
  ['toc', 'toCサービス', 'Web＋スマホアプリ'],
  ['ai', 'AI・LLMプロダクト', 'LLM API、RAG、エージェント'],
  ['rt', 'リアルタイム', 'チャット、通知、共同編集'],
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
    label: '一番重い負荷',
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
  env: [...BACK, 'site', 'ec', 'data', 'cli'],
  team: BACK,
  stage: BACK,
  cons: [...BACK, 'desktop', 'data'],
};
export const DEFAULTS: Answers = { load: 'db', env: 'paas', team: 'solo', stage: 'mvp', cons: [] };

type Lang = 'ts' | 'go' | 'rails' | 'py' | 'rust' | 'kt' | 'ex' | 'cs';
/** Display text followed by the ids (content/tools.yaml) of the tools it names */
type Part = [text: string, ...tools: string[]];
const L: Record<Lang, { n: Part; fw: Part; db: Part; job: Part; test: Part; ref: string }> = {
  ts: {
    n: ['TypeScript', 'typescript'],
    fw: ['Hono（大人数で構造を強制したいならNestJS）', 'hono', 'nestjs'],
    db: ['PostgreSQL＋Drizzle', 'postgresql', 'drizzle'],
    job: ['BullMQ＋Valkey（Redisを増やしたくなければpg-boss）', 'bullmq', 'valkey', 'pg-boss'],
    test: ['Vitest＋Playwright', 'vitest', 'playwright'],
    ref: '2-1',
  },
  go: {
    n: ['Go', 'go'],
    fw: ['標準net/http（必要ならchi）＋oapi-codegen', 'net-http', 'chi', 'oapi-codegen'],
    db: ['PostgreSQL＋sqlc＋pgx', 'postgresql', 'sqlc', 'pgx'],
    job: ['River', 'river'],
    test: ['標準testing＋testcontainers-go', 'testing', 'testcontainers-go'],
    ref: '2-2',
  },
  rails: {
    n: ['Ruby / Rails 8', 'ruby', 'rails'],
    fw: ['Rails 8', 'rails'],
    db: ['PostgreSQL（ActiveRecord）', 'postgresql', 'active-record'],
    job: ['Solid Queue', 'solid-queue'],
    test: ['Minitest＋システムテスト', 'minitest'],
    ref: '2-3',
  },
  py: {
    n: ['Python', 'python'],
    fw: ['FastAPI', 'fastapi'],
    db: ['PostgreSQL＋SQLAlchemy＋Alembic', 'postgresql', 'sqlalchemy', 'alembic'],
    job: ['Celery', 'celery'],
    test: ['pytest', 'pytest'],
    ref: '2-4',
  },
  rust: {
    n: ['Rust', 'rust'],
    fw: ['axum（Tokio）', 'axum', 'tokio'],
    db: ['PostgreSQL＋sqlx', 'postgresql', 'sqlx'],
    job: ['SQS＋ワーカー', 'sqs'],
    test: ['cargo-nextest', 'cargo-nextest'],
    ref: '2-5',
  },
  kt: {
    n: ['Kotlin', 'kotlin'],
    fw: ['Spring Boot', 'spring-boot'],
    db: ['PostgreSQL＋jOOQ＋Flyway', 'postgresql', 'jooq', 'flyway'],
    job: ['Spring Batch', 'spring-batch'],
    test: ['JUnit 5＋Kotest＋MockK', 'junit', 'kotest', 'mockk'],
    ref: '2-6',
  },
  ex: {
    n: ['Elixir', 'elixir'],
    fw: ['Phoenix', 'phoenix'],
    db: ['PostgreSQL＋Ecto', 'postgresql', 'ecto'],
    job: ['Oban', 'oban'],
    test: ['ExUnit', 'exunit'],
    ref: '2-7',
  },
  cs: {
    n: ['C#', 'csharp'],
    fw: ['ASP.NET Core（Minimal API）', 'asp-net-core'],
    db: ['PostgreSQL＋EF Core', 'postgresql', 'ef-core'],
    job: ['Quartz.NET', 'quartz-net'],
    test: ['xUnit＋NSubstitute', 'xunit', 'nsubstitute'],
    ref: '2-8',
  },
};
const CASE: Partial<Record<Kind, string>> = { saas: '19-6', toc: '19-7', ai: '19-8', rt: '19-9' };
const name = (l: Lang) => L[l].n[0];
// Joins parts into one; used where the text is composed from pieces
const join = (...parts: Part[]): Part => [parts.map((p) => p[0]).join(''), ...parts.flatMap((p) => p.slice(1))];

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
function infra(a: Input, next: boolean): Part {
  if (a.env === 'aws')
    return next
      ? [
          'フロントはVercel（AWSに集約するならOpenNext）、API：ECS on Fargate＋RDS for PostgreSQL＋Terraform',
          'vercel',
          'opennext',
          'ecs-on-fargate',
          'rds',
          'terraform',
        ]
      : ['API：ECS on Fargate＋RDS for PostgreSQL＋Terraform', 'ecs-on-fargate', 'rds', 'terraform'];
  if (a.env === 'onprem')
    return [
      'Docker＋Kamal（オンプレVM／VPS）、PostgreSQLは自前運用（PgBouncer・pgBackRest）',
      'docker',
      'kamal',
      'postgresql',
      'pgbouncer',
      'pgbackrest',
    ];
  if (a.env === 'edge')
    return [
      'Cloudflare Workers＋D1、またはNeon（Hyperdrive経由）',
      'cloudflare-workers',
      'cloudflare-d1',
      'neon',
      'cloudflare-hyperdrive',
    ];
  return next
    ? ['Vercel（フロント）＋Render または Fly.io＋Neon', 'vercel', 'render', 'fly-io', 'neon']
    : ['Render または Fly.io＋Neon', 'render', 'fly-io', 'neon'];
}

export function decide(kind: Kind, answers: Answers): Decision {
  const a: Input = { ...answers, kind, cons: new Set(answers.cons) };
  const parts: [string, Part][] = [];
  const why: string[] = [];
  const refs: string[] = [];
  const notes: string[] = [];
  const cases: string[] = [];
  let title = '';
  if (BACK.includes(a.kind)) {
    const p = pick(a);
    const l = L[p.lang];
    why.push(...p.why);
    title = l.n[0];
    let fe: Part;
    if (a.kind === 'web')
      fe =
        p.lang === 'rails'
          ? [
              'Hotwire（Turbo＋Stimulus）＋tailwindcss-rails＋ViewComponent',
              'hotwire',
              'turbo',
              'stimulus',
              'tailwindcss-rails',
              'viewcomponent',
            ]
          : p.lang === 'ex'
            ? ['Phoenix LiveView', 'phoenix-liveview']
            : [
                'React＋Vite＋TanStack Router／Query＋shadcn/ui',
                'react',
                'vite',
                'tanstack-router',
                'tanstack-query',
                'shadcn-ui',
              ];
    else if (a.kind === 'toc') fe = ['Next.js（Web）＋React Native／Expo（アプリ）', 'next-js', 'react-native', 'expo'];
    else if (a.kind === 'rt' && p.lang === 'ex')
      fe = ['Phoenix LiveView、またはNext.js＋Phoenix Channels', 'phoenix-liveview', 'next-js', 'phoenix-channels'];
    else
      fe =
        a.kind === 'ai'
          ? ['Next.js（ストリーミング表示）', 'next-js']
          : ['Next.js＋shadcn/ui＋TanStack Query', 'next-js', 'shadcn-ui', 'tanstack-query'];
    const next = fe.includes('next-js');
    parts.push(['言語', l.n], ['フロント', fe]);
    if (!(p.lang === 'rails' && a.kind === 'web')) parts.push(['バックエンド', l.fw]);
    else parts.push(['フレームワーク', ['Rails 8（管理画面はAvo、認可はPundit）', 'rails', 'avo', 'pundit']]);
    parts.push(['DB', l.db], ['ジョブ', l.job]);
    const auth: Part = {
      web: join(
        ['社内ならGoogle Workspace／Entra IDのSSO、社外向けは', 'google-workspace', 'microsoft-entra-id'],
        p.lang === 'rails' ? ['Rails 8認証ジェネレータ', 'rails'] : ['Better Auth', 'better-auth'],
      ),
      saas: ['Clerk（SSO・SCIMが必要になったらWorkOS）', 'clerk', 'workos'] as Part,
      toc: ['Supabase Auth または Clerk', 'supabase-auth', 'clerk'] as Part,
      ai: ['Clerk または Better Auth', 'clerk', 'better-auth'] as Part,
      rt: ['Clerk または Better Auth', 'clerk', 'better-auth'] as Part,
    }[a.kind as 'web' | 'saas' | 'toc' | 'ai' | 'rt'];
    parts.push(['認証', a.env === 'aws' ? join(auth, ['（AWSに集約するならCognito）', 'amazon-cognito']) : auth]);
    if (a.kind === 'saas')
      parts.push(['課金・テナント', ['Stripe Billing、テナントIDカラム＋Row Level Security', 'stripe', 'postgresql']]);
    if (a.kind === 'toc')
      parts.push(
        ['プッシュ通知', ['FCM（Expo Notifications）', 'fcm', 'expo-notifications']],
        ['配信', ['EAS Build／Submit／Update', 'eas-build', 'eas-submit', 'eas-update']],
      );
    if (a.kind === 'ai')
      parts.push(
        ['LLM・ベクトル', ['LLM API＋pgvector、評価・トレースはLangfuse', 'pgvector', 'langfuse']],
        ['長時間処理', ['Temporal または Inngest', 'temporal', 'inngest']],
      );
    if (a.kind === 'rt') {
      const rt: Partial<Record<Lang, Part>> = {
        ex: ['Phoenix Channels＋Presence', 'phoenix-channels', 'phoenix-presence'],
        ts: ['Cloudflare Durable Objects（マネージド）', 'cloudflare-durable-objects'],
      };
      parts.push(['リアルタイム', rt[p.lang] ?? ['WebSocket＋Valkey Pub/Sub', 'valkey']]);
    }
    if (a.load === 'cpu' && p.lang !== 'rust')
      parts.push([
        '重い処理',
        ['Rustで切り出し（ワーカー、またはnapi-rs／PyO3でネイティブ拡張）', 'rust', 'napi-rs', 'pyo3'],
      ]);
    parts.push(
      ['テスト', l.test],
      ['インフラ', infra(a, next)],
      ['監視', ['Sentry＋OpenTelemetry（Grafana Cloud）', 'sentry', 'opentelemetry', 'grafana-cloud']],
      ['CI', ['GitHub Actions＋Renovate', 'github-actions', 'renovate']],
    );
    cases.push(a.kind === 'web' ? (p.lang === 'rails' ? '19-4' : '19-5') : (CASE[a.kind] as string));
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
    parts.push(
      ['フロント', ['Astro＋Tailwind CSS', 'astro', 'tailwind-css']],
      ['CMS', ['microCMS（セルフホストならPayload）', 'microcms', 'payload']],
      [
        'ホスティング',
        a.env === 'aws' ? ['S3＋CloudFront', 's3', 'cloudfront'] : ['Cloudflare Pages', 'cloudflare-pages'],
      ],
      [
        'フォーム',
        ['Cloudflare Workers＋Resend、スパム対策にTurnstile', 'cloudflare-workers', 'resend', 'cloudflare-turnstile'],
      ],
      ['検索', ['Pagefind', 'pagefind']],
      ['分析', ['GA4', 'ga4']],
      ['監視', ['Better Stack（外形監視）', 'better-stack']],
    );
    cases.push('19-1');
    refs.push('11');
  } else if (a.kind === 'ec') {
    title = 'Shopify または Medusa';
    why.push(
      '独自要件が少なければSaaSに任せるのが最も安全で安い。定期購入・BtoB価格など独自要件が多いならMedusa（§19-2、§19-3）',
    );
    parts.push(
      [
        '独自要件が少ない',
        ['Shopify（テーマはLiquid、決済はShopify Payments）', 'shopify', 'liquid', 'shopify-payments'],
      ],
      [
        '独自要件が多い',
        ['Medusa＋Next.js＋Stripe／KOMOJU＋Meilisearch', 'medusa', 'next-js', 'stripe', 'komoju', 'meilisearch'],
      ],
      ['インフラ（Medusa）', infra(a, true)],
      ['アクセス集中対策', ['Cloudflare Waiting Room＋静的化（§19-12）', 'cloudflare-waiting-room']],
      ['監視', ['Sentry＋Grafana Cloud', 'sentry', 'grafana-cloud']],
    );
    cases.push('19-2', '19-3');
    refs.push('7');
  } else if (a.kind === 'cli') {
    const r = a.load === 'cpu' || a.load === 'p99';
    title = r ? 'Rust' : 'Go';
    why.push(
      r
        ? '起動時間・処理速度を詰める必要があるのでRust（§2-9）'
        : '単一バイナリで配布しやすく、クロスコンパイルも簡単なGo（§2-9）',
    );
    parts.push(
      ['言語', r ? ['Rust', 'rust'] : ['Go', 'go']],
      ['CLI', r ? ['clap', 'clap'] : ['Cobra', 'cobra']],
      [
        '配布',
        r
          ? ['cargo-dist（クロスコンパイルはcargo-zigbuild）', 'cargo-dist', 'cargo-zigbuild']
          : ['GoReleaser（GitHub Releases・Homebrew tap）', 'goreleaser', 'github-releases', 'homebrew'],
      ],
      ['テスト', r ? ['cargo-nextest', 'cargo-nextest'] : ['標準testing', 'testing']],
      ['脆弱性チェック', r ? ['cargo-audit／cargo-deny', 'cargo-audit', 'cargo-deny'] : ['govulncheck', 'govulncheck']],
    );
    cases.push('19-10');
    refs.push('2-9', r ? '2-5' : '2-2');
  } else if (a.kind === 'devtool') {
    title = 'Rust';
    why.push('近年の高速な開発ツールの主流で、WebAssemblyやネイティブ拡張として他言語に組み込める（§2-9）');
    parts.push(
      ['言語', ['Rust', 'rust']],
      [
        '組み込み先',
        [
          'WebAssembly：wasm-bindgen＋wasm-pack／Node.js：napi-rs／Python：PyO3＋maturin',
          'wasm-bindgen',
          'wasm-pack',
          'napi-rs',
          'pyo3',
          'maturin',
        ],
      ],
      ['テスト', ['cargo-nextest＋criterion（ベンチマーク）', 'cargo-nextest', 'criterion']],
      ['配布', ['cargo-dist', 'cargo-dist']],
    );
    refs.push('2-9', '2-5');
  } else if (a.kind === 'desktop') {
    const ms = a.cons.has('ms');
    title = ms ? 'C#（.NET）' : 'Tauri';
    why.push(
      ms
        ? 'Windows専用の業務アプリでMicrosoft環境が中心なら.NET（§2-9）'
        : 'UIはWeb技術、裏側はRustで軽量なバイナリになるTauri（§2-9）',
    );
    parts.push(
      ['構成', ms ? ['C#（.NET）', 'csharp', 'net'] : ['Tauri（Rust＋React／Vite）', 'tauri', 'rust', 'react', 'vite']],
      ['代替', ['Electron：Node.jsのAPIに強く依存するとき', 'electron']],
    );
    refs.push('2-9', ms ? '2-8' : '2-5');
  } else if (a.kind === 'embedded') {
    title = 'Rust';
    why.push('メモリ安全性とC並みの性能を両立できる（§2-9）');
    parts.push(
      ['言語', ['Rust', 'rust']],
      ['非同期フレームワーク', ['Embassy（厳密な割り込み駆動ならRTIC）', 'embassy', 'rtic']],
      ['代替', ['C：ベンダーSDKがCしかないとき']],
    );
    refs.push('2-9', '2-5');
  } else if (a.kind === 'data') {
    const kt = a.load === 'batch' || a.cons.has('java');
    title = kt ? 'Kotlin（Spring Batch）＋SQL' : 'SQL＋Python（Polars）';
    why.push('集計はまずSQLで書くのが最短で、SQLで表現しにくい変換だけPythonにする（§2-9）');
    if (kt) why.push('再実行・中断再開が必要な大規模バッチやストリーム処理はKotlin（§2-10 手順2）');
    parts.push(
      ['集計', ['SQL（DuckDB／BigQuery／PostgreSQL）', 'sql', 'duckdb', 'bigquery', 'postgresql']],
      [
        '変換',
        kt
          ? ['Kotlin（Spring Batch／Kafka Streams）', 'kotlin', 'spring-batch', 'kafka-streams']
          : ['Python＋Polars（uv、Ruff）', 'python', 'polars', 'uv', 'ruff'],
      ],
      ['ワークフロー', ['Temporal または AWS Step Functions', 'temporal', 'aws-step-functions']],
      ['実行', infra(a, false)],
    );
    refs.push('2-9', '2-10');
  }
  refs.push('23', '24', '25');
  const rows = parts.map(([layer, [text, ...tools]]) => ({ layer, text, tools }));
  return { title, rows, why, notes, refs, cases };
}

// Every answer combination the UI can produce for a kind
export function* allAnswers(kind: Kind): Generator<Answers> {
  const opts = (q: keyof Answers) =>
    SHOW[q].includes(kind) ? (QUESTIONS.find((x) => x.q === q)?.opts.map((o) => o[0]) ?? []) : [DEFAULTS[q] as string];
  const consOpts = QUESTIONS.find((x) => x.q === 'cons')?.opts.map((o) => o[0]) ?? [];
  const consSets = SHOW.cons.includes(kind)
    ? Array.from({ length: 1 << consOpts.length }, (_, m) => consOpts.filter((_, i) => m & (1 << i)))
    : [[]];
  for (const load of opts('load'))
    for (const env of opts('env'))
      for (const team of opts('team'))
        for (const stage of opts('stage')) for (const cons of consSets) yield { load, env, team, stage, cons };
}
