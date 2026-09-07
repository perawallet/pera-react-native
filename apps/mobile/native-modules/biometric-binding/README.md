# biometric-binding

Local Expo module implementing the `PeraBiometricBinding` native module behind
`RNBiometricsService`
(`extensions/platform-react-native/src/services/biometrics.ts`). Autolinked via
`expo.autolinking.nativeModulesDir`, with no config plugin or manual registration.

Detects changes to the device's enrolled biometric set so a fingerprint or
face enrolled after the user opted into biometric unlock cannot inherit that
opt-in. Neither `isEnrolledAsync` nor
`getEnrolledLevelAsync` can see this: remove-then-re-add never passes through an
observable bad state.

Status contract, consumed by `useBiometrics.checkBiometricsEnabled`:
`'valid' | 'changed' | 'absent' | 'unavailable'`. Only `'changed'` is an
affirmative report, and only it may destroy the opt-in. Nothing here prompts;
the reconcile runs on every mount of the hook.

## iOS: `LAContext.evaluatedPolicyDomainState`

- Opaque blob that changes whenever the biometric database changes; only
  equality is meaningful, so a SHA-256 of it is stored, never the blob.
- Populated only after `canEvaluatePolicy` has been called on that context.
- Kept in a `kSecClassGenericPassword` item (service
  `pera.biometricEnrollmentBinding`, `WhenUnlockedThisDeviceOnly`, no access
  control): it is a digest, and it has to be readable in the same non-interactive
  pass that decides whether the opt-in survives.
- Nil domain state (nothing enrolled, or biometry locked out) reports
  `'unavailable'`, not `'changed'`.

## Android: `setInvalidatedByBiometricEnrollment`

- The OS carries the invalidation: an AES key at alias
  `pera.biometric.enrollment` with `setUserAuthenticationRequired(true)` and
  `setInvalidatedByBiometricEnrollment(true)` is destroyed by the platform when a
  biometric is enrolled or all are removed. The key holds nothing; its existence
  _is_ the binding.
- `Cipher.init` is the probe: it raises `KeyPermanentlyInvalidatedException`
  without any user interaction, whereas _using_ the key would require a
  BiometricPrompt. `UserNotAuthenticatedException` therefore means the key is
  intact, so `'valid'`.
- Auth-per-use is what binds the key to the set rather than to a time window:
  `setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG)` on API 30+, and
  the deprecated `setUserAuthenticationValidityDurationSeconds(-1)` on 29
  (`minSdkVersion` is 29).

## On-device QA

Not reachable from the JS suites, which cover the JS side with mocks, so the
mechanism itself needs a device. Run `pnpm expo:prebuild:clean` first; a new
native module is not picked up by an incremental build.

1. Enable biometric unlock, then in device settings delete the enrolled
   fingerprint and add a different one without reopening Pera. Lock the app: the
   new fingerprint must not unlock, and Settings must show the toggle off.
2. Enroll a _second_ fingerprint alongside the first (Android): same outcome,
   because adding to the set is a change.
3. Add an alternate Face ID appearance (iOS): also invalidates. Fail-closed and
   intended, but worth confirming it is not silent.
4. Upgrade path: with biometrics already enabled before this build, the first
   launch must keep it enabled (binding adopted), and a re-enrollment after that
   must then be caught.
5. Android lockout: fail the fingerprint enough times to lock out, background
   and reopen. No biometric sheet may appear from the reconcile itself.
