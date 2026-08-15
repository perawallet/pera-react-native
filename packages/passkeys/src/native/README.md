# Credential-provider interop

The passkey credential provider (`react-native-passkey-autofill`, both Android
and iOS) runs in **its own process** but shares this app's keystore MMKV
instance (`PASSKEYS_MMKV_ID = "keystore"`) and master key.

**Phase 3 has landed upstream, in autofill canary.23/.24.** Both platforms now
read the keystore's own `k/`+`m/` split directly:

- Android: `KeystoreRecords.kt` declares `METADATA_PREFIX = "k/"` /
  `MATERIAL_PREFIX = "m/"`, and its `openEnvelope` accepts both the legacy
  `{iv, tag, content}` envelope and the new `{iv, content}` one.
- iOS: `PasskeyCredentialStore.swift` declares `metadataPrefix`/`materialPrefix`
  and scans `k/` for parent candidates, falling back to a flat bare-id record
  only when the split pair is absent.

There is no longer a separate on-disk contract to hand-roll here. Credentials
migrated from Pera 6 are written straight into `k/`+`m/`
(`packages/migrate/.../writeNativePasskeyEntry.ts`), and the bare-id HD-root
shadow the pre-canary.23 provider needed (`syncNativeProviderHdRoot`) has been
retired — the provider extension's `preflight/0001-retire-hd-root-shadow`
revision deletes any shadow copy still on disk once the split pair is
verifiably present.

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
