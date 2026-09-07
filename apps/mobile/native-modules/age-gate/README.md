# age-gate

Local Expo module implementing the `PeraAgeGate` native module behind
`RNAgeGateService` (`extensions/platform-react-native/src/services/age-gate.ts`).
Autolinked via `expo.autolinking.nativeModulesDir`, with no config plugin or
manual registration.

## Android: Google Play Age Signals

- `android/` declares the `com.google.android.play:age-signals` dependency in
  its own `build.gradle`.
- Verify the exact `age-signals` API (`AgeSignalsManagerFactory`,
  `checkAgeSignals`, `AgeSignalsResult.userStatus()/ageLower()/ageUpper()`) and
  pin the dependency version against the latest stable at integration time.
- Payload contract: `{ userStatus?: string, ageLower?: number|null, ageUpper?: number|null }`.

## iOS: DeclaredAgeRange (iOS 26+)

- Requires the `com.apple.developer.declared-age-range` entitlement, set in
  `app.config.builder.js` (`ios.entitlements`); it must be provisioned on the
  App ID before on-device testing.
- Verify the exact `DeclaredAgeRange` API against the installed iOS 26 SDK:
  `AgeRangeService.shared.requestAgeRange(ageGates:in:)` signature, the
  `.sharing` / `.declinedSharing` response cases, and whether
  `AgeRange.lowerBound` / `.upperBound` are optionals.
- Payload contract: `requestAgeRange` resolves
  `{ status: 'sharing' | 'declined' | 'unknown', lowerBound?, upperBound? }`;
  `getDeviceCapability` resolves `'platform'` (iOS 26+) or `'manual'`.
