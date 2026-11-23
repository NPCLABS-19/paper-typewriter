export const COLUMNS = 68;
export const WARNING_COLUMN = COLUMNS - 8;
export const TAB_SIZE = 5;
export const STORAGE_KEY = 'paper.typewriter.v1';

/** Text is entered and erased at the current end of the sheet. */
export class Typewriter {
  constructor(saved) {
    this.documents = [];
    this.activeId = '';
    if (saved?.version === 1 && Array.isArray(saved.documents)) {
      this.documents = saved.documents.filter(d => typeof d.id === 'string' && Array.isArray(d.lines))
        .map((d,i) => ({ id: d.id, number: Number.isInteger(d.number) ? d.number : i + 1,
          created: validTime(d.created) ? d.created : new Date().toISOString(),
          updated: validTime(d.updated) ? d.updated : undefined,
          lines: d.lines.map(l => typeof l === 'string' ? Array.from(l).slice(0, COLUMNS).join('') : ''),
          ribbons: Array.isArray(d.ribbons) ? d.ribbons.map(line => typeof line === 'string' ? line.slice(0,COLUMNS) : '') : [] }));
      this.activeId = saved.activeId;
    }
    if (!this.documents.length) this.newDocument();
    if (!this.documents.some(d => d.id === this.activeId)) this.activeId = this.documents.at(-1).id;
    if (!this.current.lines.length) this.current.lines = [''];
  }
  get current() { return this.documents.find(d => d.id === this.activeId); }
  get row() { return this.current.lines.length - 1; }
  get column() { return Array.from(this.current.lines.at(-1)).length; }
  get text() { return this.current.lines.join('\n'); }
  get full() { return this.column >= COLUMNS; }
  ribbonAt(row, column) { return this.current.ribbons[row]?.[column] || 'o'; }
  markEdited() {
    const previous=Date.parse(this.current.updated) || 0;
    this.current.updated=new Date(Math.max(Date.now(),previous+1)).toISOString();
  }
  type(char, ribbon = 'o') {
    if (!char || /[\r\n\t\x00-\x1f\x7f]/.test(char) || this.full) return { accepted: false, locked: this.full };
    char = Array.from(char)[0];
    const column = this.column;
    const marks = this.current.ribbons[this.row] || '';
    this.current.ribbons[this.row] = marks.slice(0,column).padEnd(column,'o') + ribbon;
    this.current.lines[this.row] += char;
    this.markEdited();
    return { accepted: true, char, row: this.row, column: this.column - 1, bell: this.column === WARNING_COLUMN };
  }
  eraseLast() {
    const line = this.current.lines[this.row];
    if (line.length) {
      const characters = Array.from(line);
      const char = characters.pop();
      this.current.lines[this.row] = characters.join('');
      if (this.current.ribbons[this.row]) this.current.ribbons[this.row] = this.current.ribbons[this.row].slice(0,characters.length);
      this.markEdited();
      return { char, row: this.row, column: characters.length };
    }
    if (this.row === 0) return null;
    this.current.lines.pop();
    this.current.ribbons.length = Math.min(this.current.ribbons.length,this.current.lines.length);
    this.markEdited();
    return { char: '\n' };
  }
  returnCarriage() {
    const distance = this.column;
    this.current.lines.push('');
    this.markEdited();
    return distance;
  }
  tab() {
    const count = Math.min(TAB_SIZE - this.column % TAB_SIZE, COLUMNS - this.column);
    return Array.from({length: count}, () => this.type(' '));
  }
  newDocument() {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const number = (this.documents.at(-1)?.number || 0) + 1;
    this.documents.push({ id, number, created: new Date().toISOString(), lines: [''], ribbons: [] });
    this.activeId = id;
    return id;
  }
  select(id) { if (this.documents.some(d => d.id === id)) this.activeId = id; }
  serialize() { return { version: 1, activeId: this.activeId, documents: this.documents }; }
}

function validTime(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
