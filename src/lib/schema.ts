// Schemas for the YAML data blocks in content/guide/*.md and for content/tools.yaml
import { z } from 'zod';

const md = z.string().min(1);
const ids = z.array(z.string()).default([]);
const head = z.array(z.string()).optional();
const rows = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ head, rows: z.array(z.object(shape).strict()) }).strict();

export const DATA = {
  /** Role | default | alternatives with switching conditions */
  choices: rows({
    role: md,
    default: md,
    tools: ids,
    alts: z.array(z.object({ name: md.optional(), tools: ids, when: md.optional() }).strict()).default([]),
    note: md.optional(),
  }),
  /** §2-10: constraint or load → language */
  uses: rows({
    situation: md,
    pick: md,
    tools: ids,
    next: md.optional(),
    example: md.optional(),
    reason: md.optional(),
  }),
  /** §19: layer → adopted stack */
  stack: rows({ layer: md, pick: md, tools: ids }),
  /** Why a technology is adopted */
  rationale: rows({ name: md, tools: ids, why: md, concern: md.optional() }),
  /** Migration path when a project grows */
  growth: rows({ from: md, tools: ids, to: md, to_tools: ids, trigger: md, prepare: md }),
  /** How a service is billed */
  cost: rows({ service: md, tools: ids, axis: md, grows: md, action: md }),
  /** Proficiency table; name is the localStorage key */
  prof: rows({ name: md, tools: ids, kind: md }),
};
export type DataKind = keyof typeof DATA;
export type Data = { [K in DataKind]: { kind: K } & z.infer<(typeof DATA)[K]> }[DataKind];

export { HEADS } from './heads';

export const isDataKind = (k: string): k is DataKind => k in DATA;

export function parseData(kind: DataKind, value: unknown): Data {
  return { kind, ...DATA[kind].parse(value) } as Data;
}

export const TOOLS_FILE = z.record(
  z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'tool ids are lowercase-kebab'),
  z.union([
    md,
    z
      .object({
        name: md,
        lang: z
          .string()
          .regex(/^2-\d+$/)
          .optional(),
      })
      .strict(),
  ]),
);

// Every tool id a data block refers to
export function toolIds(d: Data): string[] {
  const out: string[][] = [];
  for (const r of d.rows) {
    out.push(r.tools);
    if ('to_tools' in r) out.push(r.to_tools);
    if ('alts' in r) for (const a of r.alts) out.push(a.tools);
  }
  return out.flat();
}
