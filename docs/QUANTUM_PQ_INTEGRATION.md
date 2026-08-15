# Quantum (Post-Quantum) Integration

## Purpose

Pera's quantum (post-quantum, Falcon-1024) accounts use interim PQ libraries —
a prerelease `algosdk` and the WASM `falcon-1024` package — because official
Algorand support for `pqsig` transactions and Falcon signing is not yet
mainline. The Falcon libraries are confined behind one swap seam so they can
be replaced with official Algorand code later via a one-module change.

The `algosdk` prerelease is **not a fork at all**: it is official upstream
code, built from the `v3.7.0-beta.1` tag of `algorand/js-algorand-sdk`. PR
#1102 (the `pqsig` field plus the scheme-agnostic PQ signer surface) is now
**merged** upstream and released on that tag, which is v3.6.0 plus seven
commits — PQ signature support and the removal of the retired `dryrun`
endpoint. This replaces the earlier `@joe-p/algosdk` alias, a build of the
same PR while it was still a draft; the merged tag is strictly ahead of it
(it adds `addressFromPQSig`, `PQ_SALT_MAX` and `LogicSig.clearSignatures`).

The tag is not published to npm, and pnpm cannot install it as a git
dependency: the tag ships no build output, and pnpm refuses to run a
git-hosted package's build step regardless of `onlyBuiltDependencies` or
`dangerouslyAllowAllBuilds`, so a git spec yields a package with no entry
points. `tools/vendor-algosdk.sh` therefore builds the tag from source and
packs it into `libs/`, and a single `overrides` entry in
`pnpm-workspace.yaml` points the whole tree at that tarball. Application code
(including Seam B below) imports plain `algosdk`; the swap point is a
workspace-config change described there (see the `SWAP-BACK:` comment and
"Swap-back procedure" below), not a source-level import.

## Seam A — PQ crypto provider (`packages/kms/src/crypto/pq/`)

**Custody is not in this directory.** Quantum private keys live in the
keystore. `useQuantum` mints the signing child through
`@algorandfoundation/keystore-core`'s `falcon-1024` key type:

```ts
await keyStore.generate({
    type: 'falcon-1024',
    algorithm: 'Falcon-1024',
    extractable: false,
    keyUsages: ['sign', 'verify'],
    params: { seed, parentKeyId: seedKeyId, id: quantumSignKeyId(seedKeyId) },
})
```

The keystore derives the Falcon keypair from the 32-byte quantum seed and
seals the private half itself. Signing is `keyStore.sign(childKeyId, payload)`
— **the seed is never exported on the signing path.** `signWithQuantumSeed`
and `packages/kms/src/storage/quantum-child.ts`, which re-derived the keypair
in JS on every signature, are gone. `keyStore.export` is called exactly once,
at generation, and can only return the public half: the child is
`extractable: false`. (`id` and `parentKeyId` ride the untyped `params` bag;
the engine strips `seed`/`entropy`/`passphrase`/`salt` before mirroring
`params` into the entry's plaintext metadata, so passing the seed there does
not leak it.)

What remains here is pure crypto, with no SDK or address coupling:

- `PQSignatureProvider` — the interface (`scheme`, `publicKeyLength`,
  `generateKeypairFromSeed`). It has **no `sign` member**. Three jobs are
  left: scheme identity (`getPQSigningInfo` reports `getPQProvider().scheme`
  rather than a literal of its own), address derivation, and serving as the
  oracle behind `apps/mobile/src/__integration__/__fixtures__/quantum.ts` —
  those fixtures derive the expected public key and address through this
  provider, **not** through the keystore, which is what makes the quantum
  integration tests a cross-check of the keystore's derivation instead of a
  self-confirmation.
- `wasmFalconProvider.ts` — wraps WASM `falcon-1024`; used in node, vitest and
  the web/extension build.
- `rnFalconProvider.ts` — wraps the native `@joe-p/react-native-falcon` Nitro
  module; used on iOS/Android (PQ-020, landed — see below).
- `getPQProvider()` / `getPQProvider.native.ts` — both providers ship today.
  Selection is a build-time choice, not a runtime check: Metro's standard
  `.native.*` platform-extension resolution swaps in the native file for iOS
  and Android, so no consumer branches on platform.

Because the provider and the keystore now derive keys independently, they must
be pinned to each other. `keystoreFalconParity.spec.ts` does that: for a fixed
seed, `keystore-core`'s Falcon shim yields a byte-identical keypair **and** a
byte-identical signature to calling `falcon-1024` directly (that build is the
deterministic FALCON_DET1024 variant, so signatures are comparable, not merely
verifiable). **It covers the WASM/off-device half only** — on device
`react-native-keystore` injects `@joe-p/react-native-falcon` instead, since RN
cannot load WASM, so native-vs-WASM parity from a given seed is unproven by
any automated test in this repo. It is a manual device-checklist item (below).

**Official swap:** implement a new `PQSignatureProvider` and change both
`getPQProvider` factory files (node/web and native). Two modules. That swaps
the derivation/oracle side only — the code that actually produces signatures
is the keystore's Falcon binding, swapped by changing the keystore, not this
seam.

## Seam B — PQ transaction adapter (`packages/blockchain/src/pq/`)

Imports the PQ signer surface from plain `algosdk` (resolved to the vendored
upstream build via the `pnpm-workspace.yaml` override described in Purpose
above). This module names no third-party specifier and is no longer part of the
PQ library firewall (see Enforcement below):

- `deriveQuantumAddress(publicKey, schemeId?)` — derives the quantum account
  address for a PQ scheme (defaults to Falcon-1024; scheme-agnostic — see
  `pq/schemes.ts`'s `PQ_SCHEMES`/`PQSchemeId`).
- `pqSigningDigest(txn)` — the exact bytes a PQ signer must sign for `txn`.
  See "Key contracts" below; get this wrong and the signature is worthless.
- `assemblePQSignedTransaction({ txn, signature })` (sync) — takes a
  `PQSignature { schemeId, publicKey, signature }` (the `signature` field
  must already be computed over `pqSigningDigest(txn)`, not `txn` itself) and
  returns a plain algosdk `SignedTransaction` with its `pqsig` field
  populated. `sgnr` is set automatically whenever `txn`'s sender differs from
  the address the PQ key authorizes.

Key contracts:

- **The signer must sign the raw encoding, not a digest of it.**
  `pqSigningDigest(txn)` = `txn.bytesToSign()` — the "TX"-prefixed msgpack
  encoding itself. go-algorand verifies a PQ signature over
  `HashRep(message)` directly: `FalconVerifier.Verify` calls
  `VerifyBytes(HashRep(message), sig)` (`crypto/falconWrapper.go`), and
  `HashRep` is exactly that domain-prefixed encoding. Falcon hashes
  internally, so pre-hashing changes the message and the node rejects the
  signature with `falcon verify failed`.
  **The node is the authority here, not the SDK build.** Beware a version-string
  collision: the retired `@joe-p/algosdk@3.7.0-beta.1` publish (a build of PR
  #1102 while it was still a draft) is **not** upstream's identically-numbered
  `v3.7.0-beta.1` tag (the merged PR, which is what `libs/` now vendors). Only
  that fork publish had the bug below.

    The fork's `3.7.0-beta.1` had `addressWithSignersFromRawPQSigner` hand a raw
    signer `sha512_256(txn.bytesToSign())`, which no `pqsig`-capable algod
    accepts; this branch briefly signed that preimage and a differential test
    pinned the parity, which is exactly how a wrong preimage shipped silently — no
    node verified `pqsig`, so nothing caught it. Both `@joe-p/algosdk@3.7.0-beta.2`
    and the upstream tag now vendored sign `bytesToSign()` verbatim
    (`src/pq-signer.ts`), so the SDK and the node now agree and
    `quantumAdapter.spec.ts` asserts full byte-parity (signature included,
    since this Falcon build is deterministic) rather than envelope-only. That
    parity is the regression pin: if a later build reintroduces a pre-hash, it
    fails. **Whatever signs on the other side of this seam (KMS, hardware,
    etc.) must sign `pqSigningDigest(txn)`, which is `txn.bytesToSign()`
    verbatim.**

- Rekey (`sgnr`) is derived automatically by `assemblePQSignedTransaction`
  whenever the transaction's sender differs from the address the PQ key
  authorizes; no explicit sender override is threaded through today.

Real algosdk objects cross this seam in both directions — `pqSigningDigest`
takes a `Transaction` and `assemblePQSignedTransaction` returns a
`SignedTransaction` — only the signature itself (the `PQSignature.signature`
field) is raw bytes.

**Official swap:** point the `algosdk` catalog entry in `pnpm-workspace.yaml` at
the published release and delete its `overrides` entry — no changes to this
module are required. Quantum
transactions already assemble as plain `SignedTransaction`s with `pqsig` set
(see PQ-023 below), so there is no byte-threading left to delete when `pqsig`
becomes mainline.

## Swap-back procedure

1. **Official crypto lib** — implement a new `PQSignatureProvider` and change
   the `getPQProvider` factory line (Seam A). One module.
2. **Official published algosdk with `pqsig`** — when 3.7.0 reaches npm, set
   the `algosdk` catalog entry in `pnpm-workspace.yaml` to `^3.7.0` and delete
   its `overrides` entry, per the `SWAP-BACK:` comment there. That override is
   the only thing pinning the vendored build, so removing it hands resolution
   back to the catalog range. No **source** file changes are required —
   quantum transactions already assemble as plain `SignedTransaction`s with
   `pqsig` set (Seam B, PQ-023 below), so there is no byte-threading to remove,
   and `algosdkPqSupport.spec.ts` keeps passing unchanged (it fails loudly if
   the resolved build ever loses the PQ surface). Then delete `libs/` and
   `tools/vendor-algosdk.sh`. Expect a brand-new official 3.7.0 to sit inside
   the 7-day `minimumReleaseAge` window for its first week; wait the window out
   rather than adding a carveout for a package that no longer needs one.

**The keystore family shortens neither step.** Adopting
`@algorandfoundation/react-native-keystore` / `keystore-core` moved custody of
the Falcon private key, and nothing else: the keystore stops at the signature
boundary and ships no `pqsig` field, no PQ address encoding and no transaction
assembly, so it does nothing for step 2. Nor does it remove
`@joe-p/react-native-falcon` or `falcon-1024` (step 1) — canary.14 declares both
as optional peers and loads them as its own Falcon binding.

Seam A's source files carry a `// SWAP:` marker pointing back here; the
vendored algosdk's swap point lives in the `SWAP-BACK:` comment in
`pnpm-workspace.yaml` instead.

## Enforcement

`packages/blockchain/src/pq/__tests__/pqLibraryFirewall.spec.ts` scans every
`.ts`/`.tsx` file under `packages/` and `apps/` and fails CI if
`@joe-p/react-native-falcon` or `falcon-1024` (including a deep import like
`falcon-1024/wasm`) appears outside the one remaining seam directory,
`packages/kms/src/crypto/pq` (Seam A). `algosdk` is not part of this forbidden
pattern — the PQ transaction surface now ships in official `algosdk` itself. It also asserts that seam's `wasmFalconProvider.ts`
still imports `falcon-1024`, so a silent rename can't make the guard vacuous.

It is a **grep over shipped source, not a proof**, and it has three
deliberate, accepted blind spots — all documented in the spec itself, none of
them shipped code:

- `__tests__` directories tree-wide (tests legitimately import the PQ libs).
- `*.config.ts` / `*.config.tsx` (a bundler `external:` entry names the
  package as a build directive, not a runtime import).
- `tools/` is not a scanned root at all;
  `tools/localnet-quantum-check.ts` imports `falcon-1024` directly on purpose.

The pqImportSideEffects spec is the complementary guard for the thing a grep
cannot see: it asserts that importing the PQ barrel **and**
`getPQProvider.native.ts` does not _evaluate_ either Falcon library, which is
what actually crashes the app at startup.

## Scope note

PQ-018 (the seam integration) established the seams. Submission is no longer
gated (PQ-019/PQ-021 — see the "Submission is quantum-agnostic" bullet under
PQ-006 above): a quantum-signed group broadcasts through the ordinary
algod/callback transports unchanged. Whether it lands on-chain depends
entirely on the node, not on any app-side check — and as of 2026-07-30 a
`pqsig`-capable node exists (`algorand/algod:master` under consensus `future`),
so a quantum send now confirms on a correctly configured LocalNet. Public
networks still reject it (see PQ-023 below).

## PQ-006 / PERA-4488 — local signing (landed)

Quantum accounts now sign locally end-to-end on real Falcon-1024:

- **KMS runtime** — `useQuantum` mints the signing child through the keystore's
  `falcon-1024` generator and derives the address with `deriveQuantumAddress`
  (Seam B); `useKMS.signTransactionsWithKey`/`signDataWithKey` produce real
  Falcon signatures through `keyStore.sign`, with the private key sealed and
  never reaching JS; `getQuantumPublicKey(keyPairId)` exposes the recorded
  public key (guarded by `FALCON_CHILD_KEY_TYPE`). The three keygen/sign mocks
  were retired.
- **No more byte carrier (PERA-4653)** — the resolved `algosdk` fork's
  `SignedTransaction` accepts `pqsig` directly, so a PQ-signed transaction is
  now a plain `SignedTransaction`, encoded through the ordinary
  `encodeSignedTransaction` path like any other. The former
  `QuantumSignedTransaction { txn, pqSignedBytes }` carrier,
  `PeraSignedTxnResult` and `isQuantumSignedTransaction` are deleted; see
  Seam B above for the current `pqSigningDigest`/`assemblePQSignedTransaction`
  surface.
- **One shared strategy (PERA-4653)** — `createQuantumStrategy` and
  `quantumSignerActor` are deleted. Quantum accounts sign through the same
  `createLocalKeyStrategy` / `localKeySignerActor` as Algo25/HD: `canSign`
  is just `hasSigningKeys`, with no separate quantum branch.
  `useLocalKeyTransactionSigner` calls `useKMS().getPQSigningInfo(keyPairId)`
  once per call — the single place the scheme is decided — and signs
  `pqSigningDigest(txn)` (not the raw encoding) when it returns non-null,
  assembling the result via `assemblePQSignedTransaction`. Arbitrary-data and
  ARC-60 already used the shared `standardDataSigning` helpers, so those were
  unaffected.
- **Machine routing** — `determineSignerType` and `ResolvedSignerType` no
  longer have a `'quantum'` case; a quantum auth account (its own or via
  rekey either direction) classifies as `'localKey'` exactly like algo25/HD,
  since quantum accounts satisfy `hasSigningKeys` (they carry a `keyPairId`
  too). `assemblePQSignedTransaction` sets `sgnr` itself from `txn.sender` vs.
  the signer's derived quantum address — the local-key signer does not
  compute it for the PQ branch.
- **Submission is quantum-agnostic (PQ-019/PQ-021)** — no gate or mock: a
  quantum-signed group is a plain `PeraSignedTransaction` with `pqsig` set,
  so it broadcasts through the ordinary algod/callback transports unchanged.
  It reaches the chain only on a `pqsig`-capable node. One now exists
  (`algorand/algod:master` under consensus `future`, verified 2026-07-30 — see
  PQ-023); default LocalNet and every public network still reject it at submit.

## PQ-020 — native on-device Falcon (landed; device-verified 2026-07-30)

`getPQProvider()` returns the WASM provider in node/tests and
`createRNFalconProvider()` (`@joe-p/react-native-falcon`, a synchronous Nitro
module, lazy-`require`d) on the React Native runtime. `apps/mobile/plugins/withFalconNitro.js`
wires the New Architecture for prebuild. **The native module is confined to the
Seam A directory** like every other `@joe-p/*` import.

### On-device verification checklist (not runnable in CI)

1. `pnpm --filter mobile exec expo prebuild --clean` (respect the arm64-sim
   MLKit-exclusion pattern for iOS).
2. Build iOS + Android debug; confirm the nitro module autolinks (pod install /
   Gradle) — `withFalconNitro.js` only pins New Architecture; if autolinking
   needs more, extend the plugin.
3. In a dev build with `enable_quantum_accounts` on: create a quantum account,
   confirm the address matches `deriveQuantumAddress` (native pubkey = 1793 B).
4. Sign a payment; confirm the native module produces a Falcon signature
   (≤ 1232 B compressed) over `pqSigningDigest(txn)` and that
   `assemblePQSignedTransaction` yields a `pqsig` `SignedTransaction`.
   Against a LocalNet running `algorand/algod:master` under consensus `future`,
   **the send should confirm on-chain**; against any public network or a
   default LocalNet it will not (see PQ-023 below).

**Result (2026-07-30, iOS simulator, algod 4.8.298720-master / consensus
`future`):** all four steps pass. A quantum account created in-app signs with the
native nitro module and its payment **confirms on-chain** — the block carries
`sch=f1`, `fee=3000` (the 3× PQ multiplier), `pk[0]=10` and a variable-length
compressed signature (1234 B), and the app shows "Transaction Processed".

> **Quantum accounts created by earlier builds may be permanently unusable —
> recreate them.** This is a stored-**public-key** problem, independent of the
> preimage fix above. Step 3 checked the native public key's _length_ (1793 B) but never
> its _encoding_, which nothing could verify until a `pqsig` node existed. An older
> test account on this device had a stored public key whose header byte was `164`
> instead of the correct `0x0A`, and every send from it is rejected with
> `error code -3` (`FALCON_ERR_FORMAT` — the key fails to **decode**), while a
> freshly created account confirms. Note a bad stored key is invisible from the
> address, since `PQAddress(scheme, salt, publicKey)` stays self-consistent with
> whatever bytes were stored, so the authorizer check still passes. When
> triaging, read the numeric Falcon code: **-3 `FORMAT`** means bad key/signature
> _bytes_, **-4 `BADSIG`** means a wrong signing _preimage_.

### Keystore-custody additions to the checklist (not runnable in CI)

The four steps above were verified against the pre-keystore custody path.
Moving custody into `@algorandfoundation/react-native-keystore` canary.14
re-opens them and adds one item that nothing in CI can cover.

5. **Native-vs-WASM Falcon parity — the one thing no automated test in this
   repo covers.** `keystoreFalconParity.spec.ts` proves `keystore-core`'s
   Falcon shim is byte-identical to the WASM `falcon-1024` for both the
   keypair and the signature, but on device the keystore injects
   `@joe-p/react-native-falcon` instead, so seed → keypair → signature parity
   for the **native** module is unproven. Create a quantum account on device
   from `__fixtures__/quantum.ts`'s known mnemonic (`QUANTUM_TEST_MNEMONIC`)
   and confirm the in-app address matches `QUANTUM_TEST_ADDRESS`, which that
   fixture derives off-device through `getPQProvider()`. A mismatch means the
   native module and the WASM build disagree on derivation, and every address
   this repo computes off-device is wrong for on-device use.
6. Fresh install: create an algo25, an HD and a quantum account; all three
   persist across a cold start.
7. Sign a transaction from the quantum account and confirm it on-chain
   (requires a `pqsig`-capable node — see PQ-023).
8. Confirm the biometric-prompt frequency is acceptable. canary.14 deliberately
   removed canary.13's 60-second module-level plaintext master-key cache, so
   prompts are more frequent; suppression now depends on the OS via
   `authenticationValidityDuration`, which needs a `react-native-keychain@10`
   patch that upstream ships unapplied and this work deliberately did not add.
9. Upgrade an existing canary.13 install in place — do not reinstall, or the
   one interesting path goes untested. canary.14 changed the MMKV layout from a
   bare `<keyId>` blob to `m/<id>` (sealed material) + `k/<id>` (metadata), and
   `extensions/provider/src/keystore/migrateKeystoreLayout.ts` re-indexes,
   re-seals and re-labels the old records on first launch. Confirm the boot log
   reports every account (`Keystore layout migrated`, `failed: 0`) and that a
   quantum account minted before keystore custody is re-minted from its parent
   (`Quantum key material repaired`) — that account holds a public key only,
   because signing used to re-derive from the seed each time, so a migration
   alone cannot fix it.

### Known broken / deferred after the canary.14 migration

- **Web is knowingly broken.** Metro aliases
  `@algorandfoundation/react-native-keystore` to the vendored
  `extensions/keystore-chrome` for `platform === 'web'`, and that package is a
  hand-port of canary.12 with no engine factory and no WebCrypto seal helpers.
  `extensions/keystore-chrome/src/canary14-unsupported.ts` throws with a
  message naming the cause rather than failing opaquely several frames deeper.
  The fix is the deferred `@algorandfoundation/keystore-web` port, which needs
  its own plan.
- **Android passkeys are split-brain.**
  `react-native-passkey-autofill@canary.22`'s native credential provider writes
  a bare `credentialId` record shaped `{iv, tag, content}`, while canary.14
  reads and writes `m/`/`k/`-prefixed ids shaped `{iv, content}`. The two ends
  no longer meet. This is externally blocked on an upstream release and must be
  raised with the library authors; it is not fixable from this repo.
  It is, however, actively **destroyable** from this repo, which is why
  `migrateKeystoreLayout` skips those records instead of migrating them: the
  provider uses the same MMKV instance (`PASSKEYS_MMKV_ID = "keystore"`) and the
  same `app-secret` master key, so its credentials decrypt as ordinary
  canary.13 entries. Migrating one deletes the bare id the provider reads back
  by and drops its biometric-wrapped `privateKeyEnc`, which is an object rather
  than key bytes. They are identified by `type: 'hd-derived-p256'` plus
  `metadata.origin` and `metadata.userHandle`.
- **Update:** `bootstrapPasskeyAutofill`'s HD-root resolver (renamed
  `configureParentKey`) is no longer the no-op described above — it now scans
  the plaintext `k/` bucket directly (`findHdRootMetadata`) rather than going
  through `fetchSecret`, and correctly finds the root. See
  `packages/passkeys/src/native/README.md` for the current state of the
  Android/iOS passkey split.

## PQ-023 — unified signing path, generic `PQSignature` (landed)

Quantum accounts no longer have a parallel code path anywhere in signing or
submission:

- **Signing** — `useLocalKeyTransactionSigner` is the only signer for
  key-backed accounts (Algo25, HD wallet, quantum alike). It asks
  `useKMS().getPQSigningInfo(keyPairId)` once per call; when that returns
  non-null it signs `pqSigningDigest(txn)` (never the raw encoding — see "Key
  contracts" above) and assembles the result with
  `assemblePQSignedTransaction`. `createQuantumStrategy` and
  `quantumSignerActor` are deleted; there is no `'quantum'` case in
  `determineSignerType`/`ResolvedSignerType` (see PQ-006 above).
- **`PQSignature`** (`packages/blockchain/src/models/index.ts`) — the generic,
  scheme-agnostic shape carried across this boundary: `{ schemeId, publicKey,
signature }`. `schemeId` selects the wire scheme (`PQSchemeId`); the address
  salt is derived from `(scheme, publicKey)` and is therefore not carried on
  the type.
- **How far scheme-genericity actually goes.** The **transaction assembly and
  signing path** is scheme-agnostic end to end: `PQSignature`,
  `pqSigningDigest`, `assemblePQSignedTransaction`, `deriveQuantumAddress`,
  `PQSignatureProvider.scheme` (which `getPQSigningInfo` now reports rather
  than hardcoding a literal) and `useLocalKeyTransactionSigner` all thread
  `PQSchemeId` through generically — a second scheme needs no new types there
  and no new signing branch. Two things outside that path are still
  single-scheme and a second scheme must fix them first (both documented at
  `packages/blockchain/src/pq/schemes.ts`, both out of scope for PQ-023):
    - **Fee shape** — `fees/feeCalculator.ts`'s `CalculateMinTxnFeeParams`
      carries one `pqMultiplier` and a boolean `isPQSigner`. One multiplier
      cannot express two schemes with very different signature sizes
      (Falcon-1024 ≈ 1.2 KB, ML-DSA-65 ≈ 3.3 KB), and `isPQSigner` is derived
      from `isQuantumAccount(authAccount)` in the fee path, where the account
      carries no scheme — so the scheme is not retrievable there at all. A
      second scheme means a scheme-keyed multiplier and threading the scheme,
      not a boolean, into fee calculation.
    - **Key ids** — `quantumSignKeyId(seedId)`
      (`packages/kms/src/models/keys.ts`) yields exactly one child id per seed
      (`${seedId}-quantum`), so one seed cannot host two schemes without an id
      collision. Per-seed multi-scheme support means keying that id by scheme.
- **`pqSigningDigest(txn)` preimage contract** — `txn.bytesToSign()`, the
  domain-prefixed msgpack encoding itself, NOT a digest of it. This is the one
  fact in this document with the highest cost if it drifts, and it did drift:
  until 2026-07-30 this seam signed `sha512_256(txn.bytesToSign())` (the
  convention of the retired `@joe-p/algosdk@3.7.0-beta.1` publish — NOT
  upstream's identically-numbered tag, which is unaffected) and a differential
  test pinned that parity, so nothing caught it while no node verified `pqsig`.
  The first `pqsig`-capable algod rejected every such signature with `falcon
verify failed`. Later SDK builds — `@joe-p/algosdk@3.7.0-beta.2` and the
  upstream `v3.7.0-beta.1` tag now vendored — sign `bytesToSign()`, which is
  why byte-parity is now assertable again. See Seam B's
  "Key contracts" above for the upstream source that settles it. Whatever signs
  on the other side of Seam B (KMS, hardware, etc.) must sign
  `pqSigningDigest(txn)` exactly as returned.
- **LocalNet verification** — `pnpm localnet:quantum-check` (shipped on this
  branch; documented in `README.md`) exercises derive → fund → sign →
  assemble → submit → confirm against a real node. It checks **full byte
  parity** against algosdk's own PQ signer (see the preimage bullet below)
  and then broadcasts. Against `algorand/algod:master` under consensus
  `future` it reports **PASS: confirmed in round N**; on a node without `pqsig`
  it reports **PENDING at exit 0** via the narrow `PQSIG_UNSUPPORTED` match.
  Any _other_ submission failure, and any accepted-but-unconfirmed
  transaction, is a loud FAIL — **do not widen the tier logic to make a
  failure look like PENDING.** Alongside it, manual verification comprises the
  on-device checklist above plus `quantumAdapter.spec.ts`.
- **A `pqsig`-capable algod now exists: `algorand/algod:master`** — verified
  2026-07-30. `pqsig` landed in go-algorand master
  (`data/transactions/pqsig.go`; `SignedTxn.PQsig` with `codec:"pqsig"`), and
  consensus **v42** sets `EnablePQSchemeFalcon1024 = true` — a declared release
  version, not `vFuture`. What runs where:
    - `algod` 4.7.4-stable (what `algokit localnet start` runs by default) and
      `algorand/algod:nightly` (still 4.7.2680 as of 2026-07-30) both **lack**
      `pqsig` entirely and reject it with
      `no matching struct field found ... key pqsig`.
    - `algorand/algod:master` (4.8.298720, commit 88fe542f) **has** it.
      Two things are needed together — the master image AND a genesis whose
      consensus enables the scheme. AlgoKit's `algod_network_template.json` sets no
      `ConsensusProtocol`, so it defaults to the current released protocol with
      Falcon off; adding `"ConsensusProtocol": "future"` (which inherits v42) turns
      it on. With both in place, `pnpm localnet:quantum-check` reports
      **PASS: confirmed in round N** — a Falcon-signed transaction genuinely lands
      in a block. Still nothing on mainnet or public testnet.
