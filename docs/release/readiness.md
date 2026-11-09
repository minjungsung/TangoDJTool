# Tango DJ Studio release readiness

Last checked: November 9, 2026.

## Confirmed product

The existing product is Tango DJ Studio, using Android application ID `app.tangodj.studio`, version `0.1.0`, version code `1`, and target SDK `36`. Its Android launcher is a Trusted Web Activity for `https://tangodjtool.vercel.app/`. The repository also supplies an installable web application; it does not currently contain an iOS project or Expo/EAS configuration.

The clean local checkout was safely fast-forwarded from `6301f8c` to remote `main` at `29d2a19899dc352d54c51a0ea4a8762f780e08ac`. The four incoming commits changed repository automation only. The builds and screenshots below were verified against that application source.

## Completed preparation

- Production web build passed and generated the application service worker and manifest.
- Android `assembleDebug`, `bundleRelease`, and `lintRelease` passed with JDK 17, Android SDK Platform 36, and the build tools selected by Android Gradle Plugin 8.13.0. Release lint reported four warnings and no errors.
- App icons are 512 × 512, 192 × 192, and maskable 512 × 512. The feature graphic is 1024 × 500.
- Four current phone screenshots replace the obsolete three-menu UI. They show Music, Playback, Sets, and Tandas at 1215 × 2160 pixels. See the [capture manifest](assets/capture-manifest.json) for source and image hashes. These are production web UI captures in an isolated Chromium phone viewport, rather than native-installation or audio-playback evidence.
- Store text now describes the current four work areas. App name, short description, and full description fit Google's respective 30, 80, and 4,000 character limits.
- `npm run android:preflight` checks local identity, bundle signature integrity, provider-certificate input, Digital Asset Links, image dimensions, screenshot source/image hashes, listing length, and the cached web shell. It reports genuine missing signing and certificate prerequisites as failures.

## Build artifacts

| Artifact | Repository-relative location | SHA-256 | State |
| --- | --- | --- | --- |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | `0bf93016490a0f40dc5a012fe831bba486da701091e302e0e76b9b81a714f128` | Debug build; not a store release |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` | `2ac62aa7a7b3755d66918dc9274c1eaa1d356b4838695c482e07f42d75e48901` | Unsigned; not uploadable to Play |

Rebuilding with the legitimate upload key changes the bundle and its hash. Keep private signing material outside version control and never place passwords in documentation or command output.

## Authenticated Play Console state

The authenticated console inspection on November 9 confirmed the existing Tango app and package identity. Setup showed 8 of 11 items complete; internal testing showed 1 of 3 items complete. The developer account was Personal, production was unavailable, and the dashboard showed zero opted-in testers against the requirement for 12 testers continuously opted in for 14 days of closed testing.

That observed production gate remains active until the actual account satisfies Google's requirements or Google approves a genuine account change and presents different requirements. No production release or review approval has been established.

## Remaining release work

1. Confirm the registered upload-certificate state in the actual app before creating or replacing any upload key. The scoped local signing configuration check found no Tango upload-key variables or keystore in the explicit repository signing locations.
2. Connect the legitimate upload keystore with `TANGO_UPLOAD_KEYSTORE`, `TANGO_UPLOAD_STORE_PASSWORD`, `TANGO_UPLOAD_KEY_ALIAS`, and `TANGO_UPLOAD_KEY_PASSWORD`; rebuild and verify the signed AAB. Password values must stay private.
3. Obtain the actual Play app-signing certificate. Set `TANGO_APP_SIGNING_SHA256` from that distribution certificate, generate Digital Asset Links with `npm run android:assetlinks`, and deploy the statement to the app origin. The origin returned HTTP 404 for `/.well-known/assetlinks.json` during this check. An upload certificate must not be assumed to be the distribution certificate.
4. Run `npm run android:preflight -- --check-site` after deployment, then verify trusted launch, file import/export, playback, rotation, storage recovery, and offline restart on the actual distributed Android build.
5. Complete the remaining console declarations, support details, listing assets, and applicable testing-track setup. Upload the signed bundle to the available track and follow the actual production-access workflow.

See the [Google Play release plan](google-play-plan.md) and [listing text](store-listing.md). A passing build or preflight does not establish account eligibility, successful store upload, review approval, or publication.
