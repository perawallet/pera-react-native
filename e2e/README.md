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
Both runners retain the snapshot under the results directory's `suite-snapshot/`, so a failed
run can be reproduced after editing the working tree. Default result directories are unique;
`E2E_RESULTS_DIR` chooses an explicit, empty directory and `E2E_VENV` chooses a harness venv.
Each test has a five-minute timeout; override it with `E2E_TEST_TIMEOUT="10 minutes"` or Robot's
`--variable E2E_TEST_TIMEOUT:"10 minutes"` for longer journeys.

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
`ANDROID_SYSTEM_PORT` and each simulator its own `IOS_WDA_PORT`. `run.sh` takes a free port for
each run unless the environment names one: a run killed mid-way leaves its UiAutomator2 server or
WebDriverAgent on the adapter's default port, which otherwise fails every suite of the next run. Credentials for a device cloud go
in the CI secret store and reach the run as environment variables; never commit them here.

## BrowserStack

`e2e/tools/browserstack.sh <android|ios> <bs:// app id, .apk or .ipa> [robot args]` runs the suite on
BrowserStack App Automate with the device and options in `browserstack-<platform>.yml`. It needs
`BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY` and a venv from `requirements-browserstack.txt`;
an `.ipa` must be patched by `tools/qa/patch-ipa-for-browserstack.sh` first.

- Each planned job runs in its own SDK process: the SDK kills any process at one hour whatever
  `--processtimeout` says, and every case left in it then reports an error. Job budgets below are
  duration estimates, not a replacement for the test timeouts or the SDK's process limit.
- Robot filters suites before opening cloud sessions. A selected suite with no result fails the
  run even if the other suites pass; `.incomplete` keeps the release gate from accepting partial
  results. Each run requires an empty results directory so stale XML cannot count as a pass.
  `selection.json` records the selected scenarios; each must appear exactly once in the results,
  catching an SDK process that stops midway through a suite.
- The verdict comes from the result files (`tools/qa/smoke-verdict.sh`), not the SDK's exit code,
  which has reported success for a failed run.
- Cases tagged `device-shell` need `adb` or `simctl` on the machine that runs Robot. A cloud device
  is not attached to it, so those cases run only locally.
- An `.apk` or `.ipa` is uploaded under a custom id derived from its content, so a later run with the
  same file reuses the upload instead of sending it again.
- `E2E_PARALLEL=<n>` runs n jobs at once. The plan's parallel limit is
  shared by every run on the account, the release smoke gates included: past it sessions queue, and
  past the queue they are refused.
- `E2E_DEVICE="<device name>@<os version>"`, spelled as BrowserStack's device list spells them, runs
  on another device than the one in `browserstack-<platform>.yml`.
- Failure screenshots are embedded in `log.html`; the session's Appium and device logs are on its
  BrowserStack dashboard page.

The release smoke gate (`tools/qa/smoke-test.sh`) runs the `release-gate` case this way, and the
"E2E / BrowserStack" workflow runs the whole suite against uploaded E2E builds.

## Adaptive scheduling and warm sessions

The runner selects scenarios first, then plans their execution. Scheduling never skips a selected
scenario: the final XML must contain every selected identity exactly once, regardless of job layout.
`plan.json` records job boundaries and estimates alongside the original `selection.json`.

- Jobs start longest first, using the median of the last five successful timing samples per
  scenario. Android, iOS and device overrides have separate timing contexts. Missing or corrupt
  history falls back to 45 seconds per test plus 90 seconds per suite setup/teardown; these defaults
  are estimates, not benchmark results. Failed, skipped and near-zero test samples are excluded.
- `E2E_JOB_SECONDS=900` sets the target job duration, with a maximum target of 1800 seconds to leave
  headroom under the SDK limit. Swap and Multisig can split into independent case groups. Every
  group retains the original suite setup/teardown, and cases stay in their original order.
  Other suites, and individual cases larger than the target, stay intact and are marked over budget.
- `E2E_SESSION_REUSE=1` experimentally packs compatible small suites into warm jobs. The allowlist in
  `e2e/tools/schedule.py` covers assets, card, discover, onramp, send/receive and transactions; the
  assets, send/receive and transactions suites import the funded account. All other suites remain
  isolated, including PIN/security, preferences, backup and account creation.
  Reuse is off by default pending real device validation.
- Warm jobs use [Pabot's chunk mode](https://docs.robotframework.org/docs/parallel) so their suites
  execute in the same Robot process. They retain the Appium session and wallet, while each scenario
  still enters through its own fixture/home setup. The first suite launches normally; the job
  closes its session at the end. A failed suite closes its session immediately so the next suite
  launches normally instead of inheriting a possibly broken session.
- `.cache/timings-<platform>.json` is a timing cache, never a result cache. CI restores and saves it
  between runs. `run-metrics.json` and `run-metrics.md` record actual job wall times and overall
  scheduler wall time; the workflow also puts the table in its job summary. SDK wall time includes
  allocation/startup and must not be presented as billed device time.

Preview a plan without devices, cloud credentials or uploads:

```sh
E2E_PARALLEL=2 e2e/tools/plan.sh android
E2E_PARALLEL=2 E2E_SESSION_REUSE=1 e2e/tools/plan.sh android --include cardORdiscover
```

The workflow's `profile=critical` runs p0 journeys, while `profile=full` runs the normal full cloud
selection. To run the affected-flow expression from a PR, use `profile=full` and `include=<expression>`.
Critical and a custom include are mutually exclusive, so Robot's OR semantics cannot accidentally
broaden the selection. The existing release smoke gate still selects its one `release-gate` journey.

The workflow can be called by a native build workflow on main with freshly uploaded `android_app`
and/or `ios_app` IDs and the BrowserStack secrets. It does not automatically test an old build on
every source push. The nightly schedule (02:17 UTC) stays dormant until repository variables
`E2E_ANDROID_APP` and/or `E2E_IOS_APP` name uploaded E2E builds; keep those variables updated from
the native build pipeline. Nightly runs test those configured builds, not an assumed current commit.
No app is built or uploaded by the schedule itself.

Compare cold and warm runs against the same app IDs, devices and selected scenarios before enabling
reuse by default. Compare both elapsed time and failures; a quicker run with missing scenarios is
always rejected by the result verifier.

## Which suites a change affects

`python e2e/tools/affected_flows.py` maps the files changed since `origin/main` (or `--files -`,
one path per line) onto the suites in `tests/` and prints the `--include` expression that runs
them. A path counts three ways, from the most exact to the coarsest: a testID the changed source
declares that a suite locates; the app module or package the path belongs to (the tables in the
script); and paths every screen depends on (navigation, bootstrap, native projects, the harness
itself), which select the whole suite. Unmapped runtime modules, packages and shared mobile source
also select every suite until a mapping is added. Docs, the browser app and unit tests select nothing. The
pre-merge CI posts the result on every pull request, so the reviewer sees which device flows to
run before merging; `--format json` feeds a script. When a module or package gets a suite, or a
suite starts covering a new module, extend the tables in the script and its test.
Pass `--base <ref>` with `--files` to include testIDs removed or renamed since that ref. CI includes
both sides of a file rename and reads the PR base revision, so deleted source still selects its flows.

## Navigation trace

E2E builds log every screen mount/unmount, focus/blur and app foreground/background
(`apps/mobile/src/modules/deeplink/handlers/e2eNavTracer.ts`). `e2e/resources/libraries/NavTrace.py`
reads it after each test, warns on a screen pushed twice, a screen left mounted after a fixture
reset, or focus bouncing straight back, and writes each scenario's flow to `nav-flows.json`.
`e2e/tools/flow_diff.py` lists scenarios whose Android and iOS flows differ. `Load Fixture` waits on the
tracer's post-reset snapshot instead of a fixed delay.
Flow comparison also fails for missing traces and nonpassing scenarios. Empty trace files cannot
establish platform parity.

## Scenario identity

Every case carries an `id:<area>.<behaviour>` tag. The ID is what the parity matrix compares across
platforms, so keep it when renaming a case and never reuse one for a different behaviour.
`e2e/tools/parity.py` fails unless every scenario passed on both platforms.
Missing, multiple or duplicate scenario IDs fail validation rather than replacing another result.

## Checking the suite without a device

Install `e2e/requirements-dev.txt`, then run `e2e/tools/check.sh`. The pre-merge **E2E harness checks**
job runs this command: helper and runner regression tests, scenario identity/priority/timeout
contracts, and dry runs against both adapters. It needs no device or BrowserStack credentials.

`robot --dryrun --variable PLATFORM:<android|ios> e2e/tests` resolves every keyword and argument
count on each adapter, which is what catches a renamed or duplicated keyword; run it for both
platforms after editing a resource. `python -m pytest e2e/tools` covers the result tools.

Dry runs validate wiring, not device behavior. Before merging device-facing changes, run the
affected scenarios on both platforms. Backend or feature-gated skips remain visible in Robot's
report; a skipped scenario is not evidence of a passing flow.
