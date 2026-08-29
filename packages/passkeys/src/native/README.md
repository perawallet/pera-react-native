# Android and iOS credential-provider interop

The passkey credential provider (`react-native-passkey-autofill`) runs in its own process and shares
this app's keystore MMKV instance (`PASSKEYS_MMKV_ID = "keystore"`) and master key.

## The record layout is split, and only half of it moved

Keep these two apart, because they are stored differently.

**The HD-root parent lives in `k/`+`m/` on both platforms.** Android's `KeystoreRecords.kt` declares
`METADATA_PREFIX = "k/"` and `MATERIAL_PREFIX = "m/"`; iOS's `PasskeyCredentialStore.swift` declares
`metadataPrefix` and `materialPrefix`. Both scan `k/` for parent candidates, which is why neither
provider needs a bare-id shadow record any more.

**Credential records are still bare-id only, on both platforms.** iOS's only path that builds a
credential from the keystore, `allKeystoreCredentials()`, guards on `dataArray(keyData["publicKey"])`
_and_ `dataArray(keyData["privateKey"])`. `dataArray` accepts only a JSON number array, so a split
`k/` record fails the guard silently: its `publicKey` is `{"$u8": …}` and it carries no `privateKey`
at all. iOS has no credential-from-metadata path.

Android's `credentialFromMetadataRecord` (`CredentialRepository.kt`) sets `privateKey = ""` and
re-derives on demand, which cannot reproduce a legacy-imported credential. `userName` is matched
case-sensitively by `deriveLegacyPasskeyCredential.ts` while the provider lowercases it, and the
import writes no `parentKeyId` or `scheme`, so `schemeOf` pins the credential to `bip32-ed25519` even
though it was derived from a pbkdf2 main key.

So `nativeProviderRecord.ts` is the single expression of the credential contract. Read its module doc
before changing anything here, in particular why the keystore's own `sealData` and `encode` cannot be
used (both fail _silently_ against the provider), and why credentials are written as a flat bare-id
record with `privateKey` as a JSON number array.

## Upstream's adoption revision eats the flat record

Because credentials are flat, upstream's `adopt-flat-records` revision decrypts a migrated
credential's flat record perfectly well: its envelope and plaintext shapes are exactly what
`adoptLegacyRecords` and `decode` accept. It then sees a top-level `privateKey` `Uint8Array`, adopts
it into `k/`+`m/`, and deletes the flat original that neither provider can read.

`extensions/provider/src/keystore/migrations/repairs/0002-rematerialize-passkey-credentials.ts`
is the backstop. It runs
after upstream's adoption, in the same launch, and un-adopts every migrated credential:
rematerialising the flat copy from the `k/`+`m/` pair, verifying the write reads back through the
same envelope and decode a provider would use, and only then removing `k/<id>` and `m/<id>`.

**This is deliberately not a dual-write.** Android's `CredentialRepository.getCredential` tries the
split layout _first_ and returns on a hit before ever reading the bare id, so a `k/` record left
beside a freshly rematerialized flat one still wins on Android and re-derives the wrong key.

The repair restates `nativeProviderRecord.ts`'s seal function rather than importing it, because
`packages/passkeys` already depends on `@perawallet/wallet-extension-provider` and the reverse import
would be circular. A `devDependency` back the other way trips turbo's whole-graph cycle check, so
`pnpm build` fails even though both packages build clean side by side. A deep _relative_ import
creates no such edge, which is how `extensions/provider`'s `nativeCredentialRecord.spec.ts` gets a
live round trip against the real `openNativeProviderRecord`.

That spec runs three checks, and the third is the one that matters:

- The live round trip seals here and opens there. Being symmetric, it cannot say which side
  introduced a bug.
- Comparing the real `sealNativeProviderRecord` output against the restated writer's, for the same
  input, catches the two writers diverging. By construction it cannot catch both drifting together:
  shift `GCM_TAG_BYTE_LENGTH` to the same wrong value on both sides and it still passes.
- The golden envelope catches exactly that, because it is asserted as a frozen literal rather than
  re-derived, so it has no writer to agree with.

## Moving credentials into `k/`+`m/`

The provider has never been asked to read a credential from the split layout, so this has not
started. When it does, the migration has to handle everything the fixture corpus in
`__tests__/nativeProviderRecord.spec.ts` pins:

- Both envelope shapes: sealed `{iv, tag, content}` _and_ the unsealed base64url payload the provider
  falls back to when it has no master key.
- Both credential type strings: `hd-derived-p256` and the legacy `xhd-derived-p256`, which the
  provider's read path still accepts.
- Byte fields as JSON number arrays, not `{$u8}`.
- `privateKeyEnc` as an object rather than a `Uint8Array`, carried across verbatim. A generic
  secret-lifter that only understands byte arrays drops it, which destroys a biometric-gated
  credential while appearing to succeed.

## On-device checklist

None of this runs in CI; each item needs a real device and, in places, two builds in sequence.

1. Create, assert and delete a credential on an iOS simulator and a physical Android device.
   Confirm the `needs-migration` banner appears for a pre-existing credential and clears once it is
   removed and recreated, and that the credential-provider prompt says "Pera". On Android,
   `getStoredCredentials` is iOS-only by design (`extensions/passkey-autofill/src/service.ts`), so
   an empty Android passkey list for un-adopted credentials is correct.
2. Relying-party scoping: a get-credential request for one origin must not surface credentials
   belonging to another. Upstream still ships `processGetCredentialRequest` filtering on
   `allowCredentials` only, so the local patch is what enforces scoping, and it is the easiest thing
   to lose on a version bump.
3. Migration-banner delete gating: with Pera _not_ the active credential provider and at least one
   flagged passkey present, the banner must warn but offer no remove action, and the row's own trash
   icon must be withheld too. Re-registration is impossible in that state, so offering
   delete-and-recreate would walk the user into a lockout. Non-flagged passkeys must stay deletable,
   since they are derivable from the recovery passphrase, which is the point of the flag.

The flagged half of step 3 is not reachable on device without a legacy-import dataset, because the
`metadata.migration: "needs-migration"` marker is only written by the legacy import path.
`settings-passkeys-delete.test.tsx` covers that half instead.

## What passkeys actually depend on

Credentials are P256 (`hd-derived-p256`), derived by
`dP256.genDomainSpecificKeypair(rootSecret, origin, userHandle)`. Falcon and the quantum key types
are unrelated and unaffected.

**The `pbkdf2-p256` main key those credentials hang off is parented on the BIP39 entropy child, not
the wallet root.** That holds on mobile (`usePasskeyMainKey.ts`) and in the browser extension
(`keystore-signer.ts`) alike, with `repairs/0003-mint-passkey-main-key.ts` back-filling existing
wallets. The parent is load-bearing rather than a label: upstream's `generateDP256Main` calls
`withSeed(…, { wantSeed: false })`, which feeds the parent's raw stored bytes straight into PBKDF2.
The 96-byte extended root and the 16-32-byte BIP39 entropy are different bytes, so one mnemonic
yields two different main keys depending on which you parent on, and every passkey under the wrong
one is unrecoverable from the mnemonic alone. Keep the two platforms in step.

The provider persists each credential's private key (`privateKey`, or `privateKeyEnc` when
biometric-gated) and `getCredential` loads it back. The HD root is consulted only when minting a new
credential. Two consequences follow:

- Changing which root new credentials derive from does not break existing credentials, because
  sign-in never touches the root.
- Determinism (same root, origin and userHandle yields the same keypair) is therefore a _recovery_
  property, not a runtime dependency. It is what would let a credential be regenerated from the seed
  alone, and changing the root gives that up for credentials minted before the change.
