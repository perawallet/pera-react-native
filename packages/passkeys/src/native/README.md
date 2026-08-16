# Android credential-provider interop

The passkey credential provider (`react-native-passkey-autofill`, Android and
iOS) runs in **its own process** and shares this app's keystore MMKV instance
(`PASSKEYS_MMKV_ID = "keystore"`) and master key.

**Phase 3 landed upstream, in autofill canary.23/.24 — but only for the
derivation parent/root, not for credential records.** Keep these separate:

- **The HD-root parent** is read from `k/`+`m/` on both platforms now.
  Android's `KeystoreRecords.kt` declares `METADATA_PREFIX = "k/"` /
  `MATERIAL_PREFIX = "m/"`; iOS's `PasskeyCredentialStore.swift` declares
  `metadataPrefix`/`materialPrefix`, and both scan `k/` for parent candidates
  (`parentKeyCandidates`/`material(of:)` on iOS; the equivalent lookup on
  Android). This is why `syncNativeProviderHdRoot` and its bare-id shadow are
  gone — both providers genuinely no longer need it.
- **Credential records are still bare-id only, on both platforms.** iOS's only
  path that builds a credential from the keystore, `allKeystoreCredentials()`,
  guards on `dataArray(keyData["publicKey"])` **and**
  `dataArray(keyData["privateKey"])` — `dataArray` accepts only a JSON number
  array, so a split `k/` record (whose `publicKey` is `{"$u8": …}` and which
  carries no `privateKey` at all) fails the guard silently. There is no
  credential-from-metadata path on iOS. Android's
  `credentialFromMetadataRecord` (`CredentialRepository.kt`) sets
  `privateKey = ""` and re-derives on demand — which cannot reproduce a
  migrated Pera 6 credential, both because `deriveLegacyPasskeyCredential.ts`
  matches legacy `userName` case-sensitively while the provider lowercases it,
  and because the migration writes no `parentKeyId`/`scheme`, so `schemeOf`
  pins the credential to `bip32-ed25519` even though it was derived from a
  pbkdf2 main key.

So `nativeProviderRecord.ts` is still the single expression of the credential
contract. Read its module doc before changing anything here — in particular
why the keystore's own `sealData`/`encode` cannot be used (both fail
_silently_ against the provider), and why credentials are written as a flat
bare-id record with `privateKey` as a JSON number array rather than into
`k/`+`m/`.

### Upstream's own adoption revision eats the flat record

Because credentials are still flat, upstream's `adopt-flat-records`
(`@algorandfoundation/react-native-keystore`'s own revision `0002`, which runs
immediately after Pera's preflight) decrypts a migrated credential's flat
record fine — its envelope and plaintext shapes are exactly what
`adoptLegacyRecords`/`decode` accept — sees a top-level `privateKey`
`Uint8Array`, and adopts it into `k/`+`m/`, deleting the flat original neither
provider can then read.

`extensions/provider/.../repairs/0002-rematerialize-passkey-credentials.ts` is
the backstop: it runs after upstream's adoption, in the same launch, and
**un-adopts** every migrated passkey credential — rematerialising its flat
copy from the `k/`+`m/` pair, verifying the write reads back through the same
envelope+decode a provider or this migration would use, and only then removing
`k/<id>`+`m/<id>`. This is deliberately not a dual-write: Android's
`CredentialRepository.getCredential` tries the split layout _first_ and
returns on a hit before ever reading the bare id, so a `k/` record left beside
a freshly rematerialized flat one still wins on Android and re-derives the
wrong key — the exact regression this exists to prevent. Removing the split
pair once the flat copy is proven readable restores exactly the layout shipped
Pera 7 works on today. It restates `nativeProviderRecord.ts`'s seal function
rather than importing it, because `packages/passkeys` already depends on
`@perawallet/wallet-extension-provider` and the reverse import would be
circular. That doesn't rule out a live test-only round trip, though: a
`package.json` **devDependency** on `@perawallet/wallet-core-passkeys` trips
turbo's whole-graph cycle check (`pnpm build` fails even though the two
packages' own `build` scripts run clean side by side), but a **deep relative
import** creates no such edge and never enters that graph. `extensions/provider`'s
`nativeCredentialRecord.spec.ts` uses exactly that — a relative import of this
module's real `openNativeProviderRecord`, sealing here and opening there — kept
alongside a golden envelope pinned from an earlier such round trip. Neither
round trip guards the _writer_ half alone, though: both are symmetric
seal-here/open-there checks, blind to a writer bug that still round-trips
through its own paired reader (a GCM tag boundary shifted by one byte, sealed
and opened the same wrong way both times, passes both). The spec's third
check — comparing this module's real `sealNativeProviderRecord` output
directly against the restated writer's, for the same input — is the one that
isn't blind to that.

## Still pending: a real phase 3 for credentials

The provider has never been asked to read a credential from `k/`+`m/`, so this
work has not started. When it does, a migration has to handle everything the
fixture corpus in `__tests__/nativeProviderRecord.spec.ts` pins:

- Both envelope shapes: sealed `{iv, tag, content}` **and** the unsealed
  base64url payload the provider falls back to when it has no master key.
- Both credential type strings: `hd-derived-p256` and the legacy
  `xhd-derived-p256`, which the provider's read path still accepts.
- Byte fields as JSON **number arrays**, not `{$u8}`.
- `privateKeyEnc` — an object, not a `Uint8Array`. It must be carried across
  verbatim. A generic secret-lifter that only understands byte arrays drops
  it, which destroys a biometric-gated credential while appearing to succeed.

## What passkeys actually depend on

Credentials are **P256** (`hd-derived-p256`), derived by
`dP256.genDomainSpecificKeypair(rootSecret, origin, userHandle)`. Falcon and the
quantum key types are unrelated and unaffected.

The `pbkdf2-p256` main key those credentials hang off is parented on the
**BIP39 entropy child**, not the wallet root — on mobile
(`usePasskeyMainKey.ts`) and in the browser extension (`keystore-signer.ts`)
alike, with `repairs/0003-mint-passkey-main-key.ts` back-filling existing
wallets. The parent is load-bearing rather than a label: upstream's
`generateDP256Main` calls `withSeed(…, { wantSeed: false })`, which feeds the
parent's raw stored bytes straight into PBKDF2. The 96-byte extended root and
the 16–32-byte BIP39 entropy are different bytes, so **one mnemonic yields two
different main keys depending on which you parent on** — and every passkey
under the wrong one is unrecoverable. Keep the two platforms in step.

The provider **persists each credential's private key** (`privateKey`, or
`privateKeyEnc` when biometric-gated) and `getCredential` loads it back. The HD
root is consulted **only when minting a new credential**. Two consequences worth
holding on to:

- Changing which root new credentials derive from does **not** break existing
  credentials. Sign-in never touches the root.
- Determinism (`same root + origin + userHandle ⇒ same keypair`) is therefore a
  _recovery_ property, not a runtime dependency: it is what would let a
  credential be regenerated from the seed alone. Changing the root gives that up
  for credentials minted before the change.
