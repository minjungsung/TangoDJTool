# Playback review evidence

The deployed session uses the repository homepage URL and an isolated headed Chromium browser with a Galaxy S9+ emulation profile. It demonstrates that Fade 4 sec leaves actual YouTube volume fixed at 85 percent in the currently deployed build.

The revised session uses the local static production preview, real YouTube embeds, and UI-imported local WAV audio. It demonstrates provider volume ramps, the 35–47 second cortina endpoint entering Poema, measured local fade output, and edited-file persistence after reload. Generated audio remains a test fixture in the isolated browser; it is not a product example.

See `docs/device-playback-validation.md` for findings, the failed intermediate harness attempt, source provenance, and limits. These are short operational checks, not physical-device listening or a long playback soak.
