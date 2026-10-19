# Tango DJ Studio

A local-first web workspace for preparing and playing tango DJ sets, maintained independently from TangoDJ.

## Run locally

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`; `npm run preview` serves that build locally. The app can be hosted as a static site. Use a stable HTTPS origin when deploying, since browser storage belongs to that origin.

## Phone, tablet, and computer workflows

On a first visit, the example set is already prepared and the Playback work area opens. Press Play to start the examples; YouTube requires a connection. Saved workspaces, including deliberately cleared sets, are preserved.

Use **1 · Music → 2 · Sets → 3 · Tandas → 4 · Playback**. Music is the master catalog. Sets collect candidate recordings without copying audio. First visits include seven curated candidate sets: four tango sets, one vals set, one milonga set, and a cortina collection, covering all 28 sample recordings. Explicitly loading the examples restores missing sample sets; ordinary reloads preserve deletions and existing workspaces. **Collect in set** saves a candidate in a chosen set; **Add to tanda** adds it to the destination shown above the library. **Use as cortina** appears for a cortina destination. Browse from a set to collect directly into it, then use **Back to set**. Recording management actions are available through **More** on every screen size. Select candidates to create a tanda, attach a cortina, and use **Save tanda** to keep a reusable original. Playback-program edits do not alter that original. Tanda cards expand/collapse and store notes; 3–4 recordings is a recommendation rather than a hard limit.

During a tanda, **Play next** inserts a recording after the current song while keeping its playback position. Multiple additions keep their selection order; pending additions can be reordered or canceled. During a cortina, choose the next tanda as the target. **Next tanda** manually ends the cortina using the selected fade. New cortinas use the rest of the recording and wait for manual advance by default; existing saved advance settings remain intact.

**Local files** copies audio into browser storage. **Connect originals**, where the browser supports file handles, reads originals without storing a full audio copy. **Check files** shows permission and availability; **Locate file** and **Reconnect from folder** verify identical content even after renaming. Different audio requires reviewed replacement and fresh analysis. Connecting an identical original can reuse an existing recording ID; **Keep an app copy** offers independent storage at the displayed space cost. Filesystem permission may require renewal, and handles are not portable backups.

Phones and tablets use labeled navigation and recording action menus. Playback continues while moving between work areas; compact controls remain available. DJ performance histories and event records are outside this feature scope.

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

Cortinas stop after 20 seconds in the set queue. **Auto next** continues to the next tanda. Playing a cortina directly from the library opens its full source, appending an unrestricted entry when needed while retaining the prepared queue. The group play button uses its selected interval. Exported JSON retains the group playback limits.

The walkthrough uses this playlist for library, metadata, composition, playback, YouTube, and backup examples. Import your own local tango recordings for preview, reliable fades, and BPM/level analysis. No synthesized demonstration audio is included.

## First version

- Import multiple local audio files by browsing or dropping them into the library.
- Read embedded title, artist, year, genre, BPM, and duration where available; edit title, orchestra, singer, year, style, and BPM.
- Add individual YouTube watch, short, live, or share URLs. Video titles are fetched when available and can be edited manually.
- Search recordings and filter by dance style or source.
- Create, rename, reorder, and remove tandas and cortinas. Add tracks with **Add to tanda** or drag them into a group; reorder tracks within groups.
- Load an ordered set into the play queue, switch between local and YouTube recordings, pause, seek, adjust volume, and optionally advance automatically.
- Preview local recordings, fade recordings in and out at segment boundaries and during manual transitions, and optionally apply analyzed gain.
- Estimate local BPM, RMS level, peak, and suggested gain. BPM remains editable.
- Save metadata, set structure, and local audio in IndexedDB. Export and import portable JSON set files; relink missing audio when moving a set to another browser.

## Source capabilities

| Capability | Local audio | YouTube video |
| --- | --- | --- |
| Library and tanda composition | Yes | Yes |
| Playback, seeking, queue | Yes, if the browser supports the codec | Official embedded player; connection required |
| Metadata | Embedded tags and manual editing | Available video title/channel and manual editing |
| Audio preview | Yes, through the current output | Use the video player |
| Fades | Web Audio fade-in/out | Official volume API; device support varies |
| Analyzed gain adjustment | Yes | No |
| BPM and level analysis | Decoded audio | Manual BPM entry only |

YouTube audio is played through the official IFrame API. Videos are not downloaded or extracted. Private, removed, restricted, or non-embeddable videos may not play. Autoplay can require a click inside the video. Playlist import and other streaming providers are not included in this version.

## Practical limits

- Local codec support varies by browser. MP3 and WAV are good starting points; parsing metadata does not guarantee that a codec can play.
- Preview shares the main output. Separate headphone routing is not implemented; avoid previewing over a live room output.
- Fade defaults to Off to preserve recording entrances. When enabled, each recording fades in from its playback position and fades out before its natural or configured endpoint. Manual changes use sequential fade-out/fade-in, without overlapping crossfade. Short segments clamp fades to half their length. Pausing, seeking, buffering, and changing master volume preserve or recalculate the envelope. YouTube uses the official player volume API; some mobile devices ignore programmatic video volume, so use local files when audible fades must be reliable. Groups play full recordings unless they carry a playback limit, as the sample cortinas do. Cortina groups support a saved start offset and playback length; general per-recording cue points are not implemented.
- BPM uses an onset-correlation estimate over up to the first three minutes; old recordings and expressive timing can produce half/double-tempo or inaccurate estimates. Review by ear.
- RMS and peak are measured over the decoded recording. Suggested gain targets approximately -18 dBFS RMS, caps peak at -1 dBFS, and limits gain to ±12 dB. This is not integrated LUFS normalization or a limiter.
- Analysis decodes one full recording at a time and may use substantial memory for long files.
- Browser storage can run out or be cleared/evicted. Keep original recordings and export sets. JSON exports contain metadata and group order, not audio.
- An already-open app can play, edit, save, and export local recordings without a connection. Opening the app from scratch while offline is not guaranteed; there is no service-worker installation yet.
- No account, backend upload, or cross-device sync is required. YouTube and optional web fonts make external network requests.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npx playwright install webkit
npm run test:devices
npm run test:review
```

Unit checks cover URL validation, queue order, set integrity, and tempo/level estimation. Browser checks cover generated WAV import, metadata editing, analysis, local playback, set export, persistence, YouTube metadata import, missing-file relinking, and mobile layout. YouTube network playback is subject to provider restrictions and is not exercised by mocked metadata checks.

The [complete feature validation](docs/all-features-validation.md) maps current controls and error/recovery paths to repeatable UI cases. `test:review` runs the production build in desktop Chromium, phone Chromium, and tablet WebKit. Review scripts support background execution; `REVIEW_HEADLESS=1` makes the real fade review headless. Provider availability checks and codec probes are short operational checks; codec probes require `ffmpeg`.

## Personal browser workspace and languages

Each visitor has an independent workspace for the same site origin in their browser profile. IndexedDB stores library metadata, local audio (Blob values or a byte-based fallback for affected WebKit environments), group order, candidate sets, reusable tandas, original-file handles where supported, and the loaded queue; localStorage stores language, volume, fade, normalization, automatic advance, and walkthrough preferences. Reloading restores the queue without automatically starting audio. Regular visits preserve deleted/reordered sample groups; **Load milonga playlist** explicitly adds missing sample groups again.

The language selector supports Korean, English, and Spanish, including the walkthrough and playback recovery controls. Recording titles, artist names, and user-entered metadata are preserved. The initial language follows the browser language and subsequent choices are saved. Interface text uses larger, readable sizes and controls remain usable on mobile.

A save indicator reports pending, successful, and failed saves. **Request persistent storage** asks the browser to protect this site's storage from automatic eviction; the browser may decline. Clearing site data still removes the workspace. Different browser profiles, devices, or site origins do not synchronize; export/import transfers set metadata, and local recordings must be relinked.

## YouTube playback recovery

The embedded player starts with an explicit video ID and origin, with a referrer policy that identifies the site. The app displays YouTube's error code and appropriate recovery actions: retry, open on YouTube, replace the URL, attach a local recording, or skip to the next queue entry. Error 100 indicates an unavailable video, 101/150 indicates blocked embedded playback (video restrictions or an origin issue), and 153 indicates missing site identification. A video's oEmbed title being available does not guarantee embedded playback. Local audio is the reliable playback option when the provider blocks embeds. If YouTube stays buffering without advancing for 15 seconds, the deck shows a waiting message and **Retry here** reloads the video at its current source position. The app does not automatically skip the music.

## Everyday workspace

The workspace has four work areas for music, candidate sets, tandas, and playback. The toolbar provides **Example sets**, **User guide**, **Settings**, **Import set**, and **Export set**. Examples and help are available in dialogs and do not occupy the working area. Settings contains the language selector and detailed browser storage controls. Successful action messages disappear automatically; notifications can also be dismissed. Errors remain visible until dismissed or replaced.

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
- New cortinas default to a 0–20 second interval. Edit the start and end together in one compact row; displayed duration follows the selected segment.
- YouTube duration is recorded when the player supplies it. Missing durations remain excluded from known runtime totals.

Further playback checks preserve the remaining queue when its current recording is deleted, stop progress callbacks from paused/inactive sources, and restart a completed cortina from the beginning when replayed. Metadata edits update the loaded queue immediately. Canceling a rename or deletion keeps the previous undo action intact.


## DJ preparation and live operation

Each cortina group has **From** and **To** (absolute seconds into the source), and **Wait before the next tanda**. Play the source from the library, seek to a suitable musical entrance, then choose the position icon on its cortina group to save that cue. The adjacent play button checks the chosen segment on the main output. These controls work with local recordings and YouTube videos. They do not provide a separate headphone output.

Known source lengths bound cortina interval edits. Moving a cue close to the recording's end shortens its segment to the remaining time. A saved cue beyond the known source length is rejected before replacing the current playback.

Use **Update upcoming queue** to apply edits after the current recording while it keeps playing. **Load & play set** loads the entire edited set and restarts it from the first recording. Changes stay separate from the active queue so editing the next tanda does not alter the current transition. At a held cortina's end, press **Next** when ready to start the next tanda's first recording. Press **Play** to replay the same segment. Stop rewinds to the segment's start; pause preserves its current position.

The deck shows the recording number within the tanda, remaining playable time, and the next recording. A compact deck appears when the full transport is outside the viewport, allowing playback control while browsing the library. On narrow screens, recordings display as cards with visible actions. Search accepts Spanish names with or without accents.

Editing or relinking the current recording's source stops the old source. Press Play to load the updated source; metadata-only changes keep the music playing. Importing a replacement set clears the old deck and undo history.

Saving uses a workspace revision to prevent an older tab from replacing newer edits saved by another tab. A conflicting tab keeps its in-memory edits available for export and reports a save failure. Export those edits if needed, then reload to adopt the latest saved workspace. A failed metadata save does not delete the stored audio.

## Usage scenarios

| Situation | Suggested workflow | Current limit |
| --- | --- | --- |
| Personal set preparation | Import recordings, edit orchestra/singer details, arrange tandas, choose cortina intervals, then export the set. | Cortina audition shares the main output. |
| Dance lessons and practice | Prepare short groups; disable Auto next for manual pacing and use Play to repeat a finished recording. | General per-recording loop markers are not available. |
| Small milonga | Prepare local recordings, keep the upcoming queue updated, and use the compact deck while browsing. | Browser codec support and the room's output setup need a rehearsal. |
| Announcements or performances between tandas | Enable Wait before the next tanda on the preceding cortina, then press Next when ready. | No microphone mixer is included. |
| Online source research | Add a YouTube link, inspect the full source, choose a cortina interval, and retry at the same position if buffering stops. | Network access and permission to embed the video are required. |
| Moving to another device | Export/import the set and relink its local recordings on the destination browser. | JSON includes metadata and structure, not audio; automatic synchronization is unavailable. |

Local playback, editing, saving, and export work without a network connection after the app is open. Starting the app from an uncached offline browser is not supported.

## Extended playback checks

The scripts below use actual YouTube playback in isolated Chromium contexts. They do not access the everyday browser profile or upload local recordings. Provider failures and checkpoints are written to portable JSON reports.

```sh
# Keep the production preview running in another terminal before starting the soak.
npm run preview -- --port 5180 --strictPort
SOAK_SECONDS=7200 node scripts/soak.mjs

# Exercise the current development app during a long playback session.
npx vite build --outDir dist-review
npm run preview -- --outDir dist-review --port 5181 --strictPort
DJ_SECONDS=6200 node scripts/dj-session.mjs
```

`SOAK_URL` and `DJ_URL` override the default local URLs. `DJ_REPORT` selects a separate output report when running more than one session. The soak keeps one prepared set playing; the DJ session also searches, changes language, adjusts volume, and navigates during playback. Neither script evaluates the artistic quality of a recording, physical sound output, audience response, or a venue's audio setup. Deterministic browser tests separately check cue boundaries, first-recording transitions, pause versus stop, storage conflicts, and mobile controls.
