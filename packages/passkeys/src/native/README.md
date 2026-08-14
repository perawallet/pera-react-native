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

## Production reality — read this first

**Pera 7 has shipped to end users on canary.13, and passkeys work there.** This
is not a greenfield problem; every decision below is constrained by data already
on user devices.

canary.13 wrote exactly what the provider reads:

|                 | canary.13 (shipped)          | canary.14 (this branch) | provider needs            |
| --------------- | ---------------------------- | ----------------------- | ------------------------- |
| envelope        | `{iv, tag, content}`         | `{iv, content}`         | `{iv, tag, content}`      |
| `Uint8Array`    | `Array.from(v)` number array | `{"$u8": "<b64>"}`      | number array              |
| inner plaintext | base64url of JSON            | raw JSON                | base64url (raw tolerated) |
| location        | bare id                      | `k/` + `m/`             | bare id                   |

So the installed base has working credential records **and** a working HD root,
all at bare ids in a format canary.14 neither writes nor reads.

### The regression phase 2 prevents

Left unfixed, this branch would ship two independent breakages:

`migrateKeystoreLayout` skips credential records (good) but the **HD root is a
wallet key**, so it migrated to `k/`+`m/` and deleted the bare record.
`getHdRootSecret` would then return `null` for every existing user: assertions
keep working (the provider stores each credential's private key), but **no new
passkey could ever be created**.

`configureHdRootKey` was independently broken — it resolved through
`fetchSecret`, which reads a bare id canary.14 never writes, so
`setHdRootKeyId` was never called at all.

## Phase 2 — make it work now (implemented)

**Do not introduce a purpose-scoped passkey root.** An earlier draft of this
plan recommended one; with an installed base it is the wrong trade. Existing
credentials were derived from the **wallet root**, so a scoped root would break
seed-recovery for them, and any credential whose record was lost would re-derive
to a different keypair that the relying party rejects. The security argument is
also weaker than it looks: the same bytes have to be readable by the provider
either way, and they are already at a bare id on every shipped device. Moving
root material under `m/` is a phase-3 win, once the provider can read it there.

The approach is **dual-write**: the wallet root lives under `k/`+`m/` for the
keystore _and_ keeps a bare-id shadow copy in the provider's format. Same bytes,
same derivation, so nothing about the installed base changes.

1. **`createNativePasskeyWriter`** (`packages/migrate/.../
writeNativePasskeyEntry.ts`) seals through `sealNativeProviderRecord` and
   `toNativeByteArray`, not the keystore's `sealData`/`encode`. Without this, a
   Pera 6 → Pera 7 migration on a canary.14 build writes credentials the
   provider cannot read — and unlike the root, these are _created_ wrong rather
   than moved, so no later migration can recover them.
2. **The HD root keeps a bare-id shadow**, from two directions:
    - `migrateKeystoreLayout` migrates the root into `k/`+`m/` like any wallet
      key but leaves its bare entry in place (`HD_ROOT_SHADOW_TYPES`). The
      canary.13 record already sitting there is in the format the provider
      parses, so the shipped bytes are preserved rather than rewritten.
    - `syncNativeProviderHdRoot` (below) writes one when it is absent — a fresh
      install whose root was only ever created under canary.14, or a device that
      already upgraded on a build without the exemption. It also replaces one
      that no longer decrypts, so the sync is self-healing on every launch.

    The two type lists must agree. `HD_ROOT_KEY_TYPES` here is the authority (it
    decides which id the provider is handed); the migration's copy errs wide on
    purpose, because one shadow too many is a redundant ciphertext phase 3
    removes and one too few is a boot the provider cannot derive from.

3. **`configureHdRootKey`** resolves the root by scanning the plaintext `k/`
   bucket, unseals only that record's `m/` material, then `setHdRootKeyId`.
   It no longer decrypts every key in the store to find one.

Verified on a real device by upgrading an existing canary.13 install in place —
a fresh install does not exercise the case that matters. Both must hold
afterwards: an existing credential still authenticates, **and** a new credential
can still be created.

### Why not a purpose-scoped root

See the paragraph above: existing credentials derive from the wallet root.
Nothing here changes which bytes a credential derives from — that is the whole
safety property, and it is why the shadow is the _same_ material rather than a
new one.

## Phase 3 — adopt the upstream fix without losing keys

When the provider moves to `k/`+`m/` and the canary.14 `{iv, content}` envelope,
the bare-id records have to move with it.

The safety property is **write → read back → only then delete**, per record,
idempotent and resumable — the shape every keystore migration revision in
`extensions/provider/src/keystore/migrations/` already follows: each leaves
anything it could not migrate in place for a later run rather than dropping it.

Until then, nothing in this branch **consumes** provider records — upstream's
`adopt-flat-records` requires top-level material and skips `privateKeyEnc`
credentials, but does adopt (and delete the bare id of) a plain-key credential;
none of Pera's own revisions add a provider exemption (see Task 4/5's review).
That gap is what keeps phase 3 possible and is also a real, tracked exposure
for that one record shape — so do not "tidy" it into migrating them without
first closing the gap.

The bare-id root shadow from phase 2 is deleted in this phase too, and only
here: once the provider reads `m/`, the duplicate is redundant, and removing it
is the security improvement phase 2 deliberately deferred. Three things go at
the same time — `syncNativeProviderHdRoot`, `HD_ROOT_SHADOW_TYPES` in
`migrateKeystoreLayout`, and the shadows already on disk — and the last of those
is what needs the write→verify→delete treatment.

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
