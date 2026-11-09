import test from 'node:test';
import assert from 'node:assert/strict';
import { DJSession } from '../src/session.js';
import { SessionControls } from '../src/session-ui.js';

const key = 'studio-dj-session';
const local = (id = 'recording', values = {}) => ({ id, title: 'Poema', artist: 'Francisco Canaro', singer: 'Roberto Maida', style: 'Tango', source: 'local', contentHash: 'a'.repeat(64), ...values });
const clip = (track = local(), values = {}) => ({ track, groupId: 'tanda', groupName: 'Opening tanda', occurrenceId: 'first', ...values });

function fixture(initial) {
  const values = new Map(initial === undefined ? [] : [[key, initial]]);
  const writes = [];
  const storage = { getItem: name => values.get(name) ?? null, setItem(name, value) { values.set(name, value); writes.push({ name, value }); } };
  let counter = 0, milliseconds = Date.parse('2026-01-01T12:00:00.000Z');
  const session = new DJSession({ storage, now: () => milliseconds, id: () => `event-${++counter}` });
  return { session, values, writes, storage, advance: () => { milliseconds += 1000; } };
}

test('history starts only on request and repeated callback delivery logs one actual start', () => {
  const { session, writes, advance } = fixture();
  assert.deepEqual(session.current, { id: null, name: '', startedAt: null, events: [] });
  assert.equal(session.recordPlayback(1, clip(), 12), null); assert.equal(writes.length, 0);
  session.start('  Friday milonga  '); advance();
  const event = session.recordPlayback('run-1', clip(), 12);
  assert.equal(session.name, 'Friday milonga');
  assert.equal(event.startedAt, '2026-01-01T12:00:01.000Z'); assert.equal(event.position, 12);
  assert.equal(event.identity, `local:${'a'.repeat(64)}`);
  assert.equal(session.recordPlayback('run-1', clip(), 25), null);
  assert.equal(session.recordPlayback('run-1', clip(), 0), null);
  assert.equal(session.events.length, 1); assert.equal(writes.length, 2);
  session.recordPlayback('run-2', clip(), 0); assert.equal(session.events.length, 2);
  session.recordPlayback('run-2', clip(local(), { occurrenceId: 'second' }), 0); assert.equal(session.events.length, 3);
});

test('source identities recognize renamed duplicates while keeping different audio distinct', () => {
  const { session } = fixture(); session.start('Milonga'); session.recordPlayback(1, clip(), 0);
  assert.equal(session.hasPlayed(local('alias', { title: 'Different metadata' })), true);
  assert.equal(session.hasPlayed(local('different', { contentHash: 'b'.repeat(64) })), false);
  const video = { id: 'video', title: 'Video recording', source: 'youtube', videoId: 'abcdefghijk' };
  session.recordPlayback(2, clip(video), 20);
  assert.equal(session.hasPlayed({ ...video, id: 'other-video-id' }), true);
  assert.equal(session.hasPlayed({ ...video, videoId: 'abcdefghijx' }), false);
  const legacy = local('legacy', { contentHash: undefined }); session.recordPlayback(3, clip(legacy), 0);
  assert.equal(session.hasPlayed(legacy), true);
  assert.equal(session.hasPlayed(local('unidentified-alias', { contentHash: undefined })), false);
  assert.equal(session.hasPlayed(null), false);
});

test('event snapshots retain original metadata and omit file paths, audio and device fields', () => {
  const { session, values } = fixture(); session.start('Milonga');
  const item = clip(local('recording', { fileName: 'original.wav', fileSize: 500, audio: new Uint8Array([1, 2]), deviceId: 'output-device', sourcePath: '/private-music/original.wav' }));
  const event = session.recordPlayback(1, item, 4.25);
  item.track.title = 'Edited later'; item.groupName = 'Renamed later';
  assert.equal(session.events[0].title, 'Poema'); assert.equal(session.events[0].groupName, 'Opening tanda');
  assert.deepEqual(Object.keys(event).sort(), ['id', 'trackId', 'title', 'artist', 'singer', 'style', 'groupName', 'groupId', 'occurrenceId', 'source', 'identity', 'startedAt', 'position'].sort());
  assert.doesNotMatch(values.get(key), /fileName|fileSize|audio|deviceId|sourcePath|private-music|original\.wav/);
  const copy = session.current; copy.events[0].title = 'Mutation'; copy.events.push(event);
  const events = session.events; events[0].artist = 'Mutation';
  assert.equal(session.events.length, 1); assert.equal(session.events[0].title, 'Poema'); assert.equal(session.events[0].artist, 'Francisco Canaro');
});

test('valid history reloads and a new request after reload is not confused with old numeric run IDs', () => {
  const { session, storage } = fixture(); session.start('Milonga'); session.recordPlayback(1, clip(), 0);
  const restored = new DJSession({ storage });
  assert.deepEqual(restored.current, session.current);
  restored.recordPlayback(1, clip(), 42);
  assert.equal(restored.events.length, 2); assert.equal(restored.hasPlayed(local()), true);
});

test('history retains at most the latest 1000 playback events without changing earlier snapshots', () => {
  const { session, values } = fixture(); session.start('Long milonga');
  for (let i = 0; i < 1005; i++) session.recordPlayback(i, clip(local(`track-${i}`, { contentHash: undefined })), i);
  assert.equal(session.events.length, 1000); assert.equal(session.events[0].trackId, 'track-5'); assert.equal(session.events.at(-1).trackId, 'track-1004');
  assert.equal(JSON.parse(values.get(key)).events.length, 1000);
  assert.equal(session.recordPlayback(0, clip(local('track-0', { contentHash: undefined })), 0), null);
  assert.equal(session.events.length, 1000);
});

test('invalid saved data is preserved without silently creating or replacing history', () => {
  const valid = fixture(); valid.session.start('Milonga'); valid.session.recordPlayback(1, clip(), 0);
  const history = valid.session.current;
  const invalidValues = ['{broken', '', 'null', JSON.stringify({ ...history, events: Array(1001).fill(history.events[0]) }), JSON.stringify({ ...history, sourcePath: '/private-music' }), JSON.stringify({ ...history, events: [{ ...history.events[0], deviceId: 'device' }] }), JSON.stringify({ ...history, events: [history.events[0], history.events[0]] }), JSON.stringify({ ...history, name: 'n'.repeat(301) }), JSON.stringify({ ...history, startedAt: 'yesterday' }), 'x'.repeat(2_000_001)];
  for (const initial of invalidValues) {
    const values = new Map([[key, initial]]); let writes = 0;
    const storage = { getItem: name => values.get(name), setItem() { writes++; } };
    assert.throws(() => new DJSession({ storage }), error => error.code === 'invalid-history');
    assert.equal(values.get(key), initial); assert.equal(writes, 0);
  }
});

test('storage errors are exposed, keep committed history intact, and allow a failed log to retry', () => {
  const { session, storage, writes } = fixture(); session.start('Milonga');
  const setItem = storage.setItem;
  storage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  assert.throws(() => session.recordPlayback(1, clip(), 0), error => error.code === 'storage-write');
  assert.equal(session.events.length, 0);
  assert.throws(() => session.start('Replacement'), error => error.code === 'storage-write'); assert.equal(session.name, 'Milonga');
  storage.setItem = setItem;
  assert.ok(session.recordPlayback(1, clip(), 0)); assert.equal(session.events.length, 1); assert.equal(writes.length, 2);
  assert.throws(() => new DJSession({ storage: { ...storage, getItem() { throw new Error('Permission denied'); } } }), error => error.code === 'storage-read');
  assert.throws(() => new DJSession({ storage: {} }), error => error.code === 'storage-unavailable');
});

test('CSV escapes quotations and embedded newlines and neutralizes spreadsheet formulas', () => {
  const { session } = fixture(); session.start('=HYPERLINK("example")');
  session.recordPlayback(1, clip(local('csv', { title: '=SUM(1,2)', artist: '  +1+1', singer: '-2+3', style: '@formula' }), { groupName: 'Opening, "Poema"\nSecond line' }), 12.5);
  session.recordPlayback(2, clip(local('second', { title: '\t=SUM(2,3)', artist: '\nformula', singer: 'Ángel D’Agostino', contentHash: 'b'.repeat(64) })), 0);
  const csv = session.exportCSV();
  assert.match(csv, /^"Session","Session started","Played at"/);
  assert.ok(csv.includes('"\'=HYPERLINK(""example"")"')); assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"\'  +1+1"')); assert.ok(csv.includes('"\'-2+3"')); assert.ok(csv.includes('"\'@formula"'));
  assert.ok(csv.includes('"Opening, ""Poema""\nSecond line"')); assert.ok(csv.includes('"\'\t=SUM(2,3)"')); assert.ok(csv.includes('"\'\nformula"'));
  assert.ok(csv.includes('"Ángel D’Agostino"')); assert.ok(csv.includes('"12.5"')); assert.ok(csv.endsWith('\r\n'));
});

test('starting another session clears played history while retaining delivered playback requests', () => {
  const { session } = fixture(); session.start('First event'); session.recordPlayback(1, clip(), 0);
  session.start('Second event'); assert.equal(session.events.length, 0); assert.equal(session.hasPlayed(local()), false);
  assert.equal(session.recordPlayback(1, clip(), 0), null); assert.equal(session.events.length, 0);
  assert.ok(session.recordPlayback(2, clip(), 0)); assert.equal(session.events.length, 1);
  const temporary = new DJSession({ storage: null }); temporary.start('Temporary session'); temporary.recordPlayback(1, clip(), 0);
  assert.equal(temporary.events.length, 1);
});

test('malformed new playback data cannot alter the saved session', () => {
  const { session, values } = fixture(); session.start('Milonga'); const original = values.get(key);
  for (const position of [-1, Infinity, NaN, '4', 90001]) assert.throws(() => session.recordPlayback(1, clip(), position));
  assert.throws(() => session.recordPlayback('', clip(), 0));
  assert.throws(() => session.recordPlayback(1, clip(local('invalid', { source: 'streaming' })), 0));
  assert.throws(() => session.recordPlayback(1, clip(local('invalid', { title: 't'.repeat(1001) })), 0));
  assert.equal(values.get(key), original); assert.equal(session.events.length, 0);
});

function replaceGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
}

for (const failure of ['invalid name', 'quota failure']) {
  test(`recovering corrupt history preserves original bytes and UI state after ${failure}`, t => {
    const original = '{preserved-corrupt-history';
    const values = new Map([[key, original]]), notices = [];
    let removals = 0;
    replaceGlobal(t, 'localStorage', {
      getItem: name => values.get(name) ?? null,
      setItem(name, value) { if (failure === 'quota failure') throw new DOMException('Full', 'QuotaExceededError'); values.set(name, value); },
      removeItem(name) { removals++; values.delete(name); },
    });
    replaceGlobal(t, 'prompt', () => failure === 'invalid name' ? 'n'.repeat(301) : 'Recovered session');
    replaceGlobal(t, 'confirm', () => true);
    const controls = Object.create(SessionControls.prototype);
    Object.assign(controls, { error: 'Saved history is invalid.', notify: message => notices.push(message), render() {}, refreshLibrary() {} });
    controls.startNew();
    assert.equal(values.get(key), original); assert.equal(removals, 0);
    assert.equal(controls.session, undefined); assert.equal(controls.error, 'Saved history is invalid.');
    assert.equal(notices.length, 1);
  });
}

test('corrupt-history recovery replaces saved bytes only after a successful validated save', t => {
  const values = new Map([[key, '{corrupt']]);
  let reads = 0, removals = 0, renders = 0;
  replaceGlobal(t, 'localStorage', {
    getItem(name) { reads++; return values.get(name) ?? null; },
    setItem: (name, value) => values.set(name, value),
    removeItem(name) { removals++; values.delete(name); },
  });
  replaceGlobal(t, 'prompt', () => '  Recovered session  ');
  replaceGlobal(t, 'confirm', () => true);
  const controls = Object.create(SessionControls.prototype);
  Object.assign(controls, { error: 'Saved history is invalid.', notify() {}, render() { renders++; }, refreshLibrary() {} });
  controls.startNew();
  assert.equal(reads, 0); assert.equal(removals, 0); assert.equal(renders, 1);
  assert.equal(controls.session.name, 'Recovered session'); assert.equal(controls.error, null);
  assert.equal(JSON.parse(values.get(key)).name, 'Recovered session');
});

test('new sessions exclude duplicate callbacks from ongoing playback and include new Play requests', () => {
  const { session } = fixture(); session.start('First session'); session.recordPlayback(1, clip(), 0);
  session.start('Next session');
  assert.equal(session.recordPlayback(1, clip(), 31), null);
  assert.equal(session.events.length, 0);
  assert.ok(session.recordPlayback(2, clip(), 0));
  assert.equal(session.events.length, 1); assert.equal(session.events[0].position, 0);
});

test('duplicate UI callbacks avoid cloning or scanning retained session history', t => {
  const { session } = fixture(); session.start('Milonga'); session.recordPlayback(1, clip(), 0);
  const controls = Object.create(SessionControls.prototype);
  Object.assign(controls, { session, notify() { assert.fail('Duplicate notification'); }, render() { assert.fail('Duplicate render'); }, refreshLibrary() { assert.fail('Duplicate refresh'); } });
  let clones = 0, scans = 0;
  const clone = structuredClone;
  replaceGlobal(t, 'structuredClone', value => { clones++; return clone(value); });
  const hasPlayed = session.hasPlayed.bind(session);
  session.hasPlayed = track => { scans++; return hasPlayed(track); };
  for (let callback = 0; callback < 100; callback++) controls.record(1, clip(), 31);
  assert.equal(clones, 0); assert.equal(scans, 0);
});

test('recording identities reject coerced arrays without altering saved session history', () => {
  const { session, values } = fixture(); session.start('Milonga'); const original = values.get(key);
  assert.throws(() => session.recordPlayback(1, clip(local('invalid', { contentHash: ['a'.repeat(64)] })), 0), /content identity/);
  assert.throws(() => session.recordPlayback(1, clip({ id: 'video', title: 'Video', source: 'youtube', videoId: ['abcdefghijk'] }), 0), /video identity/);
  assert.equal(values.get(key), original); assert.equal(session.events.length, 0);
});
