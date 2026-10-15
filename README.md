# Tango DJ Studio

A local-first web workspace for preparing and playing tango DJ sets, maintained independently from TangoDJ.

## Run locally

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`; `npm run preview` serves that build locally. The app can be hosted as a static site. Use a stable HTTPS origin when deploying, since browser storage belongs to that origin.

## Learn with real tango recordings

Open `/?practice=1` or click **Load real tango library** to add a real-recording sample set without starting playback. Existing music is preserved. **Play tango sample set** plays only these sample groups, keeping optional synthesized exercises out of the queue.

| Group | Recordings |
| --- | --- |
| Troilo / Fiorentino · Tango · 1941 | Yo soy el tango; Te aconsejo que me olvides; El bulín de la calle Ayacucho; Toda mi vida |
| Cortina · 20 seconds | L-O-V-E — Nat King Cole |
| Canaro / Maida · Vals · 1936–1937 | Cofrecito; Secreto de amor; En voz baja |
| Cortina · 20 seconds | Hit the Road Jack — Ray Charles |
| Canaro / Maida · Milonga · 1935–1936 | Largá las penas; Milonga criolla; Silueta porteña |

These are external YouTube recordings, played through the official embed. Video titles were checked against YouTube oEmbed when the pack was added. Availability and embedding restrictions can change. No audio is downloaded. Set duration excludes unknown YouTube lengths until they are available; it is not a full runtime estimate.

In the queue, sample cortinas stop after 20 seconds. With **Auto next** enabled, playback continues to the next tanda. Playing a cortina directly from the library plays the full video. Exported sets retain group playback limits.

The walkthrough covers importing, metadata, preview, analysis, composition, playback, YouTube, and set backups. The **Optional local audio lab** supplies 11 original synthesized WAV clips for testing features that require decoded local files: preview, fades, and BPM/level analysis. It is separate from the default real-recording set. To analyze actual tango recordings, import your local music using **+ Local files**.

## First version

- Import multiple local audio files by browsing or dropping them into the library.
- Read embedded title, artist, year, genre, BPM, and duration where available; edit title, orchestra, singer, year, style, and BPM.
- Add individual YouTube watch, short, live, or share URLs. Video titles are fetched when available and can be edited manually.
- Search recordings and filter by dance style or source.
- Create, rename, reorder, and remove tandas and cortinas. Add tracks with the library's + button or drag them into a group; reorder tracks within groups.
- Load an ordered set into the play queue, switch between local and YouTube recordings, pause, seek, adjust volume, and optionally advance automatically.
- Preview local recordings, apply local fade-out/fade-in transitions, and optionally apply analyzed gain.
- Estimate local BPM, RMS level, peak, and suggested gain. BPM remains editable.
- Save metadata, set structure, and local audio in IndexedDB. Export and import portable JSON set files; relink missing audio when moving a set to another browser.

## Source capabilities

| Capability | Local audio | YouTube video |
| --- | --- | --- |
| Library and tanda composition | Yes | Yes |
| Playback, seeking, queue | Yes, if the browser supports the codec | Official embedded player; connection required |
| Metadata | Embedded tags and manual editing | Available video title/channel and manual editing |
| Audio preview | Yes, through the current output | Use the video player |
| Fades and gain adjustment | Yes | Not implemented |
| BPM and level analysis | Decoded audio | Manual BPM entry only |

YouTube audio is played through the official IFrame API. Videos are not downloaded or extracted. Private, removed, restricted, or non-embeddable videos may not play. Autoplay can require a click inside the video. Playlist import and other streaming providers are not included in this version.

## Practical limits

- Local codec support varies by browser. MP3 and WAV are good starting points; parsing metadata does not guarantee that a codec can play.
- Preview shares the main output. Separate headphone routing is not implemented; avoid previewing over a live room output.
- Fades are sequential fade-out/fade-in transitions, not overlapping crossfades. Groups play full recordings unless they carry a playback limit, as the sample cortinas do. Cue points are not implemented.
- BPM uses an onset-correlation estimate over up to the first three minutes; old recordings and expressive timing can produce half/double-tempo or inaccurate estimates. Review by ear.
- RMS and peak are measured over the decoded recording. Suggested gain targets approximately -18 dBFS RMS, caps peak at -1 dBFS, and limits gain to ±12 dB. This is not integrated LUFS normalization or a limiter.
- Analysis decodes one full recording at a time and may use substantial memory for long files.
- Browser storage can run out or be cleared/evicted. Keep original recordings and export sets. JSON exports contain metadata and group order, not audio.
- No account, backend upload, or cross-device sync is required. YouTube and optional web fonts make external network requests.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit checks cover URL validation, queue order, set integrity, and tempo/level estimation. Browser checks cover generated WAV import, metadata editing, analysis, local playback, set export, persistence, YouTube metadata import, missing-file relinking, and mobile layout. YouTube network playback is subject to provider restrictions and is not exercised by mocked metadata checks.
