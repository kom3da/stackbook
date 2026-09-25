// Pure HTML-string helpers shared by pages (build time) and browser scripts

export const esc = (s: string) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

export const secHref = (id: string, sub?: string) => `/s/${id}/${sub ? `#${sub}` : ''}`;
export const toolHref = (slug: string) => `/dict/${slug}/`;

// Inline markdown: `code`, **bold**, §N / §N-M cross references
export const inline = (t: string) =>
  esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/https?:\/\/[^\s<）)、。]+/g, (u) => `<a class="ref" href="${u}" rel="noopener">${u}</a>`)
    .replace(
      /§(\d+)(?:-(\d+))?/g,
      (m, n, sub) => `<a class="ref" href="${secHref(n, sub ? `${n}-${sub}` : undefined)}">${m}</a>`,
    );

const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9_.#+-]/.test(c);

// Link the first occurrence of each tool name found in already-escaped html (text outside tags only)
export function linkNames(html: string, names: string[], slugOf: (name: string) => string | undefined) {
  let out = html;
  for (const n of names) {
    const slug = slugOf(n);
    if (!slug) continue;
    const e = esc(n);
    let done = false;
    let inLink = false;
    out = out.replace(/(<[^>]+>)|([^<]+)/g, (m, tag: string | undefined, text: string | undefined) => {
      if (tag) {
        if (/^<a[\s>]/.test(tag)) inLink = true;
        else if (tag === '</a>') inLink = false;
        return m;
      }
      if (done || inLink || !text) return m;
      // Whole-word match only: "Go" must not match inside "GoReleaser"
      let i = text.indexOf(e);
      while (i >= 0 && (isWord(text[i - 1]) || isWord(text[i + e.length]))) i = text.indexOf(e, i + 1);
      if (i < 0) return m;
      done = true;
      return `${text.slice(0, i)}<a class="tl" href="${toolHref(slug)}">${e}</a>${text.slice(i + e.length)}`;
    });
  }
  return out;
}
