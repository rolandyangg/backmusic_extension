// Tiny promise-based IndexedDB key-value store. Used for the large data (uploaded images,
// presets that embed images) that would blow localStorage's ~5MB cap — IndexedDB uses the
// browser's much larger origin quota (the same quota navigator.storage.estimate() reports).
// One database ("backmusic"), one object store ("kv"). No dependencies.

const DB_NAME = 'backmusic';
const STORE = 'kv';
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        // A failing write (e.g. QuotaExceededError) surfaces via the request error.
        t.onabort = () => reject(t.error || (req && req.error));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error || (req && req.error));
      }),
  );
}

export function idbGet(key) {
  return tx('readonly', (store) => store.get(key));
}

export function idbSet(key, value) {
  return tx('readwrite', (store) => store.put(value, key));
}

export function idbDel(key) {
  return tx('readwrite', (store) => store.delete(key));
}
