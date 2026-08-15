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

## What passkeys actually depend on

Credentials are **P256** (`hd-derived-p256`), derived by
`dP256.genDomainSpecificKeypair(rootSecret, origin, userHandle)`. Falcon and the
quantum key types are unrelated and unaffected.

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
