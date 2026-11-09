import { test, expect, recordingAction } from './saved-workspace.js';

function taggedWav(tags) {
  const chunk = (id, payload) => {
    const bytes = Buffer.alloc(8 + payload.length + payload.length % 2);
    bytes.write(id); bytes.writeUInt32LE(payload.length, 4); payload.copy(bytes, 8); return bytes;
  };
  const rate = 8000, format = Buffer.alloc(16), audio = Buffer.alloc(rate * 8 * 2);
  format.writeUInt16LE(1); format.writeUInt16LE(1, 2); format.writeUInt32LE(rate, 4); format.writeUInt32LE(rate * 2, 8); format.writeUInt16LE(2, 12); format.writeUInt16LE(16, 14);
  for (let sample = 0; sample < audio.length / 2; sample++) audio.writeInt16LE(Math.round(650 * Math.sin(sample * 2 * Math.PI * 440 / rate)), sample * 2);
  const info = Buffer.concat([Buffer.from('INFO'), ...Object.entries(tags).map(([id, value]) => chunk(id, Buffer.from(`${value}\0`)))]);
  const body = Buffer.concat([Buffer.from('WAVE'), chunk('fmt ', format), chunk('LIST', info), chunk('data', audio)]);
  const bytes = Buffer.alloc(8 + body.length); bytes.write('RIFF'); bytes.writeUInt32LE(body.length, 4); body.copy(bytes, 8); return bytes;
}

async function savedWorkspace(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const opening = indexedDB.open('tango-dj-studio', 2);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, request = db.transaction('state').objectStore('state').get('current');
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
}

const savedRecording = async page => (await savedWorkspace(page)).tracks[0];

async function originalTagsRetained(page, id, tagText) {
  return page.evaluate(({ id, tagText }) => new Promise((resolve, reject) => {
    const opening = indexedDB.open('tango-dj-studio', 2);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, request = db.transaction('files').objectStore('files').get(id);
      request.onsuccess = async () => {
        try { const bytes = request.result.audioBytes || await request.result.arrayBuffer(); resolve(new TextDecoder().decode(bytes).includes(tagText)); }
        catch (error) { reject(error); }
        finally { db.close(); }
      };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }), { id, tagText });
}

test('provider metadata normalizes malformed, whitespace and oversized text before playback history and reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const examples = [
    { videoId: 'abcdefghij0', title: { invalid: 'title' }, author_name: ['invalid author'], expectedTitle: 'YouTube · abcdefghij0', expectedArtist: '' },
    { videoId: 'abcdefghij1', title: ' \t ', author_name: ' \n ', expectedTitle: 'YouTube · abcdefghij1', expectedArtist: '' },
    { videoId: 'abcdefghij2', title: `  ${'t'.repeat(1005)}  `, author_name: `  ${'a'.repeat(1005)}  `, expectedTitle: 't'.repeat(1000), expectedArtist: 'a'.repeat(1000) },
  ];
  await page.route('https://**', route => route.abort());
  await page.route('https://www.youtube.com/oembed?**', route => {
    const watchUrl = new URL(route.request().url()).searchParams.get('url');
    const id = new URL(watchUrl).searchParams.get('v');
    const example = examples.find(item => item.videoId === id);
    return route.fulfill({ json: { title: example.title, author_name: example.author_name } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('studio-language', 'en');
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.state = 2; this.position = 0; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(value) { this.id = typeof value === 'string' ? value : value.videoId; this.position = typeof value === 'string' ? 0 : value.startSeconds || 0; this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      getCurrentTime() { return this.position; }
      getDuration() { return 180; }
      getPlayerState() { return this.state; }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; }
      setVolume() {}
      pauseVideo() { this.state = 2; this.options.events.onStateChange({ data: 2 }); }
      playVideo() { this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      seekTo(value) { this.position = value; }
    } };
  });
  await page.goto('/');
  for (const [index, example] of examples.entries()) {
    const priorRevision = (await savedWorkspace(page)).revision;
    await page.locator('#youtube-form input').fill(`https://www.youtube.com/watch?v=${example.videoId}`);
    await page.locator('#youtube-form button').click();
    await expect.poll(async () => (await savedWorkspace(page)).revision).toBeGreaterThan(priorRevision + 1);
    const recording = (await savedWorkspace(page)).tracks.find(track => track.videoId === example.videoId);
    expect(recording).toMatchObject({ title: example.expectedTitle, artist: example.expectedArtist });
    await recordingAction(page, 'play', recording.id);
    await expect(page.locator('#session-count')).toHaveText(String(index + 1));
    await expect(page.locator('#playing-title')).toHaveText(example.expectedTitle);
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  }
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('3');
  await expect(page.locator('#session-count')).toHaveText('3');
  await expect(page.locator('#storage-recovery')).toBeHidden();
  expect((await savedWorkspace(page)).tracks.map(track => [track.title, track.artist])).toEqual(examples.map(example => [example.expectedTitle, example.expectedArtist]));
  expect(errors).toEqual([]);
});

for (const example of [
  { label: 'oversized tags', title: `  ${'t'.repeat(1005)}  `, artist: `  ${'a'.repeat(1005)}  `, expectedTitle: 't'.repeat(1000), expectedArtist: 'a'.repeat(1000) },
  { label: 'whitespace title', title: ' \t ', artist: '  Canaro  ', expectedTitle: 'tagged-recording', expectedArtist: 'Canaro' },
]) {
  test(`local WAV import normalizes ${example.label}, retains source tags, records playback and reloads`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.addInitScript(() => localStorage.setItem('studio-language', 'en'));
    await page.goto('/');
    await page.locator('#file-input').setInputFiles({ name: 'tagged-recording.wav', mimeType: 'audio/wav', buffer: taggedWav({ INAM: example.title, IART: example.artist, IGNR: ' tAnGo ', ICRD: '1935' }) });
    await expect(page.locator('#notice')).toContainText('1 recording added');
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    const recording = await savedRecording(page);
    expect(recording).toMatchObject({ title: example.expectedTitle, artist: example.expectedArtist, year: '1935', style: 'Tango' });
    expect(await originalTagsRetained(page, recording.id, example.title)).toBe(true);
    await recordingAction(page, 'play', recording.id);
    await expect(page.locator('#session-count')).toHaveText('1');
    await expect(page.locator('#playing-title')).toHaveText(example.expectedTitle);
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    await page.reload();
    await expect(page.locator('#library-count')).toHaveText('1');
    await expect(page.locator('#storage-recovery')).toBeHidden();
    expect(await savedRecording(page)).toMatchObject({ title: example.expectedTitle, artist: example.expectedArtist });
    expect(errors).toEqual([]);
  });
}
