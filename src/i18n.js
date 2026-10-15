const pairs = {
  'Playback is waiting for YouTube. Check your connection or retry from the current position.': ['YouTube 재생이 멈춰 기다리는 중입니다. 인터넷을 확인하거나 현재 지점에서 다시 시도하세요.', 'La reproducción está esperando a YouTube. Comprueba la conexión o reintenta desde la posición actual.'], 'Retry here': ['현재 지점 재시도', 'Reintentar aquí'],
  'From': ['시작', 'Desde'], 'To': ['끝', 'Hasta'], 'Cortina end position': ['코르티나 끝 지점', 'Final de la cortina'],
  'The start must be before the recording ends. Choose an earlier cue.': ['시작점은 곡이 끝나기 전이어야 합니다. 더 이른 지점을 선택하세요.', 'El inicio debe estar antes del final de la grabación. Elige un punto anterior.'],
  'Choose a cortina interval within the recording length.': ['코르티나 구간을 원본 곡 길이 안에서 지정하세요.', 'Elige un intervalo de cortina dentro de la duración de la grabación.'],
  'Update upcoming queue': ['이후 대기열 반영', 'Actualizar próximas grabaciones'],
  'Upcoming queue updated. Current recording keeps playing.': ['이후 대기열을 반영했습니다. 현재 곡은 계속 재생됩니다.', 'Cola actualizada. La grabación actual sigue sonando.'],
  'The current recording is no longer in the edited set. Finish it before loading another set.': ['현재 곡이 수정된 세트에 없습니다. 이 곡을 마친 뒤 다른 세트를 불러오세요.', 'La grabación actual ya no está en la sesión editada. Termina antes de cargar otra sesión.'],
  'This workspace changed in another tab. Export your edits, then reload to use the latest saved workspace.': ['다른 탭에서 작업 공간이 변경되었습니다. 수정 내용을 내보낸 뒤 새로고침하여 최신 저장 상태를 불러오세요.', 'Este espacio cambió en otra pestaña. Exporta tus cambios y recarga para usar la última versión guardada.'],
  'YouTube player did not become ready. Check your connection and try again.': ['YouTube 플레이어를 준비하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.', 'El reproductor de YouTube no está listo. Comprueba tu conexión e inténtalo de nuevo.'],
  'Dismiss notification': ['알림 닫기', 'Cerrar notificación'],
  'Wait before the next tanda': ['다음 탄다 시작 전 대기', 'Esperar antes de la siguiente tanda'],
  'Remaining': ['남은 시간', 'Tiempo restante'], 'Up next': ['다음 곡', 'A continuación'], 'Recording': ['곡', 'Grabación'],
  'Start at': ['시작 지점', 'Empezar en'], 'Cortina start position': ['코르티나 시작 지점', 'Inicio de la cortina'],
  'Use deck position': ['현재 재생 지점 사용', 'Usar posición actual'], 'Play this cortina': ['이 코르티나 재생', 'Reproducir esta cortina'],
  'Plays on the live output': ['주 재생 출력으로 들립니다', 'Se escucha por la salida principal'],
  'Recording source changed. Press Play to use the updated recording.': ['음악 소스가 변경되었습니다. 재생을 눌러 변경한 곡을 들으세요.', 'La fuente cambió. Pulsa reproducir para escuchar la grabación actualizada.'],
  'YOUR WORKSPACE': ['내 작업 공간', 'TU ESPACIO'],
  'Music library': ['음악 라이브러리', 'Biblioteca musical'], 'Set builder': ['탄다 구성', 'Crear tandas'], 'Live deck': ['재생 데크', 'Reproductor'],
  'Local-first workspace': ['내 브라우저 작업 공간', 'Espacio en este navegador'],
  'Music stays in this browser.': ['음악은 이 브라우저에 저장됩니다.', 'La música se guarda en este navegador.'], 'YouTube plays online.': ['YouTube는 인터넷으로 재생됩니다.', 'YouTube necesita internet.'],
  'PREPARE. LISTEN. CONNECT.': ['준비하고, 듣고, 함께 춤추세요.', 'PREPARA. ESCUCHA. CONECTA.'],
  'Your next milonga starts here.': ['다음 밀롱가를 여기서 준비하세요.', 'Tu próxima milonga empieza aquí.'],
  'Build the flow, one tanda at a time.': ['탄다를 하나씩 엮어 밀롱가의 흐름을 만드세요.', 'Construye el ambiente, tanda a tanda.'],
  'Import set': ['세트 가져오기', 'Importar sesión'], 'Export set ↗': ['세트 내보내기 ↗', 'Exportar sesión ↗'],
  'Add your recordings or a YouTube video to get started.': ['음악 파일이나 YouTube 영상을 추가해 시작하세요.', 'Añade tus archivos o un video de YouTube para empezar.'],
  '01 / COLLECTION': ['01 / 음악 모음', '01 / COLECCIÓN'], '02 / THE FLOW': ['02 / 탄다 흐름', '02 / EL AMBIENTE'], '03 / LIVE DECK': ['03 / 재생 데크', '03 / REPRODUCTOR'],
  '+ Local files': ['+ 음악 파일', '+ Archivos locales'], 'Drop your music here': ['음악 파일을 여기로 끌어오세요', 'Arrastra tu música aquí'],
  'MP3, WAV, FLAC, M4A and other browser-supported audio': ['MP3, WAV, FLAC, M4A 등 브라우저가 지원하는 음악 파일', 'MP3, WAV, FLAC, M4A y otros formatos compatibles'],
  'Browse files': ['파일 선택', 'Elegir archivos'], 'Paste a YouTube video link': ['YouTube 영상 링크 붙여넣기', 'Pega un enlace de YouTube'], 'Add video': ['영상 추가', 'Añadir video'],
  'Search title, orchestra, singer…': ['곡명, 악단, 가수 검색…', 'Buscar título, orquesta, cantante…'],
  'All styles': ['모든 장르', 'Todos los estilos'], 'All sources': ['모든 소스', 'Todas las fuentes'], 'Local': ['로컬 파일', 'Local'],
  'RECORDING': ['곡', 'GRABACIÓN'], 'STYLE / YEAR': ['장르 / 연도', 'ESTILO / AÑO'], 'LENGTH': ['길이', 'DURACIÓN'], 'Actions': ['작업', 'Acciones'],
  'A home for your collection': ['나만의 음악 모음', 'Un hogar para tu colección'],
  'Bring in your recordings, organize the details,': ['곡을 가져와 정보를 정리하고,', 'Importa tus grabaciones, organiza los detalles,'],
  'and find the right music for each moment.': ['순간에 맞는 음악을 골라보세요.', 'y encuentra la música para cada momento.'],
  'Analyze local tracks': ['로컬 곡 분석', 'Analizar archivos locales'], '+ Tanda': ['+ 탄다', '+ Tanda'], '+ Cortina': ['+ 코르티나', '+ Cortina'],
  'Select a group, then use + on a recording. Drag recordings into a group to add them.': ['탄다를 선택한 뒤 곡의 + 추가를 누르세요. 곡을 탄다로 끌어 넣어도 됩니다.', 'Selecciona un grupo y pulsa + en una grabación, o arrástrala al grupo.'],
  'Give your set a shape': ['밀롱가의 흐름을 구성하세요', 'Dale forma a tu sesión'], 'Create a tanda, choose its recordings,': ['탄다를 만들고 곡을 고른 뒤,', 'Crea una tanda, elige sus grabaciones,'], 'then add a cortina between groups.': ['탄다 사이에 코르티나를 넣으세요.', 'y añade cortinas entre los grupos.'],
  '▶ Load & play set': ['▶ 전체 세트 재생', '▶ Cargar y reproducir sesión'], 'READY WHEN YOU ARE': ['재생 준비', 'TODO LISTO'],
  'No recording loaded': ['재생 중인 곡 없음', 'Ninguna grabación cargada'], 'Play a track or load your prepared set.': ['곡을 재생하거나 구성한 세트를 불러오세요.', 'Reproduce una grabación o carga tu sesión.'],
  'Volume': ['음량', 'Volumen'], 'Fade': ['페이드', 'Fundido'], 'Off': ['끄기', 'Desactivado'], '1 sec': ['1초', '1 s'], '2 sec': ['2초', '2 s'], '4 sec': ['4초', '4 s'],
  'Level local audio': ['로컬 음량 보정', 'Ajustar nivel local'], 'Auto next': ['다음 곡 자동 재생', 'Avance automático'],
  'Preview uses the same audio output as the live deck. Fades and level adjustment apply to local audio. YouTube uses its own player controls.': ['미리 듣기는 주 재생과 같은 출력 장치를 씁니다. 페이드와 음량 보정은 로컬 파일에 적용됩니다. YouTube는 영상 플레이어로 조작하세요.', 'La escucha previa usa la misma salida que el reproductor principal. Los fundidos y el ajuste de nivel se aplican a archivos locales. YouTube usa su propio reproductor.'],
  'Stop preview': ['미리 듣기 중지', 'Detener escucha previa'], 'If automatic playback is blocked, press play in the video.': ['자동 재생이 차단되면 영상 안의 재생 버튼을 누르세요.', 'Si el inicio automático está bloqueado, pulsa reproducir dentro del video.'],
  'Play queue': ['재생 대기열', 'Cola de reproducción'], 'Load a set or play a library track.': ['세트를 불러오거나 라이브러리에서 곡을 재생하세요.', 'Carga una sesión o reproduce una grabación de la biblioteca.'],
  'Made for the music between people.': ['사람과 사람을 잇는 음악을 위해.', 'Para la música que nos une.'], 'Library & files saved locally · Export sets for backup': ['라이브러리·파일은 브라우저에 저장 · 세트 내보내기로 백업', 'Biblioteca y archivos guardados aquí · Exporta para respaldar'],
  'RECORDING DETAILS': ['곡 정보', 'DETALLES DE LA GRABACIÓN'], 'Edit metadata': ['곡 정보 수정', 'Editar metadatos'], 'Title': ['곡명', 'Título'], 'Orchestra / artist': ['악단 / 아티스트', 'Orquesta / artista'], 'Singer': ['가수', 'Cantante'], 'Year': ['연도', 'Año'], 'Style': ['장르', 'Estilo'], 'Unspecified': ['미지정', 'Sin especificar'], 'Cancel': ['취소', 'Cancelar'], 'Save details': ['정보 저장', 'Guardar detalles'],
  'Unknown orchestra': ['악단 미상', 'Orquesta desconocida'], 'File needed': ['파일 연결 필요', 'Archivo necesario'], 'FILE': ['파일', 'ARCHIVO'],
  'Play': ['재생', 'Reproducir'], 'Preview': ['미리 듣기', 'Escucha previa'], 'Analyze': ['분석', 'Analizar'], 'Edit': ['수정', 'Editar'], 'Add': ['추가', 'Añadir'], 'Relink': ['파일 연결', 'Vincular'],
  '▶ Play': ['▶ 재생', '▶ Reproducir'], '♬ Preview': ['♬ 미리 듣기', '♬ Escuchar'], '⌁ Analyze': ['⌁ 분석', '⌁ Analizar'], '✎ Edit': ['✎ 수정', '✎ Editar'], '+ Add': ['+ 추가', '+ Añadir'], '↥ Relink': ['↥ 파일 연결', '↥ Vincular'],
  'Delete': ['삭제', 'Eliminar'], 'TANGO': ['탱고', 'TANGO'], 'TANDA': ['탄다', 'TANDA'], 'CORTINA': ['코르티나', 'CORTINA'], 'Tango': ['탱고', 'Tango'], 'Vals': ['발스', 'Vals'], 'Milonga': ['밀롱가', 'Milonga'], 'Cortina': ['코르티나', 'Cortina'],
  'No matching recordings': ['검색 결과 없음', 'Sin grabaciones coincidentes'], 'Missing track': ['곡 없음', 'Grabación ausente'], 'Drop recordings here or select and use +': ['곡을 여기로 끌어오거나 선택 후 + 추가', 'Arrastra grabaciones aquí o selecciona y pulsa +'],
  'LIBRARY TRACK': ['라이브러리 곡', 'GRABACIÓN DE BIBLIOTECA'], 'Local recording': ['로컬 곡', 'Grabación local'], 'YouTube video': ['YouTube 영상', 'Video de YouTube'], 'Library track': ['라이브러리 곡', 'Grabación de biblioteca'],
  'START HERE / HANDS-ON PRACTICE': ['여기서 시작하세요 / 사용 안내', 'EMPIEZA AQUÍ / GUÍA PRÁCTICA'], 'Play a milonga DJ set': ['밀롱가 DJ 세트를 재생해보세요', 'Reproduce una sesión de milonga'],
  'Six tandas: Tango · Tango · Vals · Tango · Tango · Milonga. Each is followed by a 20-second cortina.': ['탄다 6개: 탱고 · 탱고 · 발스 · 탱고 · 탱고 · 밀롱가. 각 탄다 뒤에 20초 코르티나가 이어집니다.', 'Seis tandas: Tango · Tango · Vals · Tango · Tango · Milonga. Después de cada una hay una cortina de 20 segundos.'],
  'Load milonga playlist': ['밀롱가 목록 불러오기', 'Cargar lista de milonga'], 'Play milonga set': ['밀롱가 세트 재생', 'Reproducir sesión de milonga'], 'Hide walkthrough': ['사용 안내 접기', 'Ocultar guía'], 'Show walkthrough': ['사용 안내 펼치기', 'Mostrar guía'], 'Reset walkthrough': ['안내 진행 초기화', 'Reiniciar guía'],
  'Bring in music': ['음악 가져오기', 'Importa música'], 'Find and describe a recording': ['곡 검색과 정보 정리', 'Busca y describe una grabación'], 'Listen before adding': ['추가 전 미리 듣기', 'Escucha antes de añadir'], 'Check tempo and level': ['템포와 음량 확인', 'Revisa el tempo y el nivel'], 'Build the musical flow': ['탄다 흐름 구성', 'Construye el ambiente musical'], 'Play a set': ['세트 재생', 'Reproduce una sesión'], 'Mix local files and YouTube': ['로컬 파일과 YouTube 함께 쓰기', 'Combina archivos locales y YouTube'], 'Save and move your set': ['세트 저장과 이동', 'Guarda y traslada tu sesión'],
  'Import my tango recordings': ['내 탱고 파일 가져오기', 'Importar mis grabaciones'], 'Edit Yo soy el tango': ['Yo soy el tango 정보 수정', 'Editar Yo soy el tango'], 'Preview a local tango recording': ['로컬 탱고 곡 미리 듣기', 'Escuchar una grabación local'], 'Analyze my local recordings': ['내 로컬 곡 분석', 'Analizar mis archivos locales'], 'Select Troilo Tango tanda': ['Troilo 탱고 탄다 선택', 'Seleccionar tanda de Troilo'], 'Play real recordings': ['실제 녹음 재생', 'Reproducir grabaciones'], 'Fill an example video link': ['예제 영상 링크 입력', 'Insertar enlace de ejemplo'], 'Export my set': ['내 세트 내보내기', 'Exportar mi sesión'], '✓ Tried': ['✓ 체험 완료', '✓ Probado'], 'Library buttons': ['라이브러리 버튼', 'Botones de biblioteca'],
  'Cortina length': ['코르티나 길이', 'Duración de cortina'], 'seconds': ['초', 'segundos'], 'Adding to': ['추가할 탄다', 'Añadir a'], 'Select a tanda to add recordings': ['곡을 추가할 탄다를 선택하세요', 'Selecciona una tanda para añadir grabaciones'], 'Set changed': ['세트 수정됨', 'Sesión modificada'], 'Undo last set edit': ['마지막 세트 수정 되돌리기', 'Deshacer último cambio'], 'Set changed. Update upcoming queue to keep the current recording, or load the whole set from the start.': ['세트가 바뀌었습니다. 이후 대기열 반영으로 현재 곡을 유지하거나 전체 세트를 처음부터 재생하세요.', 'La sesión cambió. Actualiza las próximas grabaciones o carga la sesión desde el inicio.'], 'Queue restored. Press Play to resume your last recording.': ['대기열이 복원되었습니다. 재생을 누르면 마지막 곡부터 시작합니다.', 'Cola restaurada. Pulsa Reproducir para continuar desde la última grabación.'],
  'DJ workspace': ['DJ 작업 공간', 'Espacio DJ'], 'Example sets': ['예제 세트', 'Sesiones de ejemplo'], 'User guide': ['사용 안내', 'Guía de uso'], 'Settings': ['설정', 'Ajustes'], 'Close': ['닫기', 'Cerrar'],
  'Six tandas with cortinas. Add this set to your workspace when you need a starting point.': ['코르티나가 연결된 탄다 6개입니다. 시작할 구성이 필요할 때 내 작업 공간에 추가하세요.', 'Seis tandas con cortinas. Añade esta sesión a tu espacio cuando necesites un punto de partida.'],
  'Language': ['언어', 'Idioma'], 'Browser storage': ['브라우저 저장 공간', 'Almacenamiento del navegador'], 'Request persistent storage': ['저장 공간 유지 요청', 'Solicitar almacenamiento persistente'],
  'Saved in this browser': ['이 브라우저에 저장됨', 'Guardado en este navegador'], 'Saving…': ['저장 중…', 'Guardando…'], 'Save failed — export a backup': ['저장 실패 — 세트를 백업하세요', 'Error al guardar — exporta una copia'],
  'Personal workspace': ['나만의 작업 공간', 'Espacio personal'], 'Your library, audio files, set, queue, and preferences are saved for this site in this browser. Other visitors have their own workspace.': ['라이브러리, 음악 파일, 세트, 대기열과 설정은 이 사이트의 내 브라우저에 저장됩니다. 다른 방문자의 작업 공간과는 별개입니다.', 'Tu biblioteca, archivos, sesión, cola y preferencias se guardan para este sitio en este navegador. Cada visitante tiene su propio espacio.'],
  'Use my local recording': ['내 로컬 파일로 재생', 'Usar mi archivo local'],
  'Open on YouTube': ['YouTube에서 열기', 'Abrir en YouTube'], 'Replace video link': ['영상 링크 교체', 'Cambiar enlace'], 'Retry video': ['영상 다시 재생', 'Reintentar video'], 'Skip unavailable video': ['재생 불가 영상 건너뛰기', 'Saltar video no disponible'],
  'YouTube video unavailable': ['YouTube 영상을 재생할 수 없습니다', 'Video de YouTube no disponible'],
  'This video is private, removed, or unavailable in your region.': ['비공개·삭제된 영상이거나 현재 지역에서 볼 수 없습니다.', 'Este video es privado, fue eliminado o no está disponible en tu región.'],
  'YouTube blocked embedded playback. This may be a video restriction or a website origin issue.': ['YouTube가 웹사이트 내 재생을 차단했습니다. 영상 제한 또는 사이트 주소 문제일 수 있습니다.', 'YouTube bloqueó la reproducción integrada. Puede ser una restricción del video o un problema con el origen del sitio.'],
  'The uploader does not allow playback on other websites.': ['업로더가 다른 웹사이트에서의 재생을 허용하지 않습니다.', 'El autor no permite reproducir este video en otros sitios.'],
  'YouTube could not identify this website. Try opening the app normally and allow its referrer.': ['YouTube가 사이트를 확인하지 못했습니다. 앱을 일반 브라우저에서 열고 리퍼러 차단 설정을 확인하세요.', 'YouTube no pudo identificar este sitio. Abre la app en el navegador y permite el encabezado de referencia.'],
  'YouTube playback failed. Retry, replace the link, or open the video on YouTube.': ['YouTube 재생에 실패했습니다. 다시 재생하거나 링크를 바꾸거나 YouTube에서 열어보세요.', 'Falló la reproducción. Reintenta, cambia el enlace o abre el video en YouTube.'],
  'Video URL': ['영상 URL', 'URL del video'], 'Save video link': ['영상 링크 저장', 'Guardar enlace'],
  'Choose or drop local music files': ['음악 파일 선택 또는 끌어놓기', 'Elegir o arrastrar archivos de música'], 'YouTube video URL': ['YouTube 영상 URL', 'URL del video de YouTube'], 'Search library': ['라이브러리 검색', 'Buscar biblioteca'], 'Filter dance style': ['장르 필터', 'Filtrar estilo'], 'Filter source': ['소스 필터', 'Filtrar fuente'], 'Previous track': ['이전 곡', 'Grabación anterior'], 'Next track': ['다음 곡', 'Siguiente grabación'], 'Stop playback': ['재생 중지', 'Detener reproducción'], 'Play or pause': ['재생 또는 일시정지', 'Reproducir o pausar'], 'Playback position': ['재생 위치', 'Posición de reproducción'],
  'Move group up': ['탄다 위로 이동', 'Subir grupo'], 'Move group down': ['탄다 아래로 이동', 'Bajar grupo'], 'Rename group': ['탄다 이름 수정', 'Cambiar nombre del grupo'], 'Delete group': ['탄다 삭제', 'Eliminar grupo'], 'Move recording up': ['곡 위로 이동', 'Subir grabación'], 'Move recording down': ['곡 아래로 이동', 'Bajar grabación'], 'Remove recording from group': ['탄다에서 곡 제거', 'Quitar grabación del grupo'],
  'Wait for the current import or analysis to finish.': ['가져오기나 분석이 끝날 때까지 기다려주세요.', 'Espera a que termine la importación o el análisis.'], 'End of play queue.': ['대기열이 끝났습니다.', 'Fin de la cola de reproducción.'], 'Playback stopped.': ['재생을 중지했습니다.', 'Reproducción detenida.'], 'Create or select a tanda or cortina first.': ['먼저 탄다나 코르티나를 만들거나 선택하세요.', 'Primero crea o selecciona una tanda o cortina.'],
  'Cortina finished. Press Next to continue.': ['코르티나가 끝났습니다. 다음 곡을 눌러 계속하세요.', 'La cortina terminó. Pulsa Siguiente para continuar.'],
  'Enter a YouTube watch, short, live, or youtu.be video link.': ['YouTube 영상·쇼츠·라이브·공유 링크를 입력하세요.', 'Introduce un enlace de video, short, directo o youtu.be.'], 'This YouTube video is already in your library.': ['이미 라이브러리에 있는 영상입니다.', 'Este video ya está en tu biblioteca.'],
  'Video added. Edit its title and orchestra while YouTube details load.': ['영상이 추가됐습니다. 곡명과 악단 정보를 수정할 수 있습니다.', 'Video añadido. Puedes editar el título y la orquesta.'], 'Set exported. Audio is not included; keep your original recordings.': ['세트를 내보냈습니다. 음악 파일은 포함되지 않으니 원본을 보관하세요.', 'Sesión exportada. No incluye audio; conserva tus archivos originales.'],
  'Set imported. Relink any local recordings marked “File needed”.': ['세트를 가져왔습니다. 파일 연결이 필요한 곡에 원본 파일을 연결하세요.', 'Sesión importada. Vincula los archivos marcados como necesarios.'],
  'File relinked. Analyze it to refresh duration, BPM, and level.': ['파일을 연결했습니다. 분석으로 길이, BPM, 음량을 갱신하세요.', 'Archivo vinculado. Analízalo para actualizar duración, BPM y nivel.'],
  'YouTube audio cannot be decoded for analysis. Enter BPM and metadata manually.': ['YouTube 오디오는 분석할 수 없습니다. BPM과 곡 정보를 직접 입력하세요.', 'No se puede analizar el audio de YouTube. Introduce BPM y metadatos manualmente.'],
  'Use Analyze to estimate BPM, RMS level, peak, and gain. You can edit BPM manually.': ['분석으로 BPM, RMS 음량, 피크와 보정량을 추정하세요. BPM은 직접 수정할 수 있습니다.', 'Analiza para estimar BPM, RMS, pico y ganancia. Puedes corregir el BPM.'],
  'Real recordings ready: 6 DJ tandas in Tango / Tango / Vals / Tango / Tango / Milonga order, with 20-second cortinas. Press Play milonga set. Internet is required.': ['탄다 6개와 20초 코르티나를 불러왔습니다. 밀롱가 세트 재생을 누르세요. YouTube에는 인터넷이 필요합니다.', 'Se cargaron 6 tandas y cortinas de 20 segundos. Pulsa Reproducir sesión de milonga. YouTube necesita internet.'],
  'Recording link filled. Press Add video to import it.': ['영상 링크를 입력했습니다. 영상 추가를 누르세요.', 'Enlace insertado. Pulsa Añadir video.'],
  'Import a local tango recording with + Local files to use Preview. YouTube recordings use Play.': ['+ 음악 파일로 탱고 곡을 가져오면 미리 들을 수 있습니다. YouTube 영상은 재생 버튼을 사용하세요.', 'Importa una grabación con + Archivos locales para escucharla previamente. Para YouTube usa Reproducir.'],
  'Import local tango recordings to analyze BPM and level. YouTube audio cannot be analyzed.': ['BPM과 음량 분석에는 로컬 탱고 파일을 가져오세요. YouTube 오디오는 분석할 수 없습니다.', 'Importa archivos locales para analizar BPM y nivel. El audio de YouTube no se puede analizar.'],
  'Preview on current output': ['현재 출력에서 미리 듣기', 'Escuchar en la salida actual'], 'Analyze BPM and level': ['BPM과 음량 분석', 'Analizar BPM y nivel'], 'Edit metadata': ['곡 정보 수정', 'Editar metadatos'], 'Relink file': ['원본 파일 연결', 'Vincular archivo'], 'Add to selected group': ['선택한 탄다에 추가', 'Añadir al grupo seleccionado'], 'Remove from library': ['라이브러리에서 삭제', 'Quitar de la biblioteca'],
  'Unsupported set file.': ['지원하지 않는 세트 파일입니다.', 'Archivo de sesión no compatible.'], 'Set file is too large.': ['세트 파일이 너무 큽니다.', 'El archivo es demasiado grande.'], 'Invalid track data.': ['곡 정보가 올바르지 않습니다.', 'Datos de grabación no válidos.'], 'Invalid YouTube video.': ['YouTube 영상 정보가 올바르지 않습니다.', 'Video de YouTube no válido.'], 'Invalid metadata.': ['곡 정보 형식이 올바르지 않습니다.', 'Metadatos no válidos.'], 'Invalid analysis.': ['분석 정보가 올바르지 않습니다.', 'Análisis no válido.'], 'Invalid tanda data.': ['탄다 정보가 올바르지 않습니다.', 'Datos de tanda no válidos.'], 'Invalid group playback limit.': ['재생 시간 제한이 올바르지 않습니다.', 'Límite de reproducción no válido.'], 'Set files must be smaller than 10 MB.': ['세트 파일은 10MB 미만이어야 합니다.', 'El archivo debe ser menor de 10 MB.'],
  'YouTube could not load. Check your connection or browser blocking settings.': ['YouTube를 불러올 수 없습니다. 인터넷과 브라우저 차단 설정을 확인하세요.', 'No se pudo cargar YouTube. Revisa la conexión y los bloqueos del navegador.'], 'YouTube could not load.': ['YouTube를 불러올 수 없습니다.', 'No se pudo cargar YouTube.'],
  '▶ Play · ♬ Preview · ⌁ Analyze · ✎ Edit · + Add to selected group · ↥ Relink missing file · × Delete': ['▶ 재생 · ♬ 미리 듣기 · ⌁ 분석 · ✎ 수정 · + 탄다에 추가 · ↥ 파일 연결 · × 삭제', '▶ Reproducir · ♬ Escuchar · ⌁ Analizar · ✎ Editar · + Añadir al grupo · ↥ Vincular · × Eliminar'],
  'Group name': ['탄다 이름', 'Nombre del grupo'], 'Replace your current library and set with this file? Export your current set first if you want to keep it.': ['이 파일로 현재 라이브러리와 세트를 바꿀까요? 유지하려면 먼저 현재 세트를 내보내세요.', '¿Reemplazar tu biblioteca y sesión con este archivo? Exporta primero la sesión actual si deseas conservarla.'],
  'Relink the local file before playing this track.': ['재생하려면 먼저 원본 파일을 연결하세요.', 'Vincula el archivo local antes de reproducir.'], 'Relink the local file before previewing.': ['미리 들으려면 먼저 원본 파일을 연결하세요.', 'Vincula el archivo antes de escuchar.'], 'Preview playback failed.': ['미리 듣기 재생에 실패했습니다.', 'Falló la escucha previa.'],
  'This audio format could not be played. Try MP3, WAV, or a supported AAC file.': ['이 형식은 재생할 수 없습니다. MP3, WAV 또는 지원되는 AAC 파일을 사용하세요.', 'Este formato no se puede reproducir. Prueba MP3, WAV o AAC compatible.'],
};
const guide = {
  ko: [
    '탄다는 같은 장르와 음악적 성격을 가진 곡들의 묶음입니다. 코르티나는 탄다 사이에 무대를 비우고 파트너를 바꾸는 짧은 휴식 음악입니다. 예제는 실제 YouTube 녹음으로 구성됩니다. 코르티나는 대기열에서 20초 후 끝납니다. 다음 곡 자동 재생을 켜면 다음 탄다로 이어집니다.',
    '위에서 밀롱가 목록을 불러오세요. 내 곡과 탄다는 그대로 유지됩니다. + 음악 파일을 누르거나 파일을 라이브러리로 끌어 넣어 직접 가진 탱고 곡을 추가할 수 있습니다.',
    'Troilo나 Canaro로 검색하거나 탱고·발스·밀롱가·코르티나를 필터링하세요. 수정 버튼으로 곡명, 악단, 가수, 연도, 장르와 BPM을 정리하고 저장하세요.',
    '미리 듣기는 로컬 곡을 주 재생 대기열을 바꾸지 않고 재생합니다. 재생 데크에서 미리 듣기 중지를 누르면 멈춥니다. 주 재생과 같은 스피커를 씁니다.',
    '직접 가져온 탱고 파일을 분석하면 BPM과 음량을 추정합니다. 수정 창에서 RMS, 피크와 보정량을 확인하세요. BPM은 귀로 확인하고 수정할 수 있습니다. 로컬 음량 보정을 켜면 분석한 보정량이 적용됩니다.',
    '탱고 → 탱고 → 발스 → 탱고 → 탱고 → 밀롱가 순서이며 각 탄다 뒤에 코르티나가 이어집니다. 탄다를 선택하고 곡의 + 추가를 누르거나 곡을 끌어 넣으세요. 화살표로 순서를 바꾸고, ✎로 이름을 고치고, ×로 제거하세요.',
    '밀롱가 세트 재생으로 예제를 듣거나 전체 세트 재생으로 내 곡까지 모두 재생하세요. 일시정지, 이전·다음 곡, 재생 위치, 음량을 조작할 수 있습니다. 자동 재생은 곡이 끝나면 이어갑니다. 로컬 파일은 2초 페이드를 시험해볼 수 있습니다. 이후 대기열 반영은 현재 곡을 유지합니다. 코르티나의 시작·끝 지점과 다음 탄다 전 대기를 설정할 수 있습니다.',
    '예제에는 이미 실제 YouTube 녹음이 있습니다. 다른 영상 링크를 붙여 음악 모음을 늘리세요. 라이브러리의 재생 버튼으로 듣거나 전체 세트로 로컬 곡과 함께 재생하세요. 영상에는 인터넷이 필요하고 영상 안의 재생 버튼을 눌러야 할 수 있습니다.',
    '내 작업은 이 사이트의 이 브라우저에 자동 저장됩니다. 내 세트 내보내기는 곡 정보와 탄다 순서를 JSON으로 내려받습니다. 다른 브라우저에서는 세트 가져오기로 복원할 수 있습니다. 음악 파일은 별도이며, 파일 연결 필요로 표시된 곡에 원본을 연결하세요.',
    '목록은 모두 실제 녹음입니다. 탱고 외 음악은 코르티나로만 사용합니다. 미리 듣기, 페이드, 분석에는 로컬 파일이 필요합니다. YouTube 영상은 인터넷과 임베드 허용이 필요합니다. 실제 행사 전에 각 탄다를 끝까지 들어보세요.',
  ],
  es: [
    'Una tanda reúne grabaciones con un mismo estilo y carácter musical. La cortina es una pausa breve para despejar la pista y cambiar de pareja. Esta sesión usa grabaciones reales de YouTube. Las cortinas terminan a los 20 segundos en la cola; activa Avance automático para seguir con la próxima tanda.',
    'Carga la lista de milonga arriba. Tus grabaciones y grupos se conservan. Usa + Archivos locales o arrastra tus archivos de tango a la biblioteca.',
    'Busca Troilo o Canaro, o filtra por Tango, Vals, Milonga o Cortina. Pulsa Editar para modificar título, orquesta, cantante, año, estilo y BPM. Guarda los cambios.',
    'La escucha previa reproduce un archivo local sin cambiar la cola principal. Pulsa Detener escucha previa en el reproductor para parar. Usa los mismos altavoces que la reproducción principal.',
    'Analiza tus grabaciones locales para estimar BPM y nivel. Abre Editar para ver RMS, pico y ganancia sugerida. Revisa el BPM de oído. Activa Ajustar nivel local para aplicar la ganancia analizada.',
    'La secuencia es Tango → Tango → Vals → Tango → Tango → Milonga, con una cortina después de cada tanda. Selecciona un grupo y pulsa + Añadir en una grabación, o arrástrala al grupo. Usa las flechas para ordenar, ✎ para renombrar y × para quitar.',
    'Reproduce la sesión de milonga o carga la sesión completa con tus grabaciones. Puedes pausar, cambiar de pista, buscar una posición y ajustar el volumen. El avance automático continúa al terminar. Prueba el fundido de 2 segundos con archivos locales. Actualiza las próximas grabaciones sin reiniciar la actual. Cada cortina tiene inicio, duración y espera opcional.',
    'La lista ya contiene grabaciones reales de YouTube. Pega otro enlace para ampliar tu colección. Pulsa Reproducir o carga la sesión completa para combinar videos con archivos locales. YouTube necesita internet y puede requerir un clic dentro del video.',
    'Tu trabajo se guarda automáticamente para este sitio en este navegador. Exportar descarga metadatos y orden de grupos en JSON. En otro navegador, Importar restaura la sesión. El audio es independiente: vincula los archivos marcados como necesarios.',
    'Todas las selecciones son grabaciones reales. La música que no es tango se usa solo en las cortinas. Escucha previa, fundidos y análisis necesitan archivos locales. Los videos necesitan internet y permiso de inserción. Escucha cada tanda completa antes de un evento.',
  ],
};
let language;
try { language = localStorage.getItem('studio-language'); } catch { /* Optional preference. */ }
if (!['en', 'ko', 'es'].includes(language)) language = navigator.language.startsWith('ko') ? 'ko' : navigator.language.startsWith('es') ? 'es' : 'en';
const originals = new WeakMap(), attributes = new WeakMap();
let observer, scheduled = false;
export const getLanguage = () => language;
export function t(text) {
  const countdown = text.match(/^(?:Remaining|남은 시간|Tiempo restante): (.*)$/);
  if (countdown) return `${language === 'ko' ? '남은 시간' : language === 'es' ? 'Tiempo restante' : 'Remaining'}: ${countdown[1]}`;
  if (language === 'en') return text;
  const index = language === 'ko' ? 0 : 1;
  if (pairs[text]) return pairs[text][index];
  const status = text.match(/^(Remaining|Recording|Cortina · Start at):? (.*)$/);
  if (status) { const label = status[1] === 'Cortina · Start at' ? `${t('Cortina')} · ${t('Start at')}` : t(status[1]); return `${label}${status[1] === 'Remaining' ? ':' : ''} ${status[2]}`; }
  const prefix = text.match(/^([▶♬⌁✎+↥]\s*)(.+)$/);
  if (prefix && pairs[prefix[2]]) return prefix[1] + pairs[prefix[2]][index];
  const dynamic = [
    [/^(\d+) recordings · (.+) known duration$/, (n, d) => index === 0 ? `${n}곡 · 확인된 길이 ${d}` : `${n} grabaciones · duración conocida ${d}`],
    [/^(\d+) \/ 8 tried$/, n => index === 0 ? `${n} / 8 체험 완료` : `${n} / 8 probados`],
    [/^(Could not save your library|Could not restore your library|Import failed|Import stopped): (.+)$/, (prefix, message) => index === 0 ? `${prefix.startsWith('Could not save') ? '저장 실패' : prefix.startsWith('Could not restore') ? '복원 실패' : '가져오기 실패'}: ${t(message)}` : `${prefix.startsWith('Could not save') ? 'Error al guardar' : prefix.startsWith('Could not restore') ? 'Error al restaurar' : 'Error al importar'}: ${t(message)}`],
    [/^Playing (.+)$/, title => index === 0 ? `재생: ${title}` : `Reproduciendo ${title}`],
    [/^Reading (.+)…$/, title => index === 0 ? `파일 읽는 중: ${title}…` : `Leyendo ${title}…`],
    [/^Analyzing (.+)…$/, title => index === 0 ? `분석 중: ${title}…` : `Analizando ${title}…`],
    [/^(Play|Preview|Analyze|Edit|Delete) (.+)$/, (action, title) => `${t(action)} ${title}`],
    [/^Add (.+) to selected group$/, title => index === 0 ? `${title} 선택 탄다에 추가` : `Añadir ${title} al grupo seleccionado`],
    [/^Preview: (.+) · same output$/, title => index === 0 ? `미리 듣기: ${title} · 주 재생과 같은 출력` : `Escucha previa: ${title} · misma salida`],
    [/^(\d+) recordings? added\. Files are saved in this browser; keep your originals for backup\.$/, n => index === 0 ? `${n}곡 추가됨. 이 브라우저에 저장됩니다. 원본도 보관하세요.` : `${n} grabaciones añadidas. Se guardan aquí; conserva los originales.`],
    [/^(\d+) tracks analyzed\. BPM is an estimate; review it by ear\.(.*)$/, (n, rest) => index === 0 ? `${n}곡 분석 완료. BPM은 추정치이므로 귀로 확인하세요.${rest}` : `${n} grabaciones analizadas. El BPM es aproximado; revísalo de oído.${rest}`],
    [/^Remove “(.+)” from the library and every group\? Your original file will be kept\.$/, title => index === 0 ? `“${title}”을 라이브러리와 모든 탄다에서 삭제할까요? 원본 파일은 유지됩니다.` : `¿Quitar “${title}” de la biblioteca y todos los grupos? El original se conserva.`],
    [/^Remove “(.+)” from your set\? Recordings stay in the library\.$/, title => index === 0 ? `세트에서 “${title}”을 삭제할까요? 곡은 라이브러리에 유지됩니다.` : `¿Quitar “${title}” de la sesión? Las grabaciones quedan en la biblioteca.`],
  ];
  for (const [pattern, format] of dynamic) { const match = text.match(pattern); if (match) return format(...match.slice(1)); }
  return text;
}
export function translatePage() {
  observer?.disconnect();
  document.documentElement.lang = language;
  for (const el of document.querySelectorAll('.practice-explanation,.guide-grid article p,.practice-footnote')) if (!el.dataset.englishHtml) el.dataset.englishHtml = el.innerHTML;
  const nodes = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
  let node;
  while ((node = nodes.nextNode())) {
    const idleText = ['No recording loaded','READY WHEN YOU ARE','Play a track or load your prepared set.'].some(key => node.nodeValue.trim() === key || pairs[key]?.includes(node.nodeValue.trim()));
    if (!idleText && node.parentElement.closest('.track-title,.track-detail,.group-select strong,.group li>span,.queue-item strong,.queue-item small,#playing-title,#playing-artist,#playing-group,.practice-explanation,.guide-grid article p,.practice-footnote,input,textarea,[data-preserve]')) continue;
    const current = node.nodeValue;
    const previous = originals.get(node);
    const source = previous && current === previous.translated ? previous.source : current;
    const trimmed = source.trim();
    const translated = source.replace(trimmed, t(trimmed));
    if (translated !== current) node.nodeValue = translated;
    originals.set(node, { source, translated });
  }
  for (const el of document.querySelectorAll('#app [placeholder],#app [aria-label],#app [title]')) {
    const record = attributes.get(el) || {};
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr), previous = record[attr];
      const source = previous && current === previous.translated ? previous.source : current;
      const translated = t(source); if (translated !== current) el.setAttribute(attr, translated);
      record[attr] = { source, translated };
    }
    attributes.set(el, record);
  }
  const selectors = ['.practice-explanation', ...['load','edit','preview','analyze','build','play','youtube','export'].map(step => `[data-step="${step}"] p`), '.practice-footnote'];
  selectors.forEach((selector, i) => {
    const el = document.querySelector(selector); if (!el) return;
    if (!el.dataset.englishHtml) el.dataset.englishHtml = el.innerHTML;
    const desired = language === 'en' ? el.dataset.englishHtml : guide[language][i];
    if (el.innerHTML !== desired) el.innerHTML = desired;
  });
  if (document.querySelector('#language')) document.querySelector('#language').value = language;
  observer?.observe(document.querySelector('#app'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder','aria-label','title'] });
}
export function setLanguage(value) {
  if (!['en','ko','es'].includes(value)) return;
  language = value; try { localStorage.setItem('studio-language', value); } catch { /* Optional. */ }
  translatePage();
}
export function startI18n() {
  observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; translatePage(); }); } });
  translatePage();
}
