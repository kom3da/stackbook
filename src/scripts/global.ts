// Behaviour shared by every page: proficiency, checklists, copy buttons, search, diagrams

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
  drawDiagrams();
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
    if (a) location.href = a.href;
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

// ---- diagrams: Mermaid is loaded only on pages that have one ----
// Runs are serialized and pick up nodes at run time, since pages may re-render between calls
let drawing = Promise.resolve();
function drawDiagrams() {
  drawing = drawing.then(draw);
}
async function draw() {
  // Skip islands React has not hydrated yet; they fire stackbook:render once they have
  const pending = () =>
    [...document.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])')].filter(
      (n) => !n.closest('astro-island[ssr]'),
    );
  if (!pending().length) return;
  const { default: mermaid } = await import('mermaid');
  const nodes = pending();
  if (!nodes.length) return;
  const base = {
    background: 'transparent',
    fontFamily: '"IBM Plex Sans JP","Hiragino Sans",sans-serif',
    fontSize: '14px',
  };
  const themeVariables = {
    ...base,
    primaryColor: '#E6EEF6',
    primaryBorderColor: '#1F4E79',
    primaryTextColor: '#1B232B',
    lineColor: '#5B6770',
    secondaryColor: '#F7F7F4',
    tertiaryColor: '#FFFFFF',
    edgeLabelBackground: '#FFFFFF',
  };
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables,
    securityLevel: 'strict',
    flowchart: { htmlLabels: false, padding: 14, nodeSpacing: 28, rankSpacing: 36, useMaxWidth: true },
  });
  await mermaid.run({ nodes }).catch((e: unknown) => console.error(e));
}

// The make island re-renders on its own; sync controls and diagrams after each render
window.addEventListener('stackbook:render', hydrate);
hydrate();
