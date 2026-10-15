# Completed playback verification

Captured after the final session completed at 07:59:44 UTC on 15 October 2026. Current source revision: `cc2d30301d33e789fd57aa461bb8c1e58ccc3185`.

| Report | Events/checkpoints | Recorded errors | Result | SHA-256 |
| --- | ---: | ---: | --- | --- |
| soak-latest.json | 160 | 1 | Completed: 7200 seconds | `7ba55d1115a47ec65ef903a8fb32ac893062b8b99935705dd65921fa264ed59a` |
| dj-final-session.json | 131 | 0 | Completed: 4502 seconds | `aec120a4c700de4da77d9ce58482193bf805491b0063318deb9cacc12c42f9f9` |
| dj-current-build.json | 53 | 0 | Completed: 1801 seconds | `95b1b4d0ae21ba4847c000000270fa26053f2ed906c26fc7d1298563b00e676b` |
| local-session-latest.json | 40 | 0 | Completed: 608 seconds | `c990bbeabeb7b5c207a3ec00fc689e050ae93ad110b63cf81caea0e0bf1ae13e` |
| manual-checks.jsonl | 71 | — | Manual observations | `c29ba40047c755e6f2be4235bcfb503bf897404b76d6c6e1790722b78acb6f12` |

The baseline used the original production build. The 4,502-second revised session used the stable DJ-controls build before the later name, full-source preparation, source-length, and live-language adjustments. The 1,801-second session includes full-source preparation and source-length checks; the latest language adjustment was checked separately through real video playback and the final 38-test browser suite. Session durations overlap and must not be added to represent elapsed testing time.

The baseline recorded one El tamango stall; later playback progressed. The revised session played the full six-tanda set through the final cortina and explicitly restarted it, with no recorded errors. Forty-five-second checkpoint sampling does not observe every short cortina; manual one-second boundary observations supplement it. Provider progress does not establish audible musical quality or venue suitability.

The immediate-reload large-library observation restored four group recordings before saving completed. The follow-up waited for completed saving and restored all five. Both observations are preserved. The interrupted intermediate session remains in the earlier snapshot and is not counted as a completed pass.
