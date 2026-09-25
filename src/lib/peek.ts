// Build-time HTML fragments for the peek dialog: a tool, a section, or one subsection of it
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Blocks } from '../components/Blocks';
import { type Block, GROUP_LABEL, groupOf, guide, headText, type Section, secLabel, subBlocks } from './guide';
import { secHref } from './inline';
import { LINKS } from './view';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** One reference for the pane: its own page and Markdown as actions, then the heading and body */
export const fragment = (eyebrow: string, title: string, body: string, page: string, md: string) =>
  `<header class="peek-h"><div class="peek-acts"><a class="peek-more" href="${esc(page)}">単独ページで開く</a><a class="peek-more" href="${esc(md)}">Markdown</a></div><p class="eyebrow">${esc(eyebrow)}</p><h2 id="peek-title" tabindex="-1">${esc(title)}</h2></header>
<div class="peek-b doc">${body}</div>`;

const render = (blocks: Block[], secId: string) =>
  renderToStaticMarkup(createElement(Blocks, { blocks, secId, links: LINKS }));

export const sectionPeek = (s: Section) =>
  fragment(GROUP_LABEL[groupOf(s.id)], s.title, render(s.blocks, s.id), secHref(s.id), `/s/${s.id}.md`);

/** Subsections that §N-M references can point at */
export const subsections = () =>
  guide.sections.flatMap((s) =>
    s.blocks.flatMap((b) => (b.t === 'h3' && /^\d+-\d+$/.test(b.id) ? [{ s, id: b.id, text: b.text }] : [])),
  );

export const subsectionPeek = (s: Section, id: string, text: string) =>
  fragment(secLabel(s), headText(text), render(subBlocks(s.id, id), s.id), secHref(s.id, id), `/s/${s.id}.md`);
