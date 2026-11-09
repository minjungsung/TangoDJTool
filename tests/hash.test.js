import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { streamHash } from '../src/stream-hash.js';
import { contentHash } from '../src/file-sources.js';

test('shared streamed SHA-256 matches independent empty and standard vectors', async () => {
  assert.equal(await streamHash(new Blob([])), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(await streamHash(new Blob(['abc'])), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('large recordings are read sequentially in at most one-mebibyte slices without a full-file read', async () => {
  const size = 2 * 1024 * 1024 + 17, reads = [], expected = createHash('sha256');
  const bytes = (start, end) => Uint8Array.from({ length: end - start }, (_, index) => (start + index) % 251);
  for (let offset = 0; offset < size; offset += 1024 * 1024) expected.update(bytes(offset, Math.min(size, offset + 1024 * 1024)));
  const file = {
    size,
    arrayBuffer() { throw new Error('A full-file allocation is forbidden'); },
    slice(start, end) { reads.push([start, end]); return { arrayBuffer: async () => bytes(start, end).buffer }; },
  };
  assert.equal(await streamHash(file), expected.digest('hex'));
  assert.deepEqual(reads, [[0, 1048576], [1048576, 2097152], [2097152, size]]);
});

test('unreadable, malformed and truncated file inputs never produce an accepted digest', async () => {
  for (const file of [null, {}, { size: -1, slice() {} }, { size: NaN, slice() {} }]) await assert.rejects(streamHash(file), /could not be read/);
  await assert.rejects(streamHash({ size: 1, slice: () => ({ arrayBuffer: async () => { throw new Error('File disconnected'); } }) }), /File disconnected/);
  await assert.rejects(streamHash({ size: 2, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) }), /fully read/);
});

test('concurrent streaming uses independent SHA-256 states', async () => {
  const inputs = ['first recording', 'another recording'];
  assert.deepEqual(await Promise.all(inputs.map(value => streamHash(new Blob([value])))), inputs.map(value => createHash('sha256').update(value).digest('hex')));
});

test('a page without Worker support still verifies content and rejects unreadable bytes', async () => {
  assert.equal(await contentHash(new Blob(['abc'])), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await assert.rejects(contentHash({ size: 1, slice: () => ({ arrayBuffer: async () => { throw new Error('File disconnected'); } }) }), /File disconnected/);
});
