# DJ usability session

This session began at 05:58:02 UTC on 15 October 2026 and is scheduled to continue until at least 07:58:02 UTC. The production playback soak began at approximately 05:59:14 UTC and runs for 7,200 real seconds. Final results are pending.

## Operational findings and changes

- Cortinas previously always started at source time zero. That makes a long intro or silence part of the dance-floor break. The builder now accepts an absolute start/end interval in one row, supports copying the current deck position, and checks the interval through its adjacent play button.
- A fixed cortina endpoint alone does not let the DJ wait for dancers to clear the floor. An optional hold keeps the next tanda ready until Next is pressed.
- Reloading an edited set used to restart its first recording. Updating the upcoming queue now keeps the current recording and playhead while replacing future entries.
- The DJ could lose track of the current recording while browsing. The deck shows tanda position, remaining playable time, and the next recording; compact transport controls appear when the full transport is outside the viewport.
- Mobile library actions were outside the visible table. Narrow layouts use recording cards with visible actions. Very small Spanish layouts keep the interval inputs readable.
- Queue transitions and duration discovery could replace focused controls. Interval edits update summaries without replacing the inputs; keyboard focus survives moving between endpoints.
- Stop previously acted like pause. Stop now returns to the selected segment's start; pause preserves position. Completed recordings and cortinas can be replayed.
- Editing a live video URL could change the reference used to match incoming player events. Changing a source now stops it and prepares the new source for Play; metadata-only edits keep playback going.
- Set imports could retain the old player and undo history. Imports now clear the live deck and previous set undo state.
- Older tabs could overwrite newer saved edits. Revision checks prevent that overwrite. Failed metadata saves retain stored audio, and file replacement commits the file and metadata together.
- Spanish artist searches required accents. Searches now ignore accents, while stored recording names retain their original spelling.
- Playback notices caused layout movement and could cover actions. Notices use a dismissible toast, positioned above the compact transport when it is visible.
- YouTube can remain buffering without a numeric error. A waiting indicator appears after 15 seconds without progress; Retry here reloads at the current source position. The app leaves the next-recording decision to the DJ.

## Verification completed so far

The app has 11 passing unit tests and 34 passing browser tests. The original TangoDJ app's five tests also pass, including its cortina-to-first-recording regression.

Real YouTube checks verified a 35–55 second cortina entering Poema at queue index 5, a held 35–40 second cortina followed by explicit Next, and a live upcoming-queue update preserving the playhead. A real reload restored the selected recording, tanda position, cortina cue, and 28-entry queue.

The isolated local transport session completed 608 real seconds with 40 checkpoints and no page errors. Its generated WAV is a test fixture and is not added to product examples or the personal browser workspace.

An offline browser check passed local playback, editing, saving, and JSON export while the app remained open. Reloading after reconnecting retained its audio and edited metadata. Offline cold startup remains unsupported.

A real network interruption check switched to a YouTube recording while offline. The waiting indicator appeared at 0:00. After reconnecting and choosing Retry here, the same recording progressed to 0:07 without changing the queue entry. With Auto next disabled, a completed real recording replayed from its beginning; Stop and Play also restarted it.

Library playback of a cortina now opens an unrestricted source entry so the DJ can seek beyond a previously loaded short segment. A real source playback check sought to 1:18, saved a 78–98 second interval, and retained the original 28-entry queue plus one source entry.

## Observed limits

The baseline soak recorded an El tamango stall at 0:05. Playback subsequently resumed after the harness attempted recovery. An earlier edited-build session stalled on El bulín de la calle Ayacucho at 1:27; a separate fresh session played that recording through its end and entered Toda mi vida. The final revised session is still running to observe recovery behavior.

Testing uses isolated Chromium browser contexts and actual embedded videos. It verifies operations, provider state, playhead movement, ordering, and persistence. It does not establish physical speaker quality, auditory musical phrasing, audience response, headphone routing, or venue acoustics. Cortina cue examples used to verify timing are not presented as artistically curated entrances.

## Snapshot at commit

Results captured at 2026-10-15T07:17:50.341054+00:00 are preserved in [the timestamped snapshot](snapshots/2026-10-15T07-17-50Z/README.md). The baseline set reached its final 20-second cortina after approximately 70 minutes and restarted at its first recording. One baseline stall is recorded. The revised DJ session has no recorded errors at capture time. The two-hour session is still incomplete; this report does not claim a completed two-hour validation.

The 11 unit tests and production build passed again during this save. All 34 browser tests passed again in 24.9 seconds during this save.
