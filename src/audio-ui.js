import { TapTempo } from './analysis.js';
import { measureFile } from './audio-service.js';
import { processingOptions } from './audio-measurement.js';
import { t } from './i18n.js';

export const audioTranslations = {
  'Audio review': ['오디오 검토', 'Revisar audio'], 'Tempo review': ['템포 검토', 'Revisar tempo'],
  'Manual BPM': ['직접 입력 BPM', 'BPM manual'], 'Tap tempo': ['박자 두드리기', 'Marcar tempo'],
  'Reset taps': ['탭 초기화', 'Reiniciar pulsaciones'], 'Half BPM': ['BPM 절반', 'Mitad de BPM'], 'Double BPM': ['BPM 두 배', 'Doble BPM'],
  'Save BPM review': ['BPM 검토 저장', 'Guardar revisión de BPM'], 'Measure audio': ['오디오 측정', 'Medir audio'],
  'Measured loudness': ['측정된 음량', 'Sonoridad medida'], 'Measured loudness processing': ['측정 기반 음량 처리', 'Procesamiento de sonoridad medida'],
  'Enable measured processing': ['측정 기반 처리 켜기', 'Activar procesamiento medido'], 'Bypass processing': ['원본 오디오 사용', 'Omitir procesamiento'],
  'Peak limiter': ['피크 리미터', 'Limitador de picos'], 'Apply audio settings': ['오디오 설정 적용', 'Aplicar ajustes de audio'],
  'Master output': ['메인 출력', 'Salida principal'], 'Master and cue channels': ['메인 및 프리뷰 채널', 'Canales principales y de preescucha'],
  'Audition segment': ['구간 미리듣기', 'Escuchar segmento'], 'Original segment': ['원본 구간', 'Segmento original'], 'Processed segment': ['처리된 구간', 'Segmento procesado'],
  'Stop audition': ['미리듣기 중지', 'Detener escucha'], 'Detect outputs': ['출력 검색', 'Detectar salidas'],
  'From (seconds)': ['시작 (초)', 'Desde (segundos)'], 'To (seconds)': ['종료 (초)', 'Hasta (segundos)'],
  'Target LUFS': ['목표 LUFS', 'Objetivo LUFS'], 'Headroom (dB)': ['피크 여유 (dB)', 'Margen de pico (dB)'],
  'Master L': ['메인 왼쪽', 'Principal I'], 'Master R': ['메인 오른쪽', 'Principal D'],
  'Cue L': ['프리뷰 왼쪽', 'Preescucha I'], 'Cue R': ['프리뷰 오른쪽', 'Preescucha D'],
  'Apply master channels': ['메인 채널 적용', 'Aplicar canales principales'], 'Apply cue channels': ['프리뷰 채널 적용', 'Aplicar canales de preescucha'],
  'I tested the separate channel outputs on this interface': ['이 인터페이스에서 채널별 출력 분리를 직접 확인했습니다', 'He probado las salidas de canales separados en esta interfaz'],
  'Tempo estimates are uncertain and do not establish beat matching or musical suitability. Review by ear.': ['템포 추정치에는 오차가 있으며 비트 일치나 음악적 적합성을 보장하지 않습니다. 직접 들어보고 확인하세요.', 'Las estimaciones de tempo son inciertas y no establecen sincronización ni idoneidad musical. Revisa de oído.'],
  'Measure the complete mono or stereo file using gated K-weighted energy and 4× reconstructed peaks. This is digital PCM measurement; venue sound is verified separately.': ['전체 모노·스테레오 파일의 K 가중 음량과 4배 재구성 피크를 측정합니다. 디지털 PCM 측정이며 행사장 소리는 별도로 확인하세요.', 'Mide el archivo mono o estéreo completo con energía ponderada K y picos reconstruidos a 4×. Es medición PCM digital; verifica el sonido del recinto por separado.'],
  'Optional local processing uses measured gain, 5 ms lookahead peak limiting and a reconstructed peak ceiling. Originals remain unchanged. Pause to apply or bypass at the same position. YouTube uses its original output and level controls.': ['선택한 로컬 음원에 측정 기반 게인, 5ms 선행 피크 제한과 재구성 피크 상한을 적용합니다. 원본은 보존됩니다. 일시정지 후 같은 위치에서 적용하거나 해제하세요. YouTube는 자체 출력과 음량을 사용합니다.', 'El procesamiento local opcional usa ganancia medida, limitación anticipada de 5 ms y un techo de pico reconstruido. Se conservan los originales. Pausa para aplicar u omitir en la misma posición. YouTube usa su salida y controles originales.'],
  'Channel numbers depend on the selected audio interface. Pause before changing mapping. YouTube always uses the system output.': ['채널 번호는 선택한 오디오 인터페이스에 따라 다릅니다. 일시정지 후 채널을 변경하세요. YouTube는 항상 시스템 출력을 사용합니다.', 'Los números de canal dependen de la interfaz seleccionada. Pausa antes de cambiar la asignación. YouTube siempre usa la salida del sistema.'],
  'No full-file measurement saved.': ['전체 파일 측정값이 없습니다.', 'No hay medición del archivo completo guardada.'],
  'Measuring full-file PCM…': ['전체 파일 PCM 측정 중…', 'Midiendo PCM del archivo completo…'],
  'Below loudness gate': ['음량 측정 하한 미만', 'Por debajo de la puerta de sonoridad'], 'full-file PCM': ['전체 파일 PCM', 'PCM del archivo completo'],
  'Reviewed BPM': ['검토한 BPM', 'BPM revisado'], 'Unknown': ['알 수 없음', 'Desconocido'],
  'Estimate confidence': ['추정 신뢰도', 'Confianza de estimación'], 'alternatives': ['대안', 'alternativas'], 'none': ['없음', 'ninguna'],
  'manual': ['직접 입력', 'manual'], 'tap': ['탭 입력', 'pulsaciones'], 'half': ['절반 보정', 'mitad'], 'double': ['두 배 보정', 'doble'],
  'taps': ['회 탭', 'pulsaciones'], 'tap at least four beats': ['최소 네 박자를 두드리세요', 'marca al menos cuatro tiempos'],
  'BPM review saved.': ['BPM 검토를 저장했습니다.', 'Revisión de BPM guardada.'],
  'Choose a BPM from 20 to 300.': ['BPM은 20에서 300 사이로 입력하세요.', 'Elige un BPM entre 20 y 300.'],
  'Unlock Live mode before editing audio metadata.': ['오디오 정보를 수정하려면 라이브 모드를 해제하세요.', 'Desactiva el modo en vivo antes de editar los metadatos de audio.'],
  'Unlock Live mode before changing loudness processing.': ['음량 처리를 변경하려면 라이브 모드를 해제하세요.', 'Desactiva el modo en vivo antes de cambiar el procesamiento de sonoridad.'],
  'Unlock Live mode before changing the master output.': ['메인 출력을 변경하려면 라이브 모드를 해제하세요.', 'Desactiva el modo en vivo antes de cambiar la salida principal.'],
  'Unlock Live mode before changing channel mapping.': ['출력 채널을 변경하려면 라이브 모드를 해제하세요.', 'Desactiva el modo en vivo antes de cambiar la asignación de canales.'],
  'Unlock Live mode before confirming channel outputs.': ['출력 분리를 확인하려면 라이브 모드를 해제하세요.', 'Desactiva el modo en vivo antes de confirmar las salidas de canales.'],
  'Choose a separate cue output before auditioning in Live mode.': ['라이브 모드에서는 별도의 프리뷰 출력을 선택한 후 미리들으세요.', 'Elige una salida de preescucha separada antes de escuchar en modo en vivo.'],
  'Original audio · processing bypassed.': ['원본 오디오 · 음량 처리 해제됨.', 'Audio original · procesamiento omitido.'],
  'Audio settings canceled. Pause playback and unlock Live mode before applying again.': ['오디오 설정을 취소했습니다. 재생을 일시정지하고 라이브 모드를 해제한 후 다시 적용하세요.', 'Ajustes de audio cancelados. Pausa y desactiva el modo en vivo antes de volver a aplicar.'],
  'Measured processing': ['측정 기반 처리', 'Procesamiento medido'], 'LUFS target': ['LUFS 목표', 'LUFS objetivo'], 'dB headroom': ['dB 피크 여유', 'dB de margen'],
  'Master output disconnected. Reconnect and select an available output before playing.': ['메인 출력 연결이 끊겼습니다. 다시 연결하고 사용 가능한 출력을 선택한 후 재생하세요.', 'Salida principal desconectada. Reconecta y selecciona una salida disponible antes de reproducir.'],
  'Master': ['메인', 'Principal'], 'cue': ['프리뷰', 'preescucha'], 'channels': ['채널', 'canales'],
  'separate route configured; verify the hardware': ['분리된 출력 경로 설정됨 · 하드웨어에서 확인하세요', 'ruta separada configurada; verifica el hardware'],
  'shared output: preview blocked during playback': ['출력 공유 중 · 재생 중에는 미리듣기 차단', 'salida compartida: preescucha bloqueada durante la reproducción'],
};

export class AudioTools {
  constructor({ player, state, readyFile, commitPreparation, notify, canEdit = () => true }) {
    Object.assign(this, { player, state, readyFile, commitPreparation, notify, canEdit }); this.tap = new TapTempo(); this.auditionRequest = 0; this.measurementRequest = 0;
    this.mount();
    this.$('#language').addEventListener('change', () => { const track = this.state().tracks.find(track => track.id === this.trackId); if (track) { this.showMeasurement(track); this.showTempo(track); } this.routingStatus(); });
    const previous = player.onRoutingChange;
    player.onRoutingChange = () => { previous?.(); this.routingStatus(); };
    this.observer = new MutationObserver(() => this.addActions()); this.observer.observe(document.querySelector('#tracks'), { childList: true, subtree: true }); this.addActions();
    try { const saved = JSON.parse(localStorage.getItem('studio-audio-processing') || 'null'); if (saved) { player.processing = processingOptions(saved); this.syncSettings(); } } catch { /* Invalid preferences leave the unprocessed default. */ }
  }
  $(selector) { return document.querySelector(selector); }
  action(callback) { return async () => { try { await callback(); } catch (error) { this.notify(error.message, true); } }; }
  mount() {
    const dialog = document.createElement('dialog'); dialog.id = 'audio-review-dialog'; dialog.setAttribute('aria-labelledby', 'audio-review-title');
    dialog.innerHTML = `<div class="dialog-heading"><h2 id="audio-review-title">Audio review</h2><button id="audio-review-close" aria-label="Close">×</button></div>
      <p id="audio-recording" data-preserve></p><section><h3>Tempo review</h3><p id="audio-tempo-evidence" role="status"></p><p class="hint">Tempo estimates are uncertain and do not establish beat matching or musical suitability. Review by ear.</p>
      <label>Manual BPM <input id="audio-bpm" type="number" min="20" max="300" step="0.1"></label><div class="dialog-actions"><button id="audio-half">Half BPM</button><button id="audio-double">Double BPM</button><button id="audio-tap">Tap tempo</button><button id="audio-reset-tap">Reset taps</button><button id="audio-save-bpm">Save BPM review</button></div><p id="audio-tap-status" role="status"></p></section>
      <section><h3>Measured loudness</h3><p class="hint">Measure the complete mono or stereo file using gated K-weighted energy and 4× reconstructed peaks. This is digital PCM measurement; venue sound is verified separately.</p><button id="audio-measure">Measure audio</button><p id="audio-measurement" role="status"></p></section>
      <section><h3>Audition segment</h3><label>From (seconds) <input id="audio-segment-start" type="number" min="0" value="0" step="0.1"></label><label>To (seconds) <input id="audio-segment-end" type="number" min="0.1" value="15" step="0.1"></label><div class="dialog-actions"><button id="audio-audition-original">Original segment</button><button id="audio-audition-processed">Processed segment</button><button id="audio-stop-audition">Stop audition</button></div></section>`;
    document.querySelector('#app').append(dialog);
    const style = document.createElement('style'); style.textContent = '#audio-review-dialog .dialog-actions{flex-wrap:wrap;justify-content:flex-start}#audio-review-dialog section{margin-bottom:22px}#audio-settings select{width:100%}#audio-review-dialog input{max-width:100%}#audio-settings p{overflow-wrap:anywhere}'; document.querySelector('#app').append(style);
    this.$('#audio-review-close').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { ++this.auditionRequest; ++this.measurementRequest; this.player.stopPreview(); });
    this.$('#audio-half').onclick = () => this.correct(0.5, 'half'); this.$('#audio-double').onclick = () => this.correct(2, 'double');
    this.$('#audio-bpm').oninput = () => { this.bpmSource = 'manual'; };
    this.$('#audio-tap').onclick = () => { const value = this.tap.tap(); this.$('#audio-tap-status').textContent = value ? `${value} BPM · ${this.tap.taps.length} ${t('taps')}` : `${this.tap.taps.length} ${t('taps')} · ${t('tap at least four beats')}`; if (value) { this.$('#audio-bpm').value = value; this.bpmSource = 'tap'; } };
    this.$('#audio-reset-tap').onclick = () => { this.tap.reset(); this.$('#audio-tap-status').textContent = ''; };
    this.$('#audio-save-bpm').onclick = this.action(() => this.saveBpm()); this.$('#audio-measure').onclick = this.action(() => this.measure());
    this.$('#audio-audition-original').onclick = this.action(() => this.audition(false)); this.$('#audio-audition-processed').onclick = this.action(() => this.audition(true)); this.$('#audio-stop-audition').onclick = () => this.player.stopPreview();
    const settings = document.createElement('section'); settings.className = 'preview-routing'; settings.id = 'audio-settings';
    settings.innerHTML = `<h3>Measured loudness processing</h3><p class="hint">Optional local processing uses measured gain, 5 ms lookahead peak limiting and a reconstructed peak ceiling. Originals remain unchanged. Pause to apply or bypass at the same position. YouTube uses its original output and level controls.</p>
      <label><input id="audio-processing-enabled" type="checkbox"> Enable measured processing</label><label><input id="audio-processing-bypass" type="checkbox"> Bypass processing</label><label>Target LUFS <input id="audio-target-lufs" type="number" min="-30" max="-12" step="1" value="-18"></label><label>Headroom (dB) <input id="audio-headroom" type="number" min="0.5" max="12" step="0.5" value="1"></label><label><input id="audio-limiter" type="checkbox" checked> Peak limiter</label><button id="audio-apply-processing">Apply audio settings</button><p id="audio-processing-status" role="status"></p>
      <h3>Master output</h3><select id="audio-master-output" aria-label="Master output"><option value="">System output</option></select><button id="audio-detect-outputs">Detect outputs</button>
      <h3>Master and cue channels</h3><p class="hint">Channel numbers depend on the selected audio interface. Pause before changing mapping. YouTube always uses the system output.</p><div class="form-row"><label>Master L <input id="audio-master-left" type="number" min="1" max="32" value="1"></label><label>Master R <input id="audio-master-right" type="number" min="1" max="32" value="2"></label></div><button id="audio-map-master">Apply master channels</button><div class="form-row"><label>Cue L <input id="audio-cue-left" type="number" min="1" max="32" value="1"></label><label>Cue R <input id="audio-cue-right" type="number" min="1" max="32" value="2"></label></div><button id="audio-map-cue">Apply cue channels</button><label><input id="audio-confirm-channels" type="checkbox"> I tested the separate channel outputs on this interface</label><p id="audio-routing-status" role="status"></p>`;
    this.$('#settings-dialog').append(settings);
    this.$('#audio-apply-processing').onclick = this.action(() => this.applyProcessing()); this.$('#audio-detect-outputs').onclick = this.action(() => this.detectOutputs());
    this.$('#audio-master-output').onchange = this.action(async () => { try { if (!this.canEdit()) throw new Error('Unlock Live mode before changing the master output.'); await this.player.setMasterOutput(this.$('#audio-master-output').value, { canApply: this.canEdit }); } finally { this.routingStatus(); } });
    for (const kind of ['master', 'cue']) this.$(`#audio-map-${kind}`).onclick = this.action(async () => { if (!this.canEdit()) throw new Error('Unlock Live mode before changing channel mapping.'); await this.player.setOutputChannels(kind, ['left', 'right'].map(side => Number(this.$(`#audio-${kind}-${side}`).value)), { canApply: this.canEdit }); this.routingStatus(); });
    this.$('#audio-confirm-channels').onchange = this.action(async () => { if (!this.canEdit()) { this.routingStatus(); throw new Error('Unlock Live mode before confirming channel outputs.'); } this.player.confirmChannelIsolation(this.$('#audio-confirm-channels').checked); this.routingStatus(); });
    this.syncSettings(); this.routingStatus();
  }
  addActions() {
    for (const row of document.querySelectorAll('#tracks [data-track]')) {
      if (row.querySelector('[data-audio-review]')) continue;
      const button = document.createElement('button'); button.dataset.audioReview = row.dataset.track; button.dataset.action = 'audio-review'; button.dataset.id = row.dataset.track; button.className = 'secondary-action'; button.textContent = t('Audio review');
      row.querySelector('.track-actions')?.append(button);
    }
  }
  open(id) {
    ++this.auditionRequest; ++this.measurementRequest;
    this.trackId = id; const track = this.state().tracks.find(track => track.id === id); if (!track) return;
    this.$('#audio-recording').textContent = track.title; this.$('#audio-bpm').value = track.bpm || ''; this.bpmSource = 'manual'; this.tap.reset(); this.$('#audio-tap-status').textContent = '';
    this.showTempo(track);
    this.$('#audio-segment-start').value = track.cueStartSeconds || 0; this.$('#audio-segment-end').value = Math.min(track.duration || 15, (track.cueStartSeconds || 0) + 15);
    for (const id of ['audio-measure', 'audio-audition-original', 'audio-audition-processed']) this.$(`#${id}`).disabled = track.source !== 'local';
    this.showMeasurement(track); this.$('#audio-review-dialog').showModal();
  }
  showTempo(track) { this.$('#audio-tempo-evidence').textContent = track.bpmSource && track.bpmSource !== 'estimate' ? `${t('Reviewed BPM')} · ${t(track.bpmSource)}` : `${track.bpm || t('Unknown')} BPM · ${t('Estimate confidence')} ${Math.round((track.bpmConfidence || 0) * 100)}% · ${t('alternatives')} ${(track.bpmCandidates || []).join(', ') || t('none')}`; }
  showMeasurement(track) { this.$('#audio-measurement').textContent = track.loudnessAnalysisVersion ? `${track.integratedLufs == null ? t('Below loudness gate') : `${track.integratedLufs} LUFS`} · ${track.truePeakDb} dBTP · ${t('full-file PCM')}` : t('No full-file measurement saved.'); }
  correct(factor, source) { const value = Number(this.$('#audio-bpm').value) * factor; if (!(value >= 20 && value <= 300)) { this.notify('Choose a BPM from 20 to 300.', true); return; } this.$('#audio-bpm').value = Math.round(value * 10) / 10; this.bpmSource = source; }
  async commit(patch, label, expected = structuredClone(this.state()), targetId = this.trackId) {
    if (!this.canEdit()) throw new Error('Unlock Live mode before editing audio metadata.');
    const next = structuredClone(expected), track = next.tracks.find(track => track.id === targetId); if (!track) throw new Error('This recording was removed.');
    Object.assign(track, patch); if (patch.bpmSource && patch.bpmSource !== 'estimate') { track.bpmConfidence = null; delete track.bpmCandidates; }
    const saved = await this.commitPreparation(label, next, expected); if (saved === false) return false;
    if (this.trackId === targetId && this.$('#audio-review-dialog').open) this.showMeasurement(track); return true;
  }
  async saveBpm() { const bpm = Number(this.$('#audio-bpm').value); if (!(bpm >= 20 && bpm <= 300)) throw new Error('Choose a BPM from 20 to 300.'); if (await this.commit({ bpm, bpmSource: this.bpmSource }, 'Review BPM')) { this.notify('BPM review saved.'); this.openEvidence(); } }
  openEvidence() { const track = this.state().tracks.find(track => track.id === this.trackId); if (track) this.showTempo(track); }
  async measure() {
    if (!this.canEdit()) throw new Error('Unlock Live mode before editing audio metadata.');
    const request = ++this.measurementRequest, expected = structuredClone(this.state()), track = expected.tracks.find(track => track.id === this.trackId); if (!track || track.source !== 'local') throw new Error('Choose a local recording to measure.');
    this.$('#audio-measure').disabled = true; this.$('#audio-measurement').textContent = 'Measuring full-file PCM…';
    try {
      const file = await this.readyFile(track, true); if (!file) throw new Error('Relink the local file before measuring.');
      if (request !== this.measurementRequest) return false;
      const result = await measureFile(file), patch = {};
      if (request !== this.measurementRequest || this.trackId !== track.id || !this.$('#audio-review-dialog').open) return false;
      for (const key of ['integratedLufs', 'truePeakDb', 'loudnessAnalysisVersion', 'measuredSeconds', 'duration']) patch[key] = result[key];
      if (!track.bpmSource || track.bpmSource === 'estimate') for (const key of ['bpm', 'bpmConfidence', 'bpmCandidates', 'bpmSource']) patch[key] = result[key];
      await this.commit(patch, 'Measure audio', expected, track.id);
    } finally { if (request === this.measurementRequest) this.$('#audio-measure').disabled = false; }
  }
  async audition(processed) {
    const request = ++this.auditionRequest, segment = { startSeconds: Number(this.$('#audio-segment-start').value), endSeconds: Number(this.$('#audio-segment-end').value), processed };
    const track = this.state().tracks.find(track => track.id === this.trackId); if (!track || track.source !== 'local') throw new Error('Choose a local recording to audition.');
    if (!this.player.hasSeparatePreviewOutput && !this.canEdit()) throw new Error('Choose a separate cue output before auditioning in Live mode.');
    const file = await this.readyFile(track, true); if (!file) throw new Error('Relink the local file before auditioning.');
    if (request !== this.auditionRequest || !this.$('#audio-review-dialog').open || this.trackId !== track.id || segment.startSeconds !== Number(this.$('#audio-segment-start').value) || segment.endSeconds !== Number(this.$('#audio-segment-end').value)) return false;
    if (!this.player.hasSeparatePreviewOutput && !this.canEdit()) throw new Error('Choose a separate cue output before auditioning in Live mode.');
    if (!this.state().tracks.some(current => current.id === track.id && current.contentHash === track.contentHash)) return false;
    return this.player.previewSegment(track, file, segment);
  }
  syncSettings() { const settings = this.player.processing; for (const [key, id] of [['enabled', 'audio-processing-enabled'], ['bypass', 'audio-processing-bypass'], ['limiter', 'audio-limiter']]) this.$(`#${id}`).checked = settings[key]; this.$('#audio-target-lufs').value = settings.targetLufs; this.$('#audio-headroom').value = settings.headroomDb; }
  async applyProcessing() {
    if (!this.canEdit()) throw new Error('Unlock Live mode before changing loudness processing.');
    const options = { enabled: this.$('#audio-processing-enabled').checked, bypass: this.$('#audio-processing-bypass').checked, limiter: this.$('#audio-limiter').checked, targetLufs: Number(this.$('#audio-target-lufs').value), headroomDb: Number(this.$('#audio-headroom').value) };
    this.$('#audio-apply-processing').disabled = true;
    try { if (await this.player.setLoudnessProcessing(options, { canApply: this.canEdit }) !== false) { localStorage.setItem('studio-audio-processing', JSON.stringify(this.player.processing)); this.$('#audio-processing-status').textContent = !options.enabled || options.bypass ? t('Original audio · processing bypassed.') : `${t('Measured processing')} · ${options.targetLufs} ${t('LUFS target')} · ${options.headroomDb} ${t('dB headroom')}`; } else { this.syncSettings(); this.$('#audio-processing-status').textContent = t('Audio settings canceled. Pause playback and unlock Live mode before applying again.'); } } finally { this.$('#audio-apply-processing').disabled = false; }
  }
  async detectOutputs() { const outputs = await this.player.getAudioOutputs(), select = this.$('#audio-master-output'); select.replaceChildren(new Option('System output', '')); for (const device of outputs) if (!['default', 'communications'].includes(device.deviceId)) select.add(new Option(device.label || 'Audio output', device.deviceId)); select.value = this.player.masterOutputId === 'default' ? '' : this.player.masterOutputId; this.routingStatus(); }
  routingStatus() { const status = this.player.outputStatus, element = this.$('#audio-routing-status'); if (!element) return; this.$('#audio-master-output').value = status.master === 'default' ? '' : status.master; this.$('#audio-confirm-channels').checked = status.channelConfirmation; element.textContent = status.missing ? t('Master output disconnected. Reconnect and select an available output before playing.') : `${t('Master')} ${t(status.masterLabel)} · ${t('channels')} ${status.masterChannels.join('/')} · ${t('cue')} ${t(status.cueLabel)} · ${t('channels')} ${status.cueChannels.join('/')} · ${t(status.isolated ? 'separate route configured; verify the hardware' : 'shared output: preview blocked during playback')}`; }
}
