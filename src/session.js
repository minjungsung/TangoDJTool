const STORAGE_KEY = 'studio-dj-session';
const MAX_EVENTS = 1000;
const MAX_SAVED_LENGTH = 2_000_000;
const metadataFields = ['title', 'artist', 'singer', 'style', 'groupName'];
const eventFields = new Set(['id', 'trackId', ...metadataFields, 'groupId', 'occurrenceId', 'source', 'identity', 'startedAt', 'position']);

function historyError(message, code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

const text = (value, maximum, required = false) => typeof value === 'string' && value.length <= maximum && (!required || value.trim().length > 0);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && new Date(value).toISOString() === value;

function recordingIdentity(track) {
  if (!track || !text(track.id, 500, true) || !['local', 'youtube'].includes(track.source)) throw new Error('Invalid recording for DJ session history.');
  if (track.source === 'youtube') {
    if (!/^[\w-]{11}$/.test(track.videoId || '')) throw new Error('Invalid video identity for DJ session history.');
    return `youtube:${track.videoId}`;
  }
  if (track.contentHash != null) {
    if (!/^[a-f0-9]{64}$/.test(track.contentHash)) throw new Error('Invalid content identity for DJ session history.');
    return `local:${track.contentHash}`;
  }
  return `local:id:${track.id}`;
}

function validIdentity(event) {
  if (typeof event.identity !== 'string') return false;
  if (event.source === 'youtube') return /^youtube:[\w-]{11}$/.test(event.identity);
  return /^local:[a-f0-9]{64}$/.test(event.identity) || event.identity === `local:id:${event.trackId}`;
}

function validateHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['id', 'name', 'startedAt', 'events'].includes(key))
    || !text(value.id, 500, true) || !text(value.name, 300, true) || !timestamp(value.startedAt)
    || !Array.isArray(value.events) || value.events.length > MAX_EVENTS) throw new Error('Invalid session data.');
  const ids = new Set();
  for (const event of value.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).some(key => !eventFields.has(key))
      || !text(event.id, 500, true) || ids.has(event.id) || !text(event.trackId, 500, true)
      || metadataFields.some(field => !text(event[field], 1000, field === 'title'))
      || (event.groupId != null && !text(event.groupId, 500)) || (event.occurrenceId != null && !text(event.occurrenceId, 500))
      || !['local', 'youtube'].includes(event.source) || !validIdentity(event) || !timestamp(event.startedAt)
      || !Number.isFinite(event.position) || event.position < 0 || event.position > 90000) throw new Error('Invalid session event.');
    ids.add(event.id);
  }
  return value;
}

function csvCell(value) {
  let cell = String(value ?? '');
  // Quoting alone does not prevent spreadsheet formulas from executing.
  if (/^\s*[=+\-@]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

export class DJSession {
  constructor(options = {}) {
    this._storage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage;
    this._now = options.now || (() => Date.now());
    this._id = options.id || (() => crypto.randomUUID());
    this._runs = new Set();
    this._current = { id: null, name: '', startedAt: null, events: [] };
    // Explicit storage: null is a temporary, memory-only recovery workspace.
    if (this._storage === null) return;
    if (!this._storage?.getItem || !this._storage?.setItem) throw historyError('DJ session storage is unavailable.', 'storage-unavailable');
    let saved;
    try { saved = this._storage.getItem(STORAGE_KEY); }
    catch (cause) { throw historyError('DJ session history could not be read. Existing history has been kept.', 'storage-read', cause); }
    if (saved == null) return;
    try {
      if (typeof saved !== 'string' || saved.length > MAX_SAVED_LENGTH) throw new Error('Session history is too large.');
      this._current = structuredClone(validateHistory(JSON.parse(saved)));
    } catch (cause) {
      throw historyError('Saved DJ session history is invalid. It has been kept without changes.', 'invalid-history', cause);
    }
  }

  get name() { return this._current.name; }
  get events() { return structuredClone(this._current.events); }
  get current() { return structuredClone(this._current); }

  _commit(value) {
    validateHistory(value);
    const saved = JSON.stringify(value);
    if (saved.length > MAX_SAVED_LENGTH) throw historyError('DJ session history is too large to save. Export the existing history before starting another session.', 'history-too-large');
    try { this._storage?.setItem(STORAGE_KEY, saved); }
    catch (cause) { throw historyError('DJ session history could not be saved. Music can continue; export the history and retry saving.', 'storage-write', cause); }
    this._current = value;
  }

  start(name) {
    if (!text(name, 300, true)) throw new Error('Choose a DJ session name between 1 and 300 characters.');
    this._commit({ id: this._id(), name: name.trim(), startedAt: new Date(this._now()).toISOString(), events: [] });
    this._runs.clear();
    return this.current;
  }

  recordPlayback(runId, item, sourcePosition = 0) {
    if (!this._current.id) return null;
    if (!(typeof runId === 'string' && runId.length > 0 && runId.length <= 500) && !(typeof runId === 'number' && Number.isFinite(runId))) throw new Error('Invalid playback request for DJ session history.');
    const track = item?.track, identity = recordingIdentity(track);
    const key = JSON.stringify([runId, track.id, item.occurrenceId ?? null, item.groupId ?? null]);
    if (this._runs.has(key)) return null;
    const event = {
      id: this._id(), trackId: track.id, title: track.title, artist: track.artist || '', singer: track.singer || '', style: track.style || '',
      groupName: item.groupName || '', ...(item.groupId != null ? { groupId: item.groupId } : {}),
      ...(item.occurrenceId != null ? { occurrenceId: item.occurrenceId } : {}), source: track.source, identity,
      startedAt: new Date(this._now()).toISOString(), position: sourcePosition,
    };
    this._commit({ ...this._current, events: [...this._current.events, event].slice(-MAX_EVENTS) });
    this._runs.add(key);
    return structuredClone(event);
  }

  hasPlayed(track) {
    if (!track) return false;
    const identity = recordingIdentity(track);
    return this._current.events.some(event => event.identity === identity);
  }

  exportCSV() {
    const header = ['Session', 'Session started', 'Played at', 'Title', 'Orchestra / artist', 'Singer', 'Dance style', 'Tanda / group', 'Source', 'Position (seconds)', 'Recording ID', 'Group ID', 'Occurrence ID', 'Recording identity', 'Event ID'];
    const rows = this._current.events.map(event => [this.name, this._current.startedAt, event.startedAt, event.title, event.artist, event.singer, event.style, event.groupName, event.source, event.position, event.trackId, event.groupId, event.occurrenceId, event.identity, event.id]);
    return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
}
