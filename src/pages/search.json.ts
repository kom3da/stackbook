import { guide, headText, plain, secLabel } from '../lib/guide';
import { secHref } from '../lib/inline';
import { subsections } from '../lib/peek';
import { category, dictionary, hrefOf } from '../lib/tools';
import { KINDS } from '../lib/wizard';

// Compact search index: t=title, s=subtitle, h=href, k=lowercased search key
export const GET = () => {
  const hits = [
    ...dictionary().map((t) => {
      const s = t.def[0]
        ? `既定：${plain(t.def[0].role)}`
        : t.alt[0]
          ? `代替：${plain(t.alt[0].row.role)}`
          : category(t);
      return { t: t.name, s, h: hrefOf(t), k: `${t.name} ${t.id}`.toLowerCase() };
    }),
    ...KINDS.map(([k, n, d]) => ({ t: n, s: '作る', h: `/make/${k}/`, k: `${n} ${d}`.toLowerCase() })),
    ...guide.sections.map((s) => ({
      t: secLabel(s),
      s: 'ページ',
      h: `/s/${s.id}/`,
      k: `${secLabel(s)} §${s.num}`.toLowerCase(),
    })),
    // Subsections, so §2-10 or its heading finds the part that references point at
    ...subsections().map(({ s, id, text }) => {
      const t = headText(text);
      return { t, s: secLabel(s), h: secHref(s.id, id), k: `${t} ${id} §${id}`.toLowerCase() };
    }),
  ];
  return new Response(JSON.stringify(hits), { headers: { 'Content-Type': 'application/json' } });
};
