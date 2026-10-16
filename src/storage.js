const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
let database;
async function db() {
  if (!database) database = new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => { settled = true; reject(new Error('Browser storage did not respond. Try a normal browser tab or retry saving.')); }, 8000);
    let req;
    try { req = indexedDB.open('tango-dj-studio', 1); } catch (error) { clearTimeout(timeout); reject(error); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore('files'); req.result.createObjectStore('state'); };
    req.onsuccess = () => {
      clearTimeout(timeout); if (settled) { req.result.close(); return; } settled = true;
      req.result.onversionchange = () => { req.result.close(); database = null; };
      resolve(req.result);
    };
    req.onerror = () => { clearTimeout(timeout); settled = true; reject(req.error); };
    req.onblocked = () => { clearTimeout(timeout); settled = true; reject(new Error('Browser storage is busy in another tab. Close that tab and retry.')); };
  }).catch(error => { database = null; throw error; });
  return database;
}
async function write(store, action) {
  const tx = (await db()).transaction(store, 'readwrite');
  const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  let operationError;
  try { const operation = action(tx.objectStore(store)); if (operation) operation.onerror = () => { operationError = operation.error; }; }
  catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  try { await done; } catch (error) { throw operationError || error; }
}
const conflictMessage = 'This workspace changed in another tab. Export your edits, then reload to use the latest saved workspace.';
async function writeWorkspace(state, expectedRevision, replacement) {
  const stores = replacement ? ['state', 'files'] : ['state'];
  const tx = (await db()).transaction(stores, 'readwrite'), store = tx.objectStore('state');
  return new Promise((resolve, reject) => {
    let revision, operationError, conflict = false;
    tx.oncomplete = () => resolve(revision);
    tx.onerror = () => reject(operationError || tx.error);
    tx.onabort = () => reject(conflict ? new Error(conflictMessage) : operationError || tx.error);
    const existing = store.get('current');
    existing.onerror = () => { operationError = existing.error; };
    existing.onsuccess = () => {
      const currentRevision = existing.result?.revision || 0;
      if (expectedRevision != null && expectedRevision !== currentRevision) { conflict = true; tx.abort(); return; }
      revision = currentRevision + 1;
      try {
        const saving = store.put({ ...state, revision }, 'current'); saving.onerror = () => { operationError = saving.error; };
        if (replacement) { const file = tx.objectStore('files').put(replacement.file, replacement.id); file.onerror = () => { operationError = file.error; }; }
      } catch (error) { operationError = error; tx.abort(); }
    };
  });
}
export const saveState = (state, expectedRevision) => writeWorkspace(state, expectedRevision);
export const loadState = async () => request((await db()).transaction('state').objectStore('state').get('current'));
// Some WebKit environments cannot persist Blob/File values. Store portable bytes
// on that specific failure; existing Blob records remain readable.
async function recordingData(file) { return { audioBytes: await file.arrayBuffer(), type: file.type }; }
export async function saveFile(id, file) {
  try { await write('files', s => s.put(file, id)); }
  catch (error) {
    if (error?.name !== 'UnknownError') throw error;
    const bytes = await recordingData(file);
    await write('files', s => s.put(bytes, id));
  }
}
export const getFile = async id => {
  const value = await request((await db()).transaction('files').objectStore('files').get(id));
  return value?.audioBytes instanceof ArrayBuffer ? new Blob([value.audioBytes], { type: value.type }) : value;
};
export const deleteFile = id => write('files', s => s.delete(id));


// Commit replacement audio and its metadata in one transaction.
export const replaceRecording = async (id, file, state, expectedRevision) => writeWorkspace(state, expectedRevision, { id, file: await recordingData(file) });

export function storageMessage(error) {
  if (error?.name === 'QuotaExceededError') return 'Browser storage is full. Free space or import fewer files, then retry. Keep your original audio files.';
  if (error?.name === 'SecurityError' || error?.name === 'InvalidStateError') return 'Browser storage is unavailable. Open this site in a normal browser tab and allow website storage.';
  return error?.message || 'Browser storage could not complete this operation. Retry or export a backup.';
}
