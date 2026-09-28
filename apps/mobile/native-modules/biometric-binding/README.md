# biometric-binding

Local Expo module implementing the `PeraBiometricBinding` native module behind
`RNBiometricsService`
(`extensions/platform-react-native/src/services/biometrics.ts`). Autolinked via
`expo.autolinking.nativeModulesDir`, with no config plugin or manual registration.

Makes biometric unlock depend on the OS rather than on a stored boolean: a
random token is wrapped to a hardware-backed key that only a successful
biometric ceremony can use, and that the platform destroys when the enrolled
set changes. A fingerprint or face enrolled after the user opted in therefore
cannot inherit that opt-in. Neither `isEnrolledAsync` nor
`getEnrolledLevelAsync` can see this: remove-then-re-add never passes through an
observable bad state.

Surface:

- `armBinding()` → `{ blob, tokenHash }` or `null`. Creates the key, mints a
  random 32-byte token, wraps it and returns the ciphertext plus the token's
  SHA-256 as lowercase hex. Requires no ceremony, because the legacy migration
  path arms with no user present.
- `unwrapToken(blob, prompt)` → the token bytes, or a rejection whose `code` is
  one of `invalidated`, `decrypt-failed`, `no-binding`, `user-cancel`,
  `system-cancel`, `lockout`, `unavailable`, `failed`. Only the native side can
  tell a destroyed key from a declined prompt, so it classifies and JS only maps.
  `prompt.title` and `prompt.cancelLabel` are the caller's translated copy; the
  module holds no fallback copy of its own.
- `checkBinding()` → `'valid' | 'changed' | 'absent' | 'unavailable'`. Never
  prompts; it runs on every mount of `useBiometrics`. Only `'changed'` is an
  affirmative report that the set was modified.
- `clearBinding()` destroys the key.

What JavaScript does with a rejection is decided in
`packages/security/src/hooks/useBiometrics.ts`: `invalidated` drops the opt-in
at once, `decrypt-failed` drops it only once `MAX_BIOMETRIC_UNWRAP_FAILURES` of
them have accumulated since the last successful unwrap (a cancel or lockout in
between does not reset the count), and every other code keeps it.

## iOS: Secure Enclave key pair

- P-256 key pair at application tag `pera.biometric.unlock`, generated in the
  Secure Enclave with access control `[.privateKeyUsage, .biometryCurrentSet]`.
- Protection class `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`: the key
  must not survive passcode removal, and must never leave the device or enter a
  backup.
- Wrapping uses the public half
  (`eciesEncryptionCofactorVariableIVX963SHA256AESGCM`), which is why arming
  needs no authentication at all.
- Unwrapping evaluates the `LAContext` policy first and then hands that same
  context to the Keychain lookup via `kSecUseAuthenticationContext`, so there is
  one ceremony and the key is released against that evaluation. The `LAContext`
  must be kept alive (`withExtendedLifetime`) across the decrypt: a Release
  build otherwise releases it at its last use, and the failure surfaces as a
  declined ceremony that no Debug run can reproduce.
- `checkBinding` answers `'valid'` or `'absent'`, never `'changed'`: the OS
  removes a key whose biometric set changed rather than marking it unusable, so
  a re-enrollment is indistinguishable from a restore or a device upgrade. The
  user-facing copy for that case is therefore cause-neutral.
- A decrypt that fails after a successful evaluation rejects `decrypt-failed`,
  never `invalidated`: nothing at that point can tell a dead key from a
  transient refusal, so JS counts it rather than acting on one.
- Nothing is stored outside the key itself. A Keychain item would outlive app
  deletion while the App Group MMKV does not, so it would eventually claim a key
  that is gone.

## Android: AndroidKeyStore RSA pair plus an AES canary

Two keys, created and destroyed as one unit so the probe can never disagree with
the key it stands for.

- The token is wrapped to an RSA-2048 pair at alias `pera.biometric.unlock`,
  hardware-backed in the TEE. Unwrapping goes through a
  `BiometricPrompt.CryptoObject` carrying the initialised `Cipher`, and the
  decrypt uses the cipher the result hands back — using any other would defeat
  the binding.
- The public half is re-imported through `KeyFactory` /
  `X509EncodedKeySpec` before wrapping. A key read from
  `getCertificate(alias).publicKey` is still an AndroidKeyStore key and is
  subject to the key's own `USER_AUTH_REQUIRED`, so encrypting with it would
  demand a ceremony; detaching it is what makes arming possible with no user
  present.
- OAEP uses SHA-256 as the primary digest and **SHA-1 for MGF1**, on both the
  wrap and the unwrap, on every API level. Below API 34 the framework's keystore
  cipher rejects any other MGF1 digest at `Cipher.init`, so SHA-256 there means
  `enableBiometrics` reports "declined" with no prompt ever shown. From API 34
  the framework accepts other digests, but SHA-1 is the KeyMint default that
  every key authorises whether or not it carries an MGF1 tag (KeyMint's VTS
  requires it on StrongBox as well), so one spec decrypts every key ever
  minted, including one minted before an OS upgrade. `setMgf1Digests` is
  deliberately not called: on API 35 it replaces the default set instead of
  adding to it. The spec has to be explicit because the detached public key
  encrypts through Conscrypt, whose own default MGF1 digest follows the primary
  digest.
- The pair is deliberately **not** StrongBox-backed. A secure element searches
  for RSA primes on its own small processor and holds the keystore while it
  does, stalling every other keystore user in the app for seconds. An EC key
  would be fast enough there, but `BiometricPrompt.CryptoObject` in
  androidx.biometric 1.2.0-alpha accepts only `Signature`, `Cipher` and `Mac`,
  so a `KeyAgreement` cannot be bound to the prompt.
- An AES key at alias `pera.biometric.enrollment` is the enrollment probe. It
  holds nothing; its existence _is_ the binding. It is the only probe that can
  _classify_ an invalidation without a ceremony: `Cipher.init` on the secret key
  raises `KeyPermanentlyInvalidatedException` directly, whereas reaching the RSA
  private key means `KeyStore.getEntry`, which converts that same invalidation
  into an `UnrecoverableKeyException` and loses the distinction between
  `'changed'` and a key that was never there. `UserNotAuthenticatedException`
  from the canary therefore means the key is intact, so `'valid'`.
- `checkBinding` probes the canary before it looks for the RSA pair.
  `containsAlias` goes through `getKeyMetadata`, which swallows a keystore2
  `KEY_PERMANENTLY_INVALIDATED` and reports the key as missing, so checking
  presence first would answer `'absent'` and make `'changed'` unreachable on
  those devices. A missing RSA pair is still `'absent'`, because the canary alone
  says nothing about the key that actually holds the token.
- Everything inside the prompt's `runOnUiThread` block settles the promise,
  including the guard on `isDestroyed` / `isFinishing` /
  `supportFragmentManager.isStateSaved`. Past `onSaveInstanceState`,
  `BiometricPrompt.authenticateInternal` returns without firing any callback, so
  without that guard the unwrap hangs for the whole unlock cycle and leaks the
  KeyMint operation.
- The OS carries the invalidation on both:
  `setInvalidatedByBiometricEnrollment(true)` destroys them when a biometric is
  enrolled or all are removed. Auth-per-use is what binds them to the set rather
  than to a time window: a 0s validity with `AUTH_BIOMETRIC_STRONG` via
  `setUserAuthenticationParameters` on API 30+, and the deprecated
  `setUserAuthenticationValidityDurationSeconds(-1)` on 29 (`minSdkVersion` is
  29).

## On-device QA

This module has no automated coverage: the JS suites mock the bridge, so
everything below only exists as behavior on real hardware. Run
`pnpm expo:prebuild:clean` first — a new native module is not picked up by an
incremental build — and run the iOS pass at least once on a **Release** build,
not just Debug (see the `LAContext` trap above; Debug hides it by construction).
The Simulator has no real Secure Enclave, so a Simulator pass proves nothing
about `armBinding` or `unwrapToken`; every step below needs physical hardware.

**Enrollment change, both platforms**

1. Enable biometric unlock, then in device settings delete the enrolled
   fingerprint and add a different one without reopening Pera. Lock the app:
   the new fingerprint must not unlock, and Settings must show the toggle off.
2. Enroll a _second_ fingerprint alongside the first (Android): same outcome,
   because adding to the set is a change.
3. Add an alternate Face ID appearance (iOS). The key becomes unusable either at
   the next `checkBinding` (`absent`) or at the next unwrap (`decrypt-failed`);
   record which. In the first case the hook must land on `disabledReason:
'rebind-required'` before any prompt; in the second it must land there after
   `MAX_BIOMETRIC_UNWRAP_FAILURES` unlock attempts, each of which must fall back
   to the PIN pad.
4. Remove the device passcode (iOS): the Secure Enclave key is destroyed with
   it, reported `absent`.

**Ceremony shape**

5. Opting in shows exactly **one** sheet — the confirmation unwrap immediately
   after `armBinding`. `armBinding` itself must show none: it wraps to the
   public key, which needs no ceremony.
6. Cold start with biometrics already enabled must raise **zero** sheets before
   the lock screen; the enrollment probe (`checkBinding`) never prompts.
7. Each unwrap after that shows exactly one sheet. Two means the `LAContext`
   used for the policy evaluation is not the one reaching the Keychain query.
8. Cancel an in-progress opt-in ceremony (before confirming): no orphan RSA or
   AES key must remain — `checkBinding` afterward must read `absent`, not
   `valid` against a half-created pair.

**Lockout and PIN-only states**

9. Android lockout: fail the fingerprint enough times to lock out, background
   and reopen. No biometric sheet may appear from the reconcile itself, and the
   opt-in must remain intact once the lockout clears on its own.
10. iOS with only a PIN/passcode enrolled (no Face ID/Touch ID, or Face ID
    temporarily unconfirmed): `getSecurityLevel` reports `'secret'`, and the
    opt-in must survive rather than being torn down — an unconfirmed level is
    not the same as a destroyed key.
11. Cancel the iOS prompt with the cancel button, again with the side button,
    and again by choosing "Enter Passcode": the first and third must reject
    `user-cancel`, the second `system-cancel` — the lock screen retries a
    `system-cancel` at once, and anything else only after the app has been in
    the background. Fail the ceremony 5 times running to confirm `lockout`.
12. Cancel the Android prompt four ways. All four reject `user-cancel`, so only
    the app leaving the foreground tells them apart: lock the device, and press
    Home — the sheet must come back when the app is resumed. Press Back, and tap
    the negative button — the user must stay on the PIN pad with no second
    sheet.
13. PIN lockout on a cold start: lock the app, fail the PIN until it locks out,
    kill the app and reopen it. No biometric sheet may appear, and the pad must
    show the countdown rather than silently refusing input.

**Upgrade and legacy paths**

13. Upgrade path: with biometrics already enabled before this build (a blob
    under the pre-binding id, with no key pair behind it), the first launch
    after upgrading must raise no biometric sheet and no offer at the lock
    screen. Entering the PIN must re-arm the binding silently: Settings reads
    on, the next lock shows one biometric sheet and it unlocks. Kill the app
    before ever entering the PIN and reopen: the re-arm must still happen on
    the first PIN entry. Force the arm to fail (no biometric enrolled at that
    moment) and confirm the "set up again" offer appears instead.
14. Legacy import: arm the binding on the import path, where no user is present
    to complete a ceremony, and confirm it succeeds — this is the path that
    depends on the wrap needing only the public key.

**Android hardware variants**

15. An API 29–33 handset and an API 35+ handset: enable biometric unlock on
    each and confirm the prompt appears and the ceremony succeeds. The framework
    below 34 accepts only SHA-1 for MGF1 and 35 changed the default MGF1 set, so
    these are the versions where a wrong OAEP spec shows up as
    `enableBiometrics` reporting "declined" with **no prompt ever shown**.
    `adb logcat -s PeraBiometricBinding` carries the reason if it fails.
16. Upgrade a handset from API 33 to 34 or later with biometric unlock enabled
    and confirm the existing key still unwraps: the OAEP spec must not depend
    on the OS version.
17. Enable biometrics from Settings and, on the same run, unlock with the PIN:
    neither should stall. Generation is in the TEE so it cannot hold the
    keystore, and a regression back to StrongBox shows up here as a freeze
    rather than as a failure.
18. Re-enroll a fingerprint and confirm **both** the RSA pair and the AES canary
    invalidate. If only the canary invalidates, `checkBinding` reads `valid`
    while every unwrap rejects `decrypt-failed`; the opt-in must then drop with
    the "set up again" copy after `MAX_BIOMETRIC_UNWRAP_FAILURES` attempts
    rather than failing forever. Read the `disabledReason` copy to see which
    branch fired: a "biometric settings changed" message is the intended
    `changed` branch; "set up again" means the presence check or the failure
    counter pre-empted it; a silent toggle-off means the probe reported
    `unavailable`.
19. Background the app while the biometric prompt is open, then foreground it
    again: the unwrap must not hang.
20. Force an arm failure (e.g. fill the keystore) and confirm the failure logs
    a diagnosable reason rather than dropping it — arm failures have no other
    way to be debugged from a device.
21. Run a full release build (`assembleRelease` on Android, a Release scheme on
    iOS) at least once — a debug-only pass does not exercise R8 or Release-only
    code paths like the `LAContext` lifetime above.
