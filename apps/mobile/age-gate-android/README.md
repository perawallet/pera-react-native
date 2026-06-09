# age-gate-android

Canonical tracked source for the `PeraAgeGate` Android native module.

- Implements `NativeModules.PeraAgeGate` on Android via Google Play Age Signals API.
- Canonical tracked source; the `android/` prebuild dir is gitignored. The `withAgeGate` config plugin (separate task) copies this tree into the prebuild Android source set, adds the `com.google.android.play:age-signals` gradle dependency, and registers `PeraAgeGatePackage` in `MainApplication.kt`.
- Verify the exact `com.google.android.play:age-signals` API (`AgeSignalsManagerFactory`, `checkAgeSignals`, `AgeSignalsResult.userStatus()/ageLower()/ageUpper()`) and pin the dependency version against the latest stable at integration time.
- Payload contract consumed by RNAgeGateService: `{ userStatus?: string, ageLower?: number|null, ageUpper?: number|null }`.
