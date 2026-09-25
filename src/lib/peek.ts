// Build-time HTML fragments for the peek dialog: a tool, a section, or one subsection of it
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Blocks } from '../components/Blocks';
import { type Block, guide, plain, type Section, secLabel, stripNo, subBlocks } from './guide';
import { secHref } from './inline';
import { LINKS } from './view';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const fragment = (eyebrow: string, title: string, body: string, more: { href: string; label: string }) =>
  `<header class="peek-h"><p class="eyebrow">${esc(eyebrow)}</p><h2 id="peek-title">${esc(title)}</h2></header>
<div class="peek-b doc">${body}</div>
<p class="peek-more"><a class="ref" href="${esc(more.href)}">${esc(more.label)}</a></p>`;

const render = (blocks: Block[], secId: string) =>
  renderToStaticMarkup(createElement(Blocks, { blocks, secId, links: LINKS }));

export const sectionPeek = (s: Section) =>
  fragment(s.num ? `§${s.num}` : '', s.title, render(s.blocks, s.id), { href: secHref(s.id), label: 'ページで読む →' });

/** Subsections that §N-M references can point at */
export const subsections = () =>
  guide.sections.flatMap((s) =>
    s.blocks.flatMap((b) => (b.t === 'h3' && /^\d+-\d+$/.test(b.id) ? [{ s, id: b.id, text: b.text }] : [])),
  );

export const subsectionPeek = (s: Section, id: string, text: string) =>
  fragment(`§${id}`, stripNo(plain(text)), render(subBlocks(s.id, id), s.id), {
    href: secHref(s.id, id),
    label: `${secLabel(s)} をページで読む →`,
  });
