# Quantum (Post-Quantum) Integration

## Purpose

Pera's quantum (post-quantum, Falcon-1024) accounts use Joe Polny's interim PQ
libraries — the `@joe-p/algosdk` beta fork and the WASM `falcon-1024` package —
because official Algorand support for `pqsig` transactions and Falcon signing
is not yet mainline. These third-party libraries are confined behind two swap
seams so they can be replaced with official Algorand code later via a
one-module (or one-import) change, without touching the rest of the codebase.

## Seam A — PQ crypto provider (`packages/kms/src/crypto/pq/`)

Pure crypto, with no SDK or address coupling:

- `PQSignatureProvider` — the interface (`scheme`, `publicKeyLength`,
  `generateKeypairFromSeed`, `sign`).
- `wasmFalconProvider.ts` — wraps WASM `falcon-1024`; used in node/vitest.
- `getPQProvider()` — the factory that selects the concrete provider.

The React Native on-device provider (wrapping `@joe-p/react-native-falcon`) is
a later ticket (PQ-020); today this seam only ships the WASM provider.

**Official swap:** implement a new `PQSignatureProvider` and change the
`getPQProvider` factory line. One module.

## Seam B — PQ transaction adapter (`packages/blockchain/src/pq/`)

The **only** module importing `@joe-p/algosdk`:

- `deriveQuantumAddress(publicKey)` — derives the quantum account address.
- `assembleQuantumSignedTxn({ unsignedTxnBytes, publicKey, falconSignature })`
  (async) — decodes the unsigned txn with the fork, attaches the Falcon
  signature, and returns node-ready signed bytes carrying the `pqsig` field.

Key contracts:

- The Falcon signature must be computed over
  `SHA-512/256("TX" || msgpack(unsignedTxn))` — the fork hashes this
  internally, so callers pass the raw signature, not a pre-hashed digest.
- Rekey (`sgnr`) is derived automatically by the fork whenever the
  transaction's sender differs from the derived quantum address; no explicit
  sender override is threaded through today.

Stock `algosdk` objects never cross into the fork — only bytes go in and out.

**Official swap:** swap the `@joe-p/algosdk` import in this module. If
`pqsig` becomes part of the mainline `SignedTransaction`, delete the
byte-threading and route quantum through the normal signed-transaction path.

## Swap-back procedure

1. **Official crypto lib** — implement a new `PQSignatureProvider` and change
   the `getPQProvider` factory line (Seam A). One module.
2. **Official algosdk with `pqsig`** — swap the `@joe-p/algosdk` import in
   Seam B (`quantumAdapter.ts`). If `pqsig` becomes mainline
   `SignedTransaction`, delete the adapter's byte-threading and route quantum
   through the normal signed-transaction path.

Both seam source files carry a `// SWAP:` marker pointing back here.

## Enforcement

`packages/blockchain/src/pq/__tests__/pqLibraryFirewall.spec.ts` scans every
`.ts`/`.tsx` file under `packages/` and `apps/` (excluding `__tests__`) and
fails CI if any `@joe-p/*` or `falcon-1024` import appears outside the two
seam directories. It also asserts the seam files still import their
respective libraries, so a silent rename can't make the guard vacuous.

## Scope note

PQ-018 (the seam integration) establishes the seams only. Broadcast is
LocalNet-only until an official algod with `pqsig` support ships; submission
gating is tracked separately as PQ-019.

## PQ-006 / PERA-4488 — local signing (landed)

Quantum accounts now sign locally end-to-end on real Falcon-1024:

- **KMS runtime** — `useQuantum` generates the real keypair + address via the
  provider (Seam A) and `deriveQuantumAddress` (Seam B); `useKMS.signWithQuantumSeed`
  produces real Falcon signatures (secret key zeroed in `finally`);
  `getQuantumPublicKey(keyPairId)` exposes the committed public key (guarded by
  `FALCON_CHILD_KEY_TYPE`). The three keygen/sign mocks were retired.
- **Byte carrier** — `QuantumSignedTransaction { txn, pqSignedBytes }` +
  `PeraSignedTxnResult` + `isQuantumSignedTransaction`; `encodeSignedTransaction`
  returns the node-ready `pqSignedBytes` verbatim for the carrier. A `pqsig`
  transaction cannot be a stock algosdk `SignedTransaction`, hence the carrier.
- **Dedicated strategy** — `createQuantumStrategy` (`canSign → isQuantumAccount`)
  signs transactions into carriers via `useQuantumTransactionSigner`
  (`assembleQuantumSignedTxn`, Seam B) and reuses the shared
  `standardDataSigning` helpers for arbitrary-data + ARC-60.
- **Machine routing** — `determineSignerType` classifies quantum as its own
  `'quantum'` `ResolvedSignerType` (checked before `hasSigningKeys`, since
  quantum accounts also carry a `keyPairId`); `quantumSignerActor` runs the
  strategy. `createLocalKeyStrategy` no longer accepts quantum (single owner).
  Rekey works both ways: an Ed25519 account rekeyed to a quantum auth routes to
  the quantum strategy (the fork sets `sgnr` from `txn.sender` vs the signer's
  own quantum address); a quantum account rekeyed to Ed25519 routes to local-key.
- **Submission stays gated** — the algod transport keeps the synthetic
  `isQuantumMock` txid path; the callback transport refuses to deliver a Falcon
  carrier (`assertNoQuantumSignedTransactions`). Real broadcast is PQ-019.

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
   (≤ 1232 B compressed) and a `QuantumSignedTransaction` carrier is produced.
   **No on-chain confirmation is expected** — submission is gated (PQ-019).
