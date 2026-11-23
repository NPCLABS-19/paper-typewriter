import { STORAGE_KEY } from './engine.js';

const DATABASE = 'paper.drafts';
const STORE = 'sheets';
const modified = draft => draft.updated || draft.created || '';
let database;

function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

function readBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const records = backup?.documents;
    const documents = Array.isArray(records) ? records.filter(draft =>
      typeof draft?.id === 'string' && Array.isArray(draft.lines)
    ) : [];
    return { activeId: backup?.activeId, documents };
  } catch {
    return { documents: [] };
  }
}

export function saveBackup(activeId, documents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, activeId, documents }));
}

export function saveArchive(db, drafts) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const draft of drafts) {
      const request = store.get(draft.id);
      request.onsuccess = () => {
        if (!request.result || modified(draft) >= modified(request.result)) store.put(draft);
      };
    }
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function loadArchive() {
  const backup = readBackup();
  const sheets = new Map(backup.documents.map(draft => [draft.id, draft]));
  let db;
  try {
    const opened = await openDatabase();
    const records = await new Promise((resolve, reject) => {
      const request = opened.transaction(STORE).objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const archived = new Map(records.map(draft => [draft.id, draft]));
    const migration = backup.documents.filter(draft =>
      !archived.has(draft.id) || modified(draft) > modified(archived.get(draft.id))
    );
    for (const draft of records) {
      if (!sheets.has(draft.id) || modified(draft) >= modified(sheets.get(draft.id))) {
        sheets.set(draft.id, draft);
      }
    }
    if (migration.length) await saveArchive(opened, migration);
    db = opened;
  } catch {
    // Keep the local snapshot usable if IndexedDB is disabled or full.
  }
  const documents = [...sheets.values()].sort((a,b) =>
    (a.number || 0) - (b.number || 0) || (a.created || '').localeCompare(b.created || '')
  );
  return { db, stored: { version: 1, activeId: backup.activeId, documents } };
}
