// Default column headings per data block kind (kept apart from the Zod schemas so browser code stays small)
import type { DataKind } from './schema';

export const HEADS: Record<DataKind, string[]> = {
  choices: ['役割', '既定', '代替と乗り換え条件'],
  uses: ['状況', '選ぶ言語'],
  stack: ['レイヤー', '採用'],
  rationale: ['技術', '採用の根拠', 'よくある懸念と回答'],
  growth: ['始めの構成', '移行先', '移行のきっかけ', '最初からやっておく備え'],
  cost: ['サービス', '主な課金の軸', '膨らみやすい要因', '対策'],
  prof: ['ツール', '区分', '習熟度'],
};
