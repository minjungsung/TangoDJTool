import { loadState, saveState, getFile, saveFile } from './storage.js';

// YouTube rejects numeric loopback origins even for embeddable recordings.
// Move the existing browser workspace before adopting the hostname origin.
const params = new URLSearchParams(location.search);
const numeric = location.hostname === '127.0.0.1';
const hostnameOrigin = `${location.protocol}//localhost${location.port ? `:${location.port}` : ''}`;
const numericOrigin = `${location.protocol}//127.0.0.1${location.port ? `:${location.port}` : ''}`;
const preferenceKeys = ['studio-language', 'studio-settings', 'studio-walkthrough'];

async function receiveWorkspace() {
  document.body.textContent = 'Restoring workspace…';
  window.addEventListener('message', async event => {
    if (event.origin !== numericOrigin || event.source !== parent || event.data?.type !== 'studio-transfer') return;
    try {
      const { state, files, preferences } = event.data;
      if (state) {
        for (const [id, blob] of files) await saveFile(id, blob);
        await saveState(state);
      }
      for (const key of preferenceKeys) if (preferences[key] != null) localStorage.setItem(key, preferences[key]);
      parent.postMessage({ type: 'studio-transfer-done' }, numericOrigin);
    } catch {
      parent.postMessage({ type: 'studio-transfer-error' }, numericOrigin);
    }
  });
  parent.postMessage({ type: 'studio-transfer-ready' }, numericOrigin);
}
async function moveToHostname() {
  if (localStorage.getItem('studio-hostname-migrated') === hostnameOrigin) { location.replace(hostnameOrigin + location.pathname + location.search + location.hash); return; }
  const state = await loadState();
  const files = [];
  for (const track of state?.tracks || []) if (track.source === 'local') {
    const blob = await getFile(track.id); if (blob) files.push([track.id, blob]);
  }
  const preferences = Object.fromEntries(preferenceKeys.map(key => [key, localStorage.getItem(key)]));
  if (!state && preferenceKeys.every(key => preferences[key] == null)) {
    location.replace(hostnameOrigin + location.pathname + location.search + location.hash); return;
  }
  document.body.textContent = 'Moving your saved workspace to localhost…';
  await new Promise((resolve, reject) => {
    const frame = document.createElement('iframe'); frame.hidden = true;
    const timeout = setTimeout(() => { window.removeEventListener('message', receive); frame.remove(); reject(new Error('Workspace transfer timed out.')); }, 30000);
    function receive(event) {
      if (event.origin !== hostnameOrigin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'studio-transfer-ready') frame.contentWindow.postMessage({ type: 'studio-transfer', state, files, preferences }, hostnameOrigin);
      if (['studio-transfer-done', 'studio-transfer-error'].includes(event.data?.type)) {
        clearTimeout(timeout); window.removeEventListener('message', receive); frame.remove();
        event.data.type === 'studio-transfer-done' ? resolve() : reject(new Error('Workspace transfer failed.'));
      }
    }
    window.addEventListener('message', receive);
    frame.src = hostnameOrigin + '/?workspace-transfer=1'; document.body.append(frame);
  });
  localStorage.setItem('studio-hostname-migrated', hostnameOrigin);
  location.replace(hostnameOrigin + location.pathname + location.search + location.hash);
}
if (location.hostname === 'localhost' && params.get('workspace-transfer') === '1' && parent !== window) {
  await receiveWorkspace();
} else if (numeric) {
  try { await moveToHostname(); }
  catch {
    document.body.replaceChildren(); const app = document.createElement('div'); app.id = 'app'; document.body.append(app);
    await import('./main.js');
    document.querySelector('#notice').hidden = false;
    document.querySelector('#notice-message').textContent = 'Could not move your workspace to localhost. Export your set and keep your original audio files before opening localhost.';
  }
} else {
  await import('./main.js');
}
