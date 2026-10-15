# Device end-to-end tests

One Robot Framework suite runs on Android and iOS. Scenarios and shared keywords live in `tests/`
and `resources/`; everything that differs by platform (session capabilities, deeplink delivery,
sheet dismissal, tab selectors) lives in `resources/platforms/`. A test never branches on the
platform: add the difference to both adapters instead.

## Fixtures

Each case starts from a named app state loaded through
`perawallet://app/dev/e2e-fixture?name=<fixture>`, so any case can run or retry alone. The hook
is compiled into a bundle only when `E2E_FIXTURES=1` is set at bundle time, and Metro refuses to
build a production bundle with it (`apps/mobile/metro-build-gates.js`). In every other build the
link falls through to Home.

The fixture hook accepts a fixture name, never data. It refuses the URL from in-app sources (QR
scan, webview, banner, push), and never creates accounts or handles key material; wallet creation
stays a UI journey in `Start Pera With Wallet`.

The build is the security boundary, not the link source: in an E2E build any web page in the
system browser or any other installed app can fire the link and replace contacts. Build E2E
bundles only for test devices, never on a lane that uploads to TestFlight, Firebase or a store.
Fixtures also flow into Cloud Backup if it is on, so keep test wallets off real backup accounts.

Fixture names and their data are defined in
`apps/mobile/src/modules/deeplink/handlers/useE2eFixtureDeeplink.ts`, and
`resources/contacts.resource` mirrors the values the tests assert on. Change both together.

## Running

Bundle with the hook, then point the suite at a device through Appium:

```sh
pip install -r e2e/requirements.txt
# Android: a release-mode APK embeds the bundle, so no dev client, Metro or dev menu is involved
(cd apps/mobile/android && E2E_FIXTURES=1 APP_ENV=development ./gradlew assembleRelease)
# iOS simulator: a dev client served by Metro with the hook bundled in
E2E_FIXTURES=1 APP_ENV=development pnpm --filter mobile start
robot --variable PLATFORM:android --outputdir e2e/results/android e2e/tests
robot --variable PLATFORM:ios --outputdir e2e/results/ios e2e/tests
python e2e/tools/parity.py e2e/results/android/output.xml e2e/results/ios/output.xml
```

Set `APP_ENV` explicitly: a local `.env.local` may say `production`, and Metro refuses to bundle
the hook for production.

Adapters read `APPIUM_URL`, `ANDROID_UDID`, `ANDROID_PACKAGE`, `ANDROID_SYSTEM_PORT`, `IOS_UDID` and
`IOS_BUNDLE_ID` as
Robot variables (`--variable NAME:value`). Credentials for a device cloud go in the CI secret
store and reach the run as environment variables; never commit them here.

## Scenario identity

Every case carries an `id:<area>.<behaviour>` tag. The ID is what the parity matrix compares across
platforms, so keep it when renaming a case and never reuse one for a different behaviour.
`tools/parity.py` fails unless every scenario passed on both platforms.
