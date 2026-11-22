export const COLUMNS = 68;
export const WARNING_COLUMN = COLUMNS - 8;
export const TAB_SIZE = 5;
export const MAX_PAGES = 10;
export const STORAGE_KEY = 'paper.typewriter.v1';

/** Append-only model. There is deliberately no erase or cursor operation. */
export class Typewriter {
  constructor(saved) {
    this.documents = [];
    this.activeId = '';
    if (saved?.version === 1 && Array.isArray(saved.documents)) {
      this.documents = saved.documents.filter(d => typeof d.id === 'string' && Array.isArray(d.lines))
        .map((d,i) => ({ id: d.id, number: Number.isInteger(d.number) ? d.number : i + 1, created: d.created || new Date().toISOString(),
          lines: d.lines.map(l => typeof l === 'string' ? Array.from(l).slice(0, COLUMNS).join('') : '') }));
      this.activeId = saved.activeId;
    }
    this.documents = this.documents.slice(-MAX_PAGES);
    if (!this.documents.length) this.newDocument();
    if (!this.documents.some(d => d.id === this.activeId)) this.activeId = this.documents.at(-1).id;
    if (!this.current.lines.length) this.current.lines = [''];
  }
  get current() { return this.documents.find(d => d.id === this.activeId); }
  get row() { return this.current.lines.length - 1; }
  get column() { return Array.from(this.current.lines.at(-1)).length; }
  get text() { return this.current.lines.join('\n'); }
  get full() { return this.column >= COLUMNS; }
  type(char) {
    if (!char || /[\r\n\t\x00-\x1f\x7f]/.test(char) || this.full) return { accepted: false, locked: this.full };
    char = Array.from(char)[0];
    this.current.lines[this.row] += char;
    return { accepted: true, char, row: this.row, column: this.column - 1, bell: this.column === WARNING_COLUMN };
  }
  returnCarriage() {
    const distance = this.column;
    this.current.lines.push('');
    return distance;
  }
  tab() {
    const count = Math.min(TAB_SIZE - this.column % TAB_SIZE, COLUMNS - this.column);
    return Array.from({length: count}, () => this.type(' '));
  }
  newDocument() {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const number = (this.documents.at(-1)?.number || 0) + 1;
    this.documents.push({ id, number, created: new Date().toISOString(), lines: [''] });
    this.documents = this.documents.slice(-MAX_PAGES);
    this.activeId = id;
    return id;
  }
  select(id) { if (this.documents.some(d => d.id === id)) this.activeId = id; }
  serialize() { return { version: 1, activeId: this.activeId, documents: this.documents }; }
}
