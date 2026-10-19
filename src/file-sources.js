import { getFile, getSource } from './storage.js';
export const canConnectFiles = () => typeof window.showOpenFilePicker === 'function';
export const canConnectFolder = () => typeof window.showDirectoryPicker === 'function';
export function contentHash(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.hash); };
    worker.onerror = event => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage(file);
  });
}
export async function resolveSource(track, requestPermission = false) {
  const source = await getSource(track.id);
  if (!source?.handle) {
    const file = await getFile(track.id);
    return { file, status: file ? 'Stored copy' : 'File missing' };
  }
  try {
    let permission = await source.handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted' && requestPermission) permission = await source.handle.requestPermission({ mode: 'read' });
    if (permission !== 'granted') return { status: 'Permission needed' };
    const file = await source.handle.getFile();
    if (track.contentHash && (track.fileSize !== file.size || track.lastModified !== file.lastModified) && await contentHash(file) !== track.contentHash) return { status: 'File changed' };
    return { file, status: 'Ready' };
  } catch { return { status: 'File missing' }; }
}
export async function attachIdentical(track, file, handle) {
  const hash = await contentHash(file);
  if (track.contentHash && track.contentHash !== hash) throw new Error('This is different audio. Use Replace recording to review the change.');
  if (!track.contentHash) throw new Error('Original identity is unavailable. Use Replace recording to review the change.');
  return file;
}
export async function* folderFiles(directory) {
  for await (const handle of directory.values()) {
    if (handle.kind === 'directory') yield* folderFiles(handle);
    else if (/\.(mp3|wav|flac|m4a|ogg|aiff?|opus|aac)$/i.test(handle.name)) yield { handle, file: await handle.getFile() };
  }
}
