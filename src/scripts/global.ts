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
  for (const s of document.querySelectorAll<HTMLSelectElement>('select.prof')) s.value = p[s.dataset.tool ?? ''] ?? '';
}
function syncChecks() {
  const c = load(CKEY);
  for (const i of document.querySelectorAll<HTMLInputElement>('input[data-ck]')) i.checked = !!c[i.dataset.ck ?? ''];
}
export function hydrate() {
  syncProf();
  syncChecks();
}

document.addEventListener('change', (e) => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLSelectElement && t.matches('select.prof')) {
    const p = loadProf();
    const k = t.dataset.tool ?? '';
    if (t.value) p[k] = t.value;
    else delete p[k];
    save(PKEY, p);
    syncProf();
  } else if (t instanceof HTMLInputElement && t.dataset.ck) {
    const c = load(CKEY);
    if (t.checked) c[t.dataset.ck] = '1';
    else delete c[t.dataset.ck];
    save(CKEY, c);
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
    : '<p class="px-3 py-2 text-sm text-mute">見つからない</p>';
  const stat = document.getElementById('qstat');
  if (stat) stat.textContent = res.length ? `${res.length}件の候補` : '見つからない';
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
// The chain of opened references is kept in ?ref= so the browser's back button walks it.
const peek = document.getElementById('peek') as HTMLDialogElement | null;
const peekBody = document.getElementById('peek-body');
const crumbs = document.getElementById('peek-crumbs');
const WIDE = matchMedia('(min-width: 1280px)');
type Entry = { urls: string[]; label: string };
let trail: Entry[] = [];
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
  if (push) history.pushState({ ref: true }, '', href);
  else history.replaceState(history.state, '', href);
}

function drawCrumbs() {
  if (!crumbs) return;
  crumbs.replaceChildren(
    ...trail.map((e, i) => {
      const li = document.createElement('li');
      if (i === trail.length - 1) {
        li.textContent = e.label;
        li.setAttribute('aria-current', 'step');
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = e.label;
        b.dataset.crumb = String(i);
        li.append(b);
      }
      return li;
    }),
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
  const wasOpen = peek.open;
  openPane();
  if (peekBody) peekBody.scrollTop = 0;
  peekBody?.querySelector<HTMLElement>('.peek-h h2')?.focus({ preventScroll: true });
  if (mode !== 'none') writeUrl(mode === 'push' && !wasOpen);
  return true;
}

function closePane() {
  if (!peek?.open) return;
  peek.close();
}
peek?.addEventListener('close', () => {
  document.body.classList.remove('ref-open');
  if (!trail.length) return;
  trail = [];
  // Leave the pane's history entry if we made one, so Back doesn't reopen it
  if (history.state?.ref) history.back();
  else writeUrl(false);
  opener?.focus({ preventScroll: true });
  opener = null;
});
crumbs?.addEventListener('click', (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-crumb]')?.dataset.crumb;
  if (i !== undefined) showTrail(trail.slice(0, Number(i) + 1), 'replace');
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

// The make island asks for several tools at once
window.addEventListener('stackbook:peek', (e) => {
  const hrefs = (e as CustomEvent<{ hrefs: string[] }>).detail.hrefs;
  const urls = hrefs.map((h) => fragmentOf(h)).filter((x): x is string => !!x);
  opener = document.activeElement as HTMLElement | null;
  if (urls.length) showTrail([{ urls, label: '' }], peek?.open ? 'replace' : 'push');
});

document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-peek-close]') || (e.target === peek && peek?.matches(':modal'))) {
    closePane();
    return;
  }
  const a = t.closest<HTMLAnchorElement>('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  // Moving between pages stays a page move
  if (a.closest('.peek-more, .pager, .side-nav, header nav, nav[aria-label="主要"]')) return;
  const frag = fragmentOf(a.getAttribute('href') ?? '');
  if (!frag) return;
  e.preventDefault();
  if (qres) qres.hidden = true;
  // Following a link inside the pane extends the chain; one from the page starts a new chain
  const inside = !!peek?.contains(a);
  if (!inside) opener = a;
  const entry = { urls: [frag], label: '' };
  const ok = await showTrail(inside ? [...trail, entry] : [entry], peek?.open ? 'replace' : 'push');
  if (!ok) location.href = a.href;
  // A step reference (§N-M 手順K) scrolls the pane to that step
  const step = new URL(a.href).hash.slice(1);
  if (ok && /-s\d+$/.test(step)) peekBody?.querySelector(`#${CSS.escape(step)}`)?.scrollIntoView({ block: 'start' });
});

// The make island re-renders on its own; sync its controls after each render
window.addEventListener('stackbook:render', hydrate);
hydrate();
