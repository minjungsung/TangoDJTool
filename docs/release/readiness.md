# Tango DJ Studio release readiness

Last checked: November 9, 2026, 10:52 UTC for the submitted review state.

## Confirmed product

The existing product is Tango DJ Studio, using Android application ID `app.tangodj.studio`, initial internal version `0.1.0` / version code `1`, and target SDK `36`. The launcher repair is published to internal testing as version `0.1.1` / version code `2`. Its Android launcher is a Trusted Web Activity for `https://tangodjtool.vercel.app/`. The repository also supplies an installable web application; it does not currently contain an iOS project or Expo/EAS configuration.

The reviewed web snapshot is committed revision `3556887cf895300517ec9892dd5e4bc07afa9c67`, following the reviewed DJ workflow merge into `main`. Its production build and submitted phone screenshots were verified from a temporary Git archive of that revision. Concurrent application edits in the shared checkout were preserved and excluded from this release snapshot. Native version 2 provenance is recorded separately below. A later anonymous check found that the production alias serves a newer asset set; this evidence pass does not verify those later web revisions.

## Completed preparation

- Production web build passed and generated the application service worker and manifest.
- Android `assembleDebug`, `bundleRelease`, and `lintRelease` passed with JDK 17, Android SDK Platform 36, and the build tools selected by Android Gradle Plugin 8.13.0. Release lint reported four warnings and no errors.
- App icons are 512 × 512, 192 × 192, and maskable 512 × 512. The feature graphic is 1024 × 500.
- Four current phone screenshots replace the obsolete listing images. They show Music, Playback, Sets, and Tandas at 1080 × 1920 pixels, cropped from actual 1080 × 2400 Android emulator captures without changing the app layout. See the [capture manifest](assets/capture-manifest.json) for source, original-image hashes, cropping coordinates, upload names, and actual Console order. These verify the production website in Android Chrome; they do not establish a Play-installed version 2 launch or physical audio behavior.
- Store text now describes the current four work areas. App name, short description, and full description fit Google's respective 30, 80, and 4,000 character limits.
- `npm run android:preflight` checks local identity, bundle signature integrity, provider-certificate input, Digital Asset Links, image dimensions, screenshot source/image hashes, listing length, and the cached web shell. The current exact-source run with `--check-site` passed all 18 checks at 10:46:09 UTC on November 9, using the existing JDK 17, accepted version 2 AAB, current phone captures, and genuine distribution fingerprint. The [preflight report](preflight-report.json) records the archive context; its source digest is `7af50dc405c5d87efaadb8ccdff6472edce980ba670b4eb9cebb2db258593013`. This resolves the earlier version 2 screenshot-provenance failure. Device behavior is verified separately below.
- The Digital Asset Links generator preserves unrelated statements and existing certificate fingerprints. A temporary-directory verification confirmed preservation, idempotence, and refusal to replace invalid JSON.

## Build artifacts

| Artifact | Repository-relative location | SHA-256 | State |
| --- | --- | --- | --- |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | `0bf93016490a0f40dc5a012fe831bba486da701091e302e0e76b9b81a714f128` | Debug build; not a store release |
| Internal version 2 AAB | `android/app/build/outputs/bundle/release/app-release.aab` | `b81ae444927a8045ff3fb3059bc429f6192beec5d7a6bf09d964dfebf484666c` | Accepted and published to active internal testing; Play-installed version 2 not yet verified |
| Local version 2 APK | `android/app/build/outputs/apk/release/app-release.apk` | `3e4385b7f9468eecad12c207634bd3a1fcb2b21a77c62665a5442731443a54ac` | Local upload-key signature; successful basic launch and workspace smoke test |

The earlier unsigned AAB had SHA-256 `2ac62aa7a7b3755d66918dc9274c1eaa1d356b4838695c482e07f42d75e48901`. The first signed internal AAB had SHA-256 `bf64b55e88f0b9cb8480bc971b9f097354ba26aaf960a2ac751946f1a3361418`. Rebuilding the native launcher for version 2 changed the bundle and its hash. Keep private signing material outside version control and never place passwords in documentation or command output.

## Authenticated Play Console state

The initial authenticated console inspection on November 9 confirmed the existing Tango app and package identity. Setup showed 8 of 11 items complete; internal testing showed 1 of 3 items complete. The developer account was Personal, production was unavailable, and the dashboard showed zero opted-in testers against the requirement for 12 testers continuously opted in for 14 days of closed testing.

Play App Signing displayed “In use.” The official downloaded deployment certificate matches the primary app-signing fingerprint recorded below. This establishes the distribution certificate, not possession or identity of the upload key.

That observed production gate remains active until the actual account satisfies Google's requirements or Google approves a genuine account change and presents different requirements. No production release or review approval has been established.

A fresh Account details → About you inspection still showed Account type “Personal,” an enabled “Change account type” control, and an unset trader status. The official trader declaration was opened for the authorized service operation. Its review screen requires consent to display the payments-profile legal identity and developer contacts publicly, plus certification to offer only products or services that comply with local laws. A private comparison found that the draft legal name, public phone, and address differ from the intended verified public operator fields; the representative and support email match. The declaration was not saved, pending the owner's choice or legitimate profile correction. The official organization-verification notice separately requests a genuine South Korean document in JPEG, PDF, or PNG format, up to 10 MB; no document was uploaded. No approved organization conversion is established.

The remaining app setup was completed in the official Console: Music & Audio category, user-authorized support email, production website, default English listing, four actual phone screenshots, and Data safety. Existing content ratings, adult target audience, ads declaration, and other completed declarations were preserved. The ads declaration already correctly says the app contains ads.

The completed Data safety questionnaire includes approximate location, app interactions, and device or browser identifiers collected and shared through optional YouTube features. These data are declared non-ephemeral, with provider functionality, analytics, advertising, security, and personalization purposes, consistent with Google's published privacy practices. The app uses HTTPS and has no app account creation or external-account login. Local audio and workspace remain on the device. No developer-operated deletion-request service was asserted. The privacy policy explicitly describes the providers, browser storage deletion, external privacy controls, and possible YouTube advertisements.

## Deployed Digital Asset Links

The authenticated Play Console displayed the primary SHA-256 app-signing fingerprint:

```text
31:B2:FC:8A:C0:3D:9D:8A:A5:E1:9B:8B:76:85:12:8E:59:E1:61:BE:B4:EF:AE:61:BE:F8:2F:34:C8:46:AE:29
```

The official “Download certificates” archive `certificates.zip` contains `deployment_cert.der`. Independent DER decoding produced the same fingerprint; the certificate file SHA-256 is `31b2fc8ac03d9d8aa5e19b8b7685128e59e161beb4efae61bef82f34c846ae29`. The archive and local credentials are not committed.

The reviewed free production deployment was `dpl_At1fffM47FfdXEmAhcjLREsiDTKH`, at the existing [production website](https://tangodjtool.vercel.app/). The authenticated official Vercel API confirmed `READY`, production target, and Git revision `3556887cf895300517ec9892dd5e4bc07afa9c67`. Anonymous requests verified the root, matching privacy page, JavaScript/CSS assets, and [live association](https://tangodjtool.vercel.app/.well-known/assetlinks.json). The association exactly matches [the repository statement](../../public/.well-known/assetlinks.json), containing `app.tangodj.studio`, `delegate_permission/common.handle_all_urls`, and the provider certificate above. Response SHA-256: `26f83564cc9373c067d681a4dc50f3c3997b66535701e21197d905b020cca144`. No paid build configuration was selected.

A subsequent anonymous check on November 9 found later `index`, `storage`, and preload-helper JavaScript assets at the production alias. The privacy and Digital Asset Links response hashes remained unchanged. The [capture manifest](assets/capture-manifest.json) records this observation separately; the screenshots and 18-check preflight remain evidence for the reviewed snapshot, not for the later assets.

The Settings privacy link and Console policy now both use `https://tangodjtool.vercel.app/privacy.html`. Actual Android navigation initially exposed a stale service-worker client. Closing only the two owned Tango browser tabs let the pending update activate, without clearing the workspace. A repeated Settings → Privacy policy action then opened the current HTTPS policy, dated November 9, 2026, with the explicit provider-data and advertising disclosures. Anonymous policy response SHA-256: `8e94050bc1fead4901415329e7d8f013d9f51f6e1388dcb23eb08c7f2fd540fd`.

The application root, privacy page, and web manifest also returned HTTP 200 without redirects. Local and hosted production builds passed. This verifies the deployed association file. The first Play-distributed version crashed before browser launch. The corrected local version launches successfully, while full-screen trusted launch of Play-distributed version 2 remains unverified.

## Upload signing

The authenticated existing internal-testing draft was empty, and its official “Add from library” dialog displayed “No app bundles.” Following authorization to prepare an initial upload candidate, an isolated RSA-3072 key was generated with a cryptographically random password and generic Tango DJ Studio certificate identity. Existing key material was not overwritten. The private storage directory has mode `0700`; the keystore, private configuration, and candidate AAB have mode `0600` and are excluded from version control.

Accepted upload-certificate SHA-256:

```text
F7:CD:A3:29:D5:7C:D9:C8:F5:75:74:12:C9:4B:55:EE:18:A8:FA:2E:95:5C:47:CA:C9:51:9B:A9:48:42:C4:93
```

The existing environment-based release configuration built the candidate with `bundleRelease`, retaining version `0.1.0` and version code `1`. JAR signature verification passed, the embedded signing certificate matched the candidate certificate, and the AAB ZIP integrity check passed. The preflight at 08:51:26 UTC on November 9, 2026 passed 18 of 18 checks, including the live distribution-certificate association.

This upload certificate is distinct from the Play distribution certificate. The official Play UI accepted `tango-dj-studio-v1.aab`, displayed “Enhanced,” version `1 (0.1.0)`, API levels `24+`, and target SDK `36`, and enabled the next release step without a signing rejection. No upload-key replacement or reset was performed. The signed build was created from committed revision `4d94757cd67197c4a2e7d6baaef9001c7f971636`; subsequent commits changed release documentation only.

## Published internal tests

The existing internal release was completed in the official Play Console on November 9, 2026. The review displayed two warnings: no testers were selected, and no deobfuscation file was attached. The latter is consistent with the existing `minifyEnabled false` configuration. No blocking error or signing rejection was displayed, and the “Save and publish” confirmation was completed.

The release then showed “Available to internal testers,” one version code, “Released on Nov 9 6:04 PM,” and “Not reviewed.” The temporary app name is `app.tangodj.studio (unreviewed)`.

A dedicated “Tango DJ Studio Internal” email list was created with the one authorized account and selected for this track. The existing 15-user list was preserved and remained unselected. After saving, the track changed to “Active,” and the Save control was disabled, reflecting the saved configuration. The authorized account accepted the official web invitation; the confirmation displayed “You’re a tester for app.tangodj.studio (unreviewed)” and offered “Download test app.” Google noted that first-time download availability can take a few minutes.

The saved English release notes are:

> Initial internal test release of Tango DJ Studio.
> Prepare music libraries, candidate sets and tandas; play local recordings and official YouTube embeds; import and export set metadata; save the workspace on this device.

This establishes actual internal-test publication and account opt-in. The Play-distributed binary was subsequently installed, but its native launcher crashes before the web application opens, as described below. A corrected second internal release subsequently succeeded. Internal-test membership does not satisfy the separate closed-testing production-access requirement, and no production publication or Google review approval is claimed.

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

The relevant call chain is `ManageDataLauncherActivity.addSiteSettingsShortcut` → `LauncherActivity.launchTwa` → `LauncherActivity.onCreate`. The version 1 manifest lacked the required activity declaration. A successful build, upload, and prerequisite preflight did not detect this native runtime failure.

Device work stopped when an independent emulator was requested. Other installed applications, their data, and the Play account were preserved. No Tango web UI, file workflow, audio playback, storage recovery, or trusted full-screen behavior has been verified on this binary. The launcher was subsequently corrected and a new internal version published, as recorded below.

## Launcher repair and version 2 validation

The launcher manifest now follows Google's [ManageDataLauncherActivity usage contract](https://github.com/GoogleChrome/android-browser-helper/blob/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/ManageDataLauncherActivity.java) and [basic TWA manifest example](https://github.com/GoogleChrome/android-browser-helper/blob/main/demos/twa-basic/src/main/AndroidManifest.xml): it declares the activity, sets the application's `manageSpaceActivity`, and provides `android.support.customtabs.trusted.MANAGE_SPACE_URL` for the existing HTTPS origin. The activity is not exported, matching the example's default visibility without an intent filter.

The corrected native version uses `0.1.1`, version code `2`, the same application ID, and the existing accepted upload key. `assembleRelease`, `bundleRelease`, and `lintRelease` passed. The built APK manifest contains the required activity and manage-space metadata; JAR signature integrity and the unchanged upload-certificate identity were verified.

Native source provenance is committed revision `aba7854900dd0602201fd2731bb3ac712e2c86ea`, with digest `8996e86a9f3a5dcc53e1d44abf0c05f778abfd65cde9feb34f750723ad498d22` over sorted tracked Android paths and their SHA-256 hashes. The Android subtree was clean when built. Concurrent web-source edits did not enter this TWA launcher binary. The original version 2 preflight passed 17 of 18 checks because earlier web captures were stale; the current 18-of-18 run above verifies the refreshed source and image provenance.

The official Play UI accepted `tango-dj-studio-v2.aab` as “Enhanced,” version `2 (0.1.1)`, API levels `24+`, and target SDK `36`. Review displayed only the deobfuscation-file warning and no blocking error. The new internal release excluded version 1. After the official publish confirmation, the track showed “Active,” latest release `2 (0.1.1)`, “Available to internal testers,” “Released on Nov 9 6:32 PM,” and “Not reviewed.”

The saved version 2 release notes are:

> Fixes an Android startup crash caused by a missing browser settings activity.

The corrected local APK was installed on an independent Android 16 / API 36 emulator. Package metadata confirmed version `2` / `0.1.1`, minimum SDK `24`, target SDK `36`, and initiating package `com.android.shell`, distinguishing this local installation from the earlier Play installation. Chrome's first-launch screen was completed using its account-free option; the Tango workspace then rendered at the configured production HTTPS origin. Music search found `Poema`, a candidate set was created, the set remained after native relaunch, and only the smoke-test set was removed afterward. The existing demo collections were preserved.

See the [native local launch screenshot](assets/native-local-launch-v2.png), captured through the session-bound device tool at 1080 × 2400 pixels. Image SHA-256: `1de5eb4e4ba7ea487feb10b6c7e3cad62a99219409ffe77674a6a2f7661d468a`. It is authentic local-version evidence, separate from the four store-listing web captures. Chrome's toolbar is visible because this APK uses the upload certificate, while the live association contains Google's distribution certificate.

The independent device's Play Store still requires account sign-in. Play-distributed version 2 installation, verified full-screen launch, physical audio output, file picker workflows, and exhaustive native regression tests remain unverified. The confirmed second internal rollout does not establish production access or review approval.

## Closed release submitted for review

The existing Alpha closed-testing track was prepared through the official Console. Availability is limited to South Korea, and only the existing one-user authorized test list is selected. The separate legacy 15-user list was preserved and left unselected. The user-authorized support address is the feedback channel. No invitations or outreach messages were sent.

The accepted version `2 (0.1.1)` was selected from the official bundle library without another upload or signing-key change. Version 1 was excluded. Release validation displayed one warning about the absent deobfuscation file, consistent with `minifyEnabled false`, and no blocking error. The English notes identify the closed test, local workspace and playback features, and corrected startup crash.

The final official “Send changes for review” confirmation submitted 14 changes, including the closed release, country availability, owner-only testers, current English listing, matching privacy URL, and Data safety. Publishing overview initially displayed running quick checks. At 10:52 UTC, it displayed “Changes in review” and “Your changes are now in review. We may find additional issues when reviewing your app.” The quick-check countdown was gone. This establishes the actual review state; it does not establish approval, active closed distribution, tester opt-in, or production publication.

The dashboard still requires 12 genuine closed-test opt-ins maintained for 14 continuous days before the production-access application. The last confirmed count is zero. Internal-test membership is separate.

## Remaining release work

1. Connect the authorized tester account to Play on the independent device and install the published version 2 through the official store.
2. Verify trusted launch, file import/export, playback, rotation, storage recovery, and offline restart on that Play-distributed build.
3. Retain the accepted upload key securely and provide the existing `TANGO_UPLOAD_*` environment variables for future builds. Password values must stay private; use a new version code for any later uploaded bundle.
4. Monitor Google's review decision and verify that an approved closed release becomes available. Only then verify genuine opt-in and the actual continuous-testing period; satisfy the 12-tester/14-day gate before applying for production access.
5. Have the account owner complete the official trader consent and certification; complete any required genuine organization-document verification through the official account flow.
6. Review later web-source changes and refresh release evidence when those changes require it. Do not treat this committed release snapshot as verification of later revisions.

See the [Google Play release plan](google-play-plan.md) and [listing text](store-listing.md). A passing build or preflight does not establish account eligibility, successful store upload, review approval, or publication.
