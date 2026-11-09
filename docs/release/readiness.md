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
- `npm run android:preflight` checks local identity, bundle signature integrity, provider-certificate input, Digital Asset Links, image dimensions, screenshot source/image hashes, listing length, and the cached web shell. The post-deployment run with `--check-site` passed 17 of 18 checks; only the unsigned release-bundle signature remains a failure.
- The Digital Asset Links generator preserves unrelated statements and existing certificate fingerprints. A temporary-directory verification confirmed preservation, idempotence, and refusal to replace invalid JSON.

## Build artifacts

| Artifact | Repository-relative location | SHA-256 | State |
| --- | --- | --- | --- |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | `0bf93016490a0f40dc5a012fe831bba486da701091e302e0e76b9b81a714f128` | Debug build; not a store release |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` | `2ac62aa7a7b3755d66918dc9274c1eaa1d356b4838695c482e07f42d75e48901` | Unsigned; not uploadable to Play |

Rebuilding with the legitimate upload key changes the bundle and its hash. Keep private signing material outside version control and never place passwords in documentation or command output.

## Authenticated Play Console state

The authenticated console inspection on November 9 confirmed the existing Tango app and package identity. Setup showed 8 of 11 items complete; internal testing showed 1 of 3 items complete. The developer account was Personal, production was unavailable, and the dashboard showed zero opted-in testers against the requirement for 12 testers continuously opted in for 14 days of closed testing.

Play App Signing displayed “In use.” The official downloaded deployment certificate matches the primary app-signing fingerprint recorded below. This establishes the distribution certificate, not possession or identity of the upload key.

That observed production gate remains active until the actual account satisfies Google's requirements or Google approves a genuine account change and presents different requirements. No production release or review approval has been established.

## Deployed Digital Asset Links

The authenticated Play Console displayed the primary SHA-256 app-signing fingerprint:

```text
31:B2:FC:8A:C0:3D:9D:8A:A5:E1:9B:8B:76:85:12:8E:59:E1:61:BE:B4:EF:AE:61:BE:F8:2F:34:C8:46:AE:29
```

The official “Download certificates” archive `certificates.zip` contains `deployment_cert.der`. Independent DER decoding produced the same fingerprint; the certificate file SHA-256 is `31b2fc8ac03d9d8aa5e19b8b7685128e59e161beb4efae61bef82f34c846ae29`. The archive and local credentials are not committed.

The existing Vercel project was deployed to its production alias on November 9, 2026. Deployment ID: `dpl_22wQLbed9tagauwg7k9XnrmUN9u2`. At 08:47:25 UTC, an anonymous request to [the live statement](https://tangodjtool.vercel.app/.well-known/assetlinks.json) returned HTTP 200, `application/json; charset=utf-8`, and no redirect. The response exactly matched [the repository statement](../../public/.well-known/assetlinks.json), containing `app.tangodj.studio`, `delegate_permission/common.handle_all_urls`, and the provider certificate above. Response SHA-256: `26f83564cc9373c067d681a4dc50f3c3997b66535701e21197d905b020cca144`.

The application root, privacy page, and web manifest also returned HTTP 200 without redirects. Local and hosted production builds passed. This verifies the deployed association file; full-screen trusted launch must still be checked on an actual Play-distributed build.

## Remaining release work

1. Confirm the registered upload-certificate state in the actual app before creating or replacing any upload key. The scoped local signing configuration check found no Tango upload-key variables or keystore in the explicit repository signing locations.
2. Connect the legitimate upload keystore with `TANGO_UPLOAD_KEYSTORE`, `TANGO_UPLOAD_STORE_PASSWORD`, `TANGO_UPLOAD_KEY_ALIAS`, and `TANGO_UPLOAD_KEY_PASSWORD`; rebuild and verify the signed AAB. Password values must stay private.
3. Run `npm run android:preflight -- --check-site` with the genuine distribution fingerprint after rebuilding the signed bundle. Verify trusted launch, file import/export, playback, rotation, storage recovery, and offline restart on the actual distributed Android build.
4. Complete the remaining console declarations, support details, listing assets, and applicable testing-track setup. Upload the signed bundle to the available track and follow the actual production-access workflow.

See the [Google Play release plan](google-play-plan.md) and [listing text](store-listing.md). A passing build or preflight does not establish account eligibility, successful store upload, review approval, or publication.
