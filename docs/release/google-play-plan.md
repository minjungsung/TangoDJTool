# Google Play release plan

## Product and architecture

Keep the existing product name, Tango DJ Studio. The initial Android build uses Google's Trusted Web Activity (TWA) and Android Browser Helper to run the HTTPS website in a supported browser. This preserves official YouTube embeds and site-origin storage; a WebView origin would change playback and storage behavior. The launcher does not add a separate music engine or background-playback guarantee.

The installable web manifest and service worker cache the application shell after a successful online launch. Imported audio remains in IndexedDB. YouTube playback still requires a network connection. Updates wait for a later app launch rather than reloading a running set.

The provisional Android application ID is `app.tangodj.studio`; confirm its availability before first publication. Compile and target SDK are Android 16 / API 36. The launcher opens `https://tangodjtool.vercel.app/` in any orientation. Full-screen trusted launch requires Digital Asset Links at that origin for the Play app-signing certificate. Until that verification passes, the browser may show a Custom Tab toolbar.

## Work sequence

1. Prepare the web manifest, icons, offline app shell, privacy page, Android launcher, reproducible Gradle wrapper, and store listing drafts.
2. Build debug APK and unsigned release AAB; run Android lint and web offline/regression tests. Exercise a physical Galaxy before a production release.
3. Create the Play Console app draft using the existing developer account. Confirm application ID, developer contact, app access, content rating, ads declaration, target audience, and Data safety answers.
4. Configure Play App Signing. Keep the upload key outside Git; provide signing values through environment variables. Use the Play app-signing certificate to generate and deploy `/.well-known/assetlinks.json`.
5. Upload the signed AAB to internal testing. Test installation, launch verification, file picker, playback, fades, queue transitions, import/export, rotation, storage recovery, offline restart, and links on actual devices.
6. Resolve test failures, then select the account's available closed/production tracks. Personal accounts created after November 13, 2023 require at least 12 testers continuously opted in for 14 days before applying for production access. Existing account requirements must be checked in Console; do not assume this rule applies to every account.
7. Submit the reviewed release. Store acceptance and review duration are controlled by Google.

## Build

Install JDK 17 and an Android SDK with API 36 and Build Tools 36.0.0. Configure `JAVA_HOME` and `ANDROID_HOME` in your environment; do not commit `local.properties` or workstation paths.

```sh
npm ci
npm run build
cd android
./gradlew assembleDebug bundleRelease lint
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Unsigned release bundle: `android/app/build/outputs/bundle/release/app-release.aab`. An unsigned bundle is a build result, not a Play-uploadable release.

Set `TANGO_UPLOAD_KEYSTORE`, `TANGO_UPLOAD_STORE_PASSWORD`, `TANGO_UPLOAD_KEY_ALIAS`, and `TANGO_UPLOAD_KEY_PASSWORD` to build a signed release. Do not share private keys or passwords in chat or source files. After Play App Signing provides its certificate:

```sh
TANGO_APP_SIGNING_SHA256='AA:BB:...' node scripts/android-assetlinks.mjs
npm run build
```

Use the full 32-byte fingerprint, not the illustrative abbreviated value. Deploy the resulting JSON at the HTTPS app origin with a successful JSON response and no redirect. Never substitute an upload certificate for the Play distribution certificate.

## Review limits and required inputs

Store support email and final developer identity must come from the actual account. The privacy policy links to the public project support page and describes local storage, Vercel hosting, Google Fonts, and YouTube requests. Review external-provider data practices before submitting Data safety; do not declare “no data collected” solely because local audio is not uploaded.

No music files are bundled or downloaded. The sample pack uses official YouTube embeds. Do not represent the app as affiliated with YouTube, Google, or other tango DJ products. Avoid claims of reliable mobile YouTube fading, background playback, independent headphone monitoring, or guaranteed live-event suitability.

## Official references (checked October 16, 2026)

- [Trusted Web Activity overview](https://developer.chrome.com/docs/android/trusted-web-activity/overview)
- [Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper)
- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en): new submissions target API 36 from August 31, 2026.
- [Personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
