import { createSHA256 } from 'hash-wasm';
self.onmessage = async ({ data: file }) => {
  try {
    const hash = await createSHA256(); hash.init();
    for (let offset = 0; offset < file.size; offset += 1024 * 1024) hash.update(new Uint8Array(await file.slice(offset, offset + 1024 * 1024).arrayBuffer()));
    self.postMessage({ hash: hash.digest() });
  } catch (error) { self.postMessage({ error: error.message }); }
};
