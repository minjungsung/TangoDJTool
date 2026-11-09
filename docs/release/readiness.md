# Tango DJ Studio release readiness

Last checked: November 9, 2026.

## Confirmed product

The existing product is Tango DJ Studio, using Android application ID `app.tangodj.studio`, initial internal version `0.1.0` / version code `1`, and target SDK `36`. The launcher repair is configured as version `0.1.1` / version code `2`. Its Android launcher is a Trusted Web Activity for `https://tangodjtool.vercel.app/`. The repository also supplies an installable web application; it does not currently contain an iOS project or Expo/EAS configuration.

The clean local checkout was safely fast-forwarded from `6301f8c` to remote `main` at `29d2a19899dc352d54c51a0ea4a8762f780e08ac`. The four incoming commits changed repository automation only. The builds and screenshots below were verified against that application source.

## Completed preparation

- Production web build passed and generated the application service worker and manifest.
- Android `assembleDebug`, `bundleRelease`, and `lintRelease` passed with JDK 17, Android SDK Platform 36, and the build tools selected by Android Gradle Plugin 8.13.0. Release lint reported four warnings and no errors.
- App icons are 512 × 512, 192 × 192, and maskable 512 × 512. The feature graphic is 1024 × 500.
- Four current phone screenshots replace the obsolete three-menu UI. They show Music, Playback, Sets, and Tandas at 1215 × 2160 pixels. See the [capture manifest](assets/capture-manifest.json) for source and image hashes. These are production web UI captures in an isolated Chromium phone viewport, rather than native-installation or audio-playback evidence.
- Store text now describes the current four work areas. App name, short description, and full description fit Google's respective 30, 80, and 4,000 character limits.
- `npm run android:preflight` checks local identity, bundle signature integrity, provider-certificate input, Digital Asset Links, image dimensions, screenshot source/image hashes, listing length, and the cached web shell. The signed-candidate run with `--check-site` passed all 18 checks using the actual JDK 17 tools and genuine distribution fingerprint. Play upload-certificate acceptance and device behavior remain separate requirements.
- The Digital Asset Links generator preserves unrelated statements and existing certificate fingerprints. A temporary-directory verification confirmed preservation, idempotence, and refusal to replace invalid JSON.

## Build artifacts

| Artifact | Repository-relative location | SHA-256 | State |
| --- | --- | --- | --- |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | `0bf93016490a0f40dc5a012fe831bba486da701091e302e0e76b9b81a714f128` | Debug build; not a store release |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` | `bf64b55e88f0b9cb8480bc971b9f097354ba26aaf960a2ac751946f1a3361418` | Accepted and published to internal testing; native launch crashes; not a production release |

The earlier unsigned AAB had SHA-256 `2ac62aa7a7b3755d66918dc9274c1eaa1d356b4838695c482e07f42d75e48901`. Rebuilding with signing changed the bundle and its hash. Keep private signing material outside version control and never place passwords in documentation or command output.

## Authenticated Play Console state

The initial authenticated console inspection on November 9 confirmed the existing Tango app and package identity. Setup showed 8 of 11 items complete; internal testing showed 1 of 3 items complete. The developer account was Personal, production was unavailable, and the dashboard showed zero opted-in testers against the requirement for 12 testers continuously opted in for 14 days of closed testing.

Play App Signing displayed “In use.” The official downloaded deployment certificate matches the primary app-signing fingerprint recorded below. This establishes the distribution certificate, not possession or identity of the upload key.

That observed production gate remains active until the actual account satisfies Google's requirements or Google approves a genuine account change and presents different requirements. No production release or review approval has been established.

## Deployed Digital Asset Links

The authenticated Play Console displayed the primary SHA-256 app-signing fingerprint:

```text
31:B2:FC:8A:C0:3D:9D:8A:A5:E1:9B:8B:76:85:12:8E:59:E1:61:BE:B4:EF:AE:61:BE:F8:2F:34:C8:46:AE:29
```

The official “Download certificates” archive `certificates.zip` contains `deployment_cert.der`. Independent DER decoding produced the same fingerprint; the certificate file SHA-256 is `31b2fc8ac03d9d8aa5e19b8b7685128e59e161beb4efae61bef82f34c846ae29`. The archive and local credentials are not committed.

The existing Vercel project was deployed to its production alias on November 9, 2026. Deployment ID: `dpl_22wQLbed9tagauwg7k9XnrmUN9u2`. At 08:47:25 UTC, an anonymous request to [the live statement](https://tangodjtool.vercel.app/.well-known/assetlinks.json) returned HTTP 200, `application/json; charset=utf-8`, and no redirect. The response exactly matched [the repository statement](../../public/.well-known/assetlinks.json), containing `app.tangodj.studio`, `delegate_permission/common.handle_all_urls`, and the provider certificate above. Response SHA-256: `26f83564cc9373c067d681a4dc50f3c3997b66535701e21197d905b020cca144`.

The application root, privacy page, and web manifest also returned HTTP 200 without redirects. Local and hosted production builds passed. This verifies the deployed association file. The Play-distributed build currently crashes before browser launch, so full-screen trusted launch remains unverified.

## Upload signing

The authenticated existing internal-testing draft was empty, and its official “Add from library” dialog displayed “No app bundles.” Following authorization to prepare an initial upload candidate, an isolated RSA-3072 key was generated with a cryptographically random password and generic Tango DJ Studio certificate identity. Existing key material was not overwritten. The private storage directory has mode `0700`; the keystore, private configuration, and candidate AAB have mode `0600` and are excluded from version control.

Accepted upload-certificate SHA-256:

```text
F7:CD:A3:29:D5:7C:D9:C8:F5:75:74:12:C9:4B:55:EE:18:A8:FA:2E:95:5C:47:CA:C9:51:9B:A9:48:42:C4:93
```

The existing environment-based release configuration built the candidate with `bundleRelease`, retaining version `0.1.0` and version code `1`. JAR signature verification passed, the embedded signing certificate matched the candidate certificate, and the AAB ZIP integrity check passed. The preflight at 08:51:26 UTC on November 9, 2026 passed 18 of 18 checks, including the live distribution-certificate association.

This upload certificate is distinct from the Play distribution certificate. The official Play UI accepted `tango-dj-studio-v1.aab`, displayed “Enhanced,” version `1 (0.1.0)`, API levels `24+`, and target SDK `36`, and enabled the next release step without a signing rejection. No upload-key replacement or reset was performed. The signed build was created from committed revision `4d94757cd67197c4a2e7d6baaef9001c7f971636`; subsequent commits changed release documentation only.

## Published internal test

The existing internal release was completed in the official Play Console on November 9, 2026. The review displayed two warnings: no testers were selected, and no deobfuscation file was attached. The latter is consistent with the existing `minifyEnabled false` configuration. No blocking error or signing rejection was displayed, and the “Save and publish” confirmation was completed.

The release then showed “Available to internal testers,” one version code, “Released on Nov 9 6:04 PM,” and “Not reviewed.” The temporary app name is `app.tangodj.studio (unreviewed)`.

A dedicated “Tango DJ Studio Internal” email list was created with the one authorized account and selected for this track. The existing 15-user list was preserved and remained unselected. After saving, the track changed to “Active,” and the Save control was disabled, reflecting the saved configuration. The authorized account accepted the official web invitation; the confirmation displayed “You’re a tester for app.tangodj.studio (unreviewed)” and offered “Download test app.” Google noted that first-time download availability can take a few minutes.

The saved English release notes are:

> Initial internal test release of Tango DJ Studio.
> Prepare music libraries, candidate sets and tandas; play local recordings and official YouTube embeds; import and export set metadata; save the workspace on this device.

This establishes actual internal-test publication and account opt-in. The Play-distributed binary was subsequently installed, but its native launcher crashes before the web application opens, as described below. Internal-test membership does not satisfy the separate closed-testing production-access requirement, and no production publication or Google review approval is claimed.

## Android installation and launch failure

The official Google Play application resolved `market://details?id=app.tangodj.studio` for the authorized tester and displayed the temporary unreviewed package name with an Install action. Installation completed, and the store displayed Uninstall and Open. Android package metadata confirmed version code `1`, version name `0.1.0`, minimum SDK `24`, target SDK `36`, and both installer and initiating package `com.android.vending`. This is a genuine Play installation, rather than a locally sideloaded debug artifact.

Launch attempts on an Android 16 / API 36 emulator failed before any web application interaction. The scoped Android crash buffer recorded the same exception for both attempts:

```text
java.lang.RuntimeException: Unable to start activity
app.tangodj.studio/com.google.androidbrowserhelper.trusted.LauncherActivity
Caused by: java.lang.IllegalArgumentException:
Component class com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity
 does not exist in app.tangodj.studio
```

The relevant call chain is `ManageDataLauncherActivity.addSiteSettingsShortcut` → `LauncherActivity.launchTwa` → `LauncherActivity.onCreate`. The current manifest lacks the required activity declaration. A successful build, upload, and prerequisite preflight did not detect this native runtime failure.

Device work stopped when an independent emulator was requested. Other installed applications, their data, and the Play account were preserved. No Tango web UI, file workflow, audio playback, storage recovery, or trusted full-screen behavior has been verified on this binary. Fixing the launcher and publishing a new internal version are required before further native validation.

## Launcher repair prepared

The launcher manifest now follows Google's [ManageDataLauncherActivity usage contract](https://github.com/GoogleChrome/android-browser-helper/blob/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/ManageDataLauncherActivity.java) and [basic TWA manifest example](https://github.com/GoogleChrome/android-browser-helper/blob/main/demos/twa-basic/src/main/AndroidManifest.xml): it declares the activity, sets the application's `manageSpaceActivity`, and provides `android.support.customtabs.trusted.MANAGE_SPACE_URL` for the existing HTTPS origin. The activity is not exported, matching the example's default visibility without an intent filter.

The corrected native candidate uses version `0.1.1`, version code `2`, the same application ID, and the existing accepted upload key. This configuration has not yet been validated by a new store upload or native launch. Native validation will use an independent Android emulator.

## Remaining release work

1. Correct the missing Android activity declaration, build and publish a new signed internal version with a new version code, and verify native launch on an independent emulator.
2. Verify trusted launch, file import/export, playback, rotation, storage recovery, and offline restart on the corrected Play-distributed build.
3. Retain the accepted upload key securely and provide the existing `TANGO_UPLOAD_*` environment variables for future builds. Password values must stay private; use a new version code for any later uploaded bundle.
4. Complete the remaining console declarations, support details, listing assets, and applicable closed-testing setup, then follow the actual production-access workflow.

See the [Google Play release plan](google-play-plan.md) and [listing text](store-listing.md). A passing build or preflight does not establish account eligibility, successful store upload, review approval, or publication.
