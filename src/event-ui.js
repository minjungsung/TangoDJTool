import { backTiming, eventRundown, planTime } from './event-plan.js';
import { t } from './i18n.js';

export const eventTranslations = {
  'Development progress': ['개발 진행표', 'Progreso de desarrollo'],
  'Undo': ['실행 취소', 'Deshacer'],
  'Redo': ['다시 실행', 'Rehacer'],
  'Preparation changed': ['준비 내용 변경됨', 'Preparación modificada'],
  'Preparation restored': ['준비 내용 복원됨', 'Preparación restaurada'],
  'Edit tanda composition': ['딴따 구성 수정', 'Editar composición de tanda'],
  'Edit recording metadata': ['곡 정보 수정', 'Editar metadatos de grabación'],
  'Edit saved sets': ['저장된 세트 수정', 'Editar colecciones guardadas'],
  'Reload starts a new edit history.': ['페이지를 다시 열면 편집 이력이 새로 시작됩니다.', 'Recargar inicia un nuevo historial de edición.'],
  'Library sources changed; a new edit history starts here.': ['곡 소스가 바뀌어 여기서 편집 이력이 새로 시작됩니다.', 'Cambiaron las fuentes; comienza un nuevo historial de edición.'],
  'Deleted recordings are removed from preparation history.': ['삭제한 곡은 이전 편집 이력에서도 제외됩니다.', 'Las grabaciones eliminadas se excluyen del historial de preparación.'],
  'Backup restore starts a new edit history.': ['백업 복원 후 편집 이력이 새로 시작됩니다.', 'Restaurar una copia inicia un nuevo historial de edición.'],
  'Event planning': ['행사 시간 계획', 'Planificación del evento'],
  'Target end time': ['행사 종료 시각', 'Hora de finalización'],
  'Clear deadline': ['종료 시각 지우기', 'Quitar hora límite'],
  'Review final tanda': ['마지막 딴따 검토', 'Revisar tanda final'],
  'Export event rundown': ['행사 진행표 내보내기', 'Exportar programa del evento'],
  'Print rundown': ['진행표 인쇄', 'Imprimir programa'],
  'Time available': ['남는 시간', 'Tiempo disponible'],
  'Over target': ['종료 시각 초과', 'Supera la hora límite'],
  'Reviewed final tanda': ['검토한 마지막 딴따', 'Tanda final revisada'],
  'Suggested final tanda': ['마지막 딴따 제안', 'Tanda final sugerida'],
  'Manual stop; playback is unchanged.': ['직접 멈추세요. 재생은 그대로 유지됩니다.', 'Detención manual; la reproducción sigue igual.'],
  'Review before choosing.': ['검토한 뒤 선택하세요.', 'Revisa antes de elegir.'],
  'No complete known tanda fits. Review the remaining program; do not truncate the current recording.': ['확인된 길이로 맞는 완전한 딴따가 없습니다. 남은 구성을 검토하고 현재 곡은 끝까지 유지하세요.', 'No cabe una tanda completa con duración conocida. Revisa el programa restante y deja terminar la grabación actual.'],
  'Conditional estimate; review unknown lengths and manual waits.': ['조건부 계산입니다. 알 수 없는 길이와 수동 대기를 검토하세요.', 'Estimación condicional; revisa duraciones desconocidas y esperas manuales.'],
  'No deadline selected.': ['종료 시각을 선택하세요.', 'No hay hora límite seleccionada.'],
  'Playback is unchanged. Advance or stop manually after the reviewed final tanda.': ['재생은 그대로 유지됩니다. 검토한 마지막 딴따 후 직접 넘기거나 멈추세요.', 'La reproducción sigue igual. Avanza o detén manualmente tras la tanda final revisada.'],
};

export class EventTools {
  constructor({ context, preferences, savePreferences, notify }) {
    Object.assign(this, { context, preferences, savePreferences, notify });
    document.querySelector('#set').insertAdjacentHTML('beforeend', `<details class="event-tools"><summary>Event planning</summary><label>Target end time <input id="event-deadline" type="datetime-local"></label><button id="clear-deadline">Clear deadline</button><p id="deadline-status" role="status"></p><select id="final-tanda" aria-label="Review final tanda"></select><button id="review-final-tanda">Review final tanda</button><p id="final-tanda-status"></p><button id="export-rundown">Export event rundown</button><button id="print-rundown">Print rundown</button></details>`);
    const $ = selector => document.querySelector(selector); this.$ = $;
    $('#event-deadline').value = preferences().eventDeadline || '';
    $('#event-deadline').onchange = () => { savePreferences({ eventDeadline: $('#event-deadline').value, finalGroupId: '' }); this.render(); };
    $('#clear-deadline').onclick = () => { $('#event-deadline').value = ''; savePreferences({ eventDeadline: '', finalGroupId: '' }); this.render(); };
    $('#review-final-tanda').onclick = () => {
      const plan = this.plan(), selected = plan?.candidates.find(item => String(item.endIndex) === $('#final-tanda').value);
      if (!selected) return;
      savePreferences({ finalGroupId: selected.groupId }); this.render(); notify('Playback is unchanged. Advance or stop manually after the reviewed final tanda.');
    };
    $('#export-rundown').onclick = () => {
      const url = URL.createObjectURL(new Blob([this.rundown()], { type: 'text/html;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tango-dj-event-rundown.html'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    $('#print-rundown').onclick = () => {
      const frame = document.createElement('iframe'); frame.title = 'Printable event rundown'; frame.hidden = true; frame.srcdoc = this.rundown();
      frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); }; document.body.append(frame);
    };
    this.timer = setInterval(() => this.render(), 15000);
    this.render();
  }
  plan() { return backTiming(this.context().queue, { ...this.context(), deadline: this.$('#event-deadline').value }); }
  rundown() { return eventRundown(this.context().state, { gapSeconds: this.context().gapSeconds, deadline: this.$('#event-deadline').value, finalGroupId: this.preferences().finalGroupId }); }
  render() {
    const plan = this.plan(), select = this.$('#final-tanda'), prior = select.value;
    select.replaceChildren(); this.$('#review-final-tanda').disabled = !plan?.candidates.length;
    if (!plan) { this.$('#deadline-status').textContent = t('No deadline selected.'); this.$('#final-tanda-status').textContent = ''; return; }
    const timing = plan.slackSeconds >= 0 ? `${t('Time available')}: ${planTime(plan.slackSeconds)}` : `${t('Over target')}: ${planTime(-plan.slackSeconds)}`;
    this.$('#deadline-status').textContent = `${t('Known runtime')}: ${planTime(plan.knownSeconds)} · ${timing} · ${t('Unknown lengths')}: ${plan.unknownCount} · ${t('Manual waits')}: ${plan.heldCount}${plan.conditional ? ` · ${t('Conditional estimate; review unknown lengths and manual waits.')}` : ''}`;
    for (const item of plan.candidates) select.add(new Option(`${item.name} · ${planTime(item.knownSeconds)}${item.conditional ? ' · ?' : ''}${item.slackSeconds < 0 ? ` · ${t('Over target')}` : ''}`, String(item.endIndex)));
    select.value = [...select.options].some(option => option.value === prior) ? prior : String(plan.suggestion?.endIndex ?? plan.candidates.at(-1)?.endIndex ?? '');
    const reviewed = this.context().state.groups.find(group => group.id === this.preferences().finalGroupId);
    this.$('#final-tanda-status').textContent = reviewed ? `${t('Reviewed final tanda')}: ${reviewed.name} · ${t('Manual stop; playback is unchanged.')}` : plan.suggestion ? `${t('Suggested final tanda')}: ${plan.suggestion.name} · ${t('Review before choosing.')}` : t('No complete known tanda fits. Review the remaining program; do not truncate the current recording.');
  }
}
