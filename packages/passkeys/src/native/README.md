# Android credential-provider interop

The passkey credential provider (`react-native-passkey-autofill`, Android) runs
in **its own process** and shares this app's keystore MMKV instance
(`PASSKEYS_MMKV_ID = "keystore"`) and master key. It is still on the
pre-canary.14 **bare-id** layout: no `k/` metadata prefix, no `m/` material
prefix.

`nativeProviderRecord.ts` is the single expression of that contract. Read its
module doc before changing anything here — in particular why the keystore's own
`sealData`/`encode` cannot be used (both fail _silently_ against the provider).

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

## Current state

Broken, and the breakage is silent on both sides:

- `bootstrapPasskeyAutofill`'s `configureHdRootKey` resolves keys through
  `fetchSecret`, which reads a **bare** id (`storage.getString(keyId)`) that
  canary.14 never writes. Every lookup returns `null`, so `setHdRootKeyId` is
  never called.
- Even with the id registered, the provider's `getHdRootSecret` reads
  `keystoreMMKV.decodeString(hdRootKeyId)` — also a bare id, also absent.

So no credential can be created or asserted. Existing credential records are
untouched and still readable by the provider; nothing has been lost.

## Phase 2 — make it work now (not yet implemented)

1. **Fix `configureHdRootKey`** to resolve the HD root through the `k/`+`m/`
   layout instead of `fetchSecret`'s bare-id read.
2. **Derive a purpose-scoped passkey root** from the wallet root rather than
   handing the provider the wallet root itself, mirroring what
   `extensions/keystore-chrome`'s web adapter already does with its
   `ROOT_KEY_PURPOSE` marker. A compromise of the shadow record below then
   exposes passkey credentials only, never Algorand signing keys.
3. **Write that scoped root as a shadow record** at its bare id via
   `sealNativeProviderRecord`, and register it with `setHdRootKeyId`.

The scoped root is a deliberate trade: it costs seed-recovery of credentials
minted before it (see above). Confirm that is acceptable before shipping it —
if passkey-recovery-from-seed is a product guarantee, the provider needs to
record which root each credential came from instead.

## Phase 3 — adopt the upstream fix without losing keys

When the provider moves to `k/`+`m/` and the canary.14 `{iv, content}` envelope,
the bare-id records have to move with it.

The safety property is **write → read back → only then delete**, per record,
idempotent and resumable. `migrateKeystoreLayout` already has this shape: it
leaves anything it could not migrate in place for a later run rather than
dropping it.

Until then, `migrateKeystoreLayout` **skips** provider records — skips, never
consumes. That is what keeps phase 3 possible, so do not "tidy" it into
migrating them.

What the migration must handle, all of it covered by the fixtures in
`__tests__/nativeProviderRecord.spec.ts`:

- Both envelope shapes: sealed `{iv, tag, content}` **and** the unsealed
  base64url payload the provider falls back to when it has no master key.
- Both credential type strings: `hd-derived-p256` and the legacy
  `xhd-derived-p256`, which the provider's read path still accepts.
- Byte fields as JSON **number arrays**, not `{$u8}`.
- `privateKeyEnc` — an object, not a `Uint8Array`. It must be carried across
  verbatim. A generic secret-lifter that only understands byte arrays drops it,
  which destroys a biometric-gated credential while appearing to succeed.
