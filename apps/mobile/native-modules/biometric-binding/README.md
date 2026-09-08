# biometric-binding

Local Expo module implementing the `PeraBiometricBinding` native module behind
`RNBiometricsService`
(`extensions/platform-react-native/src/services/biometrics.ts`). Autolinked via
`expo.autolinking.nativeModulesDir`, with no config plugin or manual registration.

Makes biometric unlock depend on the OS rather than on a stored boolean: a
secret the wallet needs is wrapped to a hardware-backed key that only a
successful biometric ceremony can use, and that the platform destroys when the
enrolled set changes. A fingerprint or face enrolled after the user opted in
therefore cannot inherit that opt-in. Neither `isEnrolledAsync` nor
`getEnrolledLevelAsync` can see this: remove-then-re-add never passes through an
observable bad state.

Surface:

- `armBinding()` → `{ blob, tokenHash }` or `null`. Creates the key, mints a
  random 32-byte token, wraps it and returns the ciphertext plus the token's
  SHA-256 as lowercase hex. Requires no ceremony, because the legacy migration
  path arms with no user present.
- `unwrapToken(blob, prompt)` → the token bytes, or a rejection whose `code` is
  one of `invalidated`, `no-binding`, `user-cancel`, `system-cancel`, `lockout`,
  `unavailable`, `failed`. Only the native side can tell a destroyed key from a
  declined prompt, so it classifies and JS only maps.
- `checkBinding()` → `'valid' | 'changed' | 'absent' | 'unavailable'`. Never
  prompts; it runs on every mount of `useBiometrics`. Only `'changed'` is an
  affirmative report that the set was modified.
- `clearBinding()` destroys the key.

## iOS: Secure Enclave key pair

- P-256 key pair at application tag `pera.biometric.unlock`, generated in the
  Secure Enclave with access control `[.privateKeyUsage, .biometryCurrentSet]`.
  `.biometryCurrentSet` is what makes the OS destroy the key when the enrolled
  set changes.
- Protection class `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`: the key
  must not survive passcode removal, and must never leave the device or enter a
  backup.
- Wrapping uses the public half
  (`eciesEncryptionCofactorVariableIVX963SHA256AESGCM`), which is why arming
  needs no authentication at all.
- Unwrapping evaluates the `LAContext` policy first and then hands that same
  context to the Keychain lookup via `kSecUseAuthenticationContext`, so there is
  one ceremony and the key is released against that specific evaluation.
- `checkBinding` can only answer `'valid'` or `'absent'` here. Because the key
  is removed rather than marked unusable, a re-enrollment is indistinguishable
  from a restore or a device upgrade — and all of them are recovered the same
  way, by opting in again. Android reports `'changed'` distinctly; iOS cannot.
- Nothing is stored outside the key itself. A Keychain item would outlive app
  deletion while the App Group MMKV does not, so it would eventually claim a key
  that is gone.

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
6. Cancel the iOS prompt with the cancel button and again with the side button:
   the first must reject `user-cancel`, the second `system-cancel`, since the
   lock screen retries only on the latter.
