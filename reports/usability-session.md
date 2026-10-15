# DJ usability session

This session ran from 05:58:02 UTC through 07:59:44 UTC on 15 October 2026: 2 hours, 1 minute, 42 seconds of elapsed work. The baseline production playback soak completed 7,200 real seconds. Concurrent sessions supplement this elapsed session and are not added to its duration.

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
- A cortina cue beyond the source length could appear selected without making progress. Known lengths now bound interval edits and playback; moving a cue close to the end shortens its segment to the remaining time. If the provider discovers an invalid cue only after loading, playback stops with an explanation.
- Common narrow Spanish layouts clipped the final cortina button and overflowed header button text. Interval controls now use their compact presentation through 430 pixels, and header labels wrap inside their buttons.

## Verification completed so far

The app has 11 passing unit tests and 38 passing browser tests (the final full suite completed in 28.3 seconds after the live-language fix). The original TangoDJ app's five tests also pass, including its cortina-to-first-recording regression.

Real YouTube checks verified a 35–55 second cortina entering Poema at queue index 5, a held 35–40 second cortina followed by explicit Next, and a live upcoming-queue update preserving the playhead. A real reload restored the selected recording, tanda position, cortina cue, and 28-entry queue.

The isolated local transport session completed 608 real seconds with 40 checkpoints and no page errors. Its generated WAV is a test fixture and is not added to product examples or the personal browser workspace.

An offline browser check passed local playback, editing, saving, and JSON export while the app remained open. Reloading after reconnecting retained its audio and edited metadata. Offline cold startup remains unsupported.

A real network interruption check switched to a YouTube recording while offline. The waiting indicator appeared at 0:00. After reconnecting and choosing Retry here, the same recording progressed to 0:07 without changing the queue entry. With Auto next disabled, a completed real recording replayed from its beginning; Stop and Play also restarted it.

Library playback of a cortina now opens an unrestricted source entry so the DJ can seek beyond a previously loaded short segment. A real source playback check sought to 1:18, saved a 78–98 second interval, and retained the original 28-entry queue plus one source entry.

During actual Cachirulo playback, the next recording was reordered from Guapeando to El tamango, applied to the upcoming queue, then undone and applied again. Cachirulo continued from 0:35 to 0:38, the original next recording was restored, and saving completed. The revised session later played El tamango through its end into Milongueando en el 40.

A real L-O-V-E source check rejected a 999-second cue while preserving playback at 0:02. Choosing its final seven seconds played to the source end. Viewport checks cover 320, 390, 414, and 768 pixels with Spanish header labels and cortina actions contained inside their controls.

Live playback of Milongueando en el 40 entered Fly Me to the Moon, played its 20-second segment, then entered Milagro (the next tanda's first recording). One-second sampling observed approximately one second of source-loading state at that transition. The closing Stand By Me segment stopped at 20 playable seconds; Next was disabled, and the harness explicitly restarted the set. The app did not automatically loop the completed set.

Additional checks verified future-tanda deletion and undo without interrupting the current recording, repeated-recording occurrence matching, and three-language countdown updates during real playback. An isolated 1,000-recording metadata library imported in 149 ms and returned its accent-insensitive search in 64 ms on this test browser. Reload after a completed save retained the added fifth group recording. Reload immediately after the edit, before the save completed, restored four recordings; this is a known pending-save risk, not a passed persistence check. These timings are observations from one environment, not performance guarantees.

## Observed limits

The baseline soak recorded an El tamango stall at 0:05. Playback subsequently resumed after the harness attempted recovery. An earlier edited-build session stalled on El bulín de la calle Ayacucho at 1:27; a separate fresh session played that recording through its end and entered Toda mi vida. The revised session completed 4,502 seconds, played a full set through the final cortina, and restarted with no recorded errors.

Testing uses isolated Chromium browser contexts and actual embedded videos. It verifies operations, provider state, playhead movement, ordering, and persistence. It does not establish physical speaker quality, auditory musical phrasing, audience response, headphone routing, or venue acoustics. Cortina cue examples used to verify timing are not presented as artistically curated entrances.

## Completed results

| Session | Real playback duration | Observations | Recorded errors |
| --- | ---: | ---: | ---: |
| Baseline production soak | 7,200 seconds | 160 checkpoints | 1 buffering stall |
| Stable revised DJ-controls build | 4,502 seconds | 131 events | 0 |
| Later source-preparation and source-length build | 1,801 seconds | 53 events | 0 |
| Local transport fixture | 608 seconds | 40 checkpoints | 0 |

All sessions completed. The baseline and revised DJ session each reached the final cortina and were explicitly restarted by the harness. The revised session's entire six-tanda flow was observed; short cortinas are not all present in 45-second checkpoints. One-second manual transition observations supplement the logs. The latest live-language fix passed separate actual-video checks, 11 unit tests, all 38 browser tests in 28.3 seconds, and the production build. Original TangoDJ's five tests pass, including the duplicate-ended-event regression.

The [completed snapshot](snapshots/2026-10-15T07-59-44Z/README.md) preserves reports and source provenance. The [earlier snapshot](snapshots/2026-10-15T07-17-50Z/README.md) remains as intermediate evidence; it did not establish a completed two-hour validation.

## Practical recommendation

The current workflow supports personal preparation, teaching/practice, small milongas, and announcement breaks with held cortinas. Live events benefit from prepared local recordings. Independent headphone cueing and offline cold startup remain the most useful next additions for larger-event operation. YouTube loading and embed restrictions remain provider-dependent, and pending browser saves need time to commit before reload. No physical listening, audience-response, or venue-audio validation is claimed.
