# Device end-to-end tests

One Robot Framework suite runs on Android and iOS. Scenarios and shared keywords live in `tests/`
and `resources/`; everything that differs by platform (session capabilities, deeplink delivery,
sheet dismissal, tab selectors) lives in `resources/platforms/`. A test never branches on the
platform: add the difference to both adapters instead.

Locate a view by its testID with `tid=<id>` (`resources/libraries/PeraAppiumLibrary.py`). Android
resolves it natively; iOS keeps an XPath lookup, the only one WDA makes wait for animations to
finish. Write XPath yourself only for what a testID cannot say: prefixes, siblings, text and
several IDs at once.

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
robot --exclude slow --variable PLATFORM:android --outputdir e2e/results/android e2e/tests
robot --exclude slow --variable PLATFORM:ios --outputdir e2e/results/ios e2e/tests
python e2e/tools/parity.py e2e/results/android/output.xml e2e/results/ios/output.xml
python e2e/tools/flow_diff.py e2e/results/android/nav-flows.json e2e/results/ios/nav-flows.json
```

- Run Appium 3.5.2 with UiAutomator2 8.1.1 and XCUITest 12.0.0, the versions BrowserStack runs for
  the `appiumVersion` in `browserstack-<platform>.yml`, so a case behaves the same on both.
- Keep the device at its default font and display size. A larger one pushes rows below the fold,
  where UiAutomator does not report them until scrolled to.

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

## BrowserStack

`e2e/tools/browserstack.sh <android|ios> <bs:// app id, .apk or .ipa> [robot args]` runs the suite on
BrowserStack App Automate with the device and options in `browserstack-<platform>.yml`. It needs
`BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY` and a venv from `requirements-browserstack.txt`;
an `.ipa` must be patched by `tools/qa/patch-ipa-for-browserstack.sh` first.

- Each suite runs in its own SDK process: the SDK kills any process at one hour whatever
  `--processtimeout` says, and every case left in it then reports an error.
- The verdict comes from the result files (`tools/qa/smoke-verdict.sh`), not the SDK's exit code,
  which has reported success for a failed run.
- Cases tagged `device-shell` need `adb` or `simctl` on the machine that runs Robot. A cloud device
  is not attached to it, so those cases run only locally.
- An `.apk` or `.ipa` is uploaded under a custom id derived from its content, so a later run with the
  same file reuses the upload instead of sending it again.
- `E2E_PARALLEL=<n>` runs n suites at once, each in its own session. The plan's parallel limit is
  shared by every run on the account, the release smoke gates included: past it sessions queue, and
  past the queue they are refused.
- `E2E_DEVICE="<device name>@<os version>"`, spelled as BrowserStack's device list spells them, runs
  on another device than the one in `browserstack-<platform>.yml`.
- Failure screenshots are embedded in `log.html`; the session's Appium and device logs are on its
  BrowserStack dashboard page.

The release smoke gate (`tools/qa/smoke-test.sh`) runs the `release-gate` case this way, and the
"E2E / BrowserStack" workflow runs the whole suite against uploaded E2E builds.

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
