# First-use example playback

A workspace with no saved state now starts with the existing 28-source example set, 12 tanda/cortina groups, and a prepared playback queue. Play is the initial work area on phone, tablet, and desktop. The first recording is displayed before the user presses Play; no media provider is loaded and no audio starts automatically.

Saved workspaces, including deliberately empty ones, retain their content. The first-use examples are not re-added after an empty set is imported and saved. Database failure still offers a visibly temporary example workspace with explicit saving recovery. The `?practice=1` link retains its explicit example-loading behavior for existing workspaces.

Only this first-use behavior is added by the current request. Android, PWA, privacy, and release drafts already present in the working tree are separate unfinished work.

## Validation

`playwright.onboarding.config.js` exercises fresh browser contexts in Chromium and WebKit at phone, tablet, and desktop sizes, plus exported backup, deliberate clearing/reload, and database failure. Existing feature suites use an explicitly saved empty workspace fixture so their import, editing, playback, queue, storage, and transfer assertions still describe returning users. Fresh-first-use coverage does not share that fixture.

`scripts/onboarding-review.mjs` opens the production build in an isolated phone viewport, verifies that the examples are ready without autoplay, then presses Play and Next against the actual official YouTube player. Reports are stored under `reports/onboarding/`.

The final checks passed: 10 first-use tests in Chromium/WebKit, 60 full feature cases, 49 existing regressions, and 14 unit tests. Device checks passed 17 with one explicit WebKit analyser skip. The actual YouTube first-use session started the first recording and advanced to the second with no page errors. Android/PWA offline installation checks remain incomplete and are not included in these passing results.
