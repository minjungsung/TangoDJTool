# Complete feature validation

This review covers all current user-visible feature families, including normal actions, errors, recovery, persistence, and responsive access. Verification is tied to executable cases and actual provider sessions; a passing playback timer is not accepted as evidence of a fade. It does not claim every possible input, codec, operating system, or physical speaker has been tested.

The review runs in the background with logs redirected to files. `npm run test:review` builds the static production app and runs the UI suite in desktop Chromium, phone Chromium, and tablet WebKit. The original regressions and targeted device/audio tests supplement these UI cases. Provider error cases are simulated; actual provider playback and network interruption use separate real-network sessions.

## Completed review

On 16 October 2026, the production UI suite passed all **60 cases**: 20 feature scenarios on each of desktop Chromium, phone Chromium, and tablet WebKit. The existing browser suite passed **49 tests**; unit checks passed **14 tests**. Device checks passed **17 tests**, with one explicit WebKit analyser skip. Production build and whitespace checks passed.

Actual YouTube playback checks passed for **28 of 28 example sources**, with sustained short playhead progress and no recorded page errors. An actual offline switch showed buffering; reconnect and Retry resumed the same recording. The real-provider fade session separately checks official volume changes, cortina transition, downstream local RMS, and saved-file reload.

Six tagged, generated codec fixtures were imported through the UI in each browser. Chromium played MP3, M4A/AAC, FLAC, Vorbis/OGG, and Opus; AIFF produced actionable format feedback. WebKit played all six generated variants, including AIFF. Each playable case showed both actual media progress and an updated deck timeline. These outcomes apply to the generated encodings, not all files with those extensions. An earlier six-second OGG fixture did not advance in WebKit; the longer stereo fixture did. A prior timeline sample was taken before the next media event; the player now also samples local progress every 250 ms so the UI remains current when events are sparse.

Evidence is stored in `reports/feature-review/results.json`, `real-provider-results.json`, `network-results.json`, and `codec-results.json`. The portable reporter omits workstation configuration and absolute paths. `scripts/provider-review.mjs`, `scripts/network-review.mjs`, and `scripts/codec-review.mjs` repeat operational checks against a served build. The real fade procedure is `scripts/playback-review.mjs`; set `REVIEW_HEADLESS=1` to run quietly.

## Feature inventory and evidence

| Feature | Verification | Evidence |
| --- | --- | --- |
| Empty initial library/set/deck and disabled transport | Initial state, no autoplay, empty actions | Workspace and feature suites |
| Local file picker | Actual filechooser, import and reload | File picker case |
| Drop-zone keyboard access | Enter opens actual filechooser on desktop/tablet | File picker case |
| Drop-zone file import | File/DataTransfer drop path | File drop case |
| Multiple-file import/progress | Batch import and committed count | File picker case |
| Duplicate detection | Same name/size/lastModified skipped | File picker case |
| Unsupported file filtering | Non-audio input omitted | File picker case |
| Partial import on quota failure | First file plays/reloads; second fails; retry imports | Partial import case |
| Concurrent import/analysis guards | Controls disabled; sample action rejected; operation finishes | Busy import case |
| Embedded metadata | Tagged MP3 title/artist, browser playback | Codec review |
| Search | Title/artist/accent-insensitive matching, no matches | Metadata/filter case and regressions |
| Style/source filters | Combined local/YouTube/style filters and reset | Metadata/filter case |
| Metadata title/artist/singer/year/style/BPM | Save, cancellation, required title, reload | Metadata/filter case |
| YouTube URLs | Invalid origin, canonical link, duplicate detection | URL case and URL unit tests |
| YouTube metadata | Real source titles; unavailable oEmbed still editable | Provider and URL cases |
| Individual analysis | RMS/peak/gain visible, failed decode reported | Analysis and decode failure cases |
| Bulk analysis | All local recordings analyzed, controls restored | Analysis case |
| Normalization on/off | Applied gain changes in actual Web Audio node | Analysis case |
| Live analysis | Updated gain applies without restarting current track | Live analysis case |
| Preview/stop preview | Separate preview action/status; stop | Analysis case |
| Preview from filtered guide | Works even when library row is absent | Analysis case |
| Delete a previewed recording | Cancellation preserves it; confirmed deletion stops preview | Delete case |
| Missing audio/relink | Portable JSON produces missing marker; relink plays and reloads | Portable transfer case |
| Create tanda/cortina | Explicit buttons, selected group and recording additions | Group case |
| Select group and choose recordings | Library/set handoff, selected target | Group case and device suites |
| Drag recording into group | Actual dragstart/drop handler path | File drop case |
| Rename group | Prompt value, saved name, cancel/no-op regressions | Group case |
| Reorder groups | Up/down both exercised | Group case |
| Reorder/remove group recordings | Up/down/remove and Undo | Group case |
| Delete group | Cancel, confirm, recordings preserved and reload | Group case |
| Undo set edit | Restores ordering/content, updates future queue | Group/queue cases |
| Load complete set/prepared-deck button | Prepared queue and first recording | Transport/queue cases |
| Example load/play | Existing music preserved, no duplicate sample pack, actual provider | Workspace/provider suites |
| Queue selection | Chosen occurrence plays; queue count retained | Queue case and regressions |
| Upcoming recording/tanda count/remaining time | Correct next item/cue-relative timeline, live language change | Workspace regressions |
| Pause/resume | Playhead holds and resumes | Transport case |
| Stop/restart | Rewinds selected segment and cancels pending transition | Transport/device cases |
| Previous/Next | Both queue directions; endpoint bounds | Transport case |
| Seek | Local timeline and cue-relative provider seek | Transport/cortina cases |
| Volume/mute | Actual gain below zero threshold and restored master volume | Transport case |
| Fade Off/1/2/4 | Envelope unit boundaries, saved choice, cancellation, actual four-second output | Fade/device/provider reviews |
| Natural fade endpoint | Measured local output and real cortina provider volume | Playback review session |
| Auto next on/off | Holds final source or enters next queue entry | Transport case and regressions |
| Keyboard Space | Toggles transport and avoids editing fields/dialogs | Transport case and regressions |
| Cortina start/end | Saved offsets, end bounds and invalid ranges | Cortina case and regressions |
| Copy deck position to cortina | Current position becomes cue | Cortina case |
| Play cortina interval | Phone opens deck; selected segment plays | Cortina case |
| Cortina hold/explicit Next | Holds source boundary, resumes next tanda | Workspace regressions and real playback |
| Library full cortina source | Full source remains seekable, prepared queue preserved | Workspace regression |
| Edit upcoming queue live | Current source/playhead retained; Undo applied | Queue case and regressions |
| JSON export/import | Download parsed, independent browser matches structure/cues | Portable transfer case |
| Import cancellation/corrupt/oversized JSON | Original workspace retained and error shown | Portable transfer case |
| Import reset of deck/Undo | Previous playback and history cleared | Workspace regression |
| Automatic save/reload | Metadata, groups, local audio, queue and preferences persist | UI suites |
| Stale-tab protection | Prevents overriding newer saved metadata/audio | Workspace regressions |
| Database failure/temporary mode | Examples play, local import guarded, export works, retry commits | Temporary storage case |
| Storage open timeout/retry and quota messages | Bounded opening; classified errors; guarded writes | Storage/device regressions |
| Persistent storage request/details | API action and usage information; browser permission remains provider-controlled | Guide/settings case |
| Korean/English/Spanish | Controls, guide, live countdown and persistence | Guide/settings case and regressions |
| Guide example edit/select actions | Dialog opens; correct work area receives focus | Guide/handoff case |
| Guide file/preview/analyze/export/play actions | File access, empty feedback, real operation paths | Guide, analysis, transfer and provider cases |
| Guide progress/reset | Marked actions and reset state | Guide/settings case |
| Example link fill | Opens Music and fills video URL | Guide/settings case |
| Dialog close/Escape | Modal closes without affecting workspace | Guide/handoff case |
| Toast dismiss | Notification disappears | Guide/handoff case |
| Phone navigation/menu/More | Access to each work area/action | Phone production project |
| Tablet columns and orientation | Workspaces remain available without losing player/state | Device suite |
| Desktop sidebar/workspace | Full work areas and desktop keyboard | Desktop production project |
| Floating deck | Pause/Next/open deck while preparing music | Workspace/device regressions |
| YouTube init/load failure | Explicit retry retains selected source/queue | Workspace/device regressions |
| YouTube provider errors | 100/101/150/153 feedback, replacement validation | Provider recovery case |
| Open YouTube recovery link | Correct source URL and safe target | Provider recovery case |
| Replace video/relink local recovery | New source used after Play, saved state | Provider recovery case |
| Skip unavailable recording | Next queue item starts | Provider recovery case |
| Autoplay permission guidance | Explicit retry and play-inside-video guidance | Device/permission tests |
| Prolonged local buffering | Browser waiting event and frozen source expose retry/relink after 15 seconds | Local stall case |
| Network buffering and retry | Real offline source switch then reconnect resumes same source | Network review |
| Offline local operation | Playback, edit, export, then reload after reconnect | Workspace regression |
| Numeric-loopback origin migration | Existing file/state/preferences transferred | Workspace regression |
| Example pack migration | Legacy generated examples removed, personal files retained | Model/workspace regressions |

## Issues found through this review

- Preview from the guide depended on a visible library row. A search/filter could remove that row and silently disable the guide action. The action now uses the selected local recording directly.
- Deleting a recording while previewing left the preview running and its status visible. The preview source is now tracked; confirmed deletion stops it and clears the status.
- Cortina interval Play on a phone started audio while the deck remained hidden. It now opens Play before loading the source.
- Guide file/link handoffs could target a hidden phone library. They now open Music explicitly.
- Relinking audio could race queued metadata saves and report a false stale-tab conflict. File replacement now participates in the same serialized persistence chain.
- A decoded local source could enter prolonged buffering without recovery controls. A bounded stall notice now offers retry and relinking.
- Local progress relied solely on media events; it now also polls every 250 ms to keep the deck timeline current.
- Re-analyzing the currently playing recording did not refresh the player's cloned gain metadata. Analysis now updates queue snapshots and the live player while preserving playback.

## Limits

Physical Galaxy/Safari speaker output, background operating-system suspension, venue/headphone routing, and arbitrary browser codec combinations remain outside this browser environment. Source availability checks are time-specific and do not certify that all 28 full recordings play through to the end. Offline cold startup and independent headphone cueing are not implemented; they are not marked as passed features.

## Reviewed source provenance

SHA-256 hashes identify the implementation and executable UI checks used by the passing runs.

| Source | SHA-256 |
| --- | --- |
| `src/player.js` | `83b807262e1f69ded8606c093fbbf5037bc26a2d970d8ccc29e1ea9675a4b28f` |
| `src/main.js` | `7c5e018488d15d37f45b37a76570fb68d80702ae2376084788d70321e398ccda` |
| `src/fade.js` | `c88ee8ea5391701e5219cb4c52b9127805bc10740024728758655fe5470ab2e1` |
| `src/storage.js` | `8ff050bc79aad48d408ef71c51dce942b8fb9a6843e240bcfc9952b58e76397b` |
| `src/style.css` | `b6deaac1f6eb5da707d7ee2b5268ad5ced9217f89da08d3fc8b5e48b1677af12` |
| `src/guide.js` | `c91c7ba59534149c28cb5e71190309d9f8456f49c3165cb96f2031200c8cac13` |
| `src/i18n.js` | `58eea6b0ce82355757bffc9593cb7d131050bbdff9f9d8a78f1872632fda895a` |
| `tests/browser/feature-review.spec.js` | `2d32a408cd6daf65235fc921bb0c08db041ccce940171db66715cef60fc997b6` |
