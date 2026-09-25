// The kit pages' marginalia: for each §19 case, its §26 starter commands and the §27 tools it uses
import { headText, SEC, SECS } from './guide';
import { CASE_ROWS } from './lookup';
import { TOOLS } from './tools';

export const kitCases = () => {
  const cmds = SEC.get(SECS.commands)?.blocks ?? [];
  return (SEC.get(SECS.cases)?.blocks ?? []).flatMap((b) => {
    if (b.t !== 'h3' || !/^\d+-\d+$/.test(b.id)) return [];
    // §26 headings name their case: "### 26-4. 業務システム・Rails構成（§19-4）"
    const commands = cmds.flatMap((h) => (h.t === 'h3' && h.text.includes(`（§${b.id}）`) ? [h.id] : []));
    const tools = (CASE_ROWS.get(b.id) ?? []).flatMap((r) => r.tools);
    const prof = [...new Set(tools.flatMap((id) => TOOLS.get(id)?.prof.map((p) => p.name) ?? []))];
    return [{ id: b.id, title: headText(b.text), commands, prof }];
  });
};

const count = (id: string, f: (b: NonNullable<ReturnType<typeof SEC.get>>['blocks'][number]) => number) =>
  (SEC.get(id)?.blocks ?? []).reduce((n, b) => n + f(b), 0);
export const checkTotal = () => count(SECS.checklist, (b) => (b.t === 'check' ? b.items.length : 0));
export const profTotal = () => count(SECS.prof, (b) => (b.t === 'data' && b.d.kind === 'prof' ? b.d.rows.length : 0));
export const commandTotal = () => count(SECS.commands, (b) => (b.t === 'h3' ? 1 : 0));
