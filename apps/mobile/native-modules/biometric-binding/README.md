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
  one ceremony and the key is released against that specific evaluation. The
  `LAContext` must be kept alive (`withExtendedLifetime`) across the decrypt:
  ARC may otherwise release it at its last use, which a Debug build (`-Onone`)
  masks by holding it to end of scope but a Release build does not, and the
  failure surfaces as a declined ceremony with no test able to catch it.
- `checkBinding` can only answer `'valid'` or `'absent'` here. Because the key
  is removed rather than marked unusable, a re-enrollment is indistinguishable
  from a restore or a device upgrade — and all of them are recovered the same
  way, by opting in again. Android reports `'changed'` distinctly; iOS cannot,
  so the user-facing copy for `'absent'` is deliberately cause-neutral rather
  than naming re-enrollment specifically.
- Nothing is stored outside the key itself. A Keychain item would outlive app
  deletion while the App Group MMKV does not, so it would eventually claim a key
  that is gone.

## Android: AndroidKeyStore RSA pair plus an AES canary

Two keys, created and destroyed as one unit so the probe can never disagree with
the key it stands for.

- The token is wrapped to an RSA-2048 pair at alias `pera.biometric.unlock`,
  StrongBox-backed where the device allows it. Unwrapping goes through a
  `BiometricPrompt.CryptoObject` carrying the initialised `Cipher`, and the
  decrypt uses the cipher the result hands back — using any other would defeat
  the binding.
- The public half is re-imported through `KeyFactory` /
  `X509EncodedKeySpec` before wrapping. A key read from
  `getCertificate(alias).publicKey` is still an AndroidKeyStore key and is
  subject to the key's own `USER_AUTH_REQUIRED`, so encrypting with it would
  demand a ceremony; detaching it is what makes arming possible with no user
  present.
- OAEP is initialised with an explicit `OAEPParameterSpec`. AndroidKeyStore
  defaults MGF1 to SHA-1 regardless of `setDigests`, and StrongBox supports
  SHA-256 only, so the default silently diverges from the key spec on one path
  and is rejected outright on the other.
- The permitted MGF1 digest set is pinned with `setMgf1Digests(DIGEST_SHA256)` on
  API 35+. Up to 34 the primary digest joins that set implicitly, but from 35 an
  unspecified set means SHA-1 alone, so every SHA-256 decrypt is refused at
  `Cipher.init` and StrongBox — which has no SHA-1 — refuses the key at
  generation. A key minted without the tag can only be re-armed, never repaired.
- StrongBox generation retries without the flag on `ProviderException`, not just
  its `StrongBoxUnavailableException` subclass: only
  `KM_ERROR_HARDWARE_TYPE_UNAVAILABLE` maps to that subclass, while an
  unsupported digest, padding or key size arrives as the bare superclass and
  needs the same TEE fallback.
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
3. Add an alternate Face ID appearance (iOS): also invalidates, reported as
   `absent` on the next mount, and the hook must land on `disabledReason:
'rebind-required'`.
4. Remove the device passcode (iOS): the Secure Enclave key is destroyed with
   it, also reported `absent`.

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
    `user-cancel`, the second `system-cancel` — the lock screen retries only on
    `system-cancel`. Fail the ceremony 5 times running to confirm `lockout`.

**Upgrade and legacy paths**

12. Upgrade path: with biometrics already enabled before this build (a
    pre-binding blob with no key pair behind it), the first reconcile after
    upgrading must drop the opt-in — the toggle reads off, and the user is
    offered "Turn back on". Accepting that offer re-arms it, and a
    re-enrollment after that must then be caught normally.
13. Legacy import: arm the binding on the import path, where no user is present
    to complete a ceremony, and confirm it succeeds — this is the path that
    depends on the wrap needing only the public key.

**Android hardware variants**

14. **The most important item here.** On an Android 15 or 16 handset (API
    35/36), enable biometric unlock and confirm the biometric prompt actually
    appears and the ceremony succeeds. Compare against a pre-API-35 device.
    Without an explicit MGF1 digest, AndroidKeyStore pins the key to SHA-1 and
    the SHA-256 OAEP decrypt is rejected at `Cipher.init`, so a regression here
    means `enableBiometrics` reports "declined" with **no prompt ever shown**
    and biometric unlock cannot be turned on at all. `adb logcat -s
PeraBiometricBinding` carries the reason if it fails.
15. StrongBox-backed device (Pixel 3 or newer) and a non-StrongBox device:
    enable biometrics on each and confirm the RSA pair generates and the
    confirmation ceremony succeeds on both.
16. On a StrongBox device, re-enroll a fingerprint and confirm **both** the
    StrongBox-backed RSA pair and the non-StrongBox AES canary invalidate. If
    only the canary invalidates, `checkBinding` would read `valid` while unlock
    keeps failing with no self-heal — must not happen. Read the
    `disabledReason` copy to see which branch fired: a "biometric settings
    changed" message is the intended `changed` branch; "set up again" means the
    presence check pre-empted it; a silent toggle-off means the probe reported
    `unavailable` instead.
17. An API 29–33 handset: those OS versions carry no MGF1 tag on existing keys,
    so the digest KeyMaster falls back to is OEM-defined. Confirm the OAEP
    decrypt still succeeds there.
18. Background the app while the biometric prompt is open, then foreground it
    again: the unwrap must not hang.
19. Force an arm failure (e.g. fill the keystore) and confirm the failure logs
    a diagnosable reason rather than dropping it — arm failures have no other
    way to be debugged from a device.
20. Run a full release build (`assembleRelease` on Android, a Release scheme on
    iOS) at least once — a debug-only pass does not exercise R8 or Release-only
    code paths like the `LAContext` lifetime above.
