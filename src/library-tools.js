import { t } from './i18n.js';
import { parseLibraryImport, previewLibraryImport, applyLibraryImport } from './library-import.js';
import { previewBatchEdit, applyBatchEdit, parseRecordingTags } from './library-service.js';

export const libraryToolsMarkup = `<details class="library-tools"><summary>Library filters and tools</summary><form id="library-query"><div class="form-row"><label>Artist filter<input name="artist" type="search"></label><label>Singer filter<input name="singer" type="search"></label><label>Tag filter<input name="tag" type="search"></label></div><div class="form-row"><label>Year from<input name="yearMin" type="number" min="0" max="9999"></label><label>Year to<input name="yearMax" type="number" min="0" max="9999"></label><label>BPM from<input name="bpmMin" type="number" min="0"></label><label>BPM to<input name="bpmMax" type="number" min="0"></label></div><div class="form-row"><label>Voice<select name="vocal"><option value="">All voices</option><option value="instrumental">Instrumental</option><option value="vocal">Vocal</option><option value="unknown">Unknown voice</option></select></label><label>Source readiness<select name="readiness"><option value="">All readiness</option><option value="ready">Local files ready</option><option value="attention">Files need attention</option><option value="unknown">Unchecked local files</option><option value="online">Online recordings</option></select></label><label>Minimum rating<select name="ratingMin"><option value="">Any rating</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div><div class="form-row"><label>Sort library<select name="sort"><option value="library">Saved order</option><option value="title">Title</option><option value="artist">Artist</option><option value="singer">Singer</option><option value="year">Year</option><option value="bpm">BPM</option><option value="duration">Duration</option><option value="rating">Rating</option></select></label><label>Sort direction<select name="direction"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div><label><input name="includeUnknown" type="checkbox" checked>Keep unknown year, BPM and ratings in ranges</label><button type="reset">Reset library filters</button></form><div class="dialog-actions"><button id="open-library-import">Import CSV / M3U</button><button id="select-visible-recordings">Select visible recordings</button><button id="clear-recording-selection">Clear selection</button><button id="open-batch-edit" disabled>Review batch edits <span id="recording-selection-count">0</span></button></div></details>`;
export const libraryToolsDialogs = `<dialog id="library-import-dialog"><div class="dialog-heading"><h2>Review library import</h2><button data-close="library-import-dialog" aria-label="Close">×</button></div><p class="hint">CSV columns: Title, Artist/Orchestra, Singer, Year, Style/Genre, BPM, Duration, Cue in, Cue out, File/Path, URL/Video ID, SHA256, Playlist/Tanda, Notes, Tags, Rating. Times are source seconds. M3U supports EXTINF and PLAYLIST. Local files are linked separately; source paths are not saved.</p><input id="library-import-file" type="file" accept=".csv,.m3u,.m3u8,text/csv,audio/x-mpegurl"><p id="library-import-status" role="status"></p><label><input id="library-import-playlists" type="checkbox" checked>Create candidate sets from playlists</label><div id="library-import-preview"></div><button id="apply-library-import" class="primary wide" disabled>Apply reviewed import</button></dialog><dialog id="recording-notes-dialog"><form id="recording-notes-form"><div class="dialog-heading"><h2>Recording notes, tags and rating</h2><button type="button" data-close="recording-notes-dialog" aria-label="Close">×</button></div><p id="recording-notes-title" data-preserve></p><p class="hint">Personal preparation notes and ratings describe your preferences.</p><label>Recording notes<textarea name="notes" maxlength="4000" rows="4"></textarea></label><label>Tags (comma separated)<input name="tags" maxlength="2000"></label><label>Personal rating<select name="rating"><option value="">Unrated</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><div id="recording-provenance" class="hint"></div><button id="recording-notes-relink" type="button">Relink local file</button><button type="submit" class="primary wide">Save recording notes</button></form></dialog><dialog id="batch-edit-dialog"><div class="dialog-heading"><h2>Review batch recording edits</h2><button data-close="batch-edit-dialog" aria-label="Close">×</button></div><p class="hint">Keep leaves values unchanged. Fill unknown changes only blank values. Clear is explicit. Cues apply to preparation; current music keeps its captured clip.</p><form id="batch-edit-form"><div id="batch-edit-fields"></div><button type="submit">Preview batch changes</button></form><div id="batch-edit-preview"></div><button id="apply-batch-edit" class="primary wide" disabled>Apply reviewed batch</button></dialog>`;
export const libraryImportDialog = libraryToolsDialogs;

export const recordingSelectionMarkup = track => `<label><input type="checkbox" data-library-select="${escapeHTML(track.id)}" aria-label="${escapeHTML(t('Select'))}: ${escapeHTML(track.title)}"> ${t('Select')}</label>`;
export const recordingNotesMarkup = track => `<button class="secondary-action" data-action="library-details" data-id="${escapeHTML(track.id)}">Notes / tags / rating</button>${track.rating ? `<span data-preserve>${track.rating}/5</span>` : ''}${track.tags?.length ? `<span data-preserve>${escapeHTML(track.tags.join(' · '))}</span>` : ''}`;
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
const batchFields = { title: 'Title', artist: 'Artist', singer: 'Singer', year: 'Year', style: 'Style', bpm: 'BPM', cueStartSeconds: 'Cue in', cueEndSeconds: 'Cue out', notes: 'Recording notes', tags: 'Tags', rating: 'Personal rating' };
const numericFields = ['bpm', 'cueStartSeconds', 'cueEndSeconds', 'rating'];
const display = value => value == null || value === '' || Array.isArray(value) && !value.length ? t('Unknown / blank') : Array.isArray(value) ? value.join(', ') : String(value);

export class LibraryTools {
  constructor({ context, commit, notify, readyFile, locateRecording, refreshLibrary }) {
    Object.assign(this, { context, commit, notify, readyFile, locateRecording, refreshLibrary });
    this.selected = new Set(); this.importToken = 0; this.$ = selector => document.querySelector(selector);
    this.$('#library-query').addEventListener('submit', event => event.preventDefault());
    this.$('#library-query').addEventListener('input', () => this.refreshLibrary());
    this.$('#library-query').addEventListener('change', () => this.refreshLibrary());
    this.$('#library-query').addEventListener('reset', () => queueMicrotask(() => this.refreshLibrary()));
    this.$('#tracks').addEventListener('change', event => { const id = event.target.dataset.librarySelect; if (!id) return; event.target.checked ? this.selected.add(id) : this.selected.delete(id); this.sync(); });
    this.$('#select-visible-recordings').onclick = () => { this.$('#tracks').querySelectorAll('[data-track]').forEach(row => this.selected.add(row.dataset.track)); this.sync(); };
    this.$('#clear-recording-selection').onclick = () => { this.selected.clear(); this.sync(); };
    this.$('#open-library-import').onclick = () => this.$('#library-import-dialog').showModal();
    this.$('#library-import-file').onchange = event => { const file = event.target.files[0]; event.target.value = ''; this.readImport(file); };
    this.$('#apply-library-import').onclick = () => this.applyImport();
    this.$('#recording-notes-form').onsubmit = event => { event.preventDefault(); this.saveNotes(); };
    this.$('#recording-notes-relink').onclick = async () => {
      const button = this.$('#recording-notes-relink'), form = this.$('#recording-notes-form');
      const draft = { notes: form.elements.notes.value, tags: form.elements.tags.value, rating: form.elements.rating.value };
      button.disabled = true;
      try {
        const track = this.context().state.tracks.find(track => track.id === this.notesId); if (!track) return;
        if (await this.locateRecording(track) === false) return;
        const connected = this.context().state.tracks.find(item => item.id === track.id);
        if (connected) await this.readyFile?.(connected);
        this.refreshLibrary(); this.openRecording(track.id, false);
        for (const [field, value] of Object.entries(draft)) form.elements[field].value = value;
      } catch (error) { this.notify(error.message, true); }
      finally { button.disabled = false; }
    };
    this.$('#open-batch-edit').onclick = () => this.openBatch();
    this.$('#batch-edit-form').onsubmit = event => { event.preventDefault(); this.reviewBatch(); };
    this.$('#batch-edit-form').oninput = () => { this.batchPreview = null; this.$('#apply-batch-edit').disabled = true; };
    this.$('#batch-edit-form').onchange = this.$('#batch-edit-form').oninput;
    this.$('#apply-batch-edit').onclick = () => this.applyBatch();
    this.sync();
  }
  queryOptions() { const form = this.$('#library-query'); return { ...Object.fromEntries(new FormData(form)), includeUnknown: form.elements.includeUnknown.checked }; }
  resetQuery() { this.$('#library-query').reset(); }
  sync() {
    const ids = new Set(this.context().state.tracks.map(track => track.id));
    for (const id of this.selected) if (!ids.has(id)) this.selected.delete(id);
    this.$('#recording-selection-count').textContent = this.selected.size;
    this.$('#open-batch-edit').disabled = !this.selected.size;
    this.$('#tracks').querySelectorAll('[data-library-select]').forEach(input => { input.checked = this.selected.has(input.dataset.librarySelect); });
  }
  openRecording(id, show = true) {
    const state = this.context().state, track = state.tracks.find(track => track.id === id); if (!track) return;
    this.notesId = id; this.notesBase = structuredClone(state);
    this.$('#recording-notes-title').textContent = track.title;
    const form = this.$('#recording-notes-form'); form.elements.notes.value = track.notes || ''; form.elements.tags.value = (track.tags || []).join(', '); form.elements.rating.value = track.rating || '';
    this.$('#recording-provenance').replaceChildren();
    for (const entry of track.provenance || []) { const line = document.createElement('p'); line.dataset.preserve = ''; line.textContent = `${entry.sourceName} · ${entry.format.toUpperCase()} · ${t('Row')} ${entry.row} · SHA256 ${entry.sourceHash}${entry.reference ? ` · ${entry.reference}` : ''}`; this.$('#recording-provenance').append(line); }
    this.$('#recording-notes-relink').hidden = track.source !== 'local';
    if (show) this.$('#recording-notes-dialog').showModal();
  }
  async saveNotes() {
    try {
      const form = this.$('#recording-notes-form'), tags = parseRecordingTags(form.elements.tags.value), rating = form.elements.rating.value ? Number(form.elements.rating.value) : null;
      const edits = { notes: { mode: form.elements.notes.value.trim() ? 'set' : 'clear', value: form.elements.notes.value }, tags: { mode: tags.length ? 'set' : 'clear', value: tags }, rating: { mode: rating == null ? 'clear' : 'set', value: rating } };
      if (JSON.stringify(this.context().state) !== JSON.stringify(this.notesBase)) throw new Error('The library changed. Reopen recording notes before saving.');
      const preview = previewBatchEdit(this.notesBase, [this.notesId], edits);
      if (await this.commit('Edit recording notes', preview.nextState, preview.base)) { this.$('#recording-notes-dialog').close(); this.refreshLibrary(); }
    } catch (error) { this.notify(error.message, true); }
  }
  openBatch() {
    this.sync(); if (!this.selected.size) return;
    this.batchPreview = null; this.$('#apply-batch-edit').disabled = true; this.$('#batch-edit-preview').replaceChildren();
    this.$('#batch-edit-fields').innerHTML = Object.entries(batchFields).map(([field, label]) => `<div class="form-row"><label>${t(label)}<select name="${field}-mode"><option value="keep">${t('Keep')}</option><option value="set">${t('Set')}</option><option value="fill">${t('Fill unknown')}</option>${field !== 'title' ? `<option value="clear">${t('Clear')}</option>` : ''}</select></label><label>${t('New value')}<input name="${field}-value" ${numericFields.includes(field) ? `type="number" min="0" step="${field === 'rating' ? '1' : 'any'}"` : `maxlength="${field === 'notes' ? '4000' : '1000'}"`}></label></div>`).join('');
    this.$('#batch-edit-dialog').showModal();
  }
  reviewBatch() {
    try {
      const form = this.$('#batch-edit-form'), edits = {};
      for (const field of Object.keys(batchFields)) { const mode = form.elements[`${field}-mode`].value, raw = form.elements[`${field}-value`].value; if (mode !== 'keep') edits[field] = { mode, value: numericFields.includes(field) && raw !== '' ? Number(raw) : raw }; }
      this.batchPreview = previewBatchEdit(this.context().state, [...this.selected], edits);
      const target = this.$('#batch-edit-preview'); target.replaceChildren();
      for (const change of this.batchPreview.changes) { const line = document.createElement('p'); line.dataset.preserve = ''; line.textContent = `${change.title}: ${change.fields.map(field => `${t(batchFields[field.field])}: ${display(field.before)} → ${display(field.after)}`).join(' · ')}`; target.append(line); }
      if (!this.batchPreview.changes.length) target.textContent = t('No recording values would change.');
      this.$('#apply-batch-edit').disabled = !this.batchPreview.changes.length;
    } catch (error) { this.batchPreview = null; this.$('#apply-batch-edit').disabled = true; this.notify(error.message, true); }
  }
  async applyBatch() {
    if (!this.batchPreview) return;
    this.$('#apply-batch-edit').disabled = true;
    try { const preview = this.batchPreview, next = applyBatchEdit(this.context().state, preview); if (await this.commit('Batch edit recordings', next, preview.base)) { this.$('#batch-edit-dialog').close(); this.refreshLibrary(); } }
    catch (error) { this.notify(error.message, true); }
  }
  async readImport(file) {
    if (!file) return;
    const token = ++this.importToken; this.importPreview = null; this.$('#apply-library-import').disabled = true;
    this.$('#library-import-preview').replaceChildren(); this.$('#library-import-status').textContent = t('Reading library file…');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Library files must be smaller than 5 MB.');
      const format = /\.m3u8?$/i.test(file.name) ? 'm3u' : 'csv';
      const parsed = await parseLibraryImport(await file.text(), format, file.name);
      if (token !== this.importToken) return;
      this.importPreview = previewLibraryImport(this.context().state, parsed);
      this.$('#library-import-status').textContent = `${parsed.rows.length} ${t('recordings')} · ${parsed.sourceName} · SHA256 ${parsed.sourceHash}${parsed.warnings.length ? ` · ${parsed.warnings.join(' · ')}` : ''}`;
      const target = this.$('#library-import-preview'); target.replaceChildren();
      this.importPreview.rows.forEach((row, index) => {
        const line = document.createElement('div'), title = document.createElement('p'), details = document.createElement('p'), select = document.createElement('select');
        title.dataset.preserve = ''; details.dataset.preserve = '';
        title.textContent = `${t('Row')} ${row.index}: ${row.track.title} · ${row.track.artist || t('Unknown orchestra')}${row.track.source === 'local' ? ` · ${t('Local source; relink if absent')}` : ''}${row.errors.length ? ` · ${row.errors.map(error => t(error)).join(' ')}` : ''}`;
        details.className = 'hint';
        details.textContent = [
          `${t('Singer')}: ${display(row.track.singer)}`, `${t('Style')}: ${display(row.track.style)}`, `${t('Year')}: ${display(row.track.year)}`, `${t('BPM')}: ${display(row.track.bpm)}`,
          `${t('Cue in')}: ${row.track.cueStartSeconds ?? 0} s`, `${t('Cue out')}: ${row.track.cueEndSeconds == null ? t('Recording end') : `${row.track.cueEndSeconds} s`}`,
          `${t('Duration')}: ${row.track.duration == null ? t('Unknown / blank') : `${row.track.duration} s`}`, ...(row.playlist ? [`${t('Playlist')}: ${row.playlist}`] : []),
          ...(row.reference ? [`${t('Source reference')}: ${row.reference}`] : []), ...(row.track.contentHash ? [`SHA256: ${row.track.contentHash}`] : []),
          ...(row.track.notes ? [`${t('Recording notes')}: ${row.track.notes}`] : []), ...(row.track.tags?.length ? [`${t('Tags')}: ${row.track.tags.join(', ')}`] : []), ...(row.track.rating ? [`${t('Personal rating')}: ${row.track.rating}/5`] : []),
        ].join(' · ');
        select.dataset.importRow = index; select.setAttribute('aria-label', `${t('Duplicate decision')} ${row.index}`);
        const option = (value, label) => { const item = document.createElement('option'); item.value = value; item.textContent = label; select.append(item); };
        if (row.candidates.length) option('', t('Choose duplicate decision'));
        if (!row.errors.length) option('new', t('Add separately'));
        option('skip', t('Skip row'));
        for (const candidate of row.candidates) for (const [action, label] of [['reuse', 'Reuse unchanged'], ['merge', 'Fill missing metadata'], ['replace', 'Replace supplied metadata']]) option(`${action}:${candidate.id}`, `${t(label)}: ${candidate.title} (${t(candidate.reason)})`);
        line.append(title, details, select); target.append(line);
      });
      this.$('#apply-library-import').disabled = false;
    } catch (error) { if (token === this.importToken) { this.$('#library-import-status').textContent = t(error.message); this.notify(error.message, true); } }
  }
  async applyImport() {
    if (!this.importPreview) return;
    this.$('#apply-library-import').disabled = true;
    try {
      const decisions = [...this.$('#library-import-preview').querySelectorAll('[data-import-row]')].map(select => { const separator = select.value.indexOf(':'); return separator < 0 ? { action: select.value } : { action: select.value.slice(0, separator), trackId: select.value.slice(separator + 1) }; });
      const preview = this.importPreview, next = applyLibraryImport(this.context().state, preview, decisions, { createPlaylists: this.$('#library-import-playlists').checked });
      if (await this.commit('Import library', next, preview.base)) { this.$('#library-import-dialog').close(); this.refreshLibrary(); this.notify('Library imported. Relink local recordings before playback.'); }
    } catch (error) { this.notify(error.message, true); this.$('#apply-library-import').disabled = false; }
  }
}

export const libraryToolsTranslations = {
  'Library filters and tools': ['라이브러리 필터와 도구', 'Filtros y herramientas'], 'Artist filter': ['악단 필터', 'Filtro de artista'], 'Singer filter': ['가수 필터', 'Filtro de cantante'], 'Tag filter': ['태그 필터', 'Filtro de etiqueta'],
  'Year from': ['시작 연도', 'Año desde'], 'Year to': ['끝 연도', 'Año hasta'], 'BPM from': ['최소 BPM', 'BPM desde'], 'BPM to': ['최대 BPM', 'BPM hasta'], 'Voice': ['보컬 구분', 'Voz'], 'All voices': ['모든 보컬', 'Todas las voces'], 'Instrumental': ['연주곡', 'Instrumental'], 'Vocal': ['보컬곡', 'Vocal'], 'Unknown voice': ['보컬 정보 없음', 'Voz desconocida'],
  'Source readiness': ['소스 준비 상태', 'Disponibilidad'], 'All readiness': ['모든 준비 상태', 'Todas las disponibilidades'], 'Local files ready': ['로컬 파일 준비됨', 'Archivos locales disponibles'], 'Files need attention': ['파일 확인 필요', 'Archivos por revisar'], 'Unchecked local files': ['확인 전 로컬 파일', 'Archivos locales sin revisar'], 'Online recordings': ['온라인 곡', 'Grabaciones en línea'], 'Minimum rating': ['최소 평점', 'Valoración mínima'], 'Any rating': ['모든 평점', 'Cualquier valoración'],
  'Sort library': ['라이브러리 정렬', 'Ordenar biblioteca'], 'Saved order': ['저장된 순서', 'Orden guardado'], 'Sort direction': ['정렬 방향', 'Dirección'], 'Ascending': ['오름차순', 'Ascendente'], 'Descending': ['내림차순', 'Descendente'], 'Keep unknown year, BPM and ratings in ranges': ['범위 필터에서 정보 없는 곡도 표시', 'Incluir año, BPM y valoración desconocidos'], 'Reset library filters': ['라이브러리 필터 초기화', 'Restablecer filtros'],
  'Import CSV / M3U': ['CSV / M3U 가져오기', 'Importar CSV / M3U'], 'Select visible recordings': ['표시된 곡 선택', 'Seleccionar visibles'], 'Clear selection': ['선택 해제', 'Quitar selección'], 'Review batch edits': ['일괄 수정 검토', 'Revisar cambios en lote'], 'Notes / tags / rating': ['메모 / 태그 / 평점', 'Notas / etiquetas / valoración'], 'Select': ['선택', 'Seleccionar'],
  'Review library import': ['라이브러리 가져오기 검토', 'Revisar importación'], 'Create candidate sets from playlists': ['재생목록에서 후보 세트 만들기', 'Crear colecciones de listas'], 'Apply reviewed import': ['검토한 가져오기 적용', 'Aplicar importación revisada'], 'Recording notes, tags and rating': ['곡 메모, 태그와 평점', 'Notas, etiquetas y valoración'], 'Personal preparation notes and ratings describe your preferences.': ['준비 메모와 평점은 개인 취향을 기록합니다.', 'Las notas y valoraciones describen tus preferencias.'], 'Recording notes': ['곡 메모', 'Notas de grabación'], 'Tags (comma separated)': ['태그 (쉼표로 구분)', 'Etiquetas (separadas por comas)'], 'Personal rating': ['개인 평점', 'Valoración personal'], 'Unrated': ['평점 없음', 'Sin valorar'], 'Relink local file': ['로컬 파일 다시 연결', 'Volver a enlazar archivo'], 'Save recording notes': ['곡 메모 저장', 'Guardar notas'],
  'Review batch recording edits': ['곡 일괄 수정 검토', 'Revisar cambios de grabaciones'], 'Preview batch changes': ['일괄 수정 미리보기', 'Vista previa de cambios'], 'Apply reviewed batch': ['검토한 일괄 수정 적용', 'Aplicar lote revisado'], 'Keep': ['유지', 'Conservar'], 'Set': ['설정', 'Establecer'], 'Fill unknown': ['빈 정보 채우기', 'Completar vacíos'], 'Clear': ['비우기', 'Borrar'], 'New value': ['새 값', 'Nuevo valor'], 'Unknown / blank': ['정보 없음 / 빈 값', 'Desconocido / vacío'], 'No recording values would change.': ['바뀌는 값이 없습니다.', 'No cambiaría ningún valor.'],
  'Row': ['행', 'Fila'], 'Duplicate decision': ['중복 처리', 'Decisión de duplicados'], 'Choose duplicate decision': ['중복 처리 선택', 'Elegir decisión'], 'Add separately': ['별도 곡으로 추가', 'Añadir por separado'], 'Skip row': ['행 건너뛰기', 'Omitir fila'], 'Reuse unchanged': ['기존 곡 그대로 사용', 'Reutilizar sin cambios'], 'Fill missing metadata': ['빈 메타데이터 채우기', 'Completar metadatos vacíos'], 'Replace supplied metadata': ['제공된 메타데이터 교체', 'Reemplazar metadatos indicados'], 'Library imported. Relink local recordings before playback.': ['라이브러리를 가져왔습니다. 재생 전 로컬 곡을 연결하세요.', 'Biblioteca importada. Enlaza los archivos locales antes de reproducir.'],
  'Local source; relink if absent': ['로컬 소스 · 파일이 없으면 연결', 'Fuente local; enlaza si falta'], 'Source reference': ['소스 참조', 'Referencia de origen'], 'Playlist': ['재생목록', 'Lista'], 'Cue in': ['시작 큐', 'Punto de entrada'], 'Cue out': ['끝 큐', 'Punto de salida'], 'Recording end': ['곡 끝', 'Final de grabación'], 'Tags': ['태그', 'Etiquetas'],
  'Rating': ['평점', 'Valoración'], 'Edit recording notes': ['곡 메모 수정', 'Editar notas de grabación'], 'Batch edit recordings': ['곡 일괄 수정', 'Editar grabaciones en lote'], 'Import library': ['라이브러리 가져오기', 'Importar biblioteca'],
  'Same YouTube recording': ['동일한 YouTube 곡', 'Misma grabación de YouTube'], 'Same audio hash': ['동일한 오디오 해시', 'Mismo hash de audio'], 'Matching recording ID': ['일치하는 곡 ID', 'ID de grabación coincidente'], 'Matching filename; verify the recording': ['파일 이름 일치 · 실제 녹음 확인 필요', 'Nombre de archivo coincidente; verifica la grabación'], 'Matching title and artist; verify the recording': ['곡명·악단 일치 · 실제 녹음 확인 필요', 'Título y artista coincidentes; verifica la grabación'],
  'Tags must be text.': ['태그는 텍스트로 입력하세요.', 'Las etiquetas deben ser texto.'], 'Each tag must be at most 60 characters.': ['각 태그는 60자 이내로 입력하세요.', 'Cada etiqueta debe tener como máximo 60 caracteres.'], 'Use at most 30 tags per recording.': ['곡마다 태그는 30개까지 입력하세요.', 'Usa como máximo 30 etiquetas por grabación.'],
  'The library changed. Review the changes again before applying them.': ['라이브러리가 바뀌었습니다. 적용 전 변경 내용을 다시 검토하세요.', 'La biblioteca cambió. Revisa los cambios antes de aplicarlos.'], 'The library changed. Reopen recording notes before saving.': ['라이브러리가 바뀌었습니다. 곡 메모를 다시 열고 저장하세요.', 'La biblioteca cambió. Vuelve a abrir las notas antes de guardar.'],
  'Choose existing recordings for the batch.': ['일괄 수정할 기존 곡을 선택하세요.', 'Elige grabaciones existentes para el lote.'], 'Unsupported recording field.': ['지원하지 않는 곡 정보 항목입니다.', 'Campo de grabación no compatible.'], 'Choose a valid batch edit action.': ['올바른 일괄 수정 방식을 선택하세요.', 'Elige una acción válida para el lote.'], 'Recording titles cannot be cleared.': ['곡 제목은 비울 수 없습니다.', 'No se pueden borrar los títulos.'],
  'Blank values are kept. Choose Clear explicitly to remove a value.': ['빈 입력은 기존 값을 유지합니다. 삭제하려면 비우기를 선택하세요.', 'Los campos vacíos conservan el valor. Elige Borrar para quitarlo.'], 'Use a finite numeric value.': ['유효한 숫자를 입력하세요.', 'Usa un valor numérico finito.'], 'Metadata values must be text.': ['곡 정보는 텍스트로 입력하세요.', 'Los metadatos deben ser texto.'],
  'Library files must be smaller than 5 MB.': ['라이브러리 파일은 5MB 미만이어야 합니다.', 'El archivo de biblioteca debe ser menor de 5 MB.'], 'Choose a CSV or M3U library file.': ['CSV 또는 M3U 라이브러리 파일을 선택하세요.', 'Elige un archivo CSV o M3U.'], 'Invalid CSV quotation.': ['CSV 따옴표 형식이 올바르지 않습니다.', 'Comillas CSV no válidas.'], 'Invalid text after a CSV quotation.': ['CSV 따옴표 뒤의 텍스트가 올바르지 않습니다.', 'Texto no válido tras las comillas CSV.'], 'Unclosed CSV quotation.': ['CSV 따옴표가 닫히지 않았습니다.', 'Falta cerrar las comillas CSV.'], 'Library import is too large.': ['가져올 라이브러리가 너무 큽니다.', 'La importación de biblioteca es demasiado grande.'],
  'Reading library file…': ['라이브러리 파일 읽는 중…', 'Leyendo archivo de biblioteca…'],
  'CSV needs a header and at least one recording.': ['CSV에는 열 제목과 하나 이상의 곡이 필요합니다.', 'El CSV necesita una cabecera y al menos una grabación.'], 'CSV needs a Title, File, URL, Video ID or ID column.': ['CSV에는 제목, 파일, URL, 영상 ID 또는 ID 열이 필요합니다.', 'El CSV necesita una columna de título, archivo, URL, ID de vídeo o ID.'], 'CSV has duplicate metadata columns.': ['CSV에 같은 정보 열이 중복되어 있습니다.', 'El CSV tiene columnas de metadatos duplicadas.'], 'CSV row does not match its header.': ['CSV 행의 열 수가 제목 행과 다릅니다.', 'La fila CSV no coincide con su cabecera.'],
  'Only local files and valid YouTube links are supported.': ['로컬 파일과 유효한 YouTube 링크를 지원합니다.', 'Solo se admiten archivos locales y enlaces válidos de YouTube.'], 'Online audio streams are not supported.': ['온라인 오디오 스트림은 지원하지 않습니다.', 'No se admiten transmisiones de audio en línea.'], 'Invalid SHA-256 content hash.': ['SHA-256 오디오 해시가 올바르지 않습니다.', 'Hash de contenido SHA-256 no válido.'], 'Rating must be a whole number from 1 to 5.': ['평점은 1~5 사이 정수로 입력하세요.', 'La valoración debe ser un entero entre 1 y 5.'],
  'Invalid bpm.': ['BPM 값이 올바르지 않습니다.', 'BPM no válido.'], 'Invalid duration.': ['곡 길이가 올바르지 않습니다.', 'Duración no válida.'], 'Invalid cueStartSeconds.': ['시작 큐가 올바르지 않습니다.', 'Punto de entrada no válido.'], 'Invalid cueEndSeconds.': ['끝 큐가 올바르지 않습니다.', 'Punto de salida no válido.'], 'Invalid rating.': ['평점이 올바르지 않습니다.', 'Valoración no válida.'], 'Cue out must follow cue in within supported source positions.': ['지원되는 재생 위치 안에서 끝 큐를 시작 큐 뒤에 지정하세요.', 'La salida debe seguir a la entrada dentro de los límites admitidos.'],
  'Choose a library with 1 to 10,000 supported recording rows.': ['지원되는 곡 행이 1~10,000개인 라이브러리를 선택하세요.', 'Elige una biblioteca con entre 1 y 10.000 filas admitidas.'], 'Review a duplicate decision for every row.': ['모든 행의 중복 처리 방식을 검토하세요.', 'Revisa la decisión de duplicados de cada fila.'], 'Choose an explicit duplicate decision for every row.': ['모든 행에서 중복 처리 방식을 명시적으로 선택하세요.', 'Elige una decisión explícita de duplicados para cada fila.'], 'Choose one of the reviewed matching recordings.': ['검토한 일치 후보 중 하나를 선택하세요.', 'Elige una de las grabaciones coincidentes revisadas.'], 'Different audio cannot replace a recording through metadata import. Choose Add separately.': ['다른 오디오는 정보 가져오기로 교체할 수 없습니다. 별도 곡으로 추가를 선택하세요.', 'Otro audio no puede sustituir una grabación al importar metadatos. Elige Añadir por separado.'],
  'Keep leaves values unchanged. Fill unknown changes only blank values. Clear is explicit. Cues apply to preparation; current music keeps its captured clip.': ['유지는 값을 바꾸지 않습니다. 빈 정보 채우기는 빈 값만 바꿉니다. 비우기는 명시적 삭제입니다. 큐는 준비된 곡에 적용되며 현재 음악 구간은 유지됩니다.', 'Conservar no cambia valores. Completar vacíos solo cambia campos vacíos. Borrar es explícito. Los puntos se aplican a la preparación; la música actual conserva su segmento.'],
  'CSV columns: Title, Artist/Orchestra, Singer, Year, Style/Genre, BPM, Duration, Cue in, Cue out, File/Path, URL/Video ID, SHA256, Playlist/Tanda, Notes, Tags, Rating. Times are source seconds. M3U supports EXTINF and PLAYLIST. Local files are linked separately; source paths are not saved.': ['CSV 열: 제목, 악단, 가수, 연도, 장르, BPM, 길이, 시작·끝 큐, 파일, URL/영상 ID, SHA256, 재생목록, 메모, 태그, 평점. 시간 단위는 원본 초입니다. M3U는 EXTINF와 PLAYLIST를 지원합니다. 로컬 파일은 별도로 연결하며 원본 경로는 저장하지 않습니다.', 'Columnas CSV: título, artista, cantante, año, estilo, BPM, duración, entrada/salida, archivo, URL/ID de vídeo, SHA256, lista, notas, etiquetas y valoración. Los tiempos son segundos de origen. M3U admite EXTINF y PLAYLIST. Los archivos locales se enlazan aparte; no se guardan rutas.'],
};
