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
export const saveState = state => write('state', s => s.put(state, 'current'));
export const loadState = async () => request((await db()).transaction('state').objectStore('state').get('current'));
export const saveFile = (id, file) => write('files', s => s.put(file, id));
export const getFile = async id => request((await db()).transaction('files').objectStore('files').get(id));
export const deleteFile = id => write('files', s => s.delete(id));
