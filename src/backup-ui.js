import { createBackup, inspectBackup, selectBackupRestore } from './backup.js';
import { t } from './i18n.js';
import { storageMessage } from './storage.js';

export const backupControls = `<section class="storage-panel"><div><strong>Portable backup</strong><p>Keep sets, cues, preferences and session histories together. Audio is optional.</p></div><button id="open-backup">Backup and restore</button></section>`;
export const backupDialog = `<dialog id="backup-dialog"><div class="dialog-heading"><h2>Portable backup and restore</h2><button data-close="backup-dialog" aria-label="Close">×</button></div><p id="backup-status" role="status" class="hint"></p><details open><summary>Create backup</summary><div id="backup-recordings"></div><label><input id="backup-audio" type="checkbox"> Include available local audio</label><label><input id="backup-preferences" type="checkbox" checked> Include portable preferences</label><label><input id="backup-histories" type="checkbox" checked> Include all saved and deleted histories</label><button id="prepare-backup">Prepare and review backup</button><div id="backup-review" hidden></div><button id="download-backup" disabled>Download reviewed backup</button></details><details><summary>Restore backup</summary><label>Choose portable backup<input id="backup-input" type="file" accept=".tdjb,application/octet-stream"></label><div id="restore-review" hidden><div id="restore-summary"></div><div id="restore-recordings"></div><label><input id="restore-preferences" type="checkbox" checked> Restore portable preferences</label><label><input id="restore-histories" type="checkbox" checked> Restore all included histories</label><p>Restoring replaces this browser's library, sets and local audio with the reviewed selection. Missing files stay marked for relinking. Playback stays stopped.</p><button id="confirm-backup-restore">Restore reviewed selection</button></div></details></dialog>`;

export class BackupControls {
  constructor({ notify, context, getState, getPreferences, getHistories, readyFile, commit }) {
    Object.assign(this, { notify, context, getState, getPreferences, getHistories, readyFile, commit });
    this.$ = selector => document.querySelector(selector); this.busy = false;
    this.$('#open-backup').onclick = () => {
      if (this.busy) return;
      this.prepared = null; this.$('#download-backup').disabled = true; this.$('#backup-review').hidden = true;
      this.renderRecordings('#backup-recordings', getState().tracks); this.$('#backup-dialog').showModal();
    };
    this.$('#prepare-backup').onclick = () => this.run(() => this.prepare());
    this.$('#download-backup').onclick = () => this.download();
    this.$('#backup-input').onchange = event => this.run(() => this.inspect(event.target.files[0]));
    this.$('#confirm-backup-restore').onclick = () => this.run(() => this.restore());
    for (const selector of ['#backup-recordings', '#backup-audio', '#backup-preferences', '#backup-histories']) this.$(selector).addEventListener('change', () => { this.prepared = null; this.$('#download-backup').disabled = true; this.$('#backup-review').hidden = true; });
  }
  renderRecordings(selector, tracks) {
    const container = this.$(selector); container.replaceChildren();
    const all = document.createElement('button'); all.textContent = t('Select all recordings'); all.type = 'button'; all.onclick = () => { container.querySelectorAll('input').forEach(input => { input.checked = true; }); container.dispatchEvent(new Event('change')); }; container.append(all);
    for (const track of tracks) {
      const label = document.createElement('label'), input = document.createElement('input'), title = document.createElement('span');
      input.type = 'checkbox'; input.checked = true; input.dataset.backupTrack = track.id; title.dataset.preserve = ''; title.textContent = `${track.title} · ${track.source}`;
      label.append(input, title); container.append(label);
    }
  }
  selected(selector) { return [...this.$(selector).querySelectorAll('input:checked')].map(input => input.dataset.backupTrack); }
  async run(action) {
    if (this.busy) return;
    this.busy = true; this.$('#prepare-backup').disabled = true; this.$('#confirm-backup-restore').disabled = true; this.$('#download-backup').disabled = true;
    const editable = [...this.$('#backup-dialog').querySelectorAll('input, #backup-recordings button, #restore-recordings button')].map(control => ({ control, disabled: control.disabled }));
    editable.forEach(({ control }) => { control.disabled = true; });
    try { await action(); }
    catch (error) { const message = storageMessage(error); this.$('#backup-status').textContent = t(message); this.notify(message, true); }
    finally {
      editable.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled; });
      this.busy = false; this.$('#prepare-backup').disabled = false; this.$('#confirm-backup-restore').disabled = !this.verified; this.$('#download-backup').disabled = !this.prepared;
      this.$('#restore-preferences').disabled = !this.verified?.preferences; this.$('#restore-histories').disabled = !this.verified?.histories;
    }
  }
  summary(container, report, workspace, histories) {
    container.replaceChildren();
    const counts = document.createElement('p'); counts.textContent = `${report.tracks} ${t('recordings')} · ${workspace.groups.length} ${t('groups')} · ${workspace.collections.length} ${t('sets')} · ${histories?.sessions.length || 0} ${t('saved histories')} · ${report.audioFiles} ${t('audio files')} (${Math.ceil(report.audioBytes / 1024 / 1024)} MB)`;
    container.append(counts);
    if (report.missing.length) {
      const label = document.createElement('p'); label.textContent = `${t('Files to relink')}: ${report.missing.length}`; container.append(label);
      const list = document.createElement('ul');
      for (const entry of report.missing) { const row = document.createElement('li'); row.dataset.preserve = ''; row.textContent = `${entry.title} · ${t(entry.reason)}`; list.append(row); }
      container.append(list);
    }
  }
  async prepare() {
    this.prepared = null; this.$('#backup-review').hidden = true;
    const workspace = this.getState(), trackIds = this.selected('#backup-recordings');
    if (!trackIds.length) throw new Error('Select at least one recording for the backup.');
    this.$('#backup-status').textContent = t('Preparing and verifying backup…');
    this.prepared = await createBackup({ workspace, trackIds, includeAudio: this.$('#backup-audio').checked, preferences: this.$('#backup-preferences').checked ? this.getPreferences() : null, histories: this.$('#backup-histories').checked ? this.getHistories() : null, readyFile: this.readyFile });
    this.summary(this.$('#backup-review'), this.prepared.report, this.prepared.manifest.workspace, this.prepared.manifest.histories);
    this.$('#backup-review').hidden = false; this.$('#download-backup').disabled = false;
    this.$('#backup-status').textContent = t('Backup ready. Review the selection and missing-file report before downloading.');
  }
  download() {
    if (!this.prepared || this.busy) return;
    const url = URL.createObjectURL(this.prepared.blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'tango-dj-portable-backup.tdjb'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async inspect(file) {
    this.verified = null; this.$('#restore-review').hidden = true;
    if (!file) return;
    this.$('#backup-status').textContent = t('Verifying backup before any changes…');
    this.verified = await inspectBackup(file); this.reviewRevision = this.context().revision;
    this.summary(this.$('#restore-summary'), this.verified.report, this.verified.workspace, this.verified.histories);
    this.renderRecordings('#restore-recordings', this.verified.workspace.tracks);
    this.$('#restore-preferences').disabled = this.verified.preferences === null; this.$('#restore-preferences').checked = this.verified.preferences !== null;
    this.$('#restore-histories').disabled = this.verified.histories === null; this.$('#restore-histories').checked = this.verified.histories !== null;
    this.$('#restore-review').hidden = false; this.$('#backup-status').textContent = t('Backup verified. Choose what to restore.');
  }
  async restore() {
    if (!this.verified) throw new Error('Verify a backup before restoring.');
    const context = this.context();
    if (context.playing) throw new Error('Stop playback before restoring a backup.');
    if (context.busy || context.transitioning || context.live) throw new Error('Stop preparation and unlock Live mode before restoring a backup.');
    if (context.revision !== this.reviewRevision) throw new Error('The workspace changed after review. Choose the backup again.');
    const trackIds = this.selected('#restore-recordings');
    if (!trackIds.length) throw new Error('Select at least one recording to restore.');
    const restore = selectBackupRestore(this.verified, { trackIds, preferences: this.$('#restore-preferences').checked, histories: this.$('#restore-histories').checked });
    this.$('#backup-status').textContent = t('Restoring backup…');
    await this.commit({ ...restore, expectedRevision: this.reviewRevision });
    this.verified = null; this.$('#restore-review').hidden = true;
    this.$('#backup-status').textContent = t('Backup restored. Playback is stopped; review missing files before playing.');
    this.notify('Backup restored. Playback is stopped; review missing files before playing.');
  }
}
