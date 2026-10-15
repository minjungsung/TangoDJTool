# Tango DJ Studio

A local-first web workspace for preparing and playing tango DJ sets, maintained independently from TangoDJ.

## Run locally

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`; `npm run preview` serves that build locally. The app can be hosted as a static site. Use a stable HTTPS origin when deploying, since browser storage belongs to that origin.

## Milonga DJ playlist

Open `/?practice=1` or click **Load milonga playlist**. **Play milonga set** starts only the curated DJ groups. Personal recordings are preserved. Earlier synthesized examples are removed from browser storage during migration.

The set follows a Tango / Tango / Vals / Tango / Tango / Milonga cycle. Tango tandas contain four recordings, while vals and milonga tandas contain three. Each tanda keeps one orchestra and singer or instrumental ensemble. A 20-second non-tango cortina follows each tanda.

| Tanda | Recordings | Following cortina |
| --- | --- | --- |
| Troilo / Fiorentino · Tango · 1941 | Yo soy el tango; Te aconsejo que me olvides; El bulín de la calle Ayacucho; Toda mi vida | L-O-V-E — Nat King Cole |
| Canaro / Maida · Lyrical tango · 1935–1937 | Poema; Envidia; Yo también soñé; Invierno | Hit the Road Jack — Ray Charles |
| Canaro / Maida · Vals · 1936–1937 | Cofrecito; Secreto de amor; En voz baja | Sway — Dean Martin |
| Troilo · Instrumental tango · 1941 | Cachirulo; Guapeando; El tamango; Milongueando en el 40 | Fly Me to the Moon — Frank Sinatra |
| Canaro / Maida · Rhythmic tango · 1937–1938 | Milagro; Recuerdos de París; Nada más; Yo seré como tú quieras | The Girl from Ipanema — Astrud Gilberto & Stan Getz |
| Canaro / Maida · Milonga · 1935–1936 | Largá las penas; Milonga criolla; Silueta porteña | Stand By Me — Ben E. King |

All 28 selections are real recordings linked through YouTube's official embed; no audio is downloaded. Preview the transfers and musical progression before a live event. Video availability and embedding restrictions can change. Unknown YouTube durations are excluded from the displayed known runtime.

Cortinas stop after 20 seconds in the set queue. **Auto next** continues to the next tanda. Playing a cortina directly from the library plays the full video. Exported JSON retains the group playback limits.

The walkthrough uses this playlist for library, metadata, composition, playback, YouTube, and backup examples. Import your own local tango recordings for preview, fades, and BPM/level analysis. No synthesized demonstration audio is included.

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

## Personal browser workspace and languages

Each visitor has an independent workspace for the same site origin in their browser profile. IndexedDB stores library metadata, local audio blobs, group order, and the loaded queue; localStorage stores language, volume, fade, normalization, automatic advance, and walkthrough preferences. Reloading restores the queue without automatically starting audio. Regular visits preserve deleted/reordered sample groups; **Load milonga playlist** explicitly adds missing sample groups again.

The language selector supports Korean, English, and Spanish, including the walkthrough and playback recovery controls. Recording titles, artist names, and user-entered metadata are preserved. The initial language follows the browser language and subsequent choices are saved. Interface text uses larger, readable sizes and controls remain usable on mobile.

A save indicator reports pending, successful, and failed saves. **Request persistent storage** asks the browser to protect this site's storage from automatic eviction; the browser may decline. Clearing site data still removes the workspace. Different browser profiles, devices, or site origins do not synchronize; export/import transfers set metadata, and local recordings must be relinked.

## YouTube playback recovery

The embedded player starts with an explicit video ID and origin, with a referrer policy that identifies the site. The app displays YouTube's error code and appropriate recovery actions: retry, open on YouTube, replace the URL, attach a local recording, or skip to the next queue entry. Error 100 indicates an unavailable video, 101/150 indicates blocked embedded playback (video restrictions or an origin issue), and 153 indicates missing site identification. A video's oEmbed title being available does not guarantee embedded playback. Local audio is the reliable playback option when the provider blocks embeds.

## Everyday workspace

The main screen opens directly onto the library, set builder, and player. The toolbar provides **Example sets**, **User guide**, **Settings**, **Import set**, and **Export set**. Examples and help are available in dialogs and do not occupy the working area. Settings contains the language selector and detailed browser storage controls. Successful action messages disappear automatically; errors remain visible.

Adding an example imports six editable tandas and their cortinas. Normal reloads restore your edits, queue, and preferences without playing audio or adding removed groups again. The legacy `?practice=1` link imports the example once and removes that query parameter from the URL. Use the normal site URL for everyday work.

### Local YouTube origin

Use `http://localhost` with the port printed by Vite for local development. In a direct comparison, the same embeddable video returned `UNPLAYABLE` / error 150 at the numeric loopback origin `127.0.0.1`, while `localhost` returned `OK` and progressed through playback. Error 150 therefore cannot be attributed only to the uploader.

Numeric loopback visits transfer the saved workspace, audio blobs, and preferences to the corresponding `localhost` origin before redirecting. The transfer verifies the exact message origin and sending frame; old-origin data remains intact. If storage transfer fails, the original workspace remains accessible for backup. Use a normal HTTPS hostname in production.

## Playback and editing improvements

- Playing a library recording selects its entry in the existing queue. A recording outside the queue is appended; the prepared queue is preserved.
- The play button shows play or pause state, and previous/next controls are disabled while switching recordings or at queue boundaries.
- Reload restores the last selected queue recording without autoplay. Press Play to start that recording again from its beginning.
- The set builder shows the destination group for additions. Group and recording order edits have a one-step undo while the page is open.
- Editing the set after loading a queue shows a reminder to reload it. The current queue stays stable during performance.
- New cortinas default to 20 seconds. Each cortina group has an editable length, and its displayed duration follows that limit.
- YouTube duration is recorded when the player supplies it. Missing durations remain excluded from known runtime totals.
