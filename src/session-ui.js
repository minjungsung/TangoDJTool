import { DJSession } from './session.js';
import { t, getLanguage } from './i18n.js';

export const sessionControls = `<div class="session-tools"><span>DJ session: <strong id="session-name" data-preserve>Not started</strong></span><button id="new-dj-session">New DJ session</button><button id="open-session-history">Played recordings <span id="session-count">0</span></button></div>`;
export const sessionDialog = `<dialog id="session-dialog"><div class="dialog-heading"><h2>Session playback history</h2><button data-close="session-dialog" aria-label="Close">×</button></div><p class="hint">Records successful playback starts, including partial recordings. Local preview is excluded. Export this history before starting a new session.</p><p id="session-error" class="hint" role="status" hidden></p><div id="session-history"></div><button id="export-session" class="primary wide">Export history CSV</button></dialog>`;

export class SessionControls {
  constructor({ notify, refreshLibrary }) {
    this.notify = notify; this.refreshLibrary = refreshLibrary;
    this.$ = selector => document.querySelector(selector);
    try { this.session = new DJSession(); }
    catch (error) { this.error = error.message; }
    this.$('#new-dj-session').onclick = () => this.startNew();
    this.$('#open-session-history').onclick = () => { this.render(); this.$('#session-dialog').showModal(); };
    this.$('#export-session').onclick = () => this.export();
    this.render();
  }

  played(track) {
    try { return track?.style !== 'Cortina' && Boolean(this.session?.hasPlayed(track)); }
    catch { return false; }
  }

  record(runId, item, position) {
    if (!this.session) return;
    try {
      if (!this.session.current?.id) this.session.start('Milonga session');
      const repeated = item.kind !== 'cortina' && this.played(item.track);
      const event = this.session.recordPlayback(runId, item, position);
      if (!event) return;
      if (repeated) this.notify(`${t('Repeated recording in this DJ session')}: ${item.track.title}`);
      this.error = null;
      this.render(); this.refreshLibrary();
    } catch (error) {
      if (this.error !== error.message) this.notify(error.message, true);
      this.error = error.message; this.render();
    }
  }

  startNew() {
    const name = prompt(t('DJ session name'), 'Milonga session');
    if (!name?.trim()) return;
    if ((this.error || this.session?.events.length) && !confirm(t('Start a new DJ session? Export the current history first if you want to keep it.'))) return;
    try {
      if (!this.session) { localStorage.removeItem('studio-dj-session'); this.session = new DJSession(); }
      this.session.start(name.trim()); this.error = null; this.render(); this.refreshLibrary();
    } catch (error) { this.notify(error.message, true); }
  }

  render() {
    const events = this.session?.events || [];
    this.$('#session-name').textContent = this.session?.name || t('Not started');
    this.$('#session-count').textContent = events.length;
    this.$('#session-error').hidden = !this.error;
    this.$('#session-error').textContent = this.error ? t(this.error) : '';
    this.$('#session-history').replaceChildren();
    if (!events.length) this.$('#session-history').textContent = t('No recordings have started in this session.');
    for (const event of [...events].reverse()) {
      const row = document.createElement('div'); row.className = 'session-entry';
      const title = document.createElement('strong'); title.dataset.preserve = ''; title.textContent = event.title;
      const artist = document.createElement('span'); artist.dataset.preserve = ''; artist.textContent = [event.artist, event.singer, event.groupName].filter(Boolean).join(' · ');
      const timestamp = document.createElement('small'); timestamp.textContent = new Date(event.startedAt).toLocaleTimeString(getLanguage(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      row.append(title, artist, timestamp); this.$('#session-history').append(row);
    }
    this.$('#export-session').disabled = !events.length;
  }

  export() {
    if (!this.session?.events.length) return;
    const url = URL.createObjectURL(new Blob([this.session.exportCSV()], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tango-dj-session.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
