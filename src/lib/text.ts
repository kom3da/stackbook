// Pure text helpers shared by build-time code and browser scripts

export const plain = (t: string) => t.replace(/\*\*|`/g, '');

const JP = /[　-鿿＀-￯]/;

// Split a stack description into tool-like tokens
// e.g. "PostgreSQL＋Drizzle（SQLに近い）" → ["PostgreSQL", "Drizzle"], "Zodでスキーマ定義" → ["Zod"]
export function tokens(t: string): string[] {
  return plain(t.replace(/`[^`]*`/g, ''))
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .split(/＋|\+|／| \/ |、|。|：| または |・(?=[A-Za-z])|→|\/(?=[A-Z])/)
    .flatMap((x) => {
      const lead = x.replace(/^[^A-Za-z0-9.#]+/, '');
      const [head, ...rest] = lead.split(JP);
      const tok = head.trim();
      // Short acronyms glued to Japanese are words in a sentence ("メタデータAPI", "CI必須", "GMOペイメント…")
      const glued = JP.test(x.slice(0, x.length - lead.length).slice(-1)) || (rest.length > 0 && !/\s$/.test(head));
      if (glued && /^[A-Z]{1,4}$/.test(tok)) return [];
      // Paths such as ".github" or ".kamal/secrets" are not tools
      return tok.startsWith('.') && !/^\.NET/.test(tok) ? [] : [tok];
    })
    .filter((x) => /[A-Za-z]/.test(x) && x.length > 1);
}

// Dictionary key: case/space-insensitive, trailing major version dropped ("Rails 8" → "rails")
export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/ \d+$/, '');

// "Rails" matches "Rails 8" and "ECS" matches "ECS on Fargate", but "Go" does not match "GoReleaser"
export const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
};
