const STORAGE_KEY = 'studio-dj-session';
const MAX_EVENTS = 1000;
const MAX_SAVED_LENGTH = 2_000_000;
const metadataFields = ['title', 'artist', 'singer', 'style', 'groupName'];
const eventFields = new Set(['id', 'trackId', ...metadataFields, 'groupId', 'occurrenceId', 'source', 'identity', 'startedAt', 'position', 'note']);
const MAX_SESSIONS = 100;
const emptySession = () => ({ id: null, name: '', startedAt: null, events: [] });

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
    if (typeof track.videoId !== 'string' || !/^[\w-]{11}$/.test(track.videoId)) throw new Error('Invalid video identity for DJ session history.');
    return `youtube:${track.videoId}`;
  }
  if (track.contentHash != null) {
    if (typeof track.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(track.contentHash)) throw new Error('Invalid content identity for DJ session history.');
    return `local:${track.contentHash}`;
  }
  return `local:id:${track.id}`;
}

function playbackKey(runId, item) {
  if (!(typeof runId === 'string' && runId.length > 0 && runId.length <= 500) && !(typeof runId === 'number' && Number.isFinite(runId))) throw new Error('Invalid playback request for DJ session history.');
  if (!text(item?.track?.id, 500, true)) throw new Error('Invalid recording for DJ session history.');
  return JSON.stringify([runId, item.track.id, item.occurrenceId ?? null, item.groupId ?? null]);
}

function validIdentity(event) {
  if (typeof event.identity !== 'string') return false;
  if (event.source === 'youtube') return /^youtube:[\w-]{11}$/.test(event.identity);
  return /^local:[a-f0-9]{64}$/.test(event.identity) || event.identity === `local:id:${event.trackId}`;
}

export function validateHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['id', 'name', 'startedAt', 'events', 'note'].includes(key))
    || !text(value.id, 500, true) || !text(value.name, 300, true) || !timestamp(value.startedAt)
    || (value.note != null && !text(value.note, 10000)) || !Array.isArray(value.events) || value.events.length > MAX_EVENTS) throw new Error('Invalid session data.');
  const ids = new Set();
  for (const event of value.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).some(key => !eventFields.has(key))
      || !text(event.id, 500, true) || ids.has(event.id) || !text(event.trackId, 500, true)
      || metadataFields.some(field => !text(event[field], 1000, field === 'title'))
      || (event.groupId != null && !text(event.groupId, 500)) || (event.occurrenceId != null && !text(event.occurrenceId, 500))
      || !['local', 'youtube'].includes(event.source) || !validIdentity(event) || !timestamp(event.startedAt)
      || (event.note != null && !text(event.note, 4000)) || !Number.isFinite(event.position) || event.position < 0 || event.position > 90000) throw new Error('Invalid session event.');
    ids.add(event.id);
  }
  return value;
}

export function validateSessionSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['version', 'currentId', 'sessions', 'trash'].includes(key)) || value.version !== 1
    || (value.currentId !== null && !text(value.currentId, 500, true)) || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS
    || !Array.isArray(value.trash) || value.trash.length > MAX_SESSIONS) throw new Error('Invalid session archive.');
  const ids = new Set();
  for (const history of value.sessions) {
    validateHistory(history);
    if (ids.has(history.id)) throw new Error('Duplicate session identity.');
    ids.add(history.id);
  }
  if (value.currentId !== null && !ids.has(value.currentId)) throw new Error('Current session is missing from the archive.');
  for (const entry of value.trash) {
    if (!entry || Object.keys(entry).some(key => !['history', 'deletedAt'].includes(key)) || !timestamp(entry.deletedAt)) throw new Error('Invalid deleted history.');
    validateHistory(entry.history);
    if (ids.has(entry.history.id)) throw new Error('Duplicate session identity.');
    ids.add(entry.history.id);
  }
  return structuredClone(value);
}

export function serializeSessionSnapshot(value) {
  const snapshot = validateSessionSnapshot(value);
  const current = snapshot.sessions.find(history => history.id === snapshot.currentId) || emptySession();
  const archives = snapshot.sessions.filter(history => history.id !== snapshot.currentId);
  const saved = JSON.stringify({ ...current, ...((archives.length || !current.id) ? { archives } : {}), ...(snapshot.trash.length ? { trash: snapshot.trash } : {}) });
  if (saved.length > MAX_SAVED_LENGTH) throw historyError('DJ session history is too large to save. Export histories before permanently deleting older entries from Deleted histories.', 'history-too-large');
  return saved;
}

export function parseSessionSnapshot(value) {
  if (typeof value !== 'string' || value.length > MAX_SAVED_LENGTH) throw new Error('Session history is too large.');
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid session data.');
  const { archives = [], trash = [], ...current } = parsed;
  if (current.id !== null) validateHistory(current);
  else if (JSON.stringify(current) !== JSON.stringify(emptySession()) || !Object.hasOwn(parsed, 'archives')) throw new Error('Invalid empty session.');
  return validateSessionSnapshot({ version: 1, currentId: current.id, sessions: [...archives, ...(current.id ? [current] : [])], trash });
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
    this._current = emptySession(); this._archives = []; this._trash = [];
    // Explicit storage: null is a temporary, memory-only recovery workspace.
    if (this._storage === null) return;
    if (!this._storage?.getItem || !this._storage?.setItem) throw historyError('DJ session storage is unavailable.', 'storage-unavailable');
    // Recovery prepares an empty replacement; start() validates and saves before replacing any bytes.
    if (options.restore === false) return;
    let saved;
    try { saved = this._storage.getItem(STORAGE_KEY); }
    catch (cause) { throw historyError('DJ session history could not be read. Existing history has been kept.', 'storage-read', cause); }
    if (saved == null) return;
    try {
      const snapshot = parseSessionSnapshot(saved);
      this._current = snapshot.sessions.find(history => history.id === snapshot.currentId) || emptySession();
      this._archives = snapshot.sessions.filter(history => history.id !== snapshot.currentId); this._trash = snapshot.trash;
    } catch (cause) {
      throw historyError('Saved DJ session history is invalid. It has been kept without changes.', 'invalid-history', cause);
    }
  }

  get id() { return this._current.id; }
  get name() { return this._current.name; }
  get eventCount() { return this._current.events.length; }
  get events() { return structuredClone(this._current.events); }
  get current() { return structuredClone(this._current); }

  get histories() { return structuredClone([...this._archives, ...(this.id ? [this._current] : [])]); }
  get deletedHistories() { return structuredClone(this._trash); }
  snapshot() { return { version: 1, currentId: this.id, sessions: this.histories, trash: this.deletedHistories }; }

  _commit(value, archives = this._archives, trash = this._trash) {
    const snapshot = validateSessionSnapshot({ version: 1, currentId: value.id, sessions: [...archives, ...(value.id ? [value] : [])], trash });
    const saved = serializeSessionSnapshot(snapshot);
    try { this._storage?.setItem(STORAGE_KEY, saved); }
    catch (cause) { throw historyError('DJ session history could not be saved. Music can continue; export the history and retry saving.', 'storage-write', cause); }
    this._current = value; this._archives = archives; this._trash = trash;
  }

  start(name) {
    if (!text(name, 300, true)) throw new Error('Choose a DJ session name between 1 and 300 characters.');
    const archives = [...this._archives, ...(this.id ? [this._current] : [])];
    this._commit({ id: this._id(), name: name.trim(), startedAt: new Date(this._now()).toISOString(), events: [] }, archives);
    // Retain delivered-run deduplication across session changes.
    return this.current;
  }

  restoreSnapshot(value) {
    const snapshot = validateSessionSnapshot(value);
    const current = snapshot.sessions.find(history => history.id === snapshot.currentId) || emptySession();
    this._commit(current, snapshot.sessions.filter(history => history.id !== snapshot.currentId), snapshot.trash);
    return this.snapshot();
  }

  search(query = '') {
    const needle = String(query).trim().toLocaleLowerCase();
    return this.histories.filter(history => !needle || [history.name, history.note, ...history.events.flatMap(event => [event.title, event.artist, event.singer, event.groupName, event.note])].some(value => String(value || '').toLocaleLowerCase().includes(needle)));
  }

  annotate(sessionId, note, eventId = null) {
    if (!text(note, eventId ? 4000 : 10000)) throw new Error('History annotation is too long.');
    const histories = this.histories, history = histories.find(item => item.id === sessionId);
    if (!history) throw new Error('Choose a saved session.');
    const target = eventId ? history.events.find(event => event.id === eventId) : history;
    if (!target) throw new Error('Choose a saved playback event.');
    target.note = note;
    const current = histories.find(item => item.id === this.id) || emptySession();
    this._commit(current, histories.filter(item => item.id !== this.id));
  }

  deleteHistory(sessionId) {
    const history = this.histories.find(item => item.id === sessionId);
    if (!history) throw new Error('Choose a saved session.');
    const archives = this._archives.filter(item => item.id !== sessionId);
    this._commit(sessionId === this.id ? emptySession() : this._current, archives, [...this._trash, { history, deletedAt: new Date(this._now()).toISOString() }]);
  }

  restoreHistory(sessionId) {
    const entry = this._trash.find(item => item.history.id === sessionId);
    if (!entry) throw new Error('Choose a deleted session.');
    this._commit(this._current, [...this._archives, entry.history], this._trash.filter(item => item !== entry));
    return structuredClone(entry.history);
  }

  purgeHistory(sessionId) {
    if (!this._trash.some(entry => entry.history.id === sessionId)) throw new Error('Choose a deleted session.');
    this._commit(this._current, this._archives, this._trash.filter(entry => entry.history.id !== sessionId));
  }

  hasRecordedPlayback(runId, item) { return this._runs.has(playbackKey(runId, item)); }

  recordPlayback(runId, item, sourcePosition = 0) {
    if (!this._current.id) return null;
    const key = playbackKey(runId, item);
    if (this._runs.has(key)) return null;
    const track = item.track, identity = recordingIdentity(track);
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

  exportCSV(selection = {}) {
    const sessionIds = selection.sessionIds || (this.id ? [this.id] : []);
    const eventIds = selection.eventIds ? new Set(selection.eventIds) : null;
    const histories = [...this.histories, ...this._trash.map(entry => entry.history)];
    if (!Array.isArray(sessionIds) || sessionIds.some(id => !histories.some(history => history.id === id))) throw new Error('Choose saved histories to export.');
    const header = ['Session', 'Session started', 'Played at', 'Title', 'Orchestra / artist', 'Singer', 'Dance style', 'Tanda / group', 'Source', 'Position (seconds)', 'Recording ID', 'Group ID', 'Occurrence ID', 'Recording identity', 'Event ID', 'Annotation', 'Session notes'];
    const rows = histories.filter(history => sessionIds.includes(history.id)).flatMap(history => history.events.filter(event => !eventIds || eventIds.has(event.id)).map(event => [history.name, history.startedAt, event.startedAt, event.title, event.artist, event.singer, event.style, event.groupName, event.source, event.position, event.trackId, event.groupId, event.occurrenceId, event.identity, event.id, event.note, history.note]));
    return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
}
