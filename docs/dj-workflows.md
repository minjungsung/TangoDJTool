# DJ preparation, event planning and recovery

The twelve expanded workflows below extend the existing local-first workspace. Preparation edits leave the loaded recording's captured source and cue interval intact. Updating upcoming playback remains a separate action. Audio analysis and browser tests do not certify venue sound, headphone wiring, artistic suitability or multi-hour reliability.

## Bring an existing library into Music

Open **Library filters and tools → Import CSV / M3U**. Choose a file, inspect the mapped recordings and cues, decide how to handle every duplicate, then apply the reviewed import. Playlist order becomes a candidate set, including repeated placements; it does not start playback or replace the loaded queue.

CSV supports a header row, quoted delimiters, escaped quotations and multiline cells. Comma-separated files are the default; tab-separated or semicolon-separated headers are also recognized. Headers are case-insensitive and ignore spaces, underscores, hyphens and slashes. Files are limited to 5 MB and 10,000 recording rows.

| Recording field | Accepted column examples |
| --- | --- |
| Title | `Title`, `Name`, `Track` |
| Orchestra | `Artist`, `Orchestra`, `Album Artist` |
| Singer | `Singer`, `Vocalist` |
| Year / style | `Year`, `Date`, `Style`, `Genre` |
| Tempo | `BPM`, `Tempo` |
| Source duration | `Duration`, `Seconds`, `Duration Seconds` |
| Source cue positions | `Cue in`, `Cue out`, `Cue Start Seconds`, `Cue End Seconds` |
| Local reference | `File`, `Filename`, `Path`, `Location` |
| YouTube identity | `URL`, `YouTube`, `Video URL`, `Video ID` |
| Known audio identity | `SHA256`, `Content Hash`, `Hash` |
| Existing app identity | `ID`, `Track ID` |
| Candidate playlist | `Playlist`, `Collection`, `Tanda`, `Group` |
| Personal preparation data | `Notes`, `Transfer Notes`, `Tags`, `Character`, `Energy Tags`, `Rating` |

Cues and durations use absolute seconds within the original source, rather than `minutes:seconds`. A missing column stays unknown. A valid YouTube URL uses the official embedded player; generic online audio streams are unsupported. M3U supports local references, `#EXTINF` metadata, `#PLAYLIST` names and `#EXTVLCOPT:start-time=12.5` / `#EXTVLCOPT:stop-time=60` before the following recording reference. Local path references are reduced to filenames and never grant access to the original file.

Duplicate choices include adding separately, skipping, reusing unchanged, filling missing metadata, or replacing the supplied metadata. Filename/title matches are suggestions for review, not proof of identical audio. Metadata import cannot replace a conflicting audio identity. Provenance retains the import filename, format, row and SHA-256 of the imported text, plus a portable recording reference.

Imported local entries need audio. **Notes / tags / rating → Relink local file** opens the original-file workflow. A supplied content hash must match. If an imported placeholder has no content identity, explicitly review the selected file before adopting its SHA-256. The source and cues still need rehearsal.

## Find and annotate recordings

Combine the existing search/style/source/set/played controls with artist, singer, year and BPM ranges, explicit instrumental/vocal/unknown voice, source readiness, tags and personal ratings. Blank singers remain unknown. Only explicit instrumental metadata is classified as instrumental.

Range filters retain unknown year/BPM/rating by default; turn off **Keep unknown year, BPM and ratings in ranges** to require known values. Sorting keeps unknown values last in both directions and preserves saved order for ties. **Clear filters** resets both the existing and expanded controls without changing the recording destination.

**Notes / tags / rating** saves transfer observations, comma-separated character/energy tags and an optional personal rating from 1 to 5. Notes are limited to 4,000 characters, tags to 30 entries of 60 characters each. These fields persist in set exports and portable backups and can be searched or filtered. They describe a DJ's preferences rather than objective artistic scores.

## Review a batch and undo preparation edits

Select recording checkboxes or **Select visible recordings**, then open **Review batch edits**. Each field has explicit Keep, Set, Fill unknown and Clear actions. Keep is the default. Fill unknown leaves known values alone. An empty replacement cannot silently erase metadata; choose Clear when erasure is intended. Inspect every changed value before applying. A changed library invalidates the preview.

Undo and Redo retain up to 60 labeled preparation steps during the open page, including metadata, recording notes, batch changes, tanda order/cues and saved-set changes. `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` work outside editable controls and dialogs. Opening a collapsed tanda and automatic provider duration observations do not consume a composition step; observed durations remain current across earlier snapshots. Undo never replays, seeks or rewinds the master deck, including in Live mode.

Reload and replacement of source identities start a new history boundary. Deleted recordings are removed from earlier preparation snapshots so Undo cannot resurrect missing audio. Existing edits affecting surviving recordings remain recoverable. Export a set or portable backup before replacing a library or closing the browser.

## Review tempo and measured local audio

Open **Audio review** for a recording. Estimated BPM includes a heuristic confidence value and half/double alternatives. Review by ear, enter a manual BPM, tap at least four beats, or apply Half/Double before saving. Long gaps reset tap timing; a short rolling median reduces accidental tap outliers. Saved manual/tap/correction values are distinguished from estimates.

Confidence is a measure of the estimator's pulse evidence, not a probability that the musical interpretation is correct. Expressive timing, surface noise, accents, subdivisions and half/double interpretations can reduce or mislead that evidence. This workflow does not create a beat grid or recommend beat matching.

**Measure audio** explicitly decodes the complete local mono/stereo recording. It reports integrated gated K-weighted loudness in LUFS, a 4× reconstructed peak estimate in dBTP and the measured source duration. Measurements below the loudness gate remain unknown. YouTube audio cannot be measured through its official embed.

In Settings, enable **Measured loudness processing** only when desired. Choose a target from −30 to −12 LUFS and 0.5–12 dB of headroom. Peak limiting uses a 5 ms lookahead and a release envelope; the reconstructed result is checked again against the peak ceiling. Requested loudness gain is bounded to ±12 dB; peak protection can add attenuation, so the requested target is not always achieved. Disabling the limiter constrains gain by the measured peak ceiling. Originals remain unchanged.

Pause before applying or bypassing processing. The deck retains its source position and requires an explicit resume. **Original segment** and **Processed segment** allow a reviewed comparison of source intervals through the cue output. Closing the review cancels audition. Digital measurements and exported comparison audio are reproducible evidence; actual listening through the intended room system remains a separate validation task.

## Choose master and cue routes

Settings provides explicit master-device selection, the existing preview-device selector and supported master/cue channel maps. Channel numbers refer to the selected interface's capabilities. Pause before changing the master route or channel mapping. Unsupported browser APIs and unavailable channels produce explicit feedback rather than silently selecting a different route. YouTube remains on the system output.

Preview is blocked during master playback when isolation is unverified. Separate devices must have verified different output identities. A supported multichannel interface can use disjoint channel pairs only after the DJ explicitly confirms a physical channel test. Disconnects and default-device changes cancel cue playback and invalidate that confirmation. Reconnect, select and test again before going live.

Device identifiers and hardware-specific route selections are intentionally not portable backup preferences. Automated device responses are simulated. Physical headphone/room isolation remains the hardware validation item in the [roadmap](dj-roadmap.md).

## Plan the event finish and export the rundown

Open **Tandas → Event planning** and choose a local date and end time. The comparison uses captured queue cues, the current absolute source position and configured in-tanda gaps, including a partially elapsed gap. Unknown source lengths and manual waits remain explicit. When no queue is loaded, it reviews the prepared program.

Candidate final tandas end at complete tanda boundaries. A suggestion is given only when a fully known prefix fits; a prefix containing unknown sources or manual holds remains conditional. Review and choose a final tanda. This selection is a planning marker, not an automatic stop, truncation or queue edit. Advance/stop manually after the chosen tanda, and reconsider the plan when the event changes.

**Export event rundown** creates a standalone English HTML plan. **Print rundown** prints the same content. It includes group order, orchestra/singer, source cues, known runtime, holds, uncertainty and source hashes or official YouTube references. It contains no original filesystem paths and works without the app. Tanda notes and the reviewed final marker are included.

## Keep several event histories

Successful master playback starts are recorded; preview is excluded. Starting a new named session archives the earlier session. It does not log the already-playing recording again. **Played recordings** lets you select/view/search histories, annotate sessions and individual starts, and export selected sessions or entries as CSV.

Use annotations for partial listening or mistaken starts. A logged start is never presented as proof that a recording completed. Session deletion moves it to **Deleted histories**, where Restore recovers it. Export deleted histories before using **Permanently delete**; permanent deletion requires separate confirmation and cannot be undone. Recovery and storage failures preserve committed bytes. Archives are bounded to 100 sessions and 100 deleted histories, at most 1,000 starts per session, and a total serialized size of 2,000,000 characters; reaching a limit reports a recoverable error instead of silently discarding archives.

## Make and restore a portable audio backup

Open **Settings → Backup and restore**. Select recordings and optionally include available audio, portable preferences and all saved/deleted histories. Prepare the bundle, review the counts and missing-file report, then download the `.tdjb` file. Required local audio is content-verified and identical payloads are stored once. Connected handles themselves are never represented as portable audio.

In a fresh browser, select the bundle under Restore. The format, metadata, references, histories, payload bounds and every included audio hash are validated before any change. Review a recording selection and preference/history choices. Stop or pause master playback and unlock Live mode before restoring.

Restore replaces the reviewed workspace/audio in one revision-protected IndexedDB transaction, clears original handles and leaves playback stopped. Preferences/history use a recovery journal coordinated with the committed database marker. A failed database transaction rolls those values back. If the browser closes during recovery, startup reconciles the journal with the actual database outcome; a failed recovery remains visible. A stale workspace revision blocks restoration.

Missing audio stays available as metadata for relinking. Online videos still need network/provider access. Automatic cross-device synchronization is separate from this manual portable bundle. Keep an independent original-file backup as well.

## Verification references

- [Library import](../tests/library-import.test.js), [filters](../tests/library-query.test.js), [batch/annotation schema](../tests/library-service.test.js), [integrated library workflows](../tests/browser/library-backlog.spec.js).
- [Event timing and history engine](../tests/event-plan.test.js), [event/Undo browser workflows](../tests/browser/event-edit-backlog.spec.js).
- [History contracts](../tests/session.test.js), [backup integrity/recovery](../tests/backup.test.js), [fresh-browser transfer](../tests/browser/history-backup.spec.js).
- Current counts, audio evidence and remaining physical/endurance checks are maintained in the [roadmap and progress board](dj-roadmap.md).
