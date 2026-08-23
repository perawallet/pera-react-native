# Quantum (Post-Quantum) Integration

## Purpose

Pera's quantum (post-quantum, Falcon-1024) accounts sign against **official,
published `algosdk`**. The `pqsig` field and the scheme-agnostic PQ signer
surface (upstream PR #1102) shipped in `3.7.0`, so the `algosdk` catalog range
in `pnpm-workspace.yaml` is the whole wiring — there is no override, no fork
and no vendored build. The interim PQ libraries left are
`@joe-p/react-native-falcon` (native, and what actually runs on device) and the
WASM `falcon-1024` package, both confined behind a single swap seam so they can
be replaced with official Algorand code via a one-module change.

Two `algosdk` stand-ins preceded 3.7.0. Both are gone, but the distinction
between them still matters when reading this document's history sections,
because only the first carried a signing bug:

- **`@joe-p/algosdk@3.7.0-beta.1`** — a build of PR #1102 while it was still a
  draft. Its `addressWithSignersFromRawPQSigner` signed the wrong preimage; see
  "Key contracts" below.
- **A vendored tarball of upstream's `v3.7.0-beta.1` tag** — the merged PR,
  identically numbered but unaffected by that bug. The tag was never published
  to npm, so it was built from source and forced in through an `overrides`
  entry. Address derivation, the `pqsig` msgpack schema and signed-transaction
  encoding are byte-for-byte identical to released 3.7.0. `pq-signer.js` is the
  sole exception and only additively: 3.7.0 adds an `emptyTxnSigner` for fee
  simulation, leaving `txnSigner`'s `rawSigner(txn.bytesToSign())` untouched.

Application code — including Seam B below — has always imported plain
`algosdk`, so neither stand-in nor its removal touched an application source
file.

Because a build below 3.7.0 still resolves, installs and type-checks while
silently having no way to sign a quantum account, two gates keep the floor
honest: `tools/check-single-algosdk.mjs` (pre-push) asserts the resolved
version is a published release satisfying the catalog range, and
`packages/blockchain/src/pq/__tests__/algosdkPqSupport.spec.ts` asserts the PQ
surface itself.

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

Imports the PQ signer surface from plain `algosdk` (official 3.7.0, resolved by
the catalog range described in Purpose above). This module names no third-party
specifier and is no longer part of the PQ library firewall (see Enforcement
below):

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
  `v3.7.0-beta.1` tag (the merged PR, whose PQ path is byte-identical to
  released 3.7.0). Only
  that fork publish had the bug below.

    The fork's `3.7.0-beta.1` had `addressWithSignersFromRawPQSigner` hand a raw
    signer `sha512_256(txn.bytesToSign())`, which no `pqsig`-capable algod
    accepts; this branch briefly signed that preimage and a differential test
    pinned the parity, which is exactly how a wrong preimage shipped silently — no
    node verified `pqsig`, so nothing caught it. Both `@joe-p/algosdk@3.7.0-beta.2`
    and released 3.7.0 sign `bytesToSign()` verbatim
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

**Official swap: done.** This module needed no change when the published
release landed — quantum transactions already assemble as plain
`SignedTransaction`s with `pqsig` set (see PQ-023 below), so there was no
byte-threading to delete once `pqsig` became mainline.

## Seed→keygen-seed derivation (PERA-4972)

Falcon-1024 keygen wants a 32-byte seed. Until 2026-08 this wallet fed it the
raw algo25 mnemonic entropy verbatim. go-algorand's `algokey pq` does not:
`derivePQKeySeed` in `cmd/algokey/pq_scheme.go` hashes first —
`SHA512_256("PQK" || scheme || entropy)` — before calling Falcon keygen. The
mismatch is silent: both produce a valid, self-consistent Falcon account, so
nothing errors. It just isn't the _same_ account, so the 25 words a user wrote
down restored a different address in Pera than in `algokey`, `goal`, or any
other Algorand tool. `derivePQKeygenSeed`
(`packages/blockchain/src/pq/derivation.ts`) implements the canonical formula;
`useQuantum.createQuantumKey` calls it before minting.

**Why the bug existed: the hop is nobody's job by default.**
`@algorandfoundation/keystore-core`'s Falcon shim (the `FALCON_KEY_TYPE`
branch in its `generate` handler) takes whatever is in `params.seed` and
passes it to `falcon.generateKey` unchanged — it does no hashing of its own.
The keystore does have a generic entropy→seed conversion path, `withSeed`, but
it only covers the `bip39` and `algo25` key types; there is no quantum case.
So the canonical hop is entirely the caller's responsibility, and until this
change nothing performed it — the keystore's contract and the protocol's
contract simply didn't line up, with no error at any layer to say so.

**Legacy derivation is frozen, not deleted, and permanently supported.** A
quantum address minted with the raw-entropy (legacy) derivation can be the
`auth-addr` that other accounts have rekeyed to. Those accounts have no
mnemonic of their own to re-derive from — the only way to sign for them is the
legacy key that produced that specific address. Retiring legacy derivation
would orphan every account rekeyed to a legacy-derived address, so both
derivations mint and sign forever; only which one _new_ accounts default to
has changed (canonical, per Task 5).

**Marker and child-id scheme** (Tasks 2–3, `packages/kms/src/models/keys.ts`):

- `PQDerivation = 'legacy' | 'pqk1'` is stamped into the signing child's
  `params.pqDerivation` at mint time (not stripped by the engine's
  seed/entropy/passphrase/salt filter) and read back from `metadata` by the
  repair path. An unmarked child fails the repair closed rather than guessing.
- `quantumSignKeyId(seedId, derivation)` returns `${seedId}-quantum` for
  `legacy` (the historical bare form — existing `keyPairId`s must keep
  resolving unchanged) and `${seedId}-quantum-pqk1` for `pqk1`. One seed can
  therefore host both a legacy and a canonical child side by side.

**`extensions/provider` declares its own copies of these constants**
(`extensions/provider/src/keystore/pqDerivation.ts`) rather than importing
`PQ_DERIVATION_LEGACY`/`PQ_DERIVATION_CANONICAL`/`PQDerivation` from
`packages/kms` or `derivePQKeygenSeed` from `packages/blockchain`. Both would
be a workspace dependency cycle — `extensions/provider` is what those packages
call through `getProvider()`. The two copies are pinned against drift only by
each side's own tests asserting the literal string values
(`packages/kms/src/models/__tests__/keys.test.ts`,
`extensions/provider/src/keystore/migrations/repairs/__tests__/0004-stamp-quantum-derivation.spec.ts`
and neighbors) — there is no shared source of truth to import instead.

For the same cycle reason, the repair path
(`extensions/provider/src/keystore/repairQuantumMaterial.ts` via
`singleton.ts`'s `QuantumMaterialRepairDependencies`) takes
`deriveKeygenSeed` as an **injected function** rather than importing
`derivePQKeygenSeed` directly. The app layer (which already depends on both
`packages/kms` and `packages/blockchain`) wires the real implementation in;
provider-side tests inject a stub.

**The regression pin is an external oracle, on purpose.**
`packages/blockchain/src/pq/__tests__/derivation.spec.ts` checks
`derivePQKeygenSeed` against a vector pinned in go-algorand's
`cmd/algokey/pq_test.go` (`entropy = bytes 1..32` → a specific address) — a
value computed by a different codebase, in a different language, that this
repo does not control. Every other quantum fixture here (including
`apps/mobile/src/__integration__/__fixtures__/quantum.ts`) derives its
expected address through the same provider the code under test uses, which
means a wrong derivation and its "expected" value drift together and no test
notices. That self-confirming shape is exactly how the original bug shipped
unnoticed for as long as it did. A fixture this repo cannot compute itself is
the only kind of check that can catch this bug class again.

## Swap-back procedure

1. **Official crypto lib** — implement a new `PQSignatureProvider` and change
   the `getPQProvider` factory line (Seam A). One module.
2. **Official published algosdk with `pqsig`** — ~~done~~. 3.7.0 shipped on
   2026-08-19; the catalog range moved to `^3.7.0`, the `overrides` entry,
   `libs/` and `tools/vendor-algosdk.sh` were deleted, and no **source** file
   changed. `algosdkPqSupport.spec.ts` passed unchanged across the swap, which
   is what it exists to prove. One residue to clear: the release was hours old
   when this landed, so `algosdk` sits in `minimumReleaseAgeExclude` until the
   7-day window passes — **delete that entry after 2026-08-26**.

**The keystore family shortens neither step.** Adopting
`@algorandfoundation/react-native-keystore` / `keystore-core` moved custody of
the Falcon private key, and nothing else: the keystore stops at the signature
boundary and ships no `pqsig` field, no PQ address encoding and no transaction
assembly, so it does nothing for step 2. Nor does it remove
`@joe-p/react-native-falcon` or `falcon-1024` (step 1) — canary.14 declares both
as optional peers and loads them as its own Falcon binding.

Seam A's source files carry a `// SWAP:` marker pointing back here. `algosdk`
needs no such marker: it is an ordinary catalog range now, held to the PQ floor
by `tools/check-single-algosdk.mjs` and `algosdkPqSupport.spec.ts`.

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

**What the firewall does not do is bound reach to key material.** It bounds
_specifiers_. The keystore packages publicly export Falcon binding factories —
`loadDefaultFalconBinding` from `@algorandfoundation/react-native-keystore`,
`createFalconBinding` from `@algorandfoundation/keystore-core` — and a binding
will generate a keypair and hand back a raw `privateKey`. So any file can
obtain **freshly generated** Falcon material without naming a forbidden
specifier. What it cannot do is read the keystore's existing sealed records;
that still needs the Keychain master key. Custody is enforced by the
keystore's sealed API, not by this guard — treat the firewall as protection
against accidental library coupling, not as a security boundary.

**Trap: `packages/kms`'s build output contains only the WASM provider.**
`packages/kms/dist/index.js` resolves only the WASM provider, because the
bundler resolves the base `getPQProvider.ts` and never the `.native.ts`
sibling. `@joe-p/react-native-falcon` is externalised
(`packages/kms/vite.config.ts:64`) and appears nowhere in the output;
`falcon-1024` is not in that external list, so it is inlined whole, Emscripten
glue included — `__filename` at `:7468`, `wasmBinary` at `:7531`,
`_falcon_det1024_keygen` at `:7534`.

Verify with `falcon_det1024` or `wasmBinary`, never with `falcon-1024`: that
string is also `keystore-core`'s `KeyType` value (`FALCON_CHILD_KEY_TYPE`,
`packages/kms/src/models/keys.ts:52`), and both of its hits in the bundle are
that literal, not the package — `:52` defines it and `:7766` compares against
it. `packages/blockchain/src/pq/__tests__/pqLibraryFirewall.spec.ts:50`
documents the same false positive. The factory names are no help either: the
bundler renames non-exported locals, so the WASM factory ships as `zp` at
`:7695`.

Nothing is broken today only because `apps/mobile/metro.config.js` rewrites
`@perawallet/wallet-core-*` to source, so the app never loads that build output.
Any consumer that resolves the built package instead — a node script, a future
non-Metro bundler — silently gets WASM Falcon on device.

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
   bare `<keyId>` blob to `m/<id>` (sealed material) + `k/<id>` (metadata).
   That re-indexing is no longer Pera's to do: the keystore now runs its own
   adoption revision, and Pera contributes revisions around it under
   `extensions/provider/src/keystore/migrations/` — `preflight/` before
   upstream's, `repairs/` after. Confirm every account survives the upgrade, and
   that a quantum account minted before keystore custody is re-minted from its
   parent (`Quantum key material repaired`,
   `apps/mobile/src/useAppBootstrap.ts`) — that account holds a public key only,
   because signing used to re-derive from the seed each time, so a migration
   alone cannot fix it.

    A revision's `up` must never reject. A rejection fails the whole run, and
    because the ledger entry is written only after `up` resolves, it re-runs
    next launch. A transient failure (I/O, a cancelled biometric prompt)
    clears; a deterministic one re-fails forever, with no way out but
    reinstall.

### Provider-migrations additions to the checklist (not runnable in CI)

Nothing below is catchable by a JS test — every failure mode needs a real device
with real persisted data, and most need two builds installed in sequence. Steps
11 and 12 are the ones a fresh install can never exercise.

10. **Fresh install — the brick regression.** Wipe the app, launch, create a
    wallet, confirm an account appears and can sign. A `MasterKeyNotFoundError`
    here means the migrations ledger landed in the keystore's own MMKV instance:
    `masterKeyForWrite` mints the Keychain master key only while `getAllKeys()`
    is empty (`react-native-keystore/dist/engine.js:183-184`), so any blob in
    that instance bricks first-run key creation. The ledger lives in
    `pera-provider-migrations` for exactly this reason
    (`extensions/provider/src/keystore/migrations/migrationsLedger.ts`).
11. **canary.13 install → this build, upgraded in place.** Install a `main`
    build, create one account of **each** type (hdwallet, algo25, quantum),
    create a passkey, then install this build over it without wiping. Verify all
    three accounts are present, each can sign, the existing passkey still
    authenticates, and a **new** passkey can still be created. Reinstalling
    between the two builds is what makes this test vacuous.
12. **`feat/quantum` install → this build, upgraded in place.** Install a
    pre-migration `feat/quantum` build (already `k/`+`m/`, HD-root shadow
    present), then this build over it. Verify no account vanishes and the
    bare-id shadow is gone from MMKV. This is the case
    `preflight/0001-retire-hd-root-shadow` exists for: upstream's
    `adopt-flat-records` would otherwise treat the shadow as a legacy flat
    record and write its stripped metadata over the real `k/<rootId>`, losing
    `publicKey`, `metadata.scheme` and `bip44Path`.
13. **Passkeys on both platforms.** iOS simulator and a physical Android device.
    Create, assert and delete a credential on each. Confirm the
    `needs-migration` banner appears for a pre-existing credential and clears
    once it is removed and recreated, and that the credential-provider prompt
    says "Pera", not "Rocca". Android note: `getStoredCredentials` is iOS-only
    by design (`extensions/passkey-autofill/src/service.ts:25-31`), so Android's
    passkey list is legitimately empty for un-adopted credentials — pre-existing,
    not a regression from this work.
14. **Relying-party scoping still holds.** Confirm a get-credential request for
    one origin does not surface credentials belonging to another. This is the
    whole purpose of the rebased PERA-4714 patch and the easiest thing to lose
    on a version bump: upstream still ships `processGetCredentialRequest`
    filtering on `allowCredentials` only, so the patch — not upstream — is what
    enforces scoping.
15. **Migration-banner delete gating.** With Pera **not** the active credential
    provider and at least one flagged passkey present, confirm the banner warns
    but offers no remove action, and that the row's own trash icon is withheld
    too. Re-registration is impossible in that state, so offering
    delete-and-recreate would walk the user into a lockout. Non-flagged passkeys
    must stay deletable — they are derivable from the recovery passphrase, which
    is the entire point of the flag.

#### Result of the 2026-08-17 run

Steps 10, 12, 13 and 14 pass on both platforms; step 15 passes only in its
non-flagged half (see below). Devices: Samsung SM-S901E (Android 16, SDK 36),
`com.algorand.perarn.staging`; iPhone 17 Pro simulator (iOS 26),
`com.algorandllc.perarn.staging`.

Both in-place upgrades ended in the same state: the bare-id HD-root shadow
carries a zero-length MMKV **delete tombstone**, the ledger holds preflight `4`
→ upstream `2` → repairs `3` in that order and lives in `pera-provider-migrations`,
and `<root>-passkey-main` is minted with `scheme: "pbkdf2-p256"` and
`parentKeyId` pointing at the **entropy child**, not the wallet root. Every
account survived, and a relaunch re-applied nothing.

Step 13 ran end to end against `webauthn.io` on both platforms — create, assert,
delete, then create again after the migration — and every provider-facing string
said "Pera 7 Staging". Step 14 was checked against a second relying party
(`passkey.org`) while a `webauthn.io` credential was held: Android's logcat shows
Pera's provider returning `EMPTY_RESPONSE` there and `CREDENTIALS_RECEIVED` at
`webauthn.io`, and iOS answered "You don't have any passwords or passkeys saved
for this website". On Android the credential that survived the upgrade was the
one asserted afterwards, so rematerialization is covered by the same run.

Three things worth knowing before repeating this:

- **Step 11 (canary.13 → this build) was not re-run**; it was verified earlier
  in the epic and nothing since has touched that path.
- **On the simulator, do not stage the upgrade by installing two separately
  built `.app` bundles.** Replacing an ad-hoc-signed app wipes the simulator
  keychain, so the master key does not survive and every sealed record becomes
  unreadable — which looks exactly like a migration bug and is not one. Stage it
  at the JS layer instead: install this branch's binary once, create the wallet
  against a Metro serving the base branch, then point the same binary at a Metro
  serving this one. `@algorandfoundation/react-native-keystore` ships no native
  module of its own, so nothing about that substitution is a fiction. The
  diagnostic value of the failed attempt was real, though: with the master key
  genuinely unreachable, `mint-passkey-main-key` **declined and recorded the
  root** rather than rejecting, and the app booted with its account intact —
  the decline path, exercised for real.
- **Step 15's flagged half is not device-reachable here.** The
  `metadata.migration: "needs-migration"` marker is written by the Pera 6 legacy
  import, so producing one needs a Pera 6 dataset. What _was_ checked is the
  direction that over-gating would break: with Pera removed as the credential
  provider and a non-flagged credential present, the row kept its trash icon and
  the delete went through (confirmed by tombstone, and by the screen then
  falling to the `disabled` state — which only renders when the provider is off).
  The flagged half stays covered by `settings-passkeys-delete.test.tsx`.

### Known broken / deferred after the keystore-custody migration

- **Web runs on an engine the vendored port does not supply.** Metro aliases
  `@algorandfoundation/react-native-keystore` to the vendored
  `extensions/keystore-chrome` for `platform === 'web'`, and that package is a
  partial port with no engine factory. Key storage on web works anyway:
  `extensions/provider/src/keystore/createKeystore.web.ts` composes the engine
  itself, running `keystore-core`'s orchestrator over `keystore-web`'s
  IndexedDB driver, and Metro's `.web.ts` resolution picks it. What is still
  deferred is folding that into `keystore-chrome` so the alias covers key
  storage on its own — that port is also still written against the pre-split
  `@algorandfoundation/keystore@1.0.0-canary.17` flat function API.
- **Passkey credentials are still bare-id on both platforms.** The "phase 3"
  move to the `k/`+`m/` layout landed upstream in autofill canary.23/.24 for
  the **derivation parent only**. Both providers now find the root by scanning
  `k/`, which is why the HD-root shadow record and its dual-write are gone.
  **Credential records did not move**, so the two ends still do not meet there:
  iOS's only keystore-to-credential path guards on a JSON-number-array
  `privateKey` that a split record does not carry, and Android's metadata path
  re-derives instead, which cannot reproduce a credential migrated from Pera 6.
  `packages/passkeys/src/native/README.md` is the maintained account of that
  split, of the flat-record contract in `nativeProviderRecord.ts`, and of the
  repair revision that undoes upstream's adoption of those flat records. Read
  it before touching any of them.

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
verify failed`. Later SDK builds — `@joe-p/algosdk@3.7.0-beta.2` and official
  3.7.0 — sign `bytesToSign()`, which is
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
