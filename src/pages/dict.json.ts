// Compact name index for the dictionary's 名前で引く panel: n=name, h=href, b=badge, r=role, f=fields (§1–19)
import { GROUPS, plain } from '../lib/guide';
import { dictionary, hrefOf } from '../lib/tools';

const fieldIds = new Set<string>(GROUPS.tools);
export const GET = () => {
  const rows = dictionary().map((t) => {
    const def = t.def[0];
    const alt = t.alt[0];
    const b = t.lang ? '言語' : def ? '既定' : alt ? '代替' : '構成';
    const r = t.lang ? '言語の既定' : def ? plain(def.role) : alt ? plain(alt.row.role) : 'ケース別の構成';
    const f = [...new Set([...t.def.map((x) => x.sec.id), ...t.alt.map((x) => x.row.sec.id)])].filter((id) =>
      fieldIds.has(id),
    );
    return { n: t.name, h: hrefOf(t), b, r, f };
  });
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
};
