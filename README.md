# stackbook

ケース別の技術スタック・周辺ツール選定ガイド。`content/guide/` の Markdown（表は YAML ブロック）と `content/tools.yaml` を正本とし、Astro で静的サイトに変換して閲覧する。

- **作る**：作るものと条件を選ぶと、推奨構成・根拠・構成図・雛形コマンドを1画面に表示する
- **辞書**：言語・ライブラリ・サービスを名前から引き、既定・代替・根拠・費用・移行先をまとめて表示する
- **分野／考え方／手元**：ガイドの各セクション
- **AIエージェント向け**：`/llms.txt` を入口に、同じ内容を Markdown で配信する（下記）

## セットアップ

[mise](https://mise.jdx.dev/) で Node（LTS）・pnpm・gitleaks・actionlint を揃える。

```bash
mise install
pnpm install        # lefthook の Git フックも入る
```

## 開発

```bash
pnpm dev            # http://localhost:4321 （content/ と src/ の変更を監視）
pnpm build          # dist/ に出力
pnpm preview        # dist/ を配信して確認
pnpm test           # Vitest（パーサー・判定ロジック・索引）
pnpm check          # Biome と astro check
```

コミットメッセージは Conventional Commits（`feat: …`、`fix: …`）。lefthook が pre-commit で Biome と gitleaks、commit-msg で書式を検査する。

## 構成

| パス | 役割 |
|---|---|
| `content/guide/*.md` | 本文の正本（セクションごと）。辞書・判定に使う表は YAML ブロック |
| `content/tools.yaml` | ツールの登録簿（id と表示名） |
| `src/lib/schema.ts` | YAML ブロックと登録簿のスキーマ（Zod） |
| `src/lib/guide.ts` | 本文の読み込み・検査 |
| `src/lib/tools.ts` | 辞書の索引（既定・代替・根拠・費用・移行・習熟度） |
| `src/lib/wizard.ts` | 「作る」の判定ロジック（§2-9・§2-10・§19 と一致させる） |
| `src/lib/render.ts` `make.ts` `html.ts` | HTML の描画（`make.ts` と `html.ts` はブラウザでも動く） |
| `src/lib/md.ts` | AIエージェント向け Markdown の生成 |
| `src/pages/` | ルーティング（`/make/<kind>/`、`/dict/<slug>/`、`/s/<id>/` など） |
| `src/scripts/global.ts` | 検索・習熟度・チェックリスト・コピー・Mermaid 描画 |
| `src/styles/global.css` | Tailwind CSS とデザイントークン（ライト／ダーク） |

## AIエージェント向けの配信

HTML を読ませずに済むよう、同じ内容を Markdown でも出力している。

| URL | 内容 |
|---|---|
| `/llms.txt` | 入口。読む順番と各ファイルへのリンク |
| `/make/<kind>.md` | 作るもの別の推奨構成・§19 の構成表と図・雛形コマンド |
| `/s/<id>.md` | 各セクションの原文 |
| `/dict.md`、`/dict/<slug>.md` | 辞書の索引と各項目 |
| `/guide.md` | 全文 |

プロジェクト開始時は、エージェントに `/llms.txt` と該当する `/make/<kind>.md` だけを読ませれば足りる。

## 習熟度とチェックリスト

習熟度とチェックリストはブラウザの localStorage に保存され、サーバーには送られない。習熟度表のページから JSON で書き出し・読み込みできる。
