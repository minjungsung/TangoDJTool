import { createSHA256 } from 'hash-wasm';

const chunkSize = 1024 * 1024;

export async function streamHash(file) {
  if (!Number.isSafeInteger(file?.size) || file.size < 0 || typeof file.slice !== 'function') throw new Error('The audio file could not be read for identity verification.');
  const hash = await createSHA256(); hash.init();
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size);
    const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    if (bytes.length !== end - offset) throw new Error('The audio file could not be fully read for identity verification.');
    hash.update(bytes);
  }
  return hash.digest();
}
