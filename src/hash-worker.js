import { streamHash } from './stream-hash.js';
self.onmessage = async ({ data: file }) => {
  try {
    self.postMessage({ hash: await streamHash(file) });
  } catch (error) { self.postMessage({ error: error.message }); }
};
