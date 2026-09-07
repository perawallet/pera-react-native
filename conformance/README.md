# Conformance suite

Vitest suites that run the app's own builders, signing pipeline, transformers
and error handling against a **real** Algorand node (LocalNet) rather than a
mock.

Only key custody is substituted: `harness/keystore.ts` swaps the React Native
Keychain driver for an in-memory one, and everything above it is the app's own
code: `signTransactionsWithLocalKey`, `resolvePQSigningInfo`,
`createLocalKeyStrategy`, `assignMinimumFeesToGroup`.
`harness/__tests__/algokey.spec.ts` and `harness/__tests__/keystore.spec.ts`
test the harness itself rather than the app, and each says so in its header;
the other files in that directory are ordinary conformance tests.

## Why mocks cannot prove this

A mock returns whatever the test tells it to, so it cannot catch the app disagreeing with a real node
about what a real node does. Two bug classes with exactly that shape have shipped here.

A wrong signing preimage passes every unit test, because the mock "node" verifies whatever the app
happened to sign. Only a real `pqsig`-capable node, which hashes the message itself, rejects a
double-hashed one. `conformance/src/suites/signing/quantum.spec.ts` now pins the preimage contract and
proves byte-parity against an independent Falcon implementation (`algokey`) before touching the node.

A wrong address derivation is equally invisible, because a mock has no chain-derived address to
disagree with. `conformance/src/suites/derivation/quantum.spec.ts` funds the independently-derived
address and asserts the chain credits the app-derived one.

The same property applies to node error strings; see
[shape-based algod error parsing](#shape-based-algod-error-parsing).

## Running

```sh
pnpm localnet          # start LocalNet if it isn't already running
pnpm test:conformance   # from the repo root, or `pnpm exec vitest run` from here
```

`src/harness/localnet.ts` fails fast with a clear message if LocalNet isn't
reachable at `http://localhost:4001`.

## `dist/` dependency (CI-relevant)

Every workspace package this suite imports is aliased in `vitest.config.ts`'s
`resolve.alias`. `@perawallet/wallet-core-blockchain` maps to
`packages/blockchain/src`, and Vite's prefix replacement means both the bare
specifier and any deep import hit `src`, never `dist`. That is not where the
problem is.

`src/suites/submission/chokepoint.spec.ts` imports `submitAndAutoRefreshCore`
from `@perawallet/wallet-core-signing`, and that file also imports the full
`@perawallet/wallet-core-blockchain` barrel (for real `toAlgodError`
classification logic the suite exercises). The barrel itself resolves fine, but
its own source has non-aliased dependencies one level out:
`fees/useMinimumFeeConfig.ts` imports `@perawallet/wallet-core-remote-config`,
and `utils/clearCustomNetworkCache.ts` imports `@perawallet/wallet-core-database`.
Neither of those is in `vitest.config.ts`'s alias list, so each resolves
through its own `package.json` `main` or `exports` field, meaning its built
`dist/`, and remote-config transitively pulls in `wallet-extension-platform` and
then `wallet-core-hardware-wallet` the same way. So a built `dist/` is required
for:

- `@perawallet/wallet-core-remote-config`
- `@perawallet/wallet-extension-platform`
- `@perawallet/wallet-core-hardware-wallet`
- `@perawallet/wallet-core-database`

If any of these has no `dist/` (e.g. a fresh clone/worktree that hasn't run a
build), the import fails at Vitest's collection step. That is an
unresolvable-import crash which takes every file in the run down, not an isolated
test failure.

These four are not independent. `wallet-extension-platform` depends on
`wallet-core-hardware-wallet`'s dist, and both `wallet-core-database` and
`wallet-core-remote-config` depend on `wallet-extension-platform`'s (building
`wallet-core-database` first fails with `Cannot find module
'@perawallet/wallet-extension-platform'`). They also aren't the full picture:
`wallet-core-remote-config` alone pulls in `wallet-core-shared`,
`wallet-extension-provider`, and (transitively through provider)
`wallet-extension-platform-driver` and the ledger extension packages, and
`conformance/tsconfig.json`'s `paths` reach further still (e.g.
`wallet-core-multisig`, `wallet-core-assets`, both pulled in via
`wallet-core-accounts`). Don't hand-enumerate the closure. Build everything and
let turbo's `dependsOn: ["^build"]` resolve the graph in order, the same way
`pnpm run build` already does for the rest of the repo:

```sh
pnpm run build
```

`@perawallet/wallet-extension-provider`'s real implementation additionally
pulls in `react-native-mmkv` (a native module that cannot load under Node);
`vitest.setup.ts` mocks it with an in-memory `keyValueStorage` stand-in instead
of building it. Only platform storage is mocked, never algod.
`@perawallet/wallet-core-accounts`'s full barrel (multisig/staking/currencies
hooks, unrelated to the submission chokepoint) is similarly stubbed, file-
scoped, in `chokepoint.spec.ts` itself.

## What runs is app code

The point of this suite is to put Pera's own functions in front of a real
node. Where a third-party library appears, it is on the _other_ side of the
comparison as an independent oracle, never on both.

| Area                                                                  | The app code under test                                                                                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope construction (`sig`, `sgnr`, `pqsig`, batching)              | `signTransactionsWithLocalKey`, the pure pipeline function `useLocalKeyTransactionSigner` delegates to                                        |
| Signature-scheme decision                                             | `resolvePQSigningInfo`, reading a live keystore snapshot                                                                                      |
| Strategy layer (capability gate, progress, backend signature payload) | `createLocalKeyStrategy`                                                                                                                      |
| Signer dispatch and rekey resolution                                  | `buildGroupSignerTypeMap`, `resolveSigningAccount`                                                                                            |
| Group fee assignment and re-grouping                                  | `assignMinimumFeesToGroup`, `groupHasQuantumSigner`                                                                                           |
| Fee arithmetic                                                        | `calculateMinTxnFee`, `calculatePQFeeSurcharge`                                                                                               |
| Address derivation                                                    | `algo25SeedToAddress`, `deriveQuantumAddress`, `derivePQKeygenSeed`, `generateMultisigAddress`, `encodeAlgorandAddress`, `prepareHDMasterKey` |
| In-memory PQ keygen (import probe, legacy-account notice)             | `getPQProvider().generateKeypairFromSeed`, `quantumAddressCandidates`                                                                         |
| Account state                                                         | `fetchOnChainAccountInformation` + `mapOnChainAccountInformation`, `fetchAccountAssetOptInRounds`                                             |
| Transaction history                                                   | `transformIndexerTransactions`, `collectAssetIds`, `computeBalanceImpacts`                                                                    |
| Multisig assembly                                                     | `assembleSignedMultisigTransactions`                                                                                                          |
| Submission                                                            | `submitAndAutoRefreshCore`                                                                                                                    |
| Error classification                                                  | `toAlgodError` / `parseAlgodMessage`                                                                                                          |

Two files under `harness/__tests__/` are deliberate exceptions, and say so in
their own headers: `algokey.spec.ts` self-tests the oracle (so a broken oracle
cannot make every parity assertion vacuous), and `keystore.spec.ts` self-tests
the in-memory driver standing in for the React Native Keychain. Neither
asserts anything about Pera's code. The other two files in that directory,
`build.spec.ts` and `localnet.spec.ts`, are ordinary conformance tests that
happen to live beside them; `build.spec.ts` in particular exercises the app's
signing path through the harness's `signWithKeystore`.

## The three-proof model

Most suites assert three independent things about a signed transaction, and
name them explicitly in the test body:

1. **Oracle parity.** The app-signed bytes match an independently-signed
   reference byte-for-byte. The reference is `algokey` (the Go SDK's
   reference CLI, shelled out to from `harness/algokey.ts`) for ed25519 and
   quantum signing, or a from-scratch reimplementation of the derivation math
   for HD/multisig/ALGO25 address derivation. This catches a wrong preimage
   or wrong derivation offline, before the transaction ever reaches a node.
   Cheap and exact.
2. **Node acceptance.** The signed bytes are broadcast to a real LocalNet
   node and confirmed. This is the proof a mock cannot fake: it exercises
   the node's own verifier, its own fee floor, its own error strings. This
   is what catches a wrong preimage. Oracle parity alone would not, when the bug
   is in what the app signs _relative to what the node expects_ rather than
   relative to another client library making the same mistake.
3. **Round-trip decode.** The confirmed transaction is read back from the
   node and decoded, then compared field-by-field against the test's
   declared `TxnIntent` (`harness/assert/intent.ts`). This catches the class
   of bug where a transaction is accepted but doesn't mean what the test
   thinks it means: a close-out silently added, a fee the composer computed
   differently from what was declared, a rekey that didn't take.

Not every suite needs all three, since a fee-pooling assertion has no oracle to
diff against and a rejection-path test never reaches confirmation. But where a
suite claims "this transaction is exactly correct," it backs the
claim with the two proofs that don't share a mistake with the code under
test (an independent oracle, and the node itself).

## Reading a decoded-diff failure

`harness/assert/roundTrip.ts`'s `expectConformant` fails with a two-column
table from `harness/assert/diff.ts`'s `formatFieldDiff`, listing only the fields
that differ, one row each:

```
submitted transaction does not match the declared intent:
field      expected              actual
amount     300000n               300000
```

Read the row, not just the failure message. `formatFieldDiff` renders every
value type distinguishably on purpose: `bigint` prints with a trailing `n`,
`Uint8Array` prints as lowercase hex, an absent field prints `(unset)`. So
`300000n` versus `300000` in the example above is not a formatting quirk, it is
the diff telling you a `number` leaked in where a `bigint` was expected, which is
exactly the class of bug CLAUDE.md's Numbers and Precision rules exist to
prevent. A hex vs `(unset)` row on `rekeyTo` means the
declared intent said "no rekey" and the chain disagrees, not a rendering
difference.

## Known gaps

Recorded rather than left silent. Each is either a deliberate scope boundary or
an open follow-up, not an oversight this doc is hiding.

1. **ARC-59 and application calls are not covered.** The checked-in
   `APP_SPEC` has `source: { approval: '', clear: '' }` and no `byteCode`;
   deploying via the repo's own `ARC59Factory` fails with algod
   `400: Cannot assemble empty program text`. Needs the upstream TEAL
   vendored in. Tracked as a follow-up ticket, not fixed here.
2. **Swaps are not covered.** Swap transaction groups are composed
   server-side; the client only validates and finishes an already-built
   group, so there is no client-side construction path for this suite to
   pin against a node.
3. **Native Falcon parity is unprovable here.** The harness signs quantum
   transactions with the WASM `falcon-1024` shim (works under Node). The
   shipped app loads the **native** `@joe-p/react-native-falcon` module,
   which is a Nitro/React-Native binding and cannot load outside a React Native
   runtime. Byte parity between the WASM shim and the native module is an
   assumption this suite rests on, not something it proves. It remains a manual
   on-device check; `packages/kms/src/crypto/pq/__tests__/keystoreFalconParity.spec.ts`
   records the same limit.
4. **Key custody is the one thing the suite substitutes.** Every signing
   decision (which payload to sign, which envelope field to fill, when to set
   `sgnr`) is the app's own
   (`signTransactionsWithLocalKey` + `resolvePQSigningInfo`). What differs is
   where the sealed bytes live: the app's `useKMS` reaches
   `getProvider().key.store`, a React Native Keychain/MMKV driver that cannot
   load under Node, so the harness supplies the same `keyStore.sign` call
   backed by an in-memory driver (`harness/keystore.ts`). The React bindings
   themselves (`useKMS`, `useLocalKeyTransactionSigner`) are not exercised;
   they hold no logic beyond wiring, which is why the logic was moved out of
   them.
5. **A corrupted group id has no typed `AlgodErrorCode`.** It falls through
   `parseAlgodMessage.ts` to `unknown_node_error`, which is one of
   `classifySubmitFailure.ts`'s `NO_NODE_VERDICT_CODES`, so a definitive
   node rejection gets misclassified as an indeterminate outcome and burns a
   pointless `verifyLandedWithRetries` cycle before surfacing. This is an
   open finding (`conformance/src/suites/submission/rejections.spec.ts`,
   the "submit a group with a corrupted group id" case), deliberately left
   unfixed here rather than inventing a new `AlgodErrorCode` enum member
   under this PR's scope. In practice it needs a hand-corrupted group id to
   trigger, which no normal signing flow produces.
6. **Per-byte fee pricing is unprovable on LocalNet.** LocalNet's suggested
   params are `fee: 0, minFee: 1000`; stepping the declared fee down on a
   1-byte and a 900-byte note rejects identically at every value below the floor.
   The floor LocalNet enforces is flat and size-independent, so there is no
   node-observable signal to pin a true per-byte rate against.
   `suites/fees/perByte.spec.ts` asserts the composer's computed fee against
   the node for both sizes and documents the rest rather than asserting
   something LocalNet cannot demonstrate.
7. **MBR conformance pins the constants and the delta, not every call
   site.** `suites/mbr/optIn.spec.ts` and
   `suites/accounts/accountState.spec.ts` prove the constants are right and that
   an opt-in moves the node-reported `minBalance` by exactly `FALLBACK_ASSET_MBR`,
   the arithmetic `useTransactionSendFlow.ts:148` performs. The call sites themselves are still hook-bound, so _that they
   apply it_ remains unproven here.
8. **Ledger hardware signing is not covered.** It needs a physical transport, and
   there is no way to simulate a hardware device from CI.

## Shape-based algod error parsing

`packages/blockchain/src/errors/parseAlgodMessage.ts` matches rejection messages on their _shape_,
never on how algod renders the numbers in them. Algod changes those renderings between versions, and
a regex written against one rendering silently stops matching: overspend has been rendered both as
`MicroAlgos:{Raw:300000}` and as `MicroAlgos:300mA`, an expired-transaction round range has used both
`outside of A-B` and `outside of A--B`, and a pooled group fee has been reported both as
`txgroup had 1999 in fees, which is less than the minimum 2000` and as
`txgroup with 5.999mA fees is less than 6mA (usage=6.000000 * base=1mA)`.

**A silent non-match is expensive, not cosmetic.** An unmatched message falls through to
`unknown_node_error`, which is one of `classifySubmitFailure.ts`'s `NO_NODE_VERDICT_CODES`. A
definitive, immediate rejection is then treated as an indeterminate outcome: the user waits through
`submitAndAutoRefreshCore`'s verification retry loop and still gets "outcome unknown" for a
transaction algod refused on the first response. Overspend is the most common rejection a wallet
produces, so this is a live user-facing cost.

Two error types deliberately carry less than the message appears to offer:

- `AlgodErrorParamsByCode.overspend` carries only `address`, with no `balance`, `spent` or `missing`.
  The rendered balance is the account's balance _minus the rejected transaction's own fee_, so
  nothing in this codebase can populate those fields correctly.
- `AlgodErrorParamsByCode.group_fee_too_small` carries no `paid` or `required`, because the newer
  rendering scales both figures into a variable-suffix unit that cannot be parsed back into a
  microAlgo count.

No mock can catch a drifted regex, because the regex gets tested against strings the test author
wrote, and the author makes the same wrong assumption the regex encodes. Only a real algod response
disagrees. `conformance/src/suites/submission/rejections.spec.ts` and
`conformance/src/suites/fees/pooling.spec.ts` are where that happens.

## Troubleshooting

- `LocalNet is not reachable at http://localhost:4001`. Docker isn't
  running, or the containers aren't up. `pnpm localnet:status`, then
  `pnpm localnet`.
- The indexer sits at round 0 and `suites/history` or `suites/accounts`
  time out waiting for a transaction to appear. This is a stale
  `algorandfoundation/conduit-localnet` image. Conduit logs
  (`docker logs algokit_sandbox_conduit`) show
  `unknown protocol ... this usually means you need to upgrade` and
  `error decoding block for round 1`: the pinned image predates the running
  algod's block format, so nothing is ever ingested and algod-only suites
  stay green while indexer-backed ones cannot pass.
  `docker pull algorandfoundation/conduit-localnet:latest` then
  `pnpm localnet:reset`. CI pulls fresh images, so this is a local-only
  trap.
- Stale containers or weird chain state: `pnpm localnet:reset` wipes and
  restarts LocalNet with a clean genesis. That changes the genesis hash, so if
  you have the app pointed at a custom LocalNet network config (Settings,
  Developer, Node Settings), re-enter it afterwards or use Fetch from node to
  pick up the new hash.
- An unresolvable-import crash on the very first test file, rather than a test
  failure: the `dist/` prerequisite above wasn't met. Run `pnpm run build` and
  try again.
- A single spec file crashes at collection with
  `Cannot find module '.../react-native-mmkv/.../createMMKV'`:
  `wallet-extension-provider`'s real build got loaded instead of the
  `vitest.setup.ts` mock. `vitest.config.ts` aliases it to
  `extensions/provider/src` for exactly this reason, so confirm that alias is
  still present if this resurfaces after a `vitest.config.ts` edit.
- A decoded-diff failure you don't understand: see "Reading a decoded-diff
  failure" above, and check the value types (`bigint` versus `number`, hex versus
  `(unset)`) before assuming the chain behaviour changed.
