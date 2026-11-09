import { DJSession } from './session.js';
import { t, getLanguage } from './i18n.js';

export const sessionControls = `<div class="session-tools"><span>DJ session: <strong id="session-name" data-preserve>Not started</strong></span><button id="new-dj-session">New DJ session</button><button id="open-session-history">Played recordings <span id="session-count">0</span></button></div>`;
export const sessionDialog = `<dialog id="session-dialog"><div class="dialog-heading"><h2>Session playback history</h2><button data-close="session-dialog" aria-label="Close">×</button></div><p class="hint">Records successful playback starts, including partial recordings. Local preview is excluded. New sessions archive earlier histories.</p><p id="session-error" class="hint" role="status" hidden></p><label>Search histories<input id="history-search" type="search" placeholder="Session, recording, orchestra or notes"></label><div id="history-sessions"></div><label>View session<select id="history-session"></select></label><div id="history-annotation"><label>Session notes<textarea id="history-note" maxlength="10000" rows="2"></textarea></label><button id="save-history-note">Save session notes</button><button id="delete-history">Move session to deleted histories</button></div><div id="session-history"></div><button id="export-session" class="primary wide">Export selected histories CSV</button><details><summary>Deleted histories</summary><div id="deleted-histories"></div></details></dialog>`;

export class SessionControls {
  constructor({ notify, refreshLibrary }) {
    this.notify = notify; this.refreshLibrary = refreshLibrary;
    this.$ = selector => document.querySelector(selector);
    this.selectedIds = new Set(); this.selectedEvents = new Set(); this.viewId = null;
    try { this.session = new DJSession(); } catch (error) { this.error = error.message; }
    this.$('#new-dj-session').onclick = () => this.startNew();
    this.$('#open-session-history').onclick = () => { if (!this.selectedIds.size && this.session?.id) this.selectedIds.add(this.session.id); this.render(); this.$('#session-dialog').showModal(); };
    this.$('#export-session').onclick = () => this.export();
    this.$('#history-search').oninput = () => this.render();
    this.$('#history-session').onchange = event => { this.viewId = event.target.value; this.selectedEvents.clear(); this.render(); };
    this.$('#save-history-note').onclick = () => this.change(() => this.session.annotate(this.viewId, this.$('#history-note').value));
    this.$('#delete-history').onclick = () => {
      if (!this.viewId || !confirm(t('Move this session to deleted histories? You can restore it later.'))) return;
      this.change(() => { this.session.deleteHistory(this.viewId); this.selectedIds.delete(this.viewId); this.viewId = null; });
    };
    this.render();
  }

  getHistories() { return this.session?.snapshot() || { version: 1, currentId: null, sessions: [], trash: [] }; }
  restoreHistories(snapshot) {
    const replacement = this.session || new DJSession({ restore: false });
    replacement.restoreSnapshot(snapshot); this.session = replacement; this.error = null;
    this.viewId = replacement.id; this.selectedIds = new Set(); this.selectedEvents = new Set(); this.render(); this.refreshLibrary();
  }
  reloadHistories() {
    this.session = new DJSession(); this.error = null; this.viewId = this.session.id;
    this.selectedIds = new Set(); this.selectedEvents = new Set(); this.render(); this.refreshLibrary();
  }
  change(action) {
    try { action(); this.error = null; this.render(); this.refreshLibrary(); }
    catch (error) { this.error = error.message; this.notify(error.message, true); this.render(); }
  }
  played(track) {
    try { return track?.style !== 'Cortina' && Boolean(this.session?.hasPlayed(track)); } catch { return false; }
  }
  record(runId, item, position) {
    if (!this.session) return;
    try {
      if (this.session.hasRecordedPlayback(runId, item)) return;
      if (!this.session.id) this.session.start('Milonga session');
      const repeated = item.kind !== 'cortina' && this.played(item.track);
      const event = this.session.recordPlayback(runId, item, position);
      if (!event) return;
      if (repeated) this.notify(`${t('Repeated recording in this DJ session')}: ${item.track.title}`);
      this.error = null; this.render(); this.refreshLibrary();
    } catch (error) {
      if (this.error !== error.message) this.notify(error.message, true);
      this.error = error.message; this.render();
    }
  }
  startNew() {
    const name = prompt(t('DJ session name'), 'Milonga session');
    if (!name?.trim()) return;
    if ((this.error || this.session?.eventCount) && !confirm(t('Start a new DJ session? The current history will be archived.'))) return;
    try {
      const replacement = this.session || new DJSession({ restore: false });
      replacement.start(name.trim()); this.session = replacement; this.error = null; this.viewId = replacement.id;
      this.selectedIds?.clear(); this.selectedEvents?.clear(); this.render(); this.refreshLibrary();
    } catch (error) { this.notify(error.message, true); }
  }
  render() {
    const events = this.session?.events || [], histories = this.session?.histories || [];
    this.$('#session-name').textContent = this.session?.name || t('Not started'); this.$('#session-count').textContent = events.length;
    this.$('#session-error').hidden = !this.error; this.$('#session-error').textContent = this.error ? t(this.error) : '';
    const query = this.$('#history-search').value.trim().toLocaleLowerCase();
    const matches = this.session?.search(query) || [];
    if (!histories.some(history => history.id === this.viewId)) this.viewId = this.session?.id || histories.at(-1)?.id || null;
    const selector = this.$('#history-session'); selector.replaceChildren();
    for (const history of histories.toReversed()) {
      const option = document.createElement('option'); option.value = history.id; option.dataset.preserve = '';
      option.textContent = `${history.name}${history.id === this.session.id ? ` · ${t('Current session')}` : ''} · ${history.events.length}`;
      selector.append(option);
    }
    selector.value = this.viewId || ''; selector.disabled = !histories.length;
    const list = this.$('#history-sessions'); list.replaceChildren();
    for (const history of matches.toReversed()) {
      const label = document.createElement('label'), input = document.createElement('input'), name = document.createElement('span');
      input.type = 'checkbox'; input.dataset.historySelect = history.id; input.checked = this.selectedIds.has(history.id);
      input.onchange = () => { if (input.checked) this.selectedIds.add(history.id); else this.selectedIds.delete(history.id); this.$('#export-session').disabled = !this.selectedIds.size && !this.selectedEvents.size; };
      name.dataset.preserve = ''; name.textContent = `${history.name} · ${new Date(history.startedAt).toLocaleDateString(getLanguage())} · ${history.events.length} ${t('recordings')}`;
      label.append(input, name); list.append(label);
    }
    const history = histories.find(item => item.id === this.viewId);
    this.$('#history-annotation').hidden = !history; this.$('#history-note').value = history?.note || '';
    const detail = this.$('#session-history'); detail.replaceChildren();
    if (!history?.events.length) detail.textContent = t('No recordings have started in this session.');
    for (const event of (history?.events || []).toReversed().filter(event => !query || [history.name, history.note, event.title, event.artist, event.singer, event.groupName, event.note].some(value => String(value || '').toLocaleLowerCase().includes(query)))) {
      const row = document.createElement('div'); row.className = 'session-entry';
      const selected = document.createElement('input'); selected.type = 'checkbox'; selected.dataset.historyEvent = event.id; selected.setAttribute('aria-label', `${t('Select recording')}: ${event.title}`); selected.checked = this.selectedEvents.has(event.id);
      selected.onchange = () => { if (selected.checked) this.selectedEvents.add(event.id); else this.selectedEvents.delete(event.id); this.$('#export-session').disabled = !this.selectedIds.size && !this.selectedEvents.size; };
      const title = document.createElement('strong'); title.dataset.preserve = ''; title.textContent = event.title;
      const artist = document.createElement('span'); artist.dataset.preserve = ''; artist.textContent = [event.artist, event.singer, event.groupName].filter(Boolean).join(' · ');
      const timestamp = document.createElement('small'); timestamp.textContent = new Date(event.startedAt).toLocaleString(getLanguage());
      const note = document.createElement('textarea'); note.value = event.note || ''; note.maxLength = 4000; note.rows = 1; note.setAttribute('aria-label', `${t('Recording annotation')}: ${event.title}`);
      const save = document.createElement('button'); save.textContent = t('Save annotation'); save.onclick = () => this.change(() => this.session.annotate(history.id, note.value, event.id));
      row.append(selected, title, artist, timestamp, note, save); detail.append(row);
    }
    const deleted = this.$('#deleted-histories'); deleted.replaceChildren();
    for (const entry of this.session?.deletedHistories.toReversed() || []) {
      const row = document.createElement('div'), label = document.createElement('span'), restore = document.createElement('button'), download = document.createElement('button'), purge = document.createElement('button');
      label.dataset.preserve = ''; label.textContent = entry.history.name; restore.textContent = t('Restore history'); restore.dataset.restoreHistory = entry.history.id;
      download.textContent = t('Export history CSV'); download.dataset.exportHistory = entry.history.id; download.onclick = () => this.downloadCSV(this.session.exportCSV({ sessionIds: [entry.history.id] }));
      purge.textContent = t('Permanently delete'); purge.dataset.purgeHistory = entry.history.id;
      purge.onclick = () => { if (confirm(t('Permanently delete this history? Export it first if you need a copy. This cannot be undone.'))) this.change(() => this.session.purgeHistory(entry.history.id)); };
      restore.onclick = () => this.change(() => { this.session.restoreHistory(entry.history.id); this.viewId = entry.history.id; }); row.append(label, download, restore, purge); deleted.append(row);
    }
    this.$('#export-session').disabled = !this.selectedIds.size && !this.selectedEvents.size;
  }
  export() {
    if (!this.session) return;
    const historiesWithSelectedEvents = this.session.histories.filter(history => history.events.some(event => this.selectedEvents?.has(event.id))).map(history => history.id);
    const ids = this.selectedIds?.size || historiesWithSelectedEvents.length ? [...new Set([...this.selectedIds, ...historiesWithSelectedEvents])] : [this.viewId || this.session.id].filter(Boolean);
    if (!ids.length) return;
    const csv = this.session.exportCSV({ sessionIds: ids, ...(this.selectedEvents?.size ? { eventIds: [...this.selectedEvents] } : {}) });
    this.downloadCSV(csv);
  }
  downloadCSV(csv) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'tango-dj-session.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
