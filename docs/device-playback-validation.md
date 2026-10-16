# Device and playback validation report

Validation date: 16 October 2026. All paths below are repository-relative. This report describes the local implementation, not the deployed site.

## Result

The four-second fade now follows playback position at each recording entrance and endpoint, including cortina segments. Manual transitions fade out before switching sources. Phone navigation separates Music, Set, and Play; recording cards expose Play/Add/More, while tablets retain preparation columns and desktop retains the full workspace. Playback failure offers retry and file recovery. Browser database failure leaves example playback available in a visibly temporary workspace, with saving retry and JSON export.

## Reported Galaxy failure

The user reported a database-related error while playing the example list on a Galaxy phone at the deployed site. The deployment was subsequently identified as `https://tangodjtool.vercel.app`; the exact Galaxy browser and database message remain unknown. It is not established that a particular local error reproduced the exact production incident.

A deterministic Galaxy S9+ context rejects IndexedDB initialization, opens the examples menu, plays the 28-entry playlist, verifies the unsaved temporary state, restores IndexedDB, and successfully retries saving. This passes in Chromium and WebKit. Database opening also has an eight-second timeout and clears rejected connections for retry. Revision conflicts from stale tabs continue to block overwriting newer saved work.

A separate WebKit storage experiment reproduced `UnknownError: Error preparing Blob/File data to be stored in object store`. On that specific error, recording persistence falls back to an ArrayBuffer record while retaining compatibility with existing Blob records. Device workflows verify importing and reloading these recordings with no missing-file indicator. Quota failure remains a failure and is not silently treated as a successful import.

## Completed checks

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | 14 passed | Fade boundaries, short/unknown segments, permission messages, set integrity, queue/cues, analysis |
| `npm run test:e2e` | 49 passed in 38.2 seconds | Full existing workspace regressions and nine new device/audio/storage tests |
| `npm run test:devices` | 17 passed, 1 skipped | Chromium and WebKit; iPhone 13, iPad, Pixel 7, Galaxy failure flow, orientation, persistence and recovery |
| `npm run test:review` | 60 passed | Production UI: desktop Chromium, phone Chromium, tablet WebKit |
| `npm run build` | Passed | Vite production static output |
| `git diff --check` | Passed | Patch whitespace |
| Screenshot inspection | Passed viewport containment | Korean UI at 390, 1024, and 1440 CSS pixels; phone steps/cards and tablet columns |

Tests use isolated browser contexts and generated WAV fixtures. No generated sound is added to product examples or the user's personal workspace. Device names describe emulation profiles; they are not claims of physical-device testing.

## Audio evidence and limits

A constant-amplitude WAV played through the actual Player and Web Audio gain node in Chromium was measured downstream with an analyser. The test verifies that output rises from the intro to the middle and falls near the end; master volume, seek, and pause behave consistently. Pure envelope tests establish exact four-second boundaries and short-segment clamping. A mocked official YouTube player verifies cue-relative volume, frozen buffering, the configured endpoint, and cancellation of manual transitions by Stop.

The WebKit automation environment advances the local media playhead but returns a silent MediaElementSource analyser signal. That measurement test is explicitly skipped there. Local WebKit import, playback progress, retry, persistence, and all other device checks pass. Physical Safari speaker output remains unverified; the skip must not be described as an auditory pass.

YouTube volume requests can be ignored by mobile devices. Reliable audible fades require supported local audio; no crossfade, beat matching, physical listening, venue acoustics, actual Galaxy browser execution, or background playback guarantee is claimed. The follow-up below records short real-network playback checks; it is not a long-duration soak. Position sampling can be throttled in background tabs. Existing long-session reports describe earlier revisions and do not certify this change.

## Remaining deployment verification

The repository homepage identified the deployed URL, and the follow-up below confirms that it still serves the earlier interface with no YouTube fade. Deploy the reviewed changes and confirm the new build is served. Serve the production build at the normal site origin and test on the actual Galaxy browser: open examples, play, select Fade 4 sec, advance through a cortina, temporarily block storage, retry saving, and refresh after saving. Repeat local-file fades with physical listening on phone, iPad, and desktop. Follow the device checklist in `docs/device-playback-improvement-plan.md`. Deployment has not been performed during this task.

## Source provenance

SHA-256 hashes correspond to source files checked after the passing runs. Documentation-only updates do not change these hashes.

| Portable source | SHA-256 |
| --- | --- |
| `src/fade.js` | `c88ee8ea5391701e5219cb4c52b9127805bc10740024728758655fe5470ab2e1` |
| `src/player.js` | `83b807262e1f69ded8606c093fbbf5037bc26a2d970d8ccc29e1ea9675a4b28f` |
| `src/main.js` | `7c5e018488d15d37f45b37a76570fb68d80702ae2376084788d70321e398ccda` |
| `src/storage.js` | `8ff050bc79aad48d408ef71c51dce942b8fb9a6843e240bcfc9952b58e76397b` |
| `src/style.css` | `b6deaac1f6eb5da707d7ee2b5268ad5ced9217f89da08d3fc8b5e48b1677af12` |
| `tests/browser/devices.spec.js` | `adbc974e781656457280706938f4debbd6651c509b0d3707b7ec1cd62cf732ca` |
| `tests/browser/workspace.spec.js` | `003b829e7193218379049a2eaa9cc0ca183464f287c3d99dc2597cb8c13488b3` |

## Follow-up: actual site and production-build operation

The previous validation was insufficient for the reported fade experience. Earlier sessions observed playback progress and queue transitions without measuring fade output. The real example list used YouTube, while its player implementation applied fades only to local-to-local transitions. The old local fixture script did not test four-second entrance and endpoint fades. A long playback session therefore did not establish that Fade worked. This is a coverage and reporting failure, not a user misunderstanding.

On 16 October 2026, an isolated **Chromium** browser (the initial review was headed; the final rerun was headless) using a Galaxy S9+ viewport opened the deployed site, loaded its real example list through the UI, selected Fade 4 sec, and played Yo soy el tango through the actual YouTube embed. Ten half-second samples showed the provider playhead advancing from approximately 0 to 4.5 seconds while the official player volume remained **85% throughout**. The deployed interface lacks the new device navigation. Its database error did not reproduce in this isolated context; the actual Galaxy incident remains unresolved on hardware.

The same UI path ran against the revised static production build. Ten samples showed the real provider volume rising **0 → 9 → 20 → 30 → 41 → 51 → 62 → 73 → 83 → 85%** as source playback reached four seconds. The session edited the first cortina to a 35–47 second interval, applied Update upcoming queue, and played L-O-V-E. Its last four seconds reduced volume toward zero; at the endpoint playback entered **Poema**, queue index 5, and its fade-in began. These were real provider events, not mocked YouTube results.

Next, the session imported a 12-second constant-amplitude WAV through the file input and pressed the library Play button. Half-second samples measured downstream Web Audio RMS rising from zero to approximately **0.223**, then falling to approximately **0.03** in the last second and zero at completion. The session used More → Edit to rename the recording, waited for a saved status, reloaded, and confirmed the edited title and available audio. It also switched to a tablet viewport and captured the layout. The completed revised session had no recorded page errors.

This operation exposed a transient UI defect: a new recording could briefly display the prior source's timeline during loading. The playback update callback now ignores progress while a transition is pending. After this fix, the complete 49-test browser suite and 14 unit tests passed; the production build and the headed real-network session were repeated successfully.

The first cortina review attempt did not apply the edited segment to the already-loaded queue, so its expected 35-second start did not occur. The harness now explicitly uses Update upcoming queue, matching the product workflow. That incomplete run was not counted as a pass.

Evidence is preserved under `reports/device-playback/`: `deployed-session.json`, `revised-session.json`, and interface screenshots. The repeatable procedure is `scripts/playback-review.mjs`. It launches an isolated browser (set `REVIEW_HEADLESS=1` for background execution), performs UI operations, reads the actual official provider API, and measures local output after the gain node. It includes assertions for YouTube fade-in/out, the cortina-to-next-tanda transition, local output changes, and reload persistence. Use REVIEW_URL to select a served production build; REVIEW_DEPLOYED=1 inspects the current deployment without requiring the revised interface.

These checks verify browser operation and signal changes. They are not physical listening through Galaxy speakers, perceptual musical evaluation, or proof that every mobile provider implements volume control. The reviewed source has not been deployed.

The complete feature review and codec/network evidence are documented in `docs/all-features-validation.md`. The final background fade rerun uses the current production build; its local timeline is also sampled by the player.
