# Quantum (Post-Quantum) Integration

## Purpose

Pera's quantum (post-quantum, Falcon-1024) accounts use Joe Polny's interim PQ
libraries — the `algosdk` beta fork and the WASM `falcon-1024` package —
because official Algorand support for `pqsig` transactions and Falcon signing
is not yet mainline. The Falcon libraries are confined behind one swap seam so
they can be replaced with official Algorand code later via a one-module
change. The algosdk fork is installed under the official `algosdk` package
name via a pnpm catalog alias + global override in `pnpm-workspace.yaml`, so
application code (including Seam B below) imports plain `algosdk`; its swap
point is a workspace-config change described there (see the `SWAP-BACK:`
comment and "Swap-back procedure" below), not a source-level import.

## Seam A — PQ crypto provider (`packages/kms/src/crypto/pq/`)

Pure crypto, with no SDK or address coupling:

- `PQSignatureProvider` — the interface (`scheme`, `publicKeyLength`,
  `generateKeypairFromSeed`, `sign`).
- `wasmFalconProvider.ts` — wraps WASM `falcon-1024`; used in node, vitest and
  the web/extension build.
- `rnFalconProvider.ts` — wraps the native `@joe-p/react-native-falcon` Nitro
  module; used on iOS/Android (PQ-020, landed — see below).
- `getPQProvider()` / `getPQProvider.native.ts` — both providers ship today.
  Selection is a build-time choice, not a runtime check: Metro's standard
  `.native.*` platform-extension resolution swaps in the native file for iOS
  and Android, so no consumer branches on platform.

**Official swap:** implement a new `PQSignatureProvider` and change both
`getPQProvider` factory files (node/web and native). Two modules.

## Seam B — PQ transaction adapter (`packages/blockchain/src/pq/`)

Imports the PQ signer surface from plain `algosdk` (resolved to the fork via
the `pnpm-workspace.yaml` alias described in Purpose above). This module
names no third-party specifier and is no longer part of the PQ library
firewall (see Enforcement below):

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

- **The signer must sign the digest, not the raw encoding.** `pqSigningDigest(txn)`
  = `sha512_256(txn.bytesToSign())` — SHA-512/256 over the "TX"-prefixed
  msgpack encoding. This is exactly what algosdk's own
  `addressWithSignersFromRawPQSigner` hands to a raw signer callback (see the
  fork's `pq-signer.ts`), and a differential test in `quantumAdapter.spec.ts`
  pins it by asserting our assembled bytes are byte-identical to the fork's
  own signer output for the same key. **Whatever signs on the other side of
  this seam (KMS, hardware, etc.) must sign `pqSigningDigest(txn)`, never
  `txn.bytesToSign()` directly** — the deleted `assembleQuantumSignedTxn`
  threaded a pre-computed signature through verbatim without pinning what it
  was a signature over, which is exactly how a wrong preimage would have
  shipped silently: no node verifies `pqsig` today, so nothing would have
  caught it.
- Rekey (`sgnr`) is derived automatically by `assemblePQSignedTransaction`
  whenever the transaction's sender differs from the address the PQ key
  authorizes; no explicit sender override is threaded through today.

Real algosdk objects cross this seam in both directions — `pqSigningDigest`
takes a `Transaction` and `assemblePQSignedTransaction` returns a
`SignedTransaction` — only the signature itself (the `PQSignature.signature`
field) is raw bytes.

**Official swap:** change the `algosdk` catalog entry (and its matching
`overrides` entry) in `pnpm-workspace.yaml` from the fork alias to the
official release — no changes to this module are required. Quantum
transactions already assemble as plain `SignedTransaction`s with `pqsig` set
(see PQ-023 below), so there is no byte-threading left to delete when `pqsig`
becomes mainline.

## Swap-back procedure

1. **Official crypto lib** — implement a new `PQSignatureProvider` and change
   the `getPQProvider` factory line (Seam A). One module.
2. **Official algosdk with `pqsig`** — change the `algosdk` catalog entry (and
   its matching `overrides` entry) in `pnpm-workspace.yaml` from the fork
   alias to the official release, per the `SWAP-BACK:` comment there. No
   **source** file changes are required — quantum transactions already assemble
   as plain `SignedTransaction`s with `pqsig` set (Seam B, PQ-023 below), so
   there is no byte-threading to remove. Two further **workspace-config** edits
   are: remove the now-dead `@joe-p/algosdk` entry from
   `minimumReleaseAgeExclude` (that entry matches by resolved package name, so
   it covers the `algosdk` alias too — there is no separate `algosdk` entry),
   and remove the matching `algosdk` `overrides` entry. Expect a brand-new
   official 3.7.0 to sit inside the 7-day `minimumReleaseAge` window for its
   first week; wait the window out rather than adding a carveout for a package
   that no longer needs one.

Seam A's source files carry a `// SWAP:` marker pointing back here; the
algosdk fork's swap point lives in the `SWAP-BACK:` comment in
`pnpm-workspace.yaml` instead.

## Enforcement

`packages/blockchain/src/pq/__tests__/pqLibraryFirewall.spec.ts` scans every
`.ts`/`.tsx` file under `packages/` and `apps/` and fails CI if
`@joe-p/react-native-falcon` or `falcon-1024` (including a deep import like
`falcon-1024/wasm`) appears outside the one remaining seam directory,
`packages/kms/src/crypto/pq` (Seam A). `algosdk`/`@joe-p/algosdk` is not part
of this forbidden pattern. It also asserts that seam's `wasmFalconProvider.ts`
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
entirely on the node, not on any app-side check — and **no algod available
today accepts `pqsig`**, LocalNet included (see PQ-023 below).

## PQ-006 / PERA-4488 — local signing (landed)

Quantum accounts now sign locally end-to-end on real Falcon-1024:

- **KMS runtime** — `useQuantum` generates the real keypair + address via the
  provider (Seam A) and `deriveQuantumAddress` (Seam B); `useKMS.signWithQuantumSeed`
  produces real Falcon signatures (secret key zeroed in `finally`);
  `getQuantumPublicKey(keyPairId)` exposes the committed public key (guarded by
  `FALCON_CHILD_KEY_TYPE`). The three keygen/sign mocks were retired.
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
  It reaches the chain only on a `pqsig`-capable node, and **no such algod
  exists yet** — every node available today (LocalNet included) rejects it at
  submit.

## PQ-020 — native on-device Falcon (landed; device verification pending)

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
   **No on-chain confirmation is expected** — submission is not gated, but no
   public algod accepts `pqsig` yet (see PQ-023 below).

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
- **`pqSigningDigest(txn)` preimage contract** — `sha512_256(txn.bytesToSign())`.
  This is the one fact in this document with the highest cost if it drifts:
  an earlier revision of this seam threaded a pre-computed signature through
  without pinning what it was a signature over, which is exactly how a wrong
  preimage would have shipped silently, since no node verifies `pqsig` today.
  Whatever signs on the other side of Seam B (KMS, hardware, etc.) must sign
  `pqSigningDigest(txn)`, never `txn.bytesToSign()` directly.
- **LocalNet verification** — `pnpm localnet:quantum-check` (shipped on this
  branch; documented in `README.md`) exercises derive → fund → sign →
  assemble → submit against a real node. It asserts everything that can be
  asserted today, including that our assembled bytes are byte-identical to
  algosdk's own PQ signer output, and then attempts broadcast. Because no
  available algod accepts `pqsig` (next bullet), the expected outcome today is
  **PENDING at exit 0** — that is the designed result, not a failure, and the
  narrow `PQSIG_UNSUPPORTED` match is what keeps it meaningful: any _other_
  submission failure, and any accepted-but-unconfirmed transaction, is a
  loud FAIL. **Do not "fix" the tier logic to make PENDING go away.** The
  script converts to a true PASS, unchanged, the day a `pqsig`-capable algod
  ships. Alongside it, manual verification comprises the on-device checklist
  above plus the differential test in `quantumAdapter.spec.ts`.
- **No available algod accepts `pqsig` yet** — verified as of 2026-07-28: both
  `algod` 4.7.4-stable (the version this repo's `algokit localnet start`
  runs) and `algorand/algod:nightly` build 2680 reject transactions carrying a
  `pqsig` field, with `no matching struct field found ... key pqsig`. There is
  no fork-built algod anywhere in this repo, LocalNet included. Consequently a
  quantum-signed transaction **cannot be confirmed on any network today** —
  not mainnet, not testnet, not LocalNet. Everything up to submission is
  verified; broadcast is not.
