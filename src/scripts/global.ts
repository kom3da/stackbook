// Behaviour shared by every page: proficiency, checklists, copy buttons, search

const PKEY = 'stackbook:prof';
const CKEY = 'stackbook:check';
type Store = Record<string, string>;
const load = (k: string): Store => {
  try {
    return JSON.parse(localStorage.getItem(k) || '{}');
  } catch {
    return {};
  }
};
const save = (k: string, o: Store) => {
  try {
    localStorage.setItem(k, JSON.stringify(o));
  } catch {}
  window.dispatchEvent(new Event(k));
};
export const loadProf = () => load(PKEY);

function syncProf() {
  const p = loadProf();
  for (const b of document.querySelectorAll<HTMLElement>('button[data-prof]'))
    b.setAttribute('aria-pressed', String(p[b.dataset.prof ?? ''] === b.dataset.level));
  for (const r of document.querySelectorAll<HTMLElement>('[data-pl]')) r.dataset.level = p[r.dataset.pl ?? ''] ?? '';
  const rows = [...document.querySelectorAll<HTMLElement>('.prof-grid [data-pl]')];
  // Counts beside the filters, and set/total in the kit index
  for (const n of document.querySelectorAll<HTMLElement>('[data-pf-n]')) {
    const v = n.dataset.pfN ?? '';
    n.textContent = String(
      rows.filter((r) => (v === '' ? true : v === 'unset' ? !r.dataset.level : r.dataset.level === v)).length,
    );
  }
  // Only the §27 tools count toward the table's total; other tools can carry a level too
  for (const n of document.querySelectorAll<HTMLElement>('[data-count="prof"]')) {
    const names = new Set<string>(JSON.parse(n.dataset.names || '[]'));
    n.textContent = `${Object.keys(p).filter((k) => names.has(k)).length}/${n.dataset.total}`;
  }
}
function syncChecks() {
  const c = load(CKEY);
  for (const i of document.querySelectorAll<HTMLInputElement>('input[data-ck]')) i.checked = !!c[i.dataset.ck ?? ''];
  for (const s of document.querySelectorAll<HTMLElement>('[data-ck-seg]'))
    s.classList.toggle('on', !!c[s.dataset.ckSeg ?? '']);
  for (const pr of document.querySelectorAll<HTMLElement>('[data-ck-prog]')) {
    const segs = pr.querySelectorAll('[data-ck-seg]');
    const done = pr.querySelectorAll('[data-ck-seg].on').length;
    const n = pr.querySelector('.ck-n');
    if (n) n.textContent = `${done}／${segs.length} 済み　残り ${segs.length - done}`;
  }
  for (const n of document.querySelectorAll<HTMLElement>('[data-count="check"]')) {
    const sec = n.dataset.sec ?? '';
    n.textContent = `${Object.keys(c).filter((k) => k.startsWith(`${sec}:`)).length}/${n.dataset.total}`;
  }
}
export function hydrate() {
  syncProf();
  syncChecks();
}

document.addEventListener('change', (e) => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLInputElement && t.dataset.ck) {
    const c = load(CKEY);
    if (t.checked) c[t.dataset.ck] = '1';
    else delete c[t.dataset.ck];
    save(CKEY, c);
    syncChecks();
  }
});

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const copy = t.closest<HTMLButtonElement>('button.copy');
  if (copy) {
    const text = copy.parentElement?.querySelector('code')?.textContent ?? '';
    navigator.clipboard?.writeText(text).then(() => {
      copy.textContent = 'コピーしました';
      setTimeout(() => {
        copy.textContent = 'コピー';
      }, 1500);
    });
    return;
  }
  // Proficiency: press a level to set it, press it again to clear
  const lv = t.closest<HTMLButtonElement>('button[data-prof]');
  if (lv) {
    const p = loadProf();
    const k = lv.dataset.prof ?? '';
    if (p[k] === lv.dataset.level) delete p[k];
    else p[k] = lv.dataset.level ?? '';
    save(PKEY, p);
    syncProf();
    return;
  }
  const pf = t.closest<HTMLButtonElement>('button[data-pf]');
  if (pf) {
    for (const b of pf.parentElement?.querySelectorAll('[data-pf]') ?? [])
      b.setAttribute('aria-pressed', String(b === pf));
    const grid = pf.closest('.prof')?.querySelector<HTMLElement>('.prof-grid');
    if (grid) grid.dataset.f = pf.dataset.pf ?? '';
    return;
  }
  const clr = t.closest<HTMLButtonElement>('[data-ck-clear]');
  if (clr) {
    const c = load(CKEY);
    for (const k of Object.keys(c)) if (k.startsWith(`${clr.dataset.ckClear}:`)) delete c[k];
    save(CKEY, c);
    syncChecks();
    return;
  }
  const md = t.closest<HTMLButtonElement>('[data-copy-md]');
  if (md) {
    fetch(md.dataset.copyMd ?? '')
      .then((r) => r.text())
      .then((text) => navigator.clipboard?.writeText(text))
      .then(() => {
        md.dataset.was ??= md.innerHTML;
        md.textContent = 'コピーしました';
        setTimeout(() => {
          md.innerHTML = md.dataset.was ?? '';
        }, 1500);
      });
    return;
  }
  const io = t.closest<HTMLButtonElement>('.prof-io button');
  if (io) {
    const ta = io.parentElement?.querySelector('textarea');
    if (!ta) return;
    if (io.dataset.a === 'exp') {
      ta.value = JSON.stringify(loadProf(), null, 2);
      ta.select();
    } else if (io.dataset.a === 'imp') {
      try {
        const o = JSON.parse(ta.value);
        if (typeof o !== 'object' || !o || Array.isArray(o)) throw new Error('オブジェクトではない');
        save(PKEY, o);
      } catch (err) {
        ta.value = `JSONの形式が正しくない：${(err as Error).message}`;
      }
    } else if (io.dataset.a === 'clr') save(PKEY, {});
    syncProf();
  }
});

// ---- search ----
type Hit = { t: string; s: string; h: string; k: string };
let index: Hit[] | null = null;
const q = document.getElementById('q') as HTMLInputElement | null;
const qres = document.getElementById('qres');
let sel = -1;
function setOpen(open: boolean) {
  if (!q || !qres) return;
  qres.hidden = !open;
  q.setAttribute('aria-expanded', String(open));
  if (!open) q.removeAttribute('aria-activedescendant');
}
function select(i: number) {
  const items = [...(qres?.querySelectorAll<HTMLAnchorElement>('[role="option"]') ?? [])];
  sel = Math.max(0, Math.min(items.length - 1, i));
  items.forEach((a, k) => {
    a.classList.toggle('on', k === sel);
    a.setAttribute('aria-selected', String(k === sel));
  });
  if (items[sel]) q?.setAttribute('aria-activedescendant', items[sel].id);
}
async function results(term: string) {
  const all: Hit[] = index ?? (await fetch('/search.json').then((r) => r.json()));
  index = all;
  const t = term.toLowerCase().trim();
  if (!t) return [];
  const score = (h: Hit) => (h.t.toLowerCase().startsWith(t) ? 0 : h.t.toLowerCase().includes(t) ? 1 : 2);
  return all
    .filter((h) => h.k.includes(t))
    .sort((a, b) => score(a) - score(b))
    .slice(0, 12);
}
const escHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
async function showResults() {
  if (!q || !qres) return;
  if (!q.value.trim()) {
    setOpen(false);
    return;
  }
  const res = await results(q.value);
  sel = -1;
  qres.innerHTML = res.length
    ? res
        .map(
          (r, i) =>
            `<a href="${r.h}" id="qr-${i}" role="option" aria-selected="false" class="block rounded-lg px-3 py-2 no-underline hover:bg-accent-soft [&.on]:bg-accent-soft"><span class="block text-sm font-medium">${escHtml(r.t)}</span><span class="block text-xs text-mute">${escHtml(r.s)}</span></a>`,
        )
        .join('')
    : '<p class="px-3 py-2 text-sm text-mute">該当なし</p>';
  const stat = document.getElementById('qstat');
  if (stat) stat.textContent = res.length ? `${res.length}件の候補` : '該当なし';
  q.removeAttribute('aria-activedescendant');
  setOpen(true);
}
q?.addEventListener('input', showResults);
q?.addEventListener('focus', showResults);
q?.addEventListener('keydown', (e) => {
  const items = [...(qres?.querySelectorAll<HTMLAnchorElement>('[role="option"]') ?? [])];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    select(sel + (e.key === 'ArrowDown' ? 1 : -1));
  } else if (e.key === 'Enter') {
    const a = items[Math.max(sel, 0)];
    a?.click();
  } else if (e.key === 'Escape') {
    q.value = '';
    setOpen(false);
    q.blur();
  }
});
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.search')) setOpen(false);
});
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName ?? '';
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    q?.focus();
  }
});

// ---- peek: tool and section links open beside the page instead of navigating ----
// Wide screens keep the page usable next to it (a non-modal pane); narrower ones get a modal sheet.
// The chain of opened references is kept in ?ref=, one history entry per step, so Back walks it step by step.
const peek = document.getElementById('peek') as HTMLDialogElement | null;
const peekBody = document.getElementById('peek-body');
const crumbs = document.getElementById('peek-crumbs');
const strips = document.getElementById('peek-strips');
const back = document.getElementById('peek-back');
const WIDE = matchMedia('(min-width: 1280px)');
type Entry = { urls: string[]; label: string };
let trail: Entry[] = [];
// The last closed trail, so the phone bar's 参照 button can reopen it
let lastTrail: Entry[] = [];
let opener: HTMLElement | null = null;

/** Fragment URL for a link, or null when the link should navigate normally */
function fragmentOf(href: string): string | null {
  const u = new URL(href, location.href);
  if (u.origin !== location.origin) return null;
  if (/^\/dict\/[^/]+\/$/.test(u.pathname)) return `${u.pathname}peek.html`;
  const m = u.pathname.match(/^\/s\/([^/]+)\/$/);
  if (!m) return null;
  // A reference into the page being read just scrolls
  if (u.pathname === location.pathname && !peek?.open) return null;
  // #N-M opens that subsection; #N-M-sK (a step inside it) opens the subsection too
  const sub = u.hash.slice(1).match(/^(\d+-\d+)(?:-s\d+)?$/)?.[1];
  return sub ? `/s/${m[1]}/${sub}/peek.html` : `/s/${m[1]}/peek.html`;
}

// Compact form for the URL: /dict/hono/peek.html → d:hono, /s/2/2-10/peek.html → s:2/2-10
const encode = (t: Entry[]) =>
  t
    .map((e) =>
      e.urls
        .map((u) => u.replace(/^\/dict\/(.+)\/peek\.html$/, 'd:$1').replace(/^\/s\/(.+)\/peek\.html$/, 's:$1'))
        .join('+'),
    )
    .join(',');
const decode = (v: string) =>
  v
    .split(',')
    .filter(Boolean)
    .map((e) =>
      e
        .split('+')
        .map((x) => (x.startsWith('d:') ? `/dict/${x.slice(2)}/peek.html` : `/s/${x.slice(2)}/peek.html`))
        .filter((x) => /^\/(dict|s)\/[\w./-]+\/peek\.html$/.test(x) && !x.includes('..')),
    )
    .filter((u) => u.length);

function writeUrl(push: boolean) {
  const u = new URL(location.href);
  if (trail.length) u.searchParams.set('ref', encode(trail));
  else u.searchParams.delete('ref');
  const href = `${u.pathname}${u.search}${u.hash}`;
  if (push) history.pushState({ ref: true, depth: depth() + 1 }, '', href);
  else history.replaceState(history.state, '', href);
}
/** How many history entries the pane has pushed on top of the page */
const depth = (): number => (history.state?.ref ? (history.state.depth ?? 1) : 0);
/** Go back `steps` references: through history when those entries are ours, else by redrawing */
function stepBack(steps: number) {
  if (steps > 0 && depth() > steps) history.go(-steps);
  else showTrail(trail.slice(0, trail.length - steps), 'replace');
}

const button = (label: string, i: number, cls = '') => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.crumb = String(i);
  if (cls) b.className = cls;
  b.textContent = label;
  return b;
};
// Breadcrumb (本文 › earlier › current) and collapsed strips for the earlier references
function drawCrumbs() {
  if (!crumbs || !strips) return;
  const home = document.createElement('li');
  const hb = document.createElement('button');
  hb.type = 'button';
  hb.dataset.peekClose = '';
  hb.textContent = '本文';
  home.append(hb);
  crumbs.replaceChildren(
    home,
    ...trail.map((e, i) => {
      const li = document.createElement('li');
      if (i === trail.length - 1) {
        li.textContent = e.label;
        li.setAttribute('aria-current', 'step');
      } else li.append(button(e.label, i));
      return li;
    }),
  );
  strips.replaceChildren(
    ...trail.slice(0, -1).map((e, i) => {
      const b = button('', i, 'peek-strip');
      b.innerHTML = `<span class="ps-n">${i + 1}</span><span class="ps-l"></span><span class="ps-o">広げる</span>`;
      (b.querySelector('.ps-l') as HTMLElement).textContent = e.label;
      return b;
    }),
  );
  // On phones the chips stay on one line; keep the current one in view
  crumbs.scrollLeft = crumbs.scrollWidth;
  if (back) back.hidden = trail.length < 2;
  // Screen readers hear what opened, not the whole trail again
  const live = document.getElementById('peek-live');
  if (live) live.textContent = trail.length ? `参照を開いた：${trail.at(-1)?.label}（${trail.length}件目）` : '';
  window.dispatchEvent(
    new CustomEvent('stackbook:trail', { detail: { count: (trail.length ? trail : lastTrail).length } }),
  );
}

async function render(urls: string[]): Promise<string | null> {
  try {
    const parts = await Promise.all(
      urls.map(async (u) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error(u);
        return r.text();
      }),
    );
    if (!peekBody) return null;
    peekBody.innerHTML = parts.join('<hr class="peek-sep">');
    return [...peekBody.querySelectorAll('.peek-h h2')].map((h) => h.textContent ?? '').join('・');
  } catch {
    return null;
  }
}

function openPane() {
  if (!peek || peek.open) return;
  if (WIDE.matches) {
    peek.show();
    document.body.classList.add('ref-open');
  } else peek.showModal();
}

/** Show a trail; `mode` says how the URL follows (push a history entry, replace it, or leave it) */
async function showTrail(t: Entry[], mode: 'push' | 'replace' | 'none') {
  const last = t.at(-1);
  if (!peek || !last) return false;
  const label = await render(last.urls);
  if (label === null) return false;
  last.label = label;
  trail = t;
  drawCrumbs();
  hydrate();
  openPane();
  if (peekBody) peekBody.scrollTop = 0;
  peekBody?.querySelector<HTMLElement>('.peek-h h2')?.focus({ preventScroll: true });
  if (mode !== 'none') writeUrl(mode === 'push');
  // Remembered for the home page's 前回たどった順
  try {
    const u = new URL(location.href);
    u.searchParams.set('ref', encode(trail));
    const page = document.querySelector('h1')?.textContent?.trim() ?? document.title;
    localStorage.setItem(
      'stackbook:trail',
      JSON.stringify({ url: `${u.pathname}${u.search}`, page, labels: trail.map((e) => e.label) }),
    );
  } catch {}
  return true;
}

function closePane() {
  if (!peek?.open) return;
  peek.close();
}
peek?.addEventListener('close', () => {
  document.body.classList.remove('ref-open');
  if (!trail.length) return;
  lastTrail = trail;
  trail = [];
  drawCrumbs();
  // Leave all of the pane's history entries, so Back doesn't reopen it
  const d = depth();
  if (d) history.go(-d);
  else writeUrl(false);
  // Back to what opened it; a search result is gone by now, so the search box instead
  if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true });
  else q?.focus({ preventScroll: true });
  opener = null;
});
for (const el of [crumbs, strips])
  el?.addEventListener('click', (e) => {
    const i = (e.target as HTMLElement).closest<HTMLElement>('[data-crumb]')?.dataset.crumb;
    if (i !== undefined) stepBack(trail.length - 1 - Number(i));
  });
back?.addEventListener('click', () => stepBack(1));
// The phone bar reopens the references closed last
window.addEventListener('stackbook:reopen', () => {
  if (lastTrail.length) showTrail(lastTrail, 'push');
});
// Esc closes the pane when focus isn't in a field (the modal sheet handles Esc itself)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !peek?.open || !document.body.classList.contains('ref-open')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as HTMLElement | null)?.tagName ?? '')) return;
  closePane();
});
// Browser back/forward: rebuild the pane from ?ref=
function fromUrl() {
  const t = decode(new URL(location.href).searchParams.get('ref') ?? '').map((urls) => ({ urls, label: '' }));
  if (!t.length) {
    trail = [];
    if (peek?.open) peek.close();
    return;
  }
  // Earlier crumbs need their labels: fetch their headings lazily from the fragments
  Promise.all(
    t.slice(0, -1).map(async (e) => {
      const html = await Promise.all(e.urls.map((u) => fetch(u).then((r) => (r.ok ? r.text() : ''))));
      const d = document.createElement('div');
      d.innerHTML = html.join('');
      e.label = [...d.querySelectorAll('.peek-h h2')].map((h) => h.textContent ?? '').join('・');
    }),
  ).then(() => showTrail(t, 'none'));
}
window.addEventListener('popstate', fromUrl);
if (new URL(location.href).searchParams.has('ref')) fromUrl();

document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-peek-close]') || (e.target === peek && peek?.matches(':modal'))) {
    closePane();
    return;
  }
  const a = t.closest<HTMLAnchorElement>('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  // A link to other conditions on the make page being read changes them in place, keeping the references open
  const to = new URL(a.href, location.href);
  const inPage = to.hash !== '';
  if (
    !inPage &&
    to.origin === location.origin &&
    to.pathname === location.pathname &&
    to.pathname.startsWith('/make/')
  ) {
    e.preventDefault();
    const ref = new URL(location.href).searchParams.get('ref');
    if (ref) to.searchParams.set('ref', ref);
    history.replaceState(history.state, '', `${to.pathname}${to.search}`);
    window.dispatchEvent(new Event('stackbook:answers'));
    return;
  }
  // Moving between pages stays a page move
  if (a.closest('.peek-more, .pager, header nav, nav[aria-label="主要"]')) return;
  if (a.closest('.side-nav') && !a.closest('.backlinks')) return;
  const frag = fragmentOf(a.getAttribute('href') ?? '');
  if (!frag) return;
  e.preventDefault();
  if (qres) qres.hidden = true;
  // Following a link inside the pane extends the chain; one from the page starts a new chain
  const inside = !!peek?.contains(a);
  if (!inside) opener = a;
  const entry = { urls: [frag], label: '' };
  const ok = await showTrail(inside ? [...trail, entry] : [entry], 'push');
  if (!ok) location.href = a.href;
  // A step reference (§N-M 手順K) scrolls the pane to that step
  const step = new URL(a.href).hash.slice(1);
  if (ok && /-s\d+$/.test(step)) peekBody?.querySelector(`#${CSS.escape(step)}`)?.scrollIntoView({ block: 'start' });
});

// ---- diagram zoom: a full-screen view with its own scale ----
const zoom = document.getElementById('zoom') as HTMLDialogElement | null;
const zoomBody = document.getElementById('zoom-body');
let zoomScale = 1;
let zoomW = 0;
function zoomTo(s: number) {
  const svg = zoomBody?.querySelector('svg');
  if (!svg || !zoomBody) return;
  zoomScale = Math.min(4, Math.max(0.25, s));
  svg.style.width = `${Math.round(zoomW * zoomScale)}px`;
}
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (!zoom || !zoomBody) return;
  const fig = t.closest('.diagram');
  if (fig && (t.closest('[data-zoom]') || t.closest('.diagram-svg'))) {
    const svg = fig.querySelector('svg');
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    // Drawn width, from the SVG's own max-width
    zoomW = Number(svg.style.maxWidth.replace('px', '')) || svg.getBoundingClientRect().width;
    copy.removeAttribute('width');
    copy.style.maxWidth = 'none';
    copy.style.maxHeight = 'none';
    copy.style.height = 'auto';
    zoomBody.replaceChildren(copy);
    zoom.showModal();
    // Start by fitting the screen, but never smaller than the drawn size's half
    zoomTo(Math.max(0.5, Math.min((zoomBody.clientWidth - 32) / zoomW, 1.5)));
    return;
  }
  const z = t.closest<HTMLElement>('[data-z]')?.dataset.z;
  if (z) zoomTo(z === 'in' ? zoomScale * 1.25 : z === 'out' ? zoomScale / 1.25 : (zoomBody.clientWidth - 32) / zoomW);
  if (t.closest('[data-zoom-close]') || t === zoom) zoom.close();
});

// ---- the index marks the subsection being read ----
const heads = [...document.querySelectorAll<HTMLElement>('.paper h3[id]')];
if (heads.length && document.querySelector('.side-sub')) {
  const mark = () => {
    // The last heading above the top quarter of the screen
    const cur = heads.filter((h) => h.getBoundingClientRect().top < innerHeight / 4).at(-1) ?? heads[0];
    for (const a of document.querySelectorAll<HTMLAnchorElement>('.side-sub a[href^="#"]'))
      if (a.getAttribute('href') === `#${cur.id}`) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
  };
  addEventListener('scroll', mark, { passive: true });
  mark();
}

// ---- kit: the chosen §19 case decides what the marginalia shows ----
const CASE = 'stackbook:case';
function showCase(id: string) {
  for (const c of document.querySelectorAll<HTMLElement>('[data-case]')) c.hidden = c.dataset.case !== id;
  for (const s of document.querySelectorAll<HTMLSelectElement>('[data-case-pick]')) s.value = id;
}
const pick = document.querySelector<HTMLSelectElement>('[data-case-pick]');
if (pick) {
  let saved = '';
  try {
    saved = localStorage.getItem(CASE) ?? '';
  } catch {}
  showCase(saved && pick.querySelector(`option[value="${CSS.escape(saved)}"]`) ? saved : pick.value);
  document.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLSelectElement) || !t.matches('[data-case-pick]')) return;
    showCase(t.value);
    try {
      localStorage.setItem(CASE, t.value);
    } catch {}
  });
}

// The make island re-renders on its own; sync its controls after each render
window.addEventListener('stackbook:render', hydrate);
hydrate();
