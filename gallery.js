import { loadArchive } from './archive.js';
import { MACHINES, draftMachine } from './profiles.js?v=archive';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});

const silhouettes = {
  olympia: 'M6 15q3-6 8-6h20q4 0 7 6l3 7H3z',
  lettera: 'M7 13q1-3 6-3h22q4 0 6 4l2 7H4z',
  selectric: 'M5 12q0-3 4-3h29q4 0 4 4v9H5z',
  unknown: 'M8 13q2-3 5-3h21q4 0 6 4l3 8H5z',
};

function machineIcon(machine) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 28');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path fill="#f9f3e4" stroke="#68574a" d="M16 2h16v10H16z"/><path fill="none" stroke="#483a33" stroke-width="2" d="M7 10h34"/><path data-body stroke="#483a33" stroke-linejoin="round"/><path fill="#453832" d="M12 16h24l2 4H10z"/><path fill="none" stroke="#ebe2d1" stroke-linecap="round" d="M15 18h2m3 0h2m3 0h2m3 0h2"/>';
  const body = svg.querySelector('[data-body]');
  body.setAttribute('d', silhouettes[machine] || silhouettes.unknown);
  body.setAttribute('fill', MACHINES[machine]?.color || '#a59883');
  return svg;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function draftCard(draft) {
  const machine = draftMachine(draft);
  const model = MACHINES[machine]?.name || 'Typewriter unknown';
  const first = draft.lines.findIndex(line => typeof line === 'string' && line.trim());
  const firstLine = draft.lines[first].trim();
  const label = `Page ${String(draft.number).padStart(2, '0')}`;
  const row = node('li');
  const link = node('a', 'draft-card');
  const url = new URL('./', location.href);
  url.searchParams.set('draft', draft.id);
  link.href = url;
  link.setAttribute('aria-label', `Open ${label.toLowerCase()}, ${firstLine.slice(0,80)}, ${model}`);

  const preview = node('div', 'sheet-preview');
  preview.setAttribute('aria-hidden', 'true');
  preview.append(node('p', '', draft.lines.slice(first,first+14).join('\n')));
  const meta = node('span', 'sheet-meta');
  const machineLabel = node('span', 'sheet-machine');
  machineLabel.append(machineIcon(machine), model);
  meta.append(node('span', 'sheet-number', label), machineLabel);
  link.append(preview, meta);
  row.append(link);
  return row;
}

function groupDrafts(documents) {
  const groups = new Map();
  const sorted = [...documents].sort((a,b) =>
    (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0) || (b.number || 0) - (a.number || 0)
  );
  for (const draft of sorted) {
    if (!draft.lines.some(line => typeof line === 'string' && line.trim())) continue;
    const date = new Date(draft.created);
    const label = Number.isNaN(+date) ? 'Date unavailable' : dateFormat.format(date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(draft);
  }
  return groups;
}

const { stored } = await loadArchive();
const groups = groupDrafts(stored.documents);
const status = document.getElementById('gallery-status');
if (!groups.size) status.textContent = 'Drafts will appear here after you type on a sheet.';
else {
  const gallery = document.getElementById('drafts');
  const content = document.createDocumentFragment();
  for (const [date, drafts] of groups) {
    const section = node('section','draft-day');
    const heading = node('h2','',date);
    const grid = node('ul','draft-grid');
    grid.setAttribute('role','list');
    for (const draft of drafts) grid.append(draftCard(draft));
    section.append(heading,grid);
    content.append(section);
  }
  gallery.append(content);
  status.textContent = '';
}
