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

Build the app with the hook in release mode on both platforms (no dev client, Metro or dev menu,
and the navigation trace reaches the device log), then point the suite at a device through Appium:

Use `e2e/tools/run.sh <android|ios>`: it runs from a snapshot of `tests/` and `resources/`,
so editing the suite while a pass is in flight cannot change what that pass executes. Robot
reads a resource file when its suite starts, so a mid-run edit reaches the suites after it and
not the ones before, and the failures that follow belong to neither version of the file.

```sh
pip install -r e2e/requirements.txt
(cd apps/mobile/android && E2E_FIXTURES=1 APP_ENV=development ./gradlew assembleRelease)
(cd apps/mobile && E2E_FIXTURES=1 APP_ENV=development npx expo run:ios --configuration Release --device <simulator-udid> --no-bundler)
appium &                                     # the suite talks to a device through this
ANDROID_UDID=emulator-5554 OUT_DIR=e2e/results/android e2e/tools/run.sh android
IOS_UDID=<simulator-udid>  OUT_DIR=e2e/results/ios     e2e/tools/run.sh ios
python e2e/tools/parity.py e2e/results/android/output.xml e2e/results/ios/output.xml
python e2e/tools/flow_diff.py e2e/results/android/nav-flows.json e2e/results/ios/nav-flows.json
```

`SUITE=contacts` runs one suite instead of all of them.

- Start Appium first. Without it every case fails in `Suite Setup`, and a whole pass finishes in
  under a minute looking like the suite collapsed rather than like nothing was listening. The same
  wall of `Parent suite setup failed` is what a device dying mid-pass leaves behind, which is why
  `e2e/tools/flaky.py` refuses to compare a pass where most cases failed there: those are not verdicts
  about the cases.

- Set `APP_ENV` explicitly: a local `.env.local` may say `production`, and Metro refuses to bundle
  the hook for production.
- Build iOS through `expo run:ios`: an unsigned `xcodebuild` (`CODE_SIGNING_ALLOWED=NO`) drops the
  keychain entitlements and the app hangs on its splash screen.
- A dev client also works: pass `--variable IOS_DEV_CLIENT_URL:<its exp+... link>` so relaunches
  reconnect to Metro. Its `console.log` goes to Metro only, so the navigation trace is empty there.

Adapters read `APPIUM_URL`, `ANDROID_UDID`, `ANDROID_PACKAGE`, `ANDROID_SYSTEM_PORT`, `IOS_UDID`,
`IOS_WDA_PORT`, `IOS_BUNDLE_ID` and `IOS_DEV_CLIENT_URL` as Robot variables
(`--variable NAME:value`). Several devices can run at once: give each Android device its own
`ANDROID_SYSTEM_PORT` and each simulator its own `IOS_WDA_PORT`. Credentials for a device cloud go
in the CI secret store and reach the run as environment variables; never commit them here.

## Navigation trace

E2E builds log every screen mount/unmount, focus/blur and app foreground/background
(`apps/mobile/src/modules/deeplink/handlers/e2eNavTracer.ts`). `e2e/resources/libraries/NavTrace.py`
reads it after each test, warns on a screen pushed twice, a screen left mounted after a fixture
reset, or focus bouncing straight back, and writes each scenario's flow to `nav-flows.json`.
`e2e/tools/flow_diff.py` lists scenarios whose Android and iOS flows differ. `Load Fixture` waits on the
tracer's post-reset snapshot instead of a fixed delay.

## Scenario identity

Every case carries an `id:<area>.<behaviour>` tag. The ID is what the parity matrix compares across
platforms, so keep it when renaming a case and never reuse one for a different behaviour.
`e2e/tools/parity.py` fails unless every scenario passed on both platforms.

## Checking the tooling itself

`e2e/tools/` carries the comparisons a release decision leans on, so they have their own tests:

```sh
e2e/.venv/bin/python e2e/tools/test_parity.py
e2e/.venv/bin/python e2e/tools/test_nav_trace.py
```

Each file runs its own checks under `__main__` rather than through pytest, which is not in
`requirements.txt`: written pytest-style they import cleanly, exit 0, and assert nothing.

`e2e/tools/flaky.py` takes two or more passes of the same platform and names the cases whose verdict
changed between them. A case that is green twice is not yet proof of anything, but one that
changes is a defect in the test, the app, or the device — and worth finding before CI does.
