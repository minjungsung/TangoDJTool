const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
let database;
async function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const req = indexedDB.open('tango-dj-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('files'); req.result.createObjectStore('state'); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  return database;
}
async function write(store, action) {
  const tx = (await db()).transaction(store, 'readwrite');
  const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  action(tx.objectStore(store)); await done;
}
const conflictMessage = 'This workspace changed in another tab. Export your edits, then reload to use the latest saved workspace.';
async function writeWorkspace(state, expectedRevision, replacement) {
  const stores = replacement ? ['state', 'files'] : ['state'];
  const tx = (await db()).transaction(stores, 'readwrite'), store = tx.objectStore('state');
  return new Promise((resolve, reject) => {
    let revision, conflict = false;
    tx.oncomplete = () => resolve(revision);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(conflict ? new Error(conflictMessage) : tx.error);
    const existing = store.get('current');
    existing.onsuccess = () => {
      const currentRevision = existing.result?.revision || 0;
      if (expectedRevision != null && expectedRevision !== currentRevision) { conflict = true; tx.abort(); return; }
      revision = currentRevision + 1;
      store.put({ ...state, revision }, 'current');
      if (replacement) tx.objectStore('files').put(replacement.file, replacement.id);
    };
  });
}
export const saveState = (state, expectedRevision) => writeWorkspace(state, expectedRevision);
export const loadState = async () => request((await db()).transaction('state').objectStore('state').get('current'));
export const saveFile = (id, file) => write('files', s => s.put(file, id));
export const getFile = async id => request((await db()).transaction('files').objectStore('files').get(id));
export const deleteFile = id => write('files', s => s.delete(id));


// Commit replacement audio and its metadata in one transaction.
export const replaceRecording = (id, file, state, expectedRevision) => writeWorkspace(state, expectedRevision, { id, file });
