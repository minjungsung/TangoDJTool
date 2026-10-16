# Device UI and playback improvement plan

## Problem and evidence

The reported experience is that a four-second fade is inaudible, the phone interface is confusing, and a loading operation failed. Code inspection on 16 October 2026 establishes three playback defects: the example playlist uses YouTube while the existing fade only handles local-to-local changes; automatic track endings have no fade-out; and the local fade-in starts before playback has successfully begun. The phone layout contains the library, builder, deck, and all recording actions together. Existing viewport containment tests do not prove that this workflow is understandable.

The user clarified that the error occurred on a Galaxy phone, at the deployed site, while playing the example music list; the message mentioned a database. The deployment was identified as `https://tangodjtool.vercel.app`; the Galaxy browser and exact error text remain unconfirmed. Example-list persistence and database initialization are therefore priority failure paths. Provider errors, autoplay restrictions, codec failures, and browser storage failures must remain distinct hypotheses until reproduced.

## Requirements and acceptance criteria

### Playback

- Fade Off preserves immediate playback. A selected duration fades each recording in from its audible start and out before its natural or configured segment end, including the final recording and held cortinas.
- Manual Next fades the outgoing recording before starting and fading in the incoming recording. This is sequential fading, with no promise of overlapping crossfade or beat matching.
- Envelope time follows source playback position, so buffering does not consume the introduction, pause holds position, seeking recalculates gain, and changing volume preserves the envelope.
- Clamp each fade to half a short segment to avoid overlapping fade intervals. Honor absolute cortina cues and relative segment lengths.
- Local files use Web Audio gain, rather than relying on mobile HTML media volume. YouTube uses only its official player volume API; browsers or devices that ignore programmatic video volume cannot guarantee an audible YouTube fade. Explain this at the fade control.
- Stop cancels pending transitions; obsolete async loads must not replace a newer selection. Failures leave the recording selected for explicit retry.

### Phone: below 700 CSS pixels

- Show one work area at a time: Music, Set, or Play. Keep labeled navigation reachable with safe-area spacing and without horizontal scrolling.
- Start in Music, explain the three steps, and expose file import immediately. Put guide, examples, backup, and settings in a secondary menu.
- Recording cards expose Play and Add; put metadata, preview, analysis, and deletion behind More. All primary touch actions are at least 44 pixels tall.
- Selecting a group offers an explicit route to Music to choose recordings. Starting a prepared set opens Play. Keep compact playback controls available while browsing.
- Keep transport, upcoming recording, source/loading feedback, and recovery above detailed queue content. Advanced playback controls are expandable.

### Tablet: 700–1199 CSS pixels

- Provide labeled workspace navigation and readable recording cards. At 900 pixels and above show library and builder side by side; narrower portrait tablets stack them without shrinking text.
- Keep all work areas available, with large touch controls and a deck below preparation areas. Reuse the same queue, state, and player when resizing or changing orientation.

### Computer: 1200 CSS pixels and above

- Retain library and builder side by side, deck and queue together, and keyboard transport shortcuts. Avoid a separate player implementation for each layout.

### Loading and recovery

- Display loading state and prevent duplicate import operations. Distinguish blocked playback, unsupported media, provider/network failure, quota exhaustion, and restore failure with an actionable message.
- Time-bound local playback start; provide Retry, relink local file, or skip without discarding a prepared queue. Preserve YouTube provider-specific replacement/open actions.
- Keep successful imports when a later file fails. Never report all files saved after a failed workspace save. Retry transient database-open failures instead of caching rejection indefinitely.
- Storage restoration or example-save failure must leave a usable temporary workspace: example playback is independent of persistence. Display that edits are unsaved, provide Retry saving and Export, and do not silently clear saved data. Do not convert stale-tab revision conflicts into temporary persistence because that would invite overwriting newer data.

## Implementation sequence

1. **Baseline and specification:** inspect player, persistence, responsive rules, and existing browser coverage; record verified findings and unresolved hypotheses here.
2. **Audio behavior:** introduce a position-based envelope and integrate local gain and official YouTube volume, endpoint fades, cancellation, short segments, and playback-start recovery.
3. **Device workflows:** add phone navigation and progressive disclosure, tablet preparation layouts, accessible action labels, and contextual handoffs between work areas.
4. **Import/storage reliability:** add import progress, per-file outcomes, save-failure handling, recoverable database opening, and explicit playback recovery.
5. **Verification:** run unit tests and the complete existing browser suite, then device-specific workflow tests in Chromium and WebKit. Measure actual rendered local audio amplitude using an isolated WAV fixture and Web Audio analysis. Use a mocked official player for deterministic provider envelope and failure scenarios.
6. **Documentation:** update source capability descriptions, usage instructions, and a validation report with exact checks and unverified hardware limits.

## Release and manual verification

Build the static app and review the resulting diff before deployment. A deployment is outside this local implementation task. Test the served build on an actual iPhone/Safari, iPad/Safari in both orientations, Android/Chrome, and desktop with speakers or headphones. Confirm four-second fades using a recording with an audible beginning and ending; repeat with a 20-second cortina, Next, pause/resume, seek, and Stop during a transition. Verify device volume limitations separately for YouTube. Test an interrupted network, blocked embed, unsupported file, quota failure, refresh after a completed save, and JSON transfer between independent browsers. Browser emulation is evidence for layout and logic, not physical listening or mobile background execution.

Background playback and reliable unattended events using YouTube are not guaranteed by browsers. Offline cold startup, separate headphone routing, crossfade, streaming-provider replacement, and bulk file management are follow-up features and must not obscure this workflow repair.

## Implementation status

The local implementation now includes position-based fades, official YouTube volume envelopes, phone navigation and action dialogs, tablet columns, loading/retry controls, per-file import progress, storage error classification, database-open timeout and retries, and a byte-based fallback for WebKit Blob storage failure. Galaxy example playback has a dedicated database-failure regression: the 28-entry queue plays in a clearly labeled temporary workspace, and Retry saving commits it after storage becomes available. The deployed site was audited and still serves the old interface and fade behavior. The revised build has not been deployed. See the companion validation report for final check results and limits.

The expanded review now inventories every current feature family and tests 20 complete UI scenarios across three device/browser contexts, alongside the original regressions, real example playback, network interruption, and codec probes. See `docs/all-features-validation.md`.
